import { NextRequest } from "next/server";
import { z } from "zod";
import { preflight, json, jsonError } from "@/lib/cors";
import { handle, requireUser, requireOrgMember } from "@/lib/auth";
import { db } from "@/lib/admin";
import { logAutomation } from "@/lib/log";
import { notify } from "@/lib/notify";
import { formatMoneyForOrg } from "@/lib/settings";

const Body = z.object({ orgId: z.string().min(1), paymentId: z.string().min(1) });

export function OPTIONS(req: NextRequest): Promise<Response> {
  return Promise.resolve(preflight(req));
}

// POST /api/automations/payment-received — recompute invoice totals from ALL
// payments (idempotent under retries) and update status. Field names match the
// frontend (bridgebreak) Invoice/Payment shapes.
export const POST = handle(async (req: NextRequest) => {
  const user = await requireUser(req);
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return jsonError(req, "Invalid body: orgId, paymentId required", 400);
  const { orgId, paymentId } = parsed.data;
  await requireOrgMember(orgId, user.uid);
  const database = db();

  const resolvePayment = async (pid: string): Promise<{ invoice_id?: string; amount?: number } | null> => {
    const direct = await database.ref(`/orgs/${orgId}/payments/${pid}`).get();
    if (direct.exists()) return direct.val() as { invoice_id?: string; amount?: number };
    // Normalized payments store payment_id but push-key ids; scan as fallback.
    const all = await database.ref(`/orgs/${orgId}/payments`).get();
    const list = Object.entries((all.val() ?? {}) as Record<string, { payment_id?: string; invoice_id?: string; amount?: number }>);
    return list.find(([, p]) => p.payment_id === pid)?.[1] ?? null;
  };

  const payment = await resolvePayment(paymentId);
  if (!payment?.invoice_id) return jsonError(req, "Payment or invoice not found", 404);

  const invRef = database.ref(`/orgs/${orgId}/invoices/${payment.invoice_id}`);
  const invSnap = await invRef.get();
  const inv = invSnap.val() as { amount?: number; client_name?: string } | null;
  if (!inv) return jsonError(req, "Invoice not found", 404);

  const allSnap = await database.ref(`/orgs/${orgId}/payments`).get();
  const all = Object.values((allSnap.val() ?? {}) as Record<string, {
    invoice_id?: string; amount?: number; status?: string; creditNoteId?: string; credit_note_id?: string;
  }>);
  const cnSnap = await database.ref(`/orgs/${orgId}/creditNotes`).get();
  const cnEntries = Object.entries((cnSnap.val() ?? {}) as Record<string, { invoiceId?: string; status?: string; appliedTotal?: number; total?: number; id?: string }>);
  const appliedForInvoice = cnEntries
    .filter(([, c]) => c.invoiceId === payment.invoice_id && c.status === "applied")
    .map(([key, c]) => ({ ...c, id: c.id ?? key }));
  const appliedIds = new Set(appliedForInvoice.map((c) => String(c.id ?? "")));
  const credited = appliedForInvoice.reduce((s, c) => s + (c.appliedTotal ?? c.total ?? 0), 0);
  // Only completed payments count toward amount_paid. Refunded (and other
  // non-completed) payments never count as collections. A payment linked to a
  // credit note is the refund leg of an applied note — the note already
  // reduced the invoice, so it must not reduce it twice.
  const paid = all
    .filter((p) => p.invoice_id === payment.invoice_id)
    .filter((p) => (p.status ?? "completed") === "completed")
    .filter((p) => {
      const link = p.creditNoteId ?? p.credit_note_id;
      return !link || !appliedIds.has(String(link));
    })
    .reduce((s, p) => s + (p.amount ?? 0), 0);
  const total = inv.amount ?? 0;
  const due = Math.max(0, Math.round((total - paid - credited) * 100) / 100);
  const status = due <= 0 ? (paid > 0 ? "paid" : credited > 0 ? "credited" : "paid") : paid > 0 || credited > 0 ? "partially_paid" : "pending";
  await invRef.update({ amount_paid: paid, amount_due: due, status, updated_at: new Date().toISOString() });

  await logAutomation(orgId, { name: "payment-received", status: "ok", detail: `invoice ${payment.invoice_id} → ${status}, paid ${paid}/${total}, credited ${credited}` });

  try {
    const money = await formatMoneyForOrg(orgId, payment.amount ?? 0);
    await notify({ orgId, uid: user.uid, type: "payment_received", title: "Payment received", body: `Payment of ${money} recorded for ${inv.client_name ?? "invoice"}.`, link: "/payments", email: user.email });
  } catch {
    // notify() logs internally.
  }

  return json(req, { ok: true, status, amountPaid: paid, amountDue: due });
});
