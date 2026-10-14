import { NextRequest } from "next/server";
import { z } from "zod";
import { preflight, json, jsonError } from "@/lib/cors";
import { handle, requireUser, requireOrgMember } from "@/lib/auth";
import { db } from "@/lib/admin";
import { logAutomation } from "@/lib/log";

const Body = z.object({ orgId: z.string().min(1), quotationId: z.string().min(1) });

export function OPTIONS(req: NextRequest): Promise<Response> {
  return Promise.resolve(preflight(req));
}

// POST /api/automations/quotation-accepted — create invoice (+ project if configured). Idempotent.
export const POST = handle(async (req: NextRequest) => {
  const user = await requireUser(req);
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return jsonError(req, "Invalid body: orgId, quotationId required", 400);
  const { orgId, quotationId } = parsed.data;
  await requireOrgMember(orgId, user.uid);
  const database = db();

  const qSnap = await database.ref(`/orgs/${orgId}/quotations/${quotationId}`).get();
  const q = qSnap.val() as {
    clientId?: string; clientName?: string; items?: { description: string; quantity: number; unitPrice: number }[];
    subtotal?: number; taxAmount?: number; total?: number; status?: string; createProjectOnAccept?: boolean;
  } | null;
  if (!q) return jsonError(req, "Quotation not found", 404);
  if (q.status !== "accepted") {
    await logAutomation(orgId, { name: "quotation-accepted", status: "skipped", detail: `quotation ${quotationId} status is ${q.status}` });
    return json(req, { invoiceId: null, projectId: null, skipped: true });
  }

  const invoicesSnap = await database.ref(`/orgs/${orgId}/invoices`).get();
  const invoices = (invoicesSnap.val() ?? {}) as Record<string, { quotationId?: string; id?: string }>;
  let invoiceId = Object.values(invoices).find((i) => i.quotationId === quotationId)?.id ?? null;
  if (!invoiceId) {
    const total = q.total ?? 0;
    const due = new Date();
    due.setDate(due.getDate() + 14);
    const ref = database.ref(`/orgs/${orgId}/invoices`).push();
    await ref.set({
      id: ref.key, number: `INV-${Date.now().toString(36).toUpperCase()}`, clientId: q.clientId ?? null,
      clientName: q.clientName ?? null, quotationId, items: q.items ?? [], subtotal: q.subtotal ?? total,
      taxAmount: q.taxAmount ?? 0, total, amountPaid: 0, amountDue: total, status: "sent",
      issueDate: new Date().toISOString().slice(0, 10), dueDate: due.toISOString().slice(0, 10),
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
    invoiceId = ref.key;
  }

  let projectId: string | null = null;
  if (q.createProjectOnAccept) {
    const projectsSnap = await database.ref(`/orgs/${orgId}/projects`).get();
    const projects = (projectsSnap.val() ?? {}) as Record<string, { quotationId?: string; id?: string }>;
    projectId = Object.values(projects).find((p) => p.quotationId === quotationId)?.id ?? null;
    if (!projectId) {
      const ref = database.ref(`/orgs/${orgId}/projects`).push();
      await ref.set({
        id: ref.key, title: `Project for ${q.clientName ?? quotationId}`, clientId: q.clientId ?? null,
        clientName: q.clientName ?? null, status: "not_started", progress: 0, quotationId,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      });
      projectId = ref.key;
    }
  }

  await logAutomation(orgId, { name: "quotation-accepted", status: "ok", detail: `quotation ${quotationId} → invoice ${invoiceId}${projectId ? `, project ${projectId}` : ""}` });
  return json(req, { invoiceId, projectId });
});
