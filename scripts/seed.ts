/**
 * Demo seed for the Lentone field-force CRM (FMCG clients).
 * Usage:  npm run seed   (reads env from .env.local)
 * Writes flat demo records with deterministic IDs (safe to re-run).
 */
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is missing (see .env.example)`);
  return name === "FIREBASE_ADMIN_PRIVATE_KEY" ? v.replace(/\\n/g, "\n") : v;
}

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
  const today = now.slice(0, 10);

  const set = async (path: string, value: unknown) => {
    await db.ref(path).set(value);
    console.log(`seeded ${path}`);
  };

  // --- Workers (field force) ---
  const workers = [
    { id: "demo-worker-1", name: "Arun Kumar", phone: "+919800011101", active: true, createdAt: now },
    { id: "demo-worker-2", name: "Priya Nair", phone: "+919800011102", active: true, createdAt: now },
    { id: "demo-worker-3", name: "Ravi Menon", phone: "+919800011103", active: true, createdAt: now },
  ];
  for (const w of workers) await set(`workers/${w.id}`, w);

  // --- FMCG clients across categories ---
  const clients = [
    { id: "demo-client-1", name: "Grand Hyatt Kochi", category: "Hotel", phone: "+914842001001", address: "Marine Drive, Kochi", notes: "Monthly FMCG contract", createdAt: now, updatedAt: now },
    { id: "demo-client-2", name: "Malabar Restaurant", category: "Restaurant", phone: "+914842001002", address: "MG Road, Kochi", createdAt: now, updatedAt: now },
    { id: "demo-client-3", name: "Lulu Mall Food Court", category: "Mall", phone: "+914842001003", address: "Edappally, Kochi", createdAt: now, updatedAt: now },
    { id: "demo-client-4", name: "St. Mary School Canteen", category: "School", phone: "+914842001004", address: "Kaloor, Kochi", createdAt: now, updatedAt: now },
    { id: "demo-client-5", name: "Infopark Office Pantry", category: "Office", phone: "+914842001005", address: "Kakkanad, Kochi", createdAt: now, updatedAt: now },
    { id: "demo-client-6", name: "Green Nest PG", category: "PG", phone: "+914842001006", address: "Palarivattom, Kochi", createdAt: now, updatedAt: now },
    { id: "demo-client-7", name: "Krishna Bakery", category: "Bakery", phone: "+914842001007", address: "Fort Kochi", notes: "Daily bread + snacks supply", createdAt: now, updatedAt: now },
    { id: "demo-client-8", name: "Annapoorna Catering", category: "Catering", phone: "+914842001008", address: "Thrissur", createdAt: now, updatedAt: now },
  ];
  for (const c of clients) await set(`clients/${c.id}`, c);

  // --- Leads across every stage ---
  const stages = ["New", "Contacted", "Qualified", "Proposal", "Negotiation", "Won", "Lost"] as const;
  for (let i = 0; i < stages.length; i++) {
    await set(`leads/demo-lead-${i + 1}`, {
      contactName: `Demo Contact ${i + 1}`,
      phone: `+91980002210${i + 1}`,
      clientId: clients[i % clients.length].id,
      clientName: clients[i % clients.length].name,
      stage: stages[i],
      value: (i + 1) * 15000,
      notes: "Seeded demo lead",
      createdAt: now,
      updatedAt: now,
    });
  }

  // --- Field tasks (visits + samples) ---
  const tasks = [
    { id: "demo-task-1", workerId: "demo-worker-1", workerName: "Arun Kumar", clientId: "demo-client-1", clientName: "Grand Hyatt Kochi", type: "visit", dueDate: today, status: "Assigned", notes: "Quarterly contract review", createdAt: now, updatedAt: now },
    { id: "demo-task-2", workerId: "demo-worker-2", workerName: "Priya Nair", clientId: "demo-client-7", clientName: "Krishna Bakery", type: "sample", dueDate: today, status: "In Progress", notes: "Drop new snack samples", createdAt: now, updatedAt: now },
    { id: "demo-task-3", workerId: "demo-worker-1", workerName: "Arun Kumar", clientId: "demo-client-2", clientName: "Malabar Restaurant", type: "visit", dueDate: today, status: "Done", notes: "Collected payment follow-up", createdAt: now, updatedAt: now },
  ];
  for (const t of tasks) await set(`tasks/${t.id}`, t);

  // --- Attendance (today) ---
  await set(`attendance/demo-worker-1/${today}`, {
    date: today,
    loginAt: `${today}T09:02:00.000Z`,
    logoutAt: `${today}T18:05:00.000Z`,
    hoursWorked: 9.05,
  });
  await set(`attendance/demo-worker-2/${today}`, {
    date: today,
    loginAt: `${today}T09:15:00.000Z`,
    hoursWorked: 0,
  });

  // --- GPS locations (Google Maps URLs) ---
  const locations: Record<string, { mapsUrl: string; timestamp: string; workerName: string }> = {
    "demo-worker-1": { mapsUrl: "https://www.google.com/maps?q=9.9816,76.2999", timestamp: now, workerName: "Arun Kumar" },
    "demo-worker-2": { mapsUrl: "https://www.google.com/maps?q=10.0159,76.3419", timestamp: now, workerName: "Priya Nair" },
  };
  for (const [workerId, latest] of Object.entries(locations)) {
    await set(`locations/${workerId}/latest`, latest);
    await set(`locations/${workerId}/history/demo-history-1`, { mapsUrl: latest.mapsUrl, timestamp: now });
  }

  // --- Quotation (accepted) -> invoice (unpaid) -> delivery (pending) ---
  const items = [
    { description: "FMCG combo pack (50 units)", quantity: 50, unitPrice: 220 },
    { description: "Snack sample box", quantity: 10, unitPrice: 150 },
  ];
  const total = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  await set("quotations/demo-quotation-1", {
    number: "Q-2026-001",
    clientId: "demo-client-1",
    clientName: "Grand Hyatt Kochi",
    items,
    total,
    status: "Accepted",
    createdAt: now,
    updatedAt: now,
  });
  await set("quotations/demo-quotation-2", {
    number: "Q-2026-002",
    clientId: "demo-client-7",
    clientName: "Krishna Bakery",
    items: [{ description: "Daily bread supply (100 units)", quantity: 100, unitPrice: 40 }],
    total: 4000,
    status: "Sent",
    createdAt: now,
    updatedAt: now,
  });
  await set("invoices/demo-invoice-1", {
    number: "INV-2026-001",
    clientId: "demo-client-1",
    clientName: "Grand Hyatt Kochi",
    quotationId: "demo-quotation-1",
    items,
    total,
    status: "Unpaid",
    createdAt: now,
    updatedAt: now,
  });
  await set("invoices/demo-invoice-2", {
    number: "INV-2026-002",
    clientId: "demo-client-7",
    clientName: "Krishna Bakery",
    items: [{ description: "Daily bread supply (100 units)", quantity: 100, unitPrice: 40 }],
    total: 4000,
    status: "Paid",
    createdAt: now,
    updatedAt: now,
    paidAt: now,
  });
  await set("deliveries/demo-delivery-1", {
    clientId: "demo-client-1",
    clientName: "Grand Hyatt Kochi",
    invoiceId: "demo-invoice-1",
    workerId: "demo-worker-1",
    workerName: "Arun Kumar",
    status: "Out for Delivery",
    mapsUrl: "https://www.google.com/maps?q=9.9816,76.2999",
    createdAt: now,
    updatedAt: now,
  });
  await set("deliveries/demo-delivery-2", {
    clientId: "demo-client-7",
    clientName: "Krishna Bakery",
    status: "Pending",
    createdAt: now,
    updatedAt: now,
  });

  console.log("Seed complete.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
