import { NextRequest } from "next/server";
import { z } from "zod";
import { preflight, json, jsonError } from "@/lib/cors";
import { handle, requireUser, requireOrgMember } from "@/lib/auth";
import { db } from "@/lib/admin";
import { logAutomation } from "@/lib/log";

const Body = z.object({ orgId: z.string().min(1), creditNoteId: z.string().min(1) });

export function OPTIONS(req: NextRequest): Promise<Response> {
  return Promise.resolve(preflight(req));
}

// POST /api/finance/credit-notes/apply — apply an issued credit note to its
// invoice in a transaction. Guards: issued-only (idempotent, no double
// apply), amount cannot exceed the remaining amount_due (never below 0).
// Fully credited invoices close as cancelled; otherwise status is preserved
// (partially_paid when payments exist). New RTDB paths only (creditNotes).
export const POST = handle(async (req: NextRequest) => {
  const user = await requireUser(req);
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return jsonError(req, "Invalid body: orgId, creditNoteId required", 400);
  const { orgId, creditNoteId } = parsed.data;
  await requireOrgMember(orgId, user.uid);
  const database = db();

  const cnSnap = await database.ref(`/orgs/${orgId}/creditNotes/${creditNoteId}`).get();
  const cn = cnSnap.val() as {
    invoiceId?: string; total?: number; amount?: number; taxAmount?: number; status?: string; number?: string;
  } | null;
  if (!cn) return jsonError(req, "Credit note not found", 404);
  if (cn.status === "applied") return json(req, { ok: true, alreadyApplied: true });
  if (cn.status !== "issued") return jsonError(req, `Credit note cannot be applied from status ${cn.status}`, 400);
  if (!cn.invoiceId) return jsonError(req, "Credit note has no invoice", 400);
  const creditTotal = typeof cn.total === "number" ? cn.total : (cn.amount ?? 0) + (cn.taxAmount ?? 0);
  if (!(creditTotal > 0)) return jsonError(req, "Credit note total must be positive", 400);

  const invRef = database.ref(`/orgs/${orgId}/invoices/${cn.invoiceId}`);
  const txn = await invRef.transaction((inv: Record<string, unknown> | null) => {
    if (!inv) return inv;
    const amount = typeof inv.amount === "number" ? inv.amount : 0;
    const paid = typeof inv.amount_paid === "number" ? inv.amount_paid : 0;
    const due = Math.max(0, typeof inv.amount_due === "number" ? inv.amount_due : amount - paid);
    if (creditTotal - due > 1e-9) return; // abort: exceeds remaining
    const newDue = Math.max(0, Math.round((due - creditTotal) * 100) / 100);
    return {
      ...inv,
      amount_due: newDue,
      status: newDue <= 0 ? (paid > 0 ? "paid" : "credited") : paid > 0 ? "partially_paid" : inv.status,
      updated_at: new Date().toISOString(),
    };
  });
  if (!txn.committed) return jsonError(req, "Credit exceeds the remaining invoice amount", 400);

  // Mark applied only if still issued (second guard against double-apply).
  const fresh = (await database.ref(`/orgs/${orgId}/creditNotes/${creditNoteId}`).get()).val() as { status?: string } | null;
  if (!fresh || fresh.status !== "issued") return json(req, { ok: true, alreadyApplied: true });
  await database.ref(`/orgs/${orgId}/creditNotes/${creditNoteId}`).update({
    status: "applied",
    appliedAt: new Date().toISOString(),
    appliedTotal: creditTotal,
    updatedAt: new Date().toISOString(),
  });
  await logAutomation(orgId, { name: "credit-note-applied", status: "ok", detail: `credit note ${creditNoteId} applied (${creditTotal})` });
  return json(req, { ok: true });
});
