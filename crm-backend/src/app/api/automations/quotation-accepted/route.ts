import { NextRequest } from "next/server";
import { z } from "zod";
import { preflight, json, jsonError } from "@/lib/cors";
import { handle, requireUser, requireOrgMember } from "@/lib/auth";
import { db } from "@/lib/admin";
import { logAutomation } from "@/lib/log";
import { notify } from "@/lib/notify";
import { formatMoneyForOrg } from "@/lib/settings";
import { getOrgSettings } from "@/lib/settings";
import { nextNumber, dueDateFromSettings } from "@/lib/numbering";

const Body = z.object({ orgId: z.string().min(1), quotationId: z.string().min(1) });

export function OPTIONS(req: NextRequest): Promise<Response> {
  return Promise.resolve(preflight(req));
}

// POST /api/automations/quotation-accepted — create invoice (+ project if the
// quotation carries a truthy `create_project` flag). Idempotent via quote_id.
export const POST = handle(async (req: NextRequest) => {
  const user = await requireUser(req);
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return jsonError(req, "Invalid body: orgId, quotationId required", 400);
  const { orgId, quotationId } = parsed.data;
  await requireOrgMember(orgId, user.uid);
  const database = db();

  const qSnap = await database.ref(`/orgs/${orgId}/quotations/${quotationId}`).get();
  const q = qSnap.val() as {
    client_id?: string; client_name?: string;
    items?: { description: string; quantity: number; unit_price: number; total?: number }[];
    amount?: number; subtotal?: number; tax_amount?: number;
    status?: string; valid_until?: string; create_project?: boolean;
  } | null;
  if (!q) return jsonError(req, "Quotation not found", 404);
  if (q.status !== "accepted") {
    await logAutomation(orgId, { name: "quotation-accepted", status: "skipped", detail: `quotation ${quotationId} status is ${q.status}` });
    return json(req, { invoiceId: null, projectId: null, skipped: true });
  }

  const invoicesSnap = await database.ref(`/orgs/${orgId}/invoices`).get();
  const invoices = (invoicesSnap.val() ?? {}) as Record<string, { quote_id?: string; id?: string }>;
  let invoiceId = Object.values(invoices).find((i) => i.quote_id === quotationId)?.id ?? null;
  if (!invoiceId) {
    const s = await getOrgSettings(orgId);
    const total = q.amount ?? 0;
    const ref = database.ref(`/orgs/${orgId}/invoices`).push();
    await ref.set({
      id: ref.key, workspace_id: orgId, invoice_number: await nextNumber(orgId, "invoice"),
      client_id: q.client_id ?? null, client_name: q.client_name ?? null, quote_id: quotationId,
      items: q.items ?? [], subtotal: q.subtotal ?? total, tax_amount: q.tax_amount ?? 0,
      amount: total, currency: s.general.default_currency, amount_paid: 0, amount_due: total, status: "pending",
      issue_date: new Date().toISOString().slice(0, 10), due_date: await dueDateFromSettings(orgId),
      payment_terms: s.branding.default_payment_terms, terms: s.branding.default_terms, notes: s.branding.default_notes,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    });
    invoiceId = ref.key;
  }

  let projectId: string | null = null;
  if (q.create_project) {
    const projectsSnap = await database.ref(`/orgs/${orgId}/projects`).get();
    const projects = (projectsSnap.val() ?? {}) as Record<string, { quote_id?: string; id?: string }>;
    projectId = Object.values(projects).find((p) => p.quote_id === quotationId)?.id ?? null;
    if (!projectId) {
      const ref = database.ref(`/orgs/${orgId}/projects`).push();
      await ref.set({
        id: ref.key, workspace_id: orgId, title: `Project for ${q.client_name ?? quotationId}`,
        client_id: q.client_id ?? null, client_name: q.client_name ?? null,
        status: "pending", quote_id: quotationId,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      });
      projectId = ref.key;
    }
  }

  await logAutomation(orgId, { name: "quotation-accepted", status: "ok", detail: `quotation ${quotationId} → invoice ${invoiceId}${projectId ? `, project ${projectId}` : ""}` });

  try {
    const money = await formatMoneyForOrg(orgId, q.amount ?? 0);
    const usersSnap = await database.ref(`/orgs/${orgId}/users`).get();
    const users = Object.entries((usersSnap.val() ?? {}) as Record<string, { role?: string; email?: string }>)
      .filter(([, u]) => u.role === "admin").slice(0, 5);
    for (const [uid, admin] of users) {
      await notify({ orgId, uid, type: "quotation_accepted", title: "Quotation accepted", body: `${q.client_name ?? "A quotation"} (${money}) was accepted. Invoice ${invoiceId ? "created" : "already exists"}.`, link: "/quotes", email: admin.email });
    }
  } catch {
    // notify() logs internally.
  }

  return json(req, { invoiceId, projectId });
});
