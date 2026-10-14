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

// POST /api/automations/lead-won — Lead → Won: create client + project. Idempotent.
export const POST = handle(async (req: NextRequest) => {
  const user = await requireUser(req);
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return jsonError(req, "Invalid body: orgId, leadId required", 400);
  const { orgId, leadId } = parsed.data;
  await requireOrgMember(orgId, user.uid);
  const database = db();

  const leadSnap = await database.ref(`/orgs/${orgId}/leads/${leadId}`).get();
  const lead = leadSnap.val() as { name?: string; email?: string; phone?: string; company?: string; stage?: string; value?: number; assignedTo?: string } | null;
  if (!lead) return jsonError(req, "Lead not found", 404);
  if (lead.stage !== "Won") {
    await logAutomation(orgId, { name: "lead-won", status: "skipped", detail: `lead ${leadId} stage is ${lead.stage}` });
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
      company: lead.company ?? null, source: "lead", leadId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
    clientId = ref.key;
  }

  const projectsSnap = await database.ref(`/orgs/${orgId}/projects`).get();
  const projects = (projectsSnap.val() ?? {}) as Record<string, { leadId?: string; id?: string }>;
  let projectId = Object.values(projects).find((p) => p.leadId === leadId)?.id ?? null;
  if (!projectId) {
    const ref = database.ref(`/orgs/${orgId}/projects`).push();
    await ref.set({
      id: ref.key, title: `Project for ${lead.name ?? leadId}`, clientId, clientName: lead.name ?? "",
      status: "not_started", progress: 0, leadId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
    projectId = ref.key;
  }

  await logAutomation(orgId, { name: "lead-won", status: "ok", detail: `lead ${leadId} → client ${clientId}, project ${projectId}` });

  // Notify the assignee (one email max, honours prefs; never crashes automation).
  try {
    if (lead.assignedTo) {
      const uSnap = await database.ref(`/orgs/${orgId}/users/${lead.assignedTo}`).get();
      const u = uSnap.val() as { email?: string } | null;
      await notify({ orgId, uid: lead.assignedTo, type: "lead_won", title: "Lead won", body: `${lead.name ?? "A lead"} was marked Won. Client and project created.`, link: "/clients", email: u?.email });
    }
  } catch {
    // notify() already logs email failures internally.
  }

  return json(req, { clientId, projectId });
});
