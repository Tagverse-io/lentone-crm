import { NextRequest } from "next/server";
import { z } from "zod";
import { preflight, json, jsonError } from "@/lib/cors";
import { handle, requireUser, requireOrgMember } from "@/lib/auth";
import { notify, type NotifyType } from "@/lib/notify";
import { logAutomation } from "@/lib/log";

const Body = z.object({
  orgId: z.string().min(1),
  uid: z.string().min(1),
  type: z.enum(["lead_assigned", "lead_won", "followup_due", "followup_overdue", "quotation_accepted", "quotation_rejected", "invoice_created", "invoice_overdue", "payment_received", "task_assigned", "task_due_soon", "digest"]),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(2000),
  link: z.string().max(500).optional(),
  email: z.string().email().optional(),
});

export function OPTIONS(req: NextRequest): Promise<Response> {
  return Promise.resolve(preflight(req));
}

// POST /api/notifications/send — token-verified, Zod-validated fan-out.
export const POST = handle(async (req: NextRequest) => {
  const user = await requireUser(req);
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return jsonError(req, `Invalid body: ${parsed.error.issues.map((i) => i.message).join("; ")}`, 400);
  await requireOrgMember(parsed.data.orgId, user.uid);
  const res = await notify({ ...parsed.data, type: parsed.data.type as NotifyType });
  await logAutomation(parsed.data.orgId, { name: `notify:${parsed.data.type}`, status: "ok", emailSent: res.emailSent, emailError: res.emailError });
  return json(req, { ok: true, ...res });
});
