/**
 * Demo seed — run with `npm run seed` from crm-backend.
 * Uses the Admin SDK (bypasses security rules). Idempotent: skips seeding
 * if the org already has leads. Field names match the frontend (bridgebreak) shapes.
 *
 * Required env: FIREBASE_* + (seed user uid/email). Pass the org + admin:
 *   SEED_ORG_ID=default SEED_ADMIN_UID=<uid> SEED_ADMIN_EMAIL=<you@x.com> npm run seed
 */
import admin from "firebase-admin";

const databaseURL = process.env.FIREBASE_DATABASE_URL;
const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const rawKey = process.env.FIREBASE_PRIVATE_KEY;
const orgId = process.env.SEED_ORG_ID ?? "default";
const adminUid = process.env.SEED_ADMIN_UID;
const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";

if (!databaseURL || !projectId || !clientEmail || !rawKey) {
  throw new Error("Missing FIREBASE_* env vars (see crm-backend/.env.example). Get the service key: Firebase Console → Project settings → Service accounts.");
}
if (!adminUid) {
  throw new Error("Missing SEED_ADMIN_UID — sign in once, copy the uid, then re-run.");
}

admin.initializeApp({
  credential: admin.credential.cert({ projectId, clientEmail, privateKey: rawKey.replace(/\\n/g, "\n") }),
  databaseURL,
});

const db = admin.database();
const now = new Date().toISOString();
const inDays = (n: number): string => new Date(Date.now() + n * 86400000).toISOString();
const day = (n: number): string => inDays(n).slice(0, 10);

async function main(): Promise<void> {
  const existing = await db.ref(`/orgs/${orgId}/leads`).get();
  if (existing.exists()) {
    console.log(`Org "${orgId}" already has leads — skipping seed (idempotent).`);
    return;
  }

  await db.ref(`/orgs/${orgId}/users/${adminUid}`).set({
    id: adminUid, uid: adminUid, email: adminEmail, displayName: "Demo Admin", photoURL: null,
    role: "admin", notificationPrefs: { emailEnabled: true, inAppEnabled: true, mutedTypes: [] }, createdAt: now,
  });
  await db.ref(`/users/${adminUid}`).set({
    company_id: orgId, email: adminEmail, full_name: "Demo Admin", role: "admin",
    avatar_url: null, created_at: now, updated_at: now,
  });

  const leadRef = db.ref(`/orgs/${orgId}/leads`).push();
  await leadRef.set({
    id: leadRef.key, workspace_id: orgId, name: "Asha Sharma", email: "asha@example.com",
    phone: "+91-90000-00001", company: "Acme Interiors", status: "qualified",
    source: "Website", estimated_value: 85000, owner_id: "Demo Admin",
    notes: "Wants a full-home redesign quote.", tags: ["Hot"], priority: "High",
    next_follow_up: day(2), created_at: now, updated_at: now,
  });

  const clientRef = db.ref(`/orgs/${orgId}/clients`).push();
  await clientRef.set({
    id: clientRef.key, name: "Ravi Menon", email: "ravi@example.com", company: "Menon Retail",
    address: "Kochi, Kerala", source: "lead", createdAt: now, updatedAt: now,
  });
  const clientId = clientRef.key as string;

  const contactRef = db.ref(`/orgs/${orgId}/contacts`).push();
  await contactRef.set({
    contact_id: contactRef.key, id: contactRef.key, workspace_id: orgId, client_id: clientId,
    name: "Ravi Menon", email: "ravi@example.com", phone: "+91-90000-00002",
    designation: "Owner", is_primary: true, created_at: now, updated_at: now,
  });

  const qRef = db.ref(`/orgs/${orgId}/quotations`).push();
  await qRef.set({
    id: qRef.key, workspace_id: orgId, quotation_number: "Q-DEMO01",
    client_id: clientId, client_name: "Ravi Menon",
    items: [{ description: "Storefront signage", quantity: 2, unit_price: 15000, total: 30000 }],
    amount: 30000, subtotal: 30000, tax_amount: 0, currency: "USD",
    status: "sent", valid_until: day(14), created_at: now, updated_at: now,
  });

  const invRef = db.ref(`/orgs/${orgId}/invoices`).push();
  await invRef.set({
    id: invRef.key, workspace_id: orgId, invoice_number: "INV-DEMO01",
    client_id: clientId, client_name: "Ravi Menon", quote_id: qRef.key,
    items: [{ description: "Storefront signage", quantity: 2, unit_price: 15000, total: 30000 }],
    subtotal: 30000, tax_amount: 0, amount: 30000, currency: "USD",
    amount_paid: 10000, amount_due: 20000, status: "partially_paid",
    issue_date: day(0), due_date: day(7), created_at: now, updated_at: now,
  });

  const projRef = db.ref(`/orgs/${orgId}/projects`).push();
  await projRef.set({
    id: projRef.key, workspace_id: orgId, title: "Menon Retail signage",
    description: "Storefront signage design and install", client_id: clientId,
    client_name: "Ravi Menon", status: "in_progress", deadline: day(21),
    created_at: now, updated_at: now,
  });

  const taskRef = db.ref(`/orgs/${orgId}/tasks`).push();
  await taskRef.set({
    id: taskRef.key, workspace_id: orgId, project: projRef.key, title: "Finalize artwork proof",
    priority: "high", due_date: day(1), assignee: adminUid, status: "todo",
    description: "Get client sign-off on artwork", created_at: now, updated_at: now,
  });

  const fuRef = db.ref(`/orgs/${orgId}/followUps`).push();
  await fuRef.set({
    id: fuRef.key, leadId: leadRef.key, title: "Call Asha about quote",
    notes: "Discuss quote Q-DEMO range", dueAt: inDays(2), done: false,
    assignedTo: adminUid, createdAt: now,
  });

  const postRef = db.ref(`/orgs/${orgId}/posts`).push();
  await postRef.set({
    id: postRef.key, platform: "instagram", content: "Before/after: Menon Retail signage (demo post)",
    status: "scheduled", scheduledAt: inDays(3), createdAt: now, updatedAt: now,
  });

  console.log(`Seeded demo data into org "${orgId}".`);
}

main().then(() => process.exit(0)).catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
