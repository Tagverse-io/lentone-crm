/**
 * Demo seed for the Lentone field-force CRM.
 * Usage:  npm run seed   (reads env from .env.local)
 * Writes >=25 deterministic demo records per module (safe to re-run:
 * every record uses a fixed `seed-*` id and is overwritten with set()).
 *
 * Modules: clients, leads, workers, tasks, products (inventory),
 * stockMovements, orders, quotations, invoices, payments, deliveries,
 * attendance, locations (+ history, settings, counters).
 */
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is missing (see .env.example)`);
  return name === "FIREBASE_ADMIN_PRIVATE_KEY" ? v.replace(/\\n/g, "\n") : v;
}

const DAY = 86_400_000;
const base = Date.now();
const iso = (daysAgo: number, h = 10, m = 0) => {
  const d = new Date(base - daysAgo * DAY);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};
const key = (s: string) => s.trim().toLowerCase();
const pad = (n: number) => String(n).padStart(4, "0");

const CATEGORIES = ["Hotel", "Restaurant", "Mall", "School", "Office", "PG", "Bakery", "Catering"];
const CLIENT_NAMES = [
  "Grand Hyatt Kochi", "Malabar Restaurant", "Lulu Mall Food Court", "St. Mary School Canteen",
  "Infopark Office Pantry", "Green Nest PG", "Krishna Bakery", "Annapoorna Catering",
  "Taj Malabar Resort", "Chili's Family Dine", "Oberon Mall Kiosk", "Kendriya Vidyalaya Mess",
  "TCS Campus Cafeteria", "Lakeview PG", "Best Bakes", "Malabar Caterers",
  "Crowne Plaza Kochi", "Dhe Puttu House", "Nucleus Mall Eatery", "Navy School Canteen",
  "Wipro Pantry Block", "Sunrise Men's Hostel", "Cake Square", "Spice Route Events",
  "Le Meridien Kochi", "Burger Junction", "Centre Square Food Hub", "Bhavan's School Store",
  "Kinfra Food Park", "Youth Hostel Canteen",
];
const WORKER_NAMES = [
  "Arun Kumar", "Priya Nair", "Ravi Menon", "Divya Pillai", "Suresh Babu",
  "Lakshmi Amma", "Vikram Rao", "Anita Desai", "Manoj Tiwari", "Kavya Reddy",
  "Sanjay Patil", "Meera Joshi", "Rahul Verma", "Neha Singh", "Amit Sharma",
  "Pooja Gupta", "Kiran Bedi", "Deepak Yadav", "Shalini Iyer", "Gopal Krishna",
  "Rekha Rani", "Vijay Anand",   "Sunita Devi", "Prakash Raj", "Ashwini Kumar",
];
const PRODUCT_DEFS: { name: string; sku: string; category: string; unit: string; price: number; stock: number; low: number }[] = [
  { name: "Basmati Rice 25kg Bag", sku: "RICE-25", category: "Staples", unit: "bag", price: 1850, stock: 120, low: 20 },
  { name: "Sunflower Oil 15L Can", sku: "OIL-15", category: "Staples", unit: "can", price: 2100, stock: 85, low: 15 },
  { name: "Toor Dal 30kg Bag", sku: "DAL-30", category: "Staples", unit: "bag", price: 4200, stock: 60, low: 10 },
  { name: "Sugar 50kg Bag", sku: "SUG-50", category: "Staples", unit: "bag", price: 2100, stock: 95, low: 15 },
  { name: "Wheat Flour 10kg", sku: "FLR-10", category: "Staples", unit: "bag", price: 520, stock: 8, low: 20 },
  { name: "Turmeric Powder 1kg", sku: "SPC-TUR", category: "Spices", unit: "packet", price: 280, stock: 200, low: 30 },
  { name: "Chilli Powder 1kg", sku: "SPC-CHI", category: "Spices", unit: "packet", price: 320, stock: 5, low: 30 },
  { name: "Garam Masala 500g", sku: "SPC-GRM", category: "Spices", unit: "packet", price: 240, stock: 150, low: 25 },
  { name: "Tea Powder 1kg", sku: "BEV-TEA", category: "Beverages", unit: "packet", price: 460, stock: 110, low: 20 },
  { name: "Filter Coffee 500g", sku: "BEV-COF", category: "Beverages", unit: "packet", price: 380, stock: 90, low: 15 },
  { name: "Milk Powder 1kg", sku: "DRY-MLK", category: "Dairy", unit: "packet", price: 540, stock: 70, low: 15 },
  { name: "Butter 500g Slab", sku: "DRY-BTR", category: "Dairy", unit: "piece", price: 320, stock: 6, low: 20 },
  { name: "Paneer 1kg Pack", sku: "DRY-PNR", category: "Dairy", unit: "packet", price: 420, stock: 45, low: 10 },
  { name: "Snack Mixture 5kg", sku: "SNK-MIX", category: "Snacks", unit: "bag", price: 890, stock: 75, low: 12 },
  { name: "Banana Chips 1kg", sku: "SNK-BAN", category: "Snacks", unit: "packet", price: 310, stock: 130, low: 20 },
  { name: "Mixture Sample Box", sku: "SMP-MIX", category: "Samples", unit: "piece", price: 150, stock: 300, low: 50 },
  { name: "Oil Sample 1L", sku: "SMP-OIL", category: "Samples", unit: "piece", price: 180, stock: 4, low: 25 },
  { name: "Dishwash Bar Pack", sku: "CLN-DSH", category: "Cleaning", unit: "packet", price: 220, stock: 160, low: 30 },
  { name: "Floor Cleaner 5L", sku: "CLN-FLR", category: "Cleaning", unit: "can", price: 650, stock: 55, low: 10 },
  { name: "Paper Napkins 2ply", sku: "PKG-NAP", category: "Packaging", unit: "packet", price: 140, stock: 220, low: 40 },
  { name: "Food Container 500ml x100", sku: "PKG-CNT", category: "Packaging", unit: "packet", price: 480, stock: 88, low: 20 },
  { name: "Garbage Bags Large", sku: "PKG-GRB", category: "Packaging", unit: "packet", price: 260, stock: 140, low: 25 },
  { name: "Coconut Oil 5L", sku: "OIL-COC", category: "Staples", unit: "can", price: 1150, stock: 66, low: 12 },
  { name: "Jaggery 5kg", sku: "SUG-JAG", category: "Staples", unit: "bag", price: 640, stock: 48, low: 10 },
  { name: "Cardamom 100g", sku: "SPC-CRD", category: "Spices", unit: "packet", price: 390, stock: 96, low: 15 },
  { name: "Pepper 500g", sku: "SPC-PEP", category: "Spices", unit: "packet", price: 450, stock: 3, low: 15 },
  { name: "Green Tea Box", sku: "BEV-GRT", category: "Beverages", unit: "piece", price: 260, stock: 118, low: 20 },
  { name: "Curd Cup 400g x12", sku: "DRY-CRD", category: "Dairy", unit: "packet", price: 360, stock: 52, low: 12 },
  { name: "Samosa Frozen x50", sku: "FRZ-SAM", category: "Frozen", unit: "packet", price: 550, stock: 40, low: 10 },
  { name: "Parotta Frozen x30", sku: "FRZ-PAR", category: "Frozen", unit: "packet", price: 420, stock: 7, low: 15 },
];

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
  const set = async (path: string, value: unknown) => {
    await db.ref(path).set(value);
  };
  let n = 0;
  const done = async (path: string, value: unknown) => {
    await set(path, value);
    n += 1;
  };

  // --- Settings + counters ---
  await done("settings", {
    companyName: "Lentone Foods Distribution",
    address: "Market Road, Kochi, Kerala 682001",
    gstin: "32ABCDE1234F1Z5",
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
    clientCategories: CATEGORIES,
    customFields: { clients: [], leads: [], products: [] },
  });
  await done("counters/invoices", 300);
  await done("counters/orders", 300);
  await done("counters/quotations", 300);

  // --- Workers (25) ---
  const workers = WORKER_NAMES.map((name, i) => ({
    id: `seed-worker-${i + 1}`,
    name: name.trim(),
    nameKey: key(name),
    phone: `+9198001${String(1101 + i).padStart(4, "0")}`,
    active: i !== 23,
    createdAt: iso(50 - i, 9),
  }));
  for (const w of workers) await done(`workers/${w.id}`, w);

  // --- Clients (30) ---
  const clients = CLIENT_NAMES.map((name, i) => {
    const created = iso(55 - i, 10);
    return {
      id: `seed-client-${i + 1}`,
      name,
      nameKey: key(name),
      category: CATEGORIES[i % CATEGORIES.length],
      contactPerson: `Contact ${i + 1}`,
      phone: `+91484200${String(1001 + i)}`,
      email: `orders${i + 1}@example.com`,
      address: `${100 + i} Main Street, Kochi`,
      gstin: i % 3 === 0 ? `32ABCDE${String(1000 + i)}F1Z5` : undefined,
      mapsUrl: i % 5 === 4 ? undefined : `https://www.google.com/maps?q=${(9.9 + i * 0.01).toFixed(4)},${(76.2 + i * 0.01).toFixed(4)}`,
      notes: i % 4 === 0 ? "Prefers morning delivery" : undefined,
      createdAt: created,
      updatedAt: created,
    };
  });
  for (const c of clients) await done(`clients/${c.id}`, c);

  // --- Leads (30, every stage) ---
  const stages = ["New", "Contacted", "Qualified", "Proposal", "Negotiation", "Won", "Lost"] as const;
  const leads = Array.from({ length: 30 }, (_, i) => {
    const created = iso(45 - i, 11);
    return {
      id: `seed-lead-${i + 1}`,
      contactName: `Lead Contact ${i + 1}`,
      nameKey: key(`Lead Contact ${i + 1}`),
      email: `lead${i + 1}@example.com`,
      phone: `+9198002${String(2101 + i)}`,
      clientId: clients[i % clients.length].id,
      clientName: clients[i % clients.length].name,
      stage: stages[i % stages.length],
      value: (i + 1) * 12000,
      notes: "Seeded demo lead",
      createdAt: created,
      updatedAt: created,
    };
  });
  for (const l of leads) await done(`leads/${l.id}`, l);

  // --- Products / inventory (30) ---
  const products = PRODUCT_DEFS.map((p, i) => {
    const created = iso(40 - i, 9);
    return {
      id: `seed-product-${i + 1}`,
      ...p,
      nameKey: key(p.name),
      createdAt: created,
      updatedAt: created,
    };
  });
  for (const p of products) await done(`products/${p.id}`, p);

  // --- Orders / quotations / invoices / deliveries / payments (30 each, chained) ---
  const orderStatuses = ["Confirmed", "Delivered", "Draft", "Confirmed", "Cancelled"] as const;
  const quoteStatuses = ["Draft", "Sent", "Accepted", "Rejected", "Sent"] as const;
  for (let i = 0; i < 30; i++) {
    const w = workers[i % workers.length];
    const c = clients[i % clients.length];
    const created = iso(35 - i, 10);
    const p1 = products[i % products.length];
    const p2 = products[(i + 7) % products.length];
    const q1 = (i % 4) + 1;
    const q2 = (i % 3) + 1;
    const lines = [
      { productId: p1.id, description: p1.name, quantity: q1, unitPrice: p1.price },
      { productId: p2.id, description: p2.name, quantity: q2, unitPrice: p2.price },
    ];
    const subtotal = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
    const discount = i % 5 === 0 ? Math.round(subtotal * 0.05) : 0;
    const tax = Math.round(((subtotal - discount) * 18) / 100 * 100) / 100;
    const total = Math.round((subtotal - discount + tax) * 100) / 100;
    const qNum = `Q-2026-${pad(i + 1)}`;
    const oNum = `ORD-2026-${pad(i + 1)}`;
    const vNum = `INV-2026-${pad(i + 1)}`;
    const taskId = `seed-task-${i + 1}`;
    const orderId = `seed-order-${i + 1}`;
    const quoteId = `seed-quotation-${i + 1}`;
    const invId = `seed-invoice-${i + 1}`;
    const delId = `seed-delivery-${i + 1}`;
    const payId = `seed-payment-${i + 1}`;

    await done(`quotations/${quoteId}`, {
      number: qNum, numberKey: key(qNum),
      clientId: c.id, clientName: c.name, clientKey: key(c.name),
      items: lines, subtotal, tax, discount, total,
      status: quoteStatuses[i % quoteStatuses.length],
      issueDate: created.slice(0, 10),
      validUntil: iso(35 - i - 30, 10).slice(0, 10),
      notes: i % 3 === 0 ? "Payment within 15 days of acceptance. Delivery within a week." : undefined,
      orderId, invoiceId: invId, createdAt: created, updatedAt: created,
    });
    await done(`orders/${orderId}`, {
      number: oNum, numberKey: key(oNum),
      clientId: c.id, clientName: c.name, clientKey: key(c.name),
      taskId, quotationId: quoteId, invoiceId: invId, deliveryId: delId,
      items: lines, subtotal, tax, discount, total,
      status: orderStatuses[i % orderStatuses.length],
      mapsUrl: c.mapsUrl, createdAt: created, updatedAt: created,
    });
    const invStatus = i % 4 === 0 ? "Paid" : i % 4 === 1 ? "Partial" : i % 4 === 2 ? "Overdue" : "Unpaid";
    const amountPaid = invStatus === "Paid" ? total : invStatus === "Partial" ? Math.round(total / 2) : 0;
    await done(`invoices/${invId}`, {
      number: vNum, numberKey: key(vNum),
      clientId: c.id, clientName: c.name, clientKey: key(c.name),
      quotationId: quoteId, orderId,
      items: lines, subtotal, tax, discount, total,
      amountPaid,
      issueDate: created.slice(0, 10),
      dueDate: iso(35 - i - 25, 10).slice(0, 10),
      notes: i % 4 === 0 ? "Please pay by the due date to avoid interruption." : undefined,
      status: invStatus,
      createdAt: created, updatedAt: created,
      ...(invStatus === "Paid" ? { paidAt: created } : {}),
    });
    if (invStatus === "Paid" || invStatus === "Partial") {
      await done(`payments/${payId}`, {
        invoiceId: invId, invoiceNumber: vNum, invoiceKey: key(vNum),
        clientId: c.id, clientName: c.name, clientKey: key(c.name),
        amount: amountPaid,
        mode: ["Cash", "UPI", "Bank Transfer"][i % 3],
        date: created.slice(0, 10),
        reference: `REF-${pad(i + 1)}`,
        createdAt: created,
      });
    }
    const delStatus = orderStatuses[i % orderStatuses.length] === "Delivered" ? "Delivered" : i % 3 === 0 ? "Out for Delivery" : "Pending";
    await done(`deliveries/${delId}`, {
      clientId: c.id, clientName: c.name, clientKey: key(c.name),
      invoiceId: invId, orderId, taskId,
      workerId: w.id, workerName: w.name,
      status: delStatus,
      mapsUrl: c.mapsUrl,
      ...(delStatus === "Delivered" ? { proofAt: created } : {}),
      createdAt: created, updatedAt: created,
    });

    // --- Task (30) linked to the chain ---
    const tType = (["Visit", "Sample", "Delivery"] as const)[i % 3];
    const tStatus = delStatus === "Delivered" ? "Done" : i % 3 === 0 ? "In Progress" : "Assigned";
    const sched = iso(35 - i, 10 + (i % 6));
    await done(`tasks/${taskId}`, {
      workerId: w.id, workerName: w.name, workerKey: key(w.name),
      clientId: c.id, clientName: c.name, clientKey: key(c.name),
      type: tType,
      dueDate: sched.slice(0, 10),
      scheduledAt: sched,
      mapsUrl: c.mapsUrl,
      orderId, deliveryId: delId, invoiceId: invId,
      status: tStatus,
      notes: `Seeded ${tType.toLowerCase()} task`,
      createdAt: created, updatedAt: created,
    });

    // --- History entries for the chain ---
    const hid = `seed-hist-${i + 1}`;
    await done(`history/tasks/${taskId}/${hid}`, { action: "Task assigned", detail: `${tType} for ${c.name}`, at: created });
    await done(`history/orders/${orderId}/${hid}`, { action: "Order created", detail: `${oNum} · total ${total}`, at: created });
    await done(`history/deliveries/${delId}/${hid}`, { action: "Delivery created", detail: "Status Pending", at: created });
    await done(`history/invoices/${invId}/${hid}`, { action: "Invoice created", detail: `${vNum} · ${invStatus}`, at: created });
  }

  // Top-up payments so we reach 30 payment records (one per invoice, extra partials)
  for (let i = 0; i < 30; i++) {
    const vNum = `INV-2026-${pad(i + 1)}`;
    const c = clients[i % clients.length];
    const invId = `seed-invoice-${i + 1}`;
    const created = iso(30 - i, 12);
    if (i % 4 === 0 || i % 4 === 1) continue; // already paid above
    await done(`payments/seed-payment-x-${i + 1}`, {
      invoiceId: invId, invoiceNumber: vNum, invoiceKey: key(vNum),
      clientId: c.id, clientName: c.name, clientKey: key(c.name),
      amount: 500 + i * 100,
      mode: "UPI",
      date: created.slice(0, 10),
      reference: `TOPUP-${pad(i + 1)}`,
      createdAt: created,
    });
  }

  // --- Attendance: 25 workers x 2 days = 50 records ---
  for (let i = 0; i < workers.length; i++) {
    for (const [d, li, lo] of [[3, "09:02", "18:05"], [2, "09:15", undefined]] as const) {
      const day = iso(d, 9).slice(0, 10);
      await done(`attendance/${workers[i].id}/${day}`, {
        date: day,
        loginAt: `${day}T${li}:00.000Z`,
        ...(lo ? { logoutAt: `${day}T${lo}:00.000Z`, hoursWorked: 9.05 } : { hoursWorked: 0 }),
      });
    }
  }

  // --- Locations: latest + 3 history points for 10 workers ---
  for (let i = 0; i < 10; i++) {
    const w = workers[i];
    const mapsUrl = `https://www.google.com/maps?q=${(9.97 + i * 0.005).toFixed(4)},${(76.28 + i * 0.005).toFixed(4)}`;
    await done(`locations/${w.id}/latest`, { mapsUrl, timestamp: iso(0, 12), workerName: w.name });
    for (let h = 0; h < 3; h++) {
      await done(`locations/${w.id}/history/seed-hist-${h + 1}`, {
        mapsUrl: `https://www.google.com/maps?q=${(9.96 + i * 0.005 + h * 0.001).toFixed(4)},${(76.27 + i * 0.005).toFixed(4)}`,
        timestamp: iso(h, 10 + h),
      });
    }
  }

  // --- Stock movements for seeded orders ---
  for (let i = 0; i < 30; i++) {
    const p = products[i % products.length];
    await done(`stockMovements/seed-mv-${i + 1}`, {
      productId: p.id,
      productName: p.name,
      delta: -((i % 4) + 1),
      reason: `Seeded order ORD-2026-${pad(i + 1)}`,
      refType: "order",
      refId: `seed-order-${i + 1}`,
      createdAt: iso(35 - i, 10),
    });
  }

  console.log(`Seed complete: ${n} records.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
