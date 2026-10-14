import { NextRequest } from "next/server";
import { preflight, json, jsonError } from "@/lib/cors";
import { handle, requireUser, requireOrgMember } from "@/lib/auth";
import { listGoogleEvents } from "@/lib/google";

export function OPTIONS(req: NextRequest): Promise<Response> {
  return Promise.resolve(preflight(req));
}

// GET /api/google/events?orgId=... — reads the user's Google Calendar (token-verified).
export const GET = handle(async (req: NextRequest) => {
  const user = await requireUser(req);
  const orgId = new URL(req.url).searchParams.get("orgId") ?? "default";
  await requireOrgMember(orgId, user.uid);
  void orgId;
  try {
    const events = await listGoogleEvents(user.uid);
    return json(req, { events });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Google read failed";
    if (msg.includes("not connected")) return jsonError(req, "Google not connected. Connect first.", 409);
    return jsonError(req, "Failed to read Google Calendar", 502);
  }
});
