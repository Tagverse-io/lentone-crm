import { NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { getAdminDatabase } from "@/lib/firebase-admin";
import { getServerEnv } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Vercel serverless cannot hold persistent WebSocket connections, so this
// SSE stream lives at most ~55s (see vercel.json maxDuration) and the client
// auto-reconnects; a 30s polling fallback covers any gap.

function authorized(req: NextRequest): boolean {
  let expected = "";
  try {
    expected = getServerEnv().APP_API_KEY;
  } catch {
    return false;
  }
  // SSE clients (EventSource) cannot set headers — accept ?key= too.
  const header = req.headers.get("authorization") ?? "";
  const headerMatch = header.match(/^Bearer\s+(.+)$/);
  const token = headerMatch?.[1] ?? req.nextUrl.searchParams.get("key") ?? "";
  if (!token) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function fingerprint(val: unknown): string {
  if (!val || typeof val !== "object") return "empty";
  return Object.entries(val as Record<string, { updatedAt?: string }>)
    .map(([id, v]) => `${id}:${v?.updatedAt ?? ""}`)
    .sort()
    .join("|");
}

/** GET /api/app/stream?workerId= — SSE stream of changes for that worker. */
export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  const workerId = req.nextUrl.searchParams.get("workerId");
  if (!workerId) {
    return new Response(JSON.stringify({ error: "workerId query param is missing" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const db = getAdminDatabase();
  const startedAt = Date.now();
  const MAX_MS = 55_000;

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (event: string, data: unknown) => {
        controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(enc.encode(`: ping ${new Date().toISOString()}\n\n`));
        } catch {
          // Stream closed.
        }
      }, 15_000);

      send("message", { type: "ping", at: new Date().toISOString() });
      let last = "";

      try {
        while (Date.now() - startedAt < MAX_MS) {
          const [tasksSnap, deliveriesSnap] = await Promise.all([
            db.ref("tasks").get(),
            db.ref("deliveries").get(),
          ]);
          const mine = (val: unknown, done: string) => {
            if (!val || typeof val !== "object") return {};
            return Object.fromEntries(
              Object.entries(val as Record<string, { workerId?: string; status?: string }>).filter(
                ([, v]) => v?.workerId === workerId && v?.status !== done,
              ),
            );
          };
          const fp = `${fingerprint(mine(tasksSnap.val(), "Done"))}##${fingerprint(mine(deliveriesSnap.val(), "Delivered"))}`;
          if (fp !== last) {
            last = fp;
            send("message", { type: "tasks", at: new Date().toISOString() });
          }
          await new Promise((r) => setTimeout(r, 5_000));
        }
      } catch {
        // Client disconnected — end the stream.
      } finally {
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
