import { NextRequest } from "next/server";
import { z } from "zod";
import { preflight, json, jsonError } from "@/lib/cors";
import { handle, requireUser, requireOrgMember } from "@/lib/auth";
import { db } from "@/lib/admin";
import { logAutomation } from "@/lib/log";
import { notify } from "@/lib/notify";

const Body = z.object({ orgId: z.string().min(1), leadId: z.string().min(1) });

export function OPTIONS(req: NextRequest): Promise<Response> {
  return Promise.resolve(preflight(req));
}

// POST /api/automations/lead-won — Lead → won: create client + project. Idempotent.
// Field names match the frontend (bridgebreak) Lead shape.
export const POST = handle(async (req: NextRequest) => {
  const user = await requireUser(req);
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return jsonError(req, "Invalid body: orgId, leadId required", 400);
  const { orgId, leadId } = parsed.data;
  await requireOrgMember(orgId, user.uid);
  const database = db();

  const leadSnap = await database.ref(`/orgs/${orgId}/leads/${leadId}`).get();
  const lead = leadSnap.val() as {
    name?: string; email?: string; phone?: string; company?: string;
    status?: string; source?: string; estimated_value?: number; owner_id?: string;
  } | null;
  if (!lead) return jsonError(req, "Lead not found", 404);
  if (lead.status !== "won") {
    await logAutomation(orgId, { name: "lead-won", status: "skipped", detail: `lead ${leadId} status is ${lead.status}` });
    return json(req, { clientId: null, projectId: null, skipped: true });
  }

  // Idempotency: reuse existing client/project created for this lead.
  const clientsSnap = await database.ref(`/orgs/${orgId}/clients`).get();
  const clients = (clientsSnap.val() ?? {}) as Record<string, { leadId?: string; id?: string }>;
  let clientId = Object.values(clients).find((c) => c.leadId === leadId)?.id ?? null;
  if (!clientId) {
    const ref = database.ref(`/orgs/${orgId}/clients`).push();
    await ref.set({
      id: ref.key, name: lead.name ?? "", email: lead.email ?? "", phone: lead.phone ?? null,
      company: lead.company ?? null, source: lead.source ?? "lead", leadId,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
    clientId = ref.key;
  }

  const projectsSnap = await database.ref(`/orgs/${orgId}/projects`).get();
  const projects = (projectsSnap.val() ?? {}) as Record<string, { leadId?: string; id?: string }>;
  let projectId = Object.values(projects).find((p) => p.leadId === leadId)?.id ?? null;
  if (!projectId) {
    const ref = database.ref(`/orgs/${orgId}/projects`).push();
    await ref.set({
      id: ref.key, workspace_id: orgId, client_id: clientId, title: `Project for ${lead.name ?? leadId}`,
      description: `Created automatically from won lead (${lead.company ?? ""})`.trim(),
      status: "pending", leadId,
      // Rich Project snapshots so the UI model renders without extra fetches.
      // Lead value goes to budget.est; estimated_cost stays empty.
      manual_client_name: lead.name ?? "",
      manual_client_email: lead.email ?? "",
      manual_client_company: lead.company ?? "",
      manual_client_phone: lead.phone ?? "",
      budget: { est: lead.estimated_value ?? 0, actual: 0 },
      progress_percentage: 0,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    });
    projectId = ref.key;
  }

  await logAutomation(orgId, { name: "lead-won", status: "ok", detail: `lead ${leadId} → client ${clientId}, project ${projectId}` });

  // Notify org admins (lead owner_id is a display string, not a uid).
  try {
    const usersSnap = await database.ref(`/orgs/${orgId}/users`).get();
    const users = Object.entries((usersSnap.val() ?? {}) as Record<string, { role?: string; email?: string }>)
      .filter(([, u]) => u.role === "admin").slice(0, 5);
    for (const [uid, admin] of users) {
      await notify({ orgId, uid, type: "lead_won", title: "Lead won", body: `${lead.name ?? "A lead"} was marked Won. Client and project created.`, link: "/clients", email: admin.email });
    }
  } catch {
    // notify() logs internally.
  }

  return json(req, { clientId, projectId });
});
