/**
 * Demo seed — run with `npm run seed` from crm-backend.
 * Uses the Admin SDK (bypasses security rules). Idempotent: skips seeding
 * if the org already has leads.
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
  throw new Error("Missing SEED_ADMIN_UID — sign in once with Google, copy the uid, then re-run.");
}

admin.initializeApp({
  credential: admin.credential.cert({ projectId, clientEmail, privateKey: rawKey.replace(/\\n/g, "\n") }),
  databaseURL,
});

const db = admin.database();
const now = new Date().toISOString();
const inDays = (n: number): string => new Date(Date.now() + n * 86400000).toISOString();

async function main(): Promise<void> {
  const existing = await db.ref(`/orgs/${orgId}/leads`).get();
  if (existing.exists()) {
    console.log(`Org "${orgId}" already has leads — skipping seed (idempotent).`);
    return;
  }

  await db.ref(`/orgs/${orgId}/users/${adminUid}`).set({
    uid: adminUid, email: adminEmail, displayName: "Demo Admin", role: "admin",
    notificationPrefs: { emailEnabled: true, inAppEnabled: true, mutedTypes: [] }, createdAt: now,
  });

  const leadRef = db.ref(`/orgs/${orgId}/leads`).push();
  await leadRef.set({
    id: leadRef.key, name: "Asha Sharma", email: "asha@example.com", phone: "+91-90000-00001",
    company: "Acme Interiors", stage: "Qualified", value: 85000, source: "Website",
    assignedTo: adminUid, notes: "Wants a full-home redesign quote.", nextFollowUp: inDays(2).slice(0, 10), createdAt: now, updatedAt: now,
  });

  const clientRef = db.ref(`/orgs/${orgId}/clients`).push();
  await clientRef.set({
    id: clientRef.key, name: "Ravi Menon", email: "ravi@example.com", company: "Menon Retail",
    address: "Kochi, Kerala", source: "lead", createdAt: now, updatedAt: now,
  });
  const clientId = clientRef.key as string;

  await db.ref(`/orgs/${orgId}/contacts/${clientId}-c1`).set({
    id: `${clientId}-c1`, clientId, name: "Ravi Menon", email: "ravi@example.com",
    designation: "Owner", isPrimary: true, createdAt: now, updatedAt: now,
  });

  const qRef = db.ref(`/orgs/${orgId}/quotations`).push();
  await qRef.set({
    id: qRef.key, number: "Q-DEMO01", clientId, clientName: "Ravi Menon",
    items: [{ description: "Storefront signage", quantity: 2, unitPrice: 15000 }],
    subtotal: 30000, taxAmount: 0, total: 30000, status: "sent",
    validUntil: inDays(14).slice(0, 10), createdAt: now, updatedAt: now,
  });

  const invRef = db.ref(`/orgs/${orgId}/invoices`).push();
  await invRef.set({
    id: invRef.key, number: "INV-DEMO01", clientId, clientName: "Ravi Menon", quotationId: qRef.key,
    items: [{ description: "Storefront signage", quantity: 2, unitPrice: 15000 }],
    subtotal: 30000, taxAmount: 0, total: 30000, amountPaid: 10000, amountDue: 20000, status: "partial",
    issueDate: now.slice(0, 10), dueDate: inDays(7).slice(0, 10), createdAt: now, updatedAt: now,
  });

  const projRef = db.ref(`/orgs/${orgId}/projects`).push();
  await projRef.set({
    id: projRef.key, title: "Menon Retail signage", clientId, clientName: "Ravi Menon",
    status: "in_progress", progress: 40, deadline: inDays(21).slice(0, 10), assignedTo: [adminUid], createdAt: now, updatedAt: now,
  });

  const taskRef = db.ref(`/orgs/${orgId}/tasks`).push();
  await taskRef.set({
    id: taskRef.key, projectId: projRef.key, title: "Finalize artwork proof", status: "todo",
    priority: "high", dueDate: inDays(1).slice(0, 10), assignedTo: adminUid, createdAt: now, updatedAt: now,
  });

  const fuRef = db.ref(`/orgs/${orgId}/followUps`).push();
  await fuRef.set({
    id: fuRef.key, leadId: leadRef.key, title: "Call Asha about quote", dueAt: inDays(2),
    done: false, assignedTo: adminUid, createdAt: now,
  });

  const postRef = db.ref(`/orgs/${orgId}/posts`).push();
  await postRef.set({
    id: postRef.key, platform: "instagram", content: "Before/after: Menon Retail signage ✦ (demo post)",
    status: "scheduled", scheduledAt: inDays(3), createdAt: now, updatedAt: now,
  });

  console.log(`Seeded demo data into org "${orgId}".`);
}

main().then(() => process.exit(0)).catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
