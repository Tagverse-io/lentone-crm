import { NextRequest } from "next/server";
import { z } from "zod";
import { preflight, json, jsonError } from "@/lib/cors";
import { handle, requireUser, requireOrgMember } from "@/lib/auth";
import { syncGoogleEvents } from "@/lib/google";
import { logAutomation } from "@/lib/log";

const Body = z.object({ orgId: z.string().min(1) });

export function OPTIONS(req: NextRequest): Promise<Response> {
  return Promise.resolve(preflight(req));
}

// POST /api/google/sync — two-way sync: import Google events into Central Calendar.
export const POST = handle(async (req: NextRequest) => {
  const user = await requireUser(req);
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return jsonError(req, "Invalid body: orgId required", 400);
  await requireOrgMember(parsed.data.orgId, user.uid);
  try {
    const imported = await syncGoogleEvents(user.uid, parsed.data.orgId);
    await logAutomation(parsed.data.orgId, { name: "google:sync", status: "ok", detail: `imported ${imported}` });
    return json(req, { imported });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "sync failed";
    await logAutomation(parsed.data.orgId, { name: "google:sync", status: "error", detail: msg.slice(0, 200) });
    if (msg.includes("not connected")) return jsonError(req, "Google not connected. Connect first.", 409);
    return jsonError(req, "Google sync failed", 502);
  }
});
