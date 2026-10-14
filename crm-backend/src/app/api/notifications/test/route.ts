import { NextRequest } from "next/server";
import { preflight, json } from "@/lib/cors";
import { handle, requireUser } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { brand } from "@/brand.config";

export function OPTIONS(req: NextRequest): Promise<Response> {
  return Promise.resolve(preflight(req));
}

// POST /api/notifications/test — token-verified smoke test (in-app + email to self).
export const POST = handle(async (req: NextRequest) => {
  const user = await requireUser(req);
  const body = (await req.json().catch(() => ({}))) as { orgId?: string };
  const orgId = typeof body.orgId === "string" && body.orgId ? body.orgId : "default";
  const res = await notify({
    orgId,
    uid: user.uid,
    type: "digest",
    title: `Test from ${brand.appName}`,
    body: "If you see this in-app and by email, notifications are wired correctly. Check spam on first run.",
    link: "/settings",
    email: user.email,
  });
  return json(req, { ok: true, ...res });
});
