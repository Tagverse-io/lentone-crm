import { z } from "zod";
import { db } from "./admin";

// ---------------------------------------------------------------------------
// Generic org-scoped CRUD core shared by REST (/api/crud/*) and MCP tools.
// Field conventions follow the frontend shapes: bridgebreak entities use
// snake_case (+ their own id field), white-label entities use camelCase.
// ---------------------------------------------------------------------------

export const ENTITIES = [
  "leads", "clients", "contacts", "followUps", "quotations", "invoices",
  "payments", "projects", "tasks", "socialAccounts", "posts",
  "videoProductions", "events", "notifications", "users", "automationsLog",
  "roles",
] as const;

export type EntityName = (typeof ENTITIES)[number];

export const EntitySchema = z.enum(ENTITIES);

interface EntityDef {
  /** extra id fields (besides the RTDB key `id`) stamped with the push key */
  idFields: string[];
  /** timestamp style */
  ts: "snake" | "camel";
  /** keyed by uid instead of push ids (users) */
  uidKeyed?: boolean;
  /** required fields on create */
  required: string[];
}

const DEFS: Record<EntityName, EntityDef> = {
  leads: { idFields: [], ts: "snake", required: ["name", "email"] },
  clients: { idFields: [], ts: "camel", required: ["name", "email"] },
  contacts: { idFields: ["contact_id"], ts: "snake", required: ["name", "email"] },
  followUps: { idFields: [], ts: "camel", required: ["title", "dueAt"] },
  quotations: { idFields: ["quote_id"], ts: "snake", required: ["quotation_number"] },
  invoices: { idFields: ["invoice_id"], ts: "snake", required: ["invoice_number"] },
  payments: { idFields: ["payment_id"], ts: "snake", required: ["amount"] },
  projects: { idFields: [], ts: "snake", required: ["title"] },
  tasks: { idFields: [], ts: "snake", required: ["title"] },
  socialAccounts: { idFields: [], ts: "camel", required: ["handle"] },
  posts: { idFields: [], ts: "camel", required: ["content"] },
  videoProductions: { idFields: [], ts: "camel", required: ["title"] },
  events: { idFields: [], ts: "snake", required: ["title"] },
  notifications: { idFields: [], ts: "snake", required: ["user_id", "title", "message"] },
  users: { idFields: ["uid"], ts: "camel", uidKeyed: true, required: ["email"] },
  automationsLog: { idFields: [], ts: "camel", required: ["name"] },
  roles: { idFields: [], ts: "snake", required: ["name"] },
};

export type CrudRecord = Record<string, unknown> & { id: string };

function stampNew(entity: EntityName, key: string, data: Record<string, unknown>, orgId: string): CrudRecord {
  const def = DEFS[entity];
  const now = new Date().toISOString();
  const rec: Record<string, unknown> = { ...data, id: key, workspace_id: orgId };
  for (const f of def.idFields) rec[f] = key;
  if (def.ts === "snake") {
    rec.created_at = (data.created_at as string) ?? now;
    rec.updated_at = now;
  } else {
    rec.createdAt = (data.createdAt as string) ?? now;
    rec.updatedAt = now;
  }
  return rec as CrudRecord;
}

function stampUpdate(entity: EntityName, patch: Record<string, unknown>): Record<string, unknown> {
  const now = new Date().toISOString();
  const out = { ...patch };
  delete out.id;
  for (const f of DEFS[entity].idFields) delete out[f];
  delete out.workspace_id;
  out[DEFS[entity].ts === "snake" ? "updated_at" : "updatedAt"] = now;
  return out;
}

function withId(key: string, val: unknown): CrudRecord {
  return { ...((val ?? {}) as Record<string, unknown>), id: key } as CrudRecord;
}

function assertRequired(entity: EntityName, data: Record<string, unknown>): void {
  const missing = DEFS[entity].required.filter((f) => data[f] === undefined || data[f] === null || data[f] === "");
  if (missing.length > 0) throw new Error(`Missing required fields: ${missing.join(", ")}`);
}

export async function crudList(orgId: string, entity: EntityName): Promise<CrudRecord[]> {
  const snap = await db().ref(`/orgs/${orgId}/${entity}`).get();
  const val = (snap.val() ?? {}) as Record<string, unknown>;
  return Object.entries(val)
    .map(([key, v]) => withId(key, v))
    .sort((a, b) => String(b.created_at ?? b.createdAt ?? "").localeCompare(String(a.created_at ?? a.createdAt ?? "")));
}

export async function crudGet(orgId: string, entity: EntityName, id: string): Promise<CrudRecord | null> {
  const snap = await db().ref(`/orgs/${orgId}/${entity}/${id}`).get();
  if (!snap.exists()) return null;
  return withId(id, snap.val());
}

export async function crudCreate(orgId: string, entity: EntityName, data: Record<string, unknown>): Promise<CrudRecord> {
  const input = { ...data };
  // Settings-driven defaults for documents created via REST/MCP.
  if (entity === "invoices" || entity === "quotations") {
    const { getOrgSettings } = await import("./settings");
    const { nextNumber, dueDateFromSettings } = await import("./numbering");
    const s = await getOrgSettings(orgId);
    const numField = entity === "invoices" ? "invoice_number" : "quotation_number";
    if (!input[numField]) input[numField] = await nextNumber(orgId, entity === "invoices" ? "invoice" : "quote");
    if (!input.currency) input.currency = s.general.default_currency;
    if (entity === "invoices") {
      if (!input.due_date) input.due_date = await dueDateFromSettings(orgId);
      if (!input.payment_terms) input.payment_terms = s.branding.default_payment_terms;
      if (!input.terms) input.terms = s.branding.default_terms;
      if (input.amount_paid === undefined) input.amount_paid = 0;
      if (input.amount_due === undefined) input.amount_due = (input.amount as number) ?? 0;
      if (!input.status) input.status = "pending";
    }
  }
  assertRequired(entity, input);
  const database = db();
  if (DEFS[entity].uidKeyed) {
    const uid = input.uid as string | undefined;
    if (!uid) throw new Error("uid required");
    const rec = stampNew(entity, uid, { ...input, id: uid }, orgId);
    await database.ref(`/orgs/${orgId}/${entity}/${uid}`).set(rec);
    return rec;
  }
  const ref = database.ref(`/orgs/${orgId}/${entity}`).push();
  const rec = stampNew(entity, ref.key as string, input, orgId);
  await ref.set(rec);
  return rec;
}

export async function crudUpdate(orgId: string, entity: EntityName, id: string, patch: Record<string, unknown>): Promise<CrudRecord | null> {
  const database = db();
  const ref = database.ref(`/orgs/${orgId}/${entity}/${id}`);
  if (!(await ref.get()).exists()) return null;
  const stamped = stampUpdate(entity, patch);
  await ref.update(stamped);
  return withId(id, (await ref.get()).val());
}

export async function crudDelete(orgId: string, entity: EntityName, id: string): Promise<boolean> {
  const ref = db().ref(`/orgs/${orgId}/${entity}/${id}`);
  if (!(await ref.get()).exists()) return false;
  await ref.remove();
  return true;
}
