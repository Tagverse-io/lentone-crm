import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getEnv } from "@/lib/env";
import { auth as adminAuth } from "@/lib/admin";
import { preflight, withCors } from "@/lib/cors";
import { MCP_TOOLS, type McpAuth } from "@/lib/mcp-tools";

// ---------------------------------------------------------------------------
// MCP endpoint (Streamable HTTP): POST /api/mcp with JSON-RPC 2.0 bodies.
// Every backend capability is exposed as an MCP tool (mirrors /api/*).
// Auth: `Authorization: Bearer <CRON_SECRET>` (service mode) or a Firebase
// ID token (user mode — membership checked per org).
// Connect from MCP clients (e.g. Claude, Inspector) with this URL.
// ---------------------------------------------------------------------------

const PROTOCOL_VERSION = "2025-06-18";

const RpcSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string(), z.number()]).optional(),
  method: z.string(),
  params: z.record(z.string(), z.unknown()).optional(),
});

async function resolveAuth(req: NextRequest): Promise<McpAuth> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) throw new Error("Missing Authorization Bearer token");
  if (token === getEnv().CRON_SECRET) return { mode: "service" };
  const decoded = await adminAuth().verifyIdToken(token);
  return { mode: "user", uid: decoded.uid, email: decoded.email };
}

function rpcOk(req: NextRequest, id: unknown, result: unknown): NextResponse {
  return withCors(req, NextResponse.json({ jsonrpc: "2.0", id: id ?? null, result }));
}

function rpcErr(req: NextRequest, id: unknown, code: number, message: string): NextResponse {
  return withCors(req, NextResponse.json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } }));
}

export function OPTIONS(req: NextRequest): Promise<Response> {
  return Promise.resolve(preflight(req));
}

export function GET(req: NextRequest): Promise<Response> {
  // Streamable HTTP: server-initiated SSE streams not implemented.
  return Promise.resolve(
    withCors(req, new NextResponse("Method Not Allowed: use POST with JSON-RPC", { status: 405 })),
  );
}

export function DELETE(req: NextRequest): Promise<Response> {
  return Promise.resolve(
    withCors(req, new NextResponse("Method Not Allowed", { status: 405 })),
  );
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return rpcErr(req, null, -32700, "Parse error");
  }
  const parsed = RpcSchema.safeParse(body);
  if (!parsed.success) return rpcErr(req, null, -32600, "Invalid Request");
  const { id, method, params } = parsed.data;

  if (method === "initialize") {
    return rpcOk(req, id, {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: { name: "tsk-crm", version: "1.0.0" },
    });
  }
  if (method === "notifications/initialized" || method === "notifications/cancelled") {
    return new NextResponse(null, { status: 202 });
  }
  if (method === "ping") {
    return rpcOk(req, id, {});
  }
  if (method === "tools/list") {
    return rpcOk(req, id, {
      tools: MCP_TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })),
    });
  }
  if (method === "tools/call") {
    let auth: McpAuth;
    try {
      auth = await resolveAuth(req);
    } catch {
      return rpcErr(req, id, -32001, "Unauthorized: Bearer CRON_SECRET or Firebase ID token required");
    }
    const call = z.object({ name: z.string(), arguments: z.record(z.string(), z.unknown()).optional() }).safeParse(params ?? {});
    if (!call.success) return rpcErr(req, id, -32602, "Invalid params: name + arguments required");
    const tool = MCP_TOOLS.find((t) => t.name === call.data.name);
    if (!tool) return rpcErr(req, id, -32602, `Unknown tool: ${call.data.name}`);
    try {
      const out = await tool.run(call.data.arguments ?? {}, auth);
      return rpcOk(req, id, {
        content: [{ type: "text", text: JSON.stringify(out.data ?? { ok: out.ok }) }],
        isError: !out.ok,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Tool failed";
      if (msg === "Not a member of this org") return rpcErr(req, id, -32001, msg);
      return rpcOk(req, id, { content: [{ type: "text", text: JSON.stringify({ ok: false, error: msg.slice(0, 500) }) }], isError: true });
    }
  }
  return rpcErr(req, id, -32601, `Method not found: ${method}`);
}
