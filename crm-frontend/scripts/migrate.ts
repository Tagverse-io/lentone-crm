/**
 * One-time legacy migration into the flat field-force data model.
 * Usage:  npm run migrate   (reads env from .env.local)
 *
 * Sources handled (best-effort, defensive against unknown shapes):
 *   /orgs/{orgId}/{leads,clients,quotations,invoices,payments,tasks}
 *   /field_agents            → /workers
 * Plus a backfill pass that adds missing nameKey/numberKey/clientKey and
 * createdAt/updatedAt stamps to records already on the new paths.
 *
 * Safe to re-run: migrated records use deterministic `mig-*` ids and are
 * written only when the target does not exist; counters only move forward;
 * settings are created only when missing.
 */
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is missing (see .env.example)`);
  return name === "FIREBASE_ADMIN_PRIVATE_KEY" ? v.replace(/\\n/g, "\n") : v;
}

type Rec = Record<string, unknown>;
const str = (v: unknown, fb = ""): string => (typeof v === "string" ? v : fb);
const num = (v: unknown, fb = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};
const key = (s: string) => s.trim().toLowerCase();
const sanitize = (s: string) => s.replace(/[.$#[\]/]/g, "_").slice(0, 120);
const title = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s);

const LEAD_STAGES = new Set(["New", "Contacted", "Qualified", "Proposal", "Negotiation", "Won", "Lost"]);
const QUOTE_STATUS = (s: string) =>
  ["Draft", "Sent", "Accepted", "Rejected"].includes(title(s)) ? title(s) : "Draft";
const INVOICE_STATUS = (s: string) => {
  const t = s.toLowerCase();
  if (t === "paid") return "Paid";
  if (t === "partial" || t === "partially_paid") return "Partial";
  if (t === "overdue") return "Overdue";
  return "Unpaid";
};
const TASK_STATUS = (s: string) => {
  const t = s.toLowerCase();
  if (t === "done" || t === "completed") return "Done";
  if (t === "in_progress" || t === "in progress") return "In Progress";
  return "Assigned";
};
const PAY_MODE = (s: string) => {
  const t = s.toLowerCase().replace(/_/g, " ");
  const modes = ["Cash", "UPI", "Card", "Bank Transfer", "Cheque"];
  return modes.find((m) => m.toLowerCase() === t) ?? "Cash";
};

async function main(): Promise<void> {
  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId: required("FIREBASE_ADMIN_PROJECT_ID"),
        clientEmail: required("FIREBASE_ADMIN_CLIENT_EMAIL"),
        privateKey: required("FIREBASE_ADMIN_PRIVATE_KEY"),
      }),
      databaseURL: required("NEXT_PUBLIC_FIREBASE_DATABASE_URL"),
    });
  }
  const db = getDatabase();
  const now = new Date().toISOString();
  let created = 0;
  let skipped = 0;

  const exists = async (path: string): Promise<boolean> => (await db.ref(path).get()).exists();

  const putIfMissing = async (path: string, value: Rec) => {
    if (await exists(path)) {
      skipped += 1;
      return;
    }
    await db.ref(path).set(value);
    created += 1;
  };

  const asEntries = (v: unknown): [string, Rec][] => {
    if (!v || typeof v !== "object") return [];
    return Object.entries(v as Record<string, unknown>)
      .filter(([, x]) => x && typeof x === "object")
      .map(([id, x]) => [id, x as Rec]);
  };

  // ---------- 1. /orgs/{orgId}/* → flat paths ----------
  const orgsSnap = await db.ref("orgs").get();
  if (orgsSnap.exists()) {
    for (const [orgId, orgVal] of asEntries(orgsSnap.val())) {
      const org = orgVal as Rec;
      const at = String(org.updatedAt ?? org.createdAt ?? now);

      for (const [srcId, s] of asEntries(org.leads)) {
        const stage = LEAD_STAGES.has(title(str(s.status))) ? title(str(s.status)) : "New";
        await putIfMissing(`leads/mig-lead-${sanitize(srcId)}`, {
          contactName: str(s.name) || "Migrated lead",
          nameKey: key(str(s.name)),
          email: str(s.email) || undefined,
          phone: str(s.phone) || undefined,
          clientName: str(s.company) || undefined,
          stage,
          value: num(s.estimated_value) || undefined,
          notes: str(s.notes) || undefined,
          legacy: true,
          migratedAt: now,
          sourcePath: `orgs/${orgId}/leads/${srcId}`,
          createdAt: str(s.created_at, at),
          updatedAt: str(s.updated_at, at),
        });
      }

      for (const [srcId, s] of asEntries(org.clients)) {
        const name = str(s.name) || "Migrated client";
        await putIfMissing(`clients/mig-client-${sanitize(srcId)}`, {
          name,
          nameKey: key(name),
          category: "Office",
          phone: str(s.phone) || undefined,
          email: str(s.email) || undefined,
          address: str(s.address) || undefined,
          notes: [str(s.source) && `Source: ${s.source}`, str(s.company) && `Company: ${s.company}`]
            .filter(Boolean)
            .join(" · ") || undefined,
          legacy: true,
          migratedAt: now,
          sourcePath: `orgs/${orgId}/clients/${srcId}`,
          createdAt: str(s.created_at, at),
          updatedAt: str(s.updated_at, at),
        });
      }

      for (const [srcId, s] of asEntries(org.quotations)) {
        const items = Array.isArray(s.items)
          ? (s.items as Rec[]).map((it) => ({
              description: str(it.name) || str(it.description) || "Item",
              quantity: num(it.quantity, 1),
              unitPrice: num(it.unit_price ?? it.unitPrice),
            }))
          : [];
        const total = num(s.amount, items.reduce((a, i) => a + i.quantity * i.unitPrice, 0));
        const number = str(s.quotation_number) || `MIG-Q-${srcId}`;
        await putIfMissing(`quotations/mig-quotation-${sanitize(srcId)}`, {
          number,
          numberKey: key(number),
          clientId: str(s.client_id),
          clientName: str(s.client_name) || undefined,
          items,
          subtotal: total,
          tax: 0,
          discount: 0,
          total,
          status: QUOTE_STATUS(str(s.status, "draft")),
          legacy: true,
          migratedAt: now,
          sourcePath: `orgs/${orgId}/quotations/${srcId}`,
          createdAt: str(s.created_at, at),
          updatedAt: str(s.updated_at, at),
        });
      }

      for (const [srcId, s] of asEntries(org.invoices)) {
        const items = Array.isArray(s.items)
          ? (s.items as Rec[]).map((it) => ({
              description: str(it.name) || str(it.description) || "Item",
              quantity: num(it.quantity, 1),
              unitPrice: num(it.unit_price ?? it.unitPrice),
            }))
          : [];
        const total = num(s.amount, items.reduce((a, i) => a + i.quantity * i.unitPrice, 0));
        const number = str(s.invoice_number) || `MIG-INV-${srcId}`;
        await putIfMissing(`invoices/mig-invoice-${sanitize(srcId)}`, {
          number,
          numberKey: key(number),
          clientId: str(s.client_id),
          clientName: str(s.client_name) || undefined,
          quotationId: str(s.quote_id) || undefined,
          items,
          subtotal: total,
          tax: num(s.tax_amount),
          discount: 0,
          total,
          amountPaid: num(s.amount_paid),
          dueDate: str(s.due_date).slice(0, 10) || undefined,
          status: INVOICE_STATUS(str(s.status, "pending")),
          legacy: true,
          migratedAt: now,
          sourcePath: `orgs/${orgId}/invoices/${srcId}`,
          createdAt: str(s.created_at, at),
          updatedAt: str(s.updated_at, at),
        });
      }

      for (const [srcId, s] of asEntries(org.payments)) {
        await putIfMissing(`payments/mig-payment-${sanitize(srcId)}`, {
          invoiceId: str(s.invoice_id),
          amount: num(s.amount),
          mode: PAY_MODE(str(s.method, "cash")),
          date: str(s.date, at).slice(0, 10),
          reference: str(s.reference) || undefined,
          legacy: true,
          migratedAt: now,
          sourcePath: `orgs/${orgId}/payments/${srcId}`,
          createdAt: str(s.created_at, at),
        });
      }

      for (const [srcId, s] of asEntries(org.tasks)) {
        await putIfMissing(`tasks/mig-task-${sanitize(srcId)}`, {
          workerId: str(s.assignee_id),
          workerName: str(s.assignee_name) || undefined,
          clientId: "",
          type: "Visit",
          dueDate: str(s.due_date ?? s.dueDate, at).slice(0, 10),
          status: TASK_STATUS(str(s.status, "todo")),
          notes: str(s.title) || undefined,
          legacy: true,
          migratedAt: now,
          sourcePath: `orgs/${orgId}/tasks/${srcId}`,
          createdAt: str(s.created_at, at),
          updatedAt: str(s.updated_at, at),
        });
      }
    }
  }

  // ---------- 2. /field_agents → /workers ----------
  const agentsSnap = await db.ref("field_agents").get();
  if (agentsSnap.exists()) {
    for (const [srcId, s] of asEntries(agentsSnap.val())) {
      const name = str(s.name) || str(s.full_name) || "Migrated worker";
      await putIfMissing(`workers/mig-worker-${sanitize(srcId)}`, {
        name,
        nameKey: key(name),
        phone: str(s.phone) || undefined,
        active: true,
        legacy: true,
        migratedAt: now,
        sourcePath: `field_agents/${srcId}`,
        createdAt: str(s.created_at, now),
      });
    }
  }

  // ---------- 3. Backfill search keys + stamps on flat records ----------
  const backfill: Record<string, unknown> = {};
  const touch = async (path: string) => {
    const snap = await db.ref(path).get();
    if (!snap.exists()) return;
    for (const [id, r] of asEntries(snap.val())) {
      const patch: Rec = {};
      if (!r.createdAt) patch.createdAt = now;
      if (!r.updatedAt && path !== "payments") patch.updatedAt = now;
      const nm = str(r.name) || str(r.contactName);
      if (nm && !r.nameKey) patch.nameKey = key(nm);
      const no = str(r.number);
      if (no && !r.numberKey) patch.numberKey = key(no);
      const cn = str(r.clientName);
      if (cn && !r.clientKey) patch.clientKey = key(cn);
      const ino = str(r.invoiceNumber);
      if (ino && !r.invoiceKey) patch.invoiceKey = key(ino);
      if (Object.keys(patch).length > 0) backfill[`${path}/${id}`] = patch;
    }
  };
  for (const p of ["clients", "leads", "workers", "products", "orders", "quotations", "invoices", "deliveries", "payments", "tasks"]) {
    await touch(p);
  }
  if (Object.keys(backfill).length > 0) {
    await db.ref().update(backfill);
    console.log(`backfilled ${Object.keys(backfill).length} records`);
  }

  // ---------- 4. Counters: move forward to max existing sequence ----------
  const seqOf = (number: string): number => {
    const m = number.match(/(\d+)\s*$/);
    return m ? parseInt(m[1], 10) : 0;
  };
  const bump = async (counter: string, path: string) => {
    const snap = await db.ref(path).get();
    let max = 0;
    for (const [, r] of asEntries(snap.val())) max = Math.max(max, seqOf(str(r.number)));
    if (max <= 0) return;
    const cur = ((await db.ref(`counters/${counter}`).get()).val() as number) ?? 0;
    if (max >= cur) {
      await db.ref(`counters/${counter}`).set(max + 1);
      console.log(`counters/${counter} → ${max + 1}`);
    }
  };
  await bump("invoices", "invoices");
  await bump("orders", "orders");
  await bump("quotations", "quotations");

  // ---------- 5. Settings defaults if missing ----------
  if (!(await exists("settings"))) {
    await db.ref("settings").set({
      companyName: "Lentone Foods Distribution",
      taxRate: 18,
      currency: "₹",
      invoicePrefix: "INV",
      quotationPrefix: "Q",
      orderPrefix: "ORD",
      defaultRowsPerPage: 25,
      defaultTaskSlot: "10:00",
      lowStockThreshold: 10,
      workingHoursStart: "09:00",
      workingHoursEnd: "18:00",
      clientCategories: ["Hotel", "Restaurant", "Mall", "School", "Office", "PG", "Bakery", "Catering"],
      customFields: { clients: [], leads: [], products: [] },
    });
    console.log("settings initialized");
  }

  console.log(`Migrate complete: ${created} created, ${skipped} already present.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
