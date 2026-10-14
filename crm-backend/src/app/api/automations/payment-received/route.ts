import { NextRequest } from "next/server";
import { z } from "zod";
import { preflight, json, jsonError } from "@/lib/cors";
import { handle, requireUser, requireOrgMember } from "@/lib/auth";
import { db } from "@/lib/admin";
import { logAutomation } from "@/lib/log";
import { notify } from "@/lib/notify";

const Body = z.object({ orgId: z.string().min(1), paymentId: z.string().min(1) });

export function OPTIONS(req: NextRequest): Promise<Response> {
  return Promise.resolve(preflight(req));
}

// POST /api/automations/payment-received — update invoice status + totals. Idempotent.
export const POST = handle(async (req: NextRequest) => {
  const user = await requireUser(req);
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return jsonError(req, "Invalid body: orgId, paymentId required", 400);
  const { orgId, paymentId } = parsed.data;
  await requireOrgMember(orgId, user.uid);
  const database = db();

  const pSnap = await database.ref(`/orgs/${orgId}/payments/${paymentId}`).get();
  const payment = pSnap.val() as { invoiceId?: string; amount?: number } | null;
  if (!payment?.invoiceId) return jsonError(req, "Payment or invoice not found", 404);

  const invRef = database.ref(`/orgs/${orgId}/invoices/${payment.invoiceId}`);
  const invSnap = await invRef.get();
  const inv = invSnap.val() as { total?: number; clientName?: string } | null;
  if (!inv) return jsonError(req, "Invoice not found", 404);

  // Recompute from ALL payments for this invoice → idempotent under retries/double-posts.
  const allSnap = await database.ref(`/orgs/${orgId}/payments`).get();
  const all = Object.values((allSnap.val() ?? {}) as Record<string, { invoiceId?: string; amount?: number }>);
  const paid = all.filter((p) => p.invoiceId === payment.invoiceId).reduce((s, p) => s + (p.amount ?? 0), 0);
  const total = inv.total ?? 0;
  const due = Math.max(0, total - paid);
  const status = due <= 0 ? "paid" : paid > 0 ? "partial" : "sent";
  await invRef.update({ amountPaid: paid, amountDue: due, status, updatedAt: new Date().toISOString() });

  await logAutomation(orgId, { name: "payment-received", status: "ok", detail: `invoice ${payment.invoiceId} → ${status}, paid ${paid}/${total}` });

  try {
    await notify({ orgId, uid: user.uid, type: "payment_received", title: "Payment received", body: `Payment of ${payment.amount ?? 0} recorded for ${inv.clientName ?? "invoice"}.`, link: "/payments", email: user.email });
  } catch {
    // notify() logs internally.
  }

  return json(req, { ok: true, status, amountPaid: paid, amountDue: due });
});
