import { z } from "zod";
import { db } from "./admin";
import { logAutomation } from "./log";
import { notify, type NotifyType } from "./notify";
import { connectUrl, listGoogleEvents, syncGoogleEvents } from "./google";
import { EntitySchema, crudList, crudGet, crudCreate, crudUpdate, crudDelete, type EntityName } from "./crud";

// ---------------------------------------------------------------------------
// MCP tool implementations. Same capabilities as the REST routes, callable
// as Model Context Protocol tools (see /api/mcp). Auth is resolved by the
// route: service mode (CRON_SECRET bearer) or user mode (Firebase ID token).
// ---------------------------------------------------------------------------

export interface McpAuth {
  mode: "service" | "user";
  uid?: string;
  email?: string;
}

async function orgRole(orgId: string, uid: string): Promise<string | null> {
  const snap = await db().ref(`/orgs/${orgId}/users/${uid}/role`).get();
  return (snap.val() as string | null) ?? null;
}

async function requireMember(orgId: string, auth: McpAuth): Promise<string> {
  if (auth.mode === "service") return "admin";
  if (!auth.uid) throw new Error("Not authenticated");
  const role = await orgRole(orgId, auth.uid);
  if (!role) throw new Error("Not a member of this org");
  return role;
}

export interface ToolResult {
  ok: boolean;
  data?: unknown;
  error?: string;
}

const OrgLead = z.object({ orgId: z.string().min(1), leadId: z.string().min(1) });
const OrgQuotation = z.object({ orgId: z.string().min(1), quotationId: z.string().min(1) });
const OrgPayment = z.object({ orgId: z.string().min(1), paymentId: z.string().min(1) });
const OrgOnly = z.object({ orgId: z.string().min(1) });
const UidOnly = z.object({ uid: z.string().min(1) });
const NotifyArgs = z.object({
  orgId: z.string().min(1),
  uid: z.string().min(1),
  type: z.enum(["lead_assigned", "lead_won", "followup_due", "followup_overdue", "quotation_accepted", "quotation_rejected", "invoice_created", "invoice_overdue", "payment_received", "task_assigned", "task_due_soon", "digest"]),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(2000),
  link: z.string().max(500).optional(),
  email: z.string().email().optional(),
});

async function toolLeadWon(args: unknown, auth: McpAuth): Promise<ToolResult> {
  const { orgId, leadId } = OrgLead.parse(args);
  await requireMember(orgId, auth);
  const database = db();
  const lead = (await database.ref(`/orgs/${orgId}/leads/${leadId}`).get()).val() as {
    name?: string; email?: string; phone?: string; company?: string; status?: string; source?: string;
  } | null;
  if (!lead) return { ok: false, error: "Lead not found" };
  if (lead.status !== "won") {
    await logAutomation(orgId, { name: "lead-won", status: "skipped", detail: `status is ${lead.status}` });
    return { ok: true, data: { skipped: true } };
  }
  const clients = ((await database.ref(`/orgs/${orgId}/clients`).get()).val() ?? {}) as Record<string, { leadId?: string; id?: string }>;
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
  const projects = ((await database.ref(`/orgs/${orgId}/projects`).get()).val() ?? {}) as Record<string, { leadId?: string; id?: string }>;
  let projectId = Object.values(projects).find((p) => p.leadId === leadId)?.id ?? null;
  if (!projectId) {
    const ref = database.ref(`/orgs/${orgId}/projects`).push();
    await ref.set({
      id: ref.key, workspace_id: orgId, client_id: clientId, title: `Project for ${lead.name ?? leadId}`,
      description: `Created automatically from won lead (${lead.company ?? ""})`.trim(),
      status: "pending", leadId, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    });
    projectId = ref.key;
  }
  await logAutomation(orgId, { name: "lead-won", status: "ok", detail: `lead ${leadId} → client ${clientId}, project ${projectId}` });
  return { ok: true, data: { clientId, projectId } };
}

async function toolQuotationAccepted(args: unknown, auth: McpAuth): Promise<ToolResult> {
  const { orgId, quotationId } = OrgQuotation.parse(args);
  await requireMember(orgId, auth);
  const database = db();
  const q = (await database.ref(`/orgs/${orgId}/quotations/${quotationId}`).get()).val() as {
    client_id?: string; client_name?: string;
    items?: { description: string; quantity: number; unit_price: number }[];
    amount?: number; subtotal?: number; tax_amount?: number; status?: string; create_project?: boolean;
  } | null;
  if (!q) return { ok: false, error: "Quotation not found" };
  if (q.status !== "accepted") {
    await logAutomation(orgId, { name: "quotation-accepted", status: "skipped", detail: `status is ${q.status}` });
    return { ok: true, data: { skipped: true } };
  }
  const invoices = ((await database.ref(`/orgs/${orgId}/invoices`).get()).val() ?? {}) as Record<string, { quote_id?: string; id?: string }>;
  let invoiceId = Object.values(invoices).find((i) => i.quote_id === quotationId)?.id ?? null;
  if (!invoiceId) {
    const total = q.amount ?? 0;
    const due = new Date();
    due.setDate(due.getDate() + 14);
    const ref = database.ref(`/orgs/${orgId}/invoices`).push();
    await ref.set({
      id: ref.key, workspace_id: orgId, invoice_number: `INV-${Date.now().toString(36).toUpperCase()}`,
      client_id: q.client_id ?? null, client_name: q.client_name ?? null, quote_id: quotationId,
      items: q.items ?? [], subtotal: q.subtotal ?? total, tax_amount: q.tax_amount ?? 0,
      amount: total, currency: "USD", amount_paid: 0, amount_due: total, status: "pending",
      issue_date: new Date().toISOString().slice(0, 10), due_date: due.toISOString().slice(0, 10),
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    });
    invoiceId = ref.key;
  }
  let projectId: string | null = null;
  if (q.create_project) {
    const projects = ((await database.ref(`/orgs/${orgId}/projects`).get()).val() ?? {}) as Record<string, { quote_id?: string; id?: string }>;
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
  await logAutomation(orgId, { name: "quotation-accepted", status: "ok", detail: `quotation ${quotationId} → invoice ${invoiceId}` });
  return { ok: true, data: { invoiceId, projectId } };
}

async function toolPaymentReceived(args: unknown, auth: McpAuth): Promise<ToolResult> {
  const { orgId, paymentId } = OrgPayment.parse(args);
  await requireMember(orgId, auth);
  const database = db();
  const direct = await database.ref(`/orgs/${orgId}/payments/${paymentId}`).get();
  let payment = (direct.exists() ? direct.val() : null) as { invoice_id?: string; amount?: number } | null;
  if (!payment) {
    const all = ((await database.ref(`/orgs/${orgId}/payments`).get()).val() ?? {}) as Record<string, { payment_id?: string; invoice_id?: string; amount?: number }>;
    payment = Object.values(all).find((p) => p.payment_id === paymentId) ?? null;
  }
  if (!payment?.invoice_id) return { ok: false, error: "Payment or invoice not found" };
  const invRef = database.ref(`/orgs/${orgId}/invoices/${payment.invoice_id}`);
  const inv = (await invRef.get()).val() as { amount?: number; client_name?: string } | null;
  if (!inv) return { ok: false, error: "Invoice not found" };
  const all = Object.values(((await database.ref(`/orgs/${orgId}/payments`).get()).val() ?? {}) as Record<string, { invoice_id?: string; amount?: number }>);
  const paid = all.filter((p) => p.invoice_id === payment?.invoice_id).reduce((s, p) => s + (p.amount ?? 0), 0);
  const total = inv.amount ?? 0;
  const due = Math.max(0, total - paid);
  const status = due <= 0 ? "paid" : paid > 0 ? "partially_paid" : "pending";
  await invRef.update({ amount_paid: paid, amount_due: due, status, updated_at: new Date().toISOString() });
  await logAutomation(orgId, { name: "payment-received", status: "ok", detail: `invoice ${payment.invoice_id} → ${status}` });
  return { ok: true, data: { status, amountPaid: paid, amountDue: due } };
}

async function listOrgIds(): Promise<string[]> {
  const snap = await db().ref("/orgs").get();
  return Object.keys((snap.val() ?? {}) as Record<string, unknown>);
}

async function toolOverdue(auth: McpAuth): Promise<ToolResult> {
  if (auth.mode !== "service") throw new Error("Service token required");
  const database = db();
  const today = new Date().toISOString().slice(0, 10);
  let marked = 0;
  let followUps = 0;
  for (const orgId of await listOrgIds()) {
    const invoices = Object.entries(((await database.ref(`/orgs/${orgId}/invoices`).get()).val() ?? {}) as Record<string, {
      status?: string; due_date?: string; amount_due?: number; invoice_number?: string; client_name?: string;
    }>);
    const existingFu = new Set(Object.values(((await database.ref(`/orgs/${orgId}/followUps`).get()).val() ?? {}) as Record<string, { invoiceId?: string }>).map((f) => f.invoiceId).filter(Boolean));
    let processed = 0;
    for (const [id, inv] of invoices) {
      if (processed >= 25) break;
      if ((inv.status === "pending" || inv.status === "partially_paid") && (inv.due_date ?? "") < today && (inv.amount_due ?? 0) > 0) {
        await database.ref(`/orgs/${orgId}/invoices/${id}`).update({ status: "overdue", updated_at: new Date().toISOString() });
        marked++;
        if (!existingFu.has(id)) {
          const ref = database.ref(`/orgs/${orgId}/followUps`).push();
          await ref.set({
            id: ref.key, invoiceId: id, title: `Collect overdue ${inv.invoice_number ?? id}`,
            notes: `${inv.client_name ?? ""} owes ${inv.amount_due ?? 0}`, dueAt: new Date().toISOString(),
            done: false, createdAt: new Date().toISOString(),
          });
          followUps++;
        }
        processed++;
      }
    }
    await logAutomation(orgId, { name: "overdue", status: "ok", detail: `marked ${marked}, follow-ups ${followUps}` });
  }
  return { ok: true, data: { marked, followUps } };
}

async function toolDigest(auth: McpAuth): Promise<ToolResult> {
  if (auth.mode !== "service") throw new Error("Service token required");
  const database = db();
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  let emailed = 0;
  for (const orgId of await listOrgIds()) {
    const [usersSnap, tasksSnap, fuSnap, invSnap] = await Promise.all([
      database.ref(`/orgs/${orgId}/users`).get(),
      database.ref(`/orgs/${orgId}/tasks`).get(),
      database.ref(`/orgs/${orgId}/followUps`).get(),
      database.ref(`/orgs/${orgId}/invoices`).get(),
    ]);
    const users = Object.entries((usersSnap.val() ?? {}) as Record<string, { email?: string }>);
    const tasks = Object.values((tasksSnap.val() ?? {}) as Record<string, { assignee?: string; due_date?: string; status?: string; title?: string }>);
    const fus = Object.values((fuSnap.val() ?? {}) as Record<string, { assignedTo?: string; dueAt?: string; done?: boolean; title?: string }>);
    const overdueCount = Object.values((invSnap.val() ?? {}) as Record<string, { status?: string }>).filter((i) => i.status === "overdue").length;
    for (const [uid, u] of users) {
      const myTasks = tasks.filter((t) => t.assignee === uid && t.status !== "done" && (t.due_date ?? "") <= tomorrow);
      const myFus = fus.filter((f) => !f.done && (!f.assignedTo || f.assignedTo === uid) && (f.dueAt ?? "").slice(0, 10) <= today);
      if (myTasks.length === 0 && myFus.length === 0 && overdueCount === 0) continue;
      const lines = [
        ...myTasks.map((t) => `• Task: ${t.title ?? "(untitled)"} (due ${t.due_date ?? "?"})`),
        ...myFus.map((f) => `• Follow-up: ${f.title ?? "(untitled)"}`),
        ...(overdueCount > 0 ? [`• ${overdueCount} overdue invoice(s)`] : []),
      ];
      try {
        const res = await notify({
          orgId, uid, type: "digest", title: "Daily digest",
          body: `Today: ${myTasks.length} task(s) due, ${myFus.length} follow-up(s) due, ${overdueCount} overdue invoice(s).\n${lines.slice(0, 10).join("\n")}`,
          link: "/dashboard", email: u.email,
        });
        if (res.emailSent) emailed++;
      } catch {
        // notify() logs internally.
      }
    }
    await logAutomation(orgId, { name: "digest", status: "ok", detail: `emailed ${emailed}` });
  }
  return { ok: true, data: { emailed } };
}

async function toolGoogleConnect(args: unknown, auth: McpAuth): Promise<ToolResult> {
  const uid = auth.mode === "user" && auth.uid ? auth.uid : UidOnly.parse(args).uid;
  return { ok: true, data: { url: connectUrl(uid) } };
}

async function toolGoogleEvents(args: unknown, auth: McpAuth): Promise<ToolResult> {
  const uid = auth.mode === "user" && auth.uid ? auth.uid : UidOnly.parse(args).uid;
  try {
    const events = await listGoogleEvents(uid);
    return { ok: true, data: { events } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Google read failed" };
  }
}

async function toolGoogleSync(args: unknown, auth: McpAuth): Promise<ToolResult> {
  const parsed = z.object({ orgId: z.string().min(1), uid: z.string().min(1).optional() }).parse(args);
  const uid = auth.mode === "user" && auth.uid ? auth.uid : parsed.uid;
  if (!uid) return { ok: false, error: "uid required" };
  await requireMember(parsed.orgId, auth);
  try {
    const imported = await syncGoogleEvents(uid, parsed.orgId);
    await logAutomation(parsed.orgId, { name: "google:sync", status: "ok", detail: `imported ${imported}` });
    return { ok: true, data: { imported } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Google sync failed" };
  }
}

async function toolNotify(args: unknown, auth: McpAuth): Promise<ToolResult> {
  const parsed = NotifyArgs.parse(args);
  await requireMember(parsed.orgId, auth);
  const res = await notify({ ...parsed, type: parsed.type as NotifyType });
  await logAutomation(parsed.orgId, { name: `notify:${parsed.type}`, status: "ok", emailSent: res.emailSent, emailError: res.emailError });
  return { ok: true, data: res };
}

const CrudBase = z.object({ entity: EntitySchema, orgId: z.string().min(1) });

async function toolCrudList(args: unknown, auth: McpAuth): Promise<ToolResult> {
  const { entity, orgId } = CrudBase.parse(args);
  await requireMember(orgId, auth);
  return { ok: true, data: { items: await crudList(orgId, entity as EntityName) } };
}

async function toolCrudGet(args: unknown, auth: McpAuth): Promise<ToolResult> {
  const { entity, orgId, id } = CrudBase.extend({ id: z.string().min(1) }).parse(args);
  await requireMember(orgId, auth);
  const item = await crudGet(orgId, entity as EntityName, id);
  if (!item) return { ok: false, error: "Not found" };
  return { ok: true, data: { item } };
}

async function toolCrudCreate(args: unknown, auth: McpAuth): Promise<ToolResult> {
  const { entity, orgId, data } = CrudBase.extend({ data: z.record(z.string(), z.unknown()) }).parse(args);
  await requireMember(orgId, auth);
  try {
    return { ok: true, data: { item: await crudCreate(orgId, entity as EntityName, data) } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Create failed" };
  }
}

async function toolCrudUpdate(args: unknown, auth: McpAuth): Promise<ToolResult> {
  const { entity, orgId, id, data } = CrudBase.extend({ id: z.string().min(1), data: z.record(z.string(), z.unknown()) }).parse(args);
  await requireMember(orgId, auth);
  const item = await crudUpdate(orgId, entity as EntityName, id, data);
  if (!item) return { ok: false, error: "Not found" };
  return { ok: true, data: { item } };
}

async function toolCrudDelete(args: unknown, auth: McpAuth): Promise<ToolResult> {
  const { entity, orgId, id } = CrudBase.extend({ id: z.string().min(1) }).parse(args);
  await requireMember(orgId, auth);
  const deleted = await crudDelete(orgId, entity as EntityName, id);
  if (!deleted) return { ok: false, error: "Not found" };
  return { ok: true, data: { deleted: true } };
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  run: (args: unknown, auth: McpAuth) => Promise<ToolResult>;
}

const obj = (props: Record<string, Record<string, unknown>>, required: string[]) => ({
  type: "object",
  properties: props,
  required,
  additionalProperties: false,
});
const str = (description: string) => ({ type: "string", description });

export const MCP_TOOLS: McpTool[] = [
  { name: "health", description: "Backend liveness check.", inputSchema: obj({}, []), run: async () => ({ ok: true, data: { service: "crm-backend" } }) },
  { name: "google_connect", description: "Get the Google OAuth consent URL for a user (open it to connect Calendar).", inputSchema: obj({ uid: str("Firebase uid (service mode only; user mode uses the token)") }, []), run: toolGoogleConnect },
  { name: "google_events", description: "List upcoming Google Calendar events for the connected user.", inputSchema: obj({ uid: str("Firebase uid (service mode only)") }, []), run: toolGoogleEvents },
  { name: "google_sync", description: "Import upcoming Google events into the org Central Calendar (idempotent).", inputSchema: obj({ orgId: str("Org id"), uid: str("Firebase uid (service mode only)") }, ["orgId"]), run: toolGoogleSync },
  { name: "lead_won", description: "Lead moved to Won: create client + project (idempotent).", inputSchema: obj({ orgId: str("Org id"), leadId: str("Lead id") }, ["orgId", "leadId"]), run: toolLeadWon },
  { name: "quotation_accepted", description: "Quotation accepted: create invoice, plus project if configured (idempotent).", inputSchema: obj({ orgId: str("Org id"), quotationId: str("Quotation id") }, ["orgId", "quotationId"]), run: toolQuotationAccepted },
  { name: "payment_received", description: "Payment recorded: recompute invoice totals/status (idempotent).", inputSchema: obj({ orgId: str("Org id"), paymentId: str("Payment id (RTDB key or payment_id)") }, ["orgId", "paymentId"]), run: toolPaymentReceived },
  { name: "run_overdue", description: "Mark past-due invoices overdue and create follow-ups (service token only).", inputSchema: obj({}, []), run: (a, auth) => toolOverdue(auth) },
  { name: "run_digest", description: "Send the daily digest (tasks/follow-ups/overdue) to every user (service token only).", inputSchema: obj({}, []), run: (a, auth) => toolDigest(auth) },
  { name: "send_notification", description: "Fan out an in-app notification plus email honouring user prefs.", inputSchema: obj({ orgId: str("Org id"), uid: str("Recipient uid"), type: str("Event type"), title: str("Title (max 200)"), body: str("Body (max 2000)"), link: str("App link, optional"), email: str("Recipient email, optional") }, ["orgId", "uid", "type", "title", "body"]), run: toolNotify },
  { name: "crud_list", description: "List all records of an entity (leads, clients, contacts, followUps, quotations, invoices, payments, projects, tasks, socialAccounts, posts, videoProductions, events, notifications, users, automationsLog, roles).", inputSchema: obj({ entity: str("Entity name"), orgId: str("Org id") }, ["entity", "orgId"]), run: toolCrudList },
  { name: "crud_get", description: "Get one record by id.", inputSchema: obj({ entity: str("Entity name"), orgId: str("Org id"), id: str("Record id") }, ["entity", "orgId", "id"]), run: toolCrudGet },
  { name: "crud_create", description: "Create a record (id/timestamps stamped automatically).", inputSchema: obj({ entity: str("Entity name"), orgId: str("Org id"), data: { type: "object", description: "Field values" } }, ["entity", "orgId", "data"]), run: toolCrudCreate },
  { name: "crud_update", description: "Update a record by id.", inputSchema: obj({ entity: str("Entity name"), orgId: str("Org id"), id: str("Record id"), data: { type: "object", description: "Fields to update" } }, ["entity", "orgId", "id", "data"]), run: toolCrudUpdate },
  { name: "crud_delete", description: "Delete a record by id.", inputSchema: obj({ entity: str("Entity name"), orgId: str("Org id"), id: str("Record id") }, ["entity", "orgId", "id"]), run: toolCrudDelete },
];
