/**
 * Offline self-test for pure business logic (no Firebase needed).
 * Usage: npm run selftest
 * Exits non-zero on the first failure.
 */
import {
  COUNTER_MINIMUMS,
  computeNextSequence,
  buildAssignWorkUpdate,
  buildConvertQuotationToProformaUpdate,
  buildConvertProformaToInvoiceUpdate,
  calcTotals,
  deepClean,
  deriveInvoiceStatus,
  fmtMoney,
  formatNumber,
  InsufficientStockError,
  invoiceOutstanding,
  isMapsUrl,
} from "../src/lib/db";
import { isEmailAllowed, getUserRole } from "../src/lib/auth-allowlist";

let failures = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) {
    console.log(`ok - ${name}`);
  } else {
    failures += 1;
    console.error(`FAIL - ${name}`, extra ?? "");
  }
}

// --- maps URL validation ---
check("google maps?q accepted", isMapsUrl("https://www.google.com/maps?q=9.9816,76.2999"));
check("maps.google.com accepted", isMapsUrl("https://maps.google.com/?q=9.98,76.29"));
check("goo.gl share accepted", isMapsUrl("https://maps.app.goo.gl/abcDEF123"));
check("non-map rejected", !isMapsUrl("https://example.com/maps?q=1,2"));
check("empty rejected", !isMapsUrl(""));
check("javascript rejected", !isMapsUrl("javascript:alert(1)"));

// --- totals ---
const t = calcTotals(
  [
    { description: "A", quantity: 2, unitPrice: 100 },
    { description: "B", quantity: 1, unitPrice: 50 },
  ],
  18,
  25,
);
check("subtotal 250", t.subtotal === 250);
check("discount 25", t.discount === 25);
check("tax 40.5", t.tax === 40.5, t);
check("total 265.5", t.total === 265.5, t);

// --- invoice status derivation ---
check("paid", deriveInvoiceStatus({ total: 100, amountPaid: 100 }) === "Paid");
check("partial", deriveInvoiceStatus({ total: 100, amountPaid: 40 }) === "Partial");
check("unpaid future", deriveInvoiceStatus({ total: 100, amountPaid: 0, dueDate: "2099-01-01" }) === "Unpaid");
check("overdue", deriveInvoiceStatus({ total: 100, amountPaid: 0, dueDate: "2020-01-01" }) === "Overdue");
check("outstanding", invoiceOutstanding({ total: 100, amountPaid: 30 }) === 70);
check("money format", fmtMoney(123456) === "₹1,23,456");
check("number format", formatNumber("INV", 7, 2026) === "INV-2026-0007");

// --- counter minimum thresholds ---
check("counter min invoices", COUNTER_MINIMUMS?.invoices === 751);
check("counter min quotations", COUNTER_MINIMUMS?.quotations === 2134);
check("counter min proformaInvoices", COUNTER_MINIMUMS?.proformaInvoices === 1546);

check("fresh invoice counter starts at 751", computeNextSequence?.(null, "invoices") === 751);
check("fresh quote counter starts at 2134", computeNextSequence?.(undefined, "quotations") === 2134);
check("fresh proforma counter starts at 1546", computeNextSequence?.(0, "proformaInvoices") === 1546);
check("existing counter below min elevates to min", computeNextSequence?.(300, "invoices") === 751);
check("existing counter at 751 increments to 752", computeNextSequence?.(751, "invoices") === 752);

check("invoice formatted 751", formatNumber("INV", 751, 2026) === "INV-2026-0751");
check("quote formatted 2134", formatNumber("QUO", 2134, 2026) === "QUO-2026-2134");
check("proforma formatted 1546", formatNumber("PI", 1546, 2026) === "PI-2026-1546");

// --- assign-work atomic builder ---
const products = [
  { id: "p1", name: "Rice Bag", price: 100, stock: 10 },
  { id: "p2", name: "Oil Can", price: 200, stock: 1 },
];
const built = buildAssignWorkUpdate(
  {
    workerId: "w1",
    workerName: "W",
    clientId: "c1",
    clientName: "C",
    type: "Delivery",
    scheduledAt: "2026-10-20T10:00:00.000Z",
    mapsUrl: "https://www.google.com/maps?q=9.98,76.29",
    items: [{ productId: "p1", quantity: 3 }],
    orderNumber: "ORD-2026-0001",
    invoiceNumber: "INV-2026-0001",
  },
  products,
  18,
);
const paths = Object.keys(built.updates);
check("task created", paths.some((p) => p.startsWith("tasks/")));
check("order created", paths.some((p) => p.startsWith("orders/")));
check("delivery pending", Object.entries(built.updates).some(([p, v]) => p.startsWith("deliveries/") && (v as { status: string }).status === "Pending"));
check("invoice unpaid", Object.entries(built.updates).some(([p, v]) => p.startsWith("invoices/") && (v as { status: string }).status === "Unpaid"));
check("stock deducted 10->7", built.updates["products/p1/stock"] === 7, built.updates["products/p1/stock"]);
check("order total 354", (built.updates[`orders/${built.ids.orderId}`] as { total: number }).total === 354);
check(
  "4 history entries",
  paths.filter((p) => p.startsWith("history/")).length === 4,
  paths.filter((p) => p.startsWith("history/")),
);
check("history has no undefined", !paths.some((p) => p.includes("undefined")));

let threw: unknown = null;
try {
  buildAssignWorkUpdate(
    {
      workerId: "w1",
      clientId: "c1",
      type: "Delivery",
      scheduledAt: "2026-10-20T10:00:00.000Z",
      items: [{ productId: "p2", quantity: 5 }],
      orderNumber: "ORD-1",
      invoiceNumber: "INV-1",
    },
    products,
    18,
  );
} catch (e) {
  threw = e;
}
check("short stock throws InsufficientStockError", threw instanceof InsufficientStockError, threw);
check(
  "short item named",
  threw instanceof InsufficientStockError && threw.short[0]?.name === "Oil Can",
  threw instanceof InsufficientStockError ? threw.short : threw,
);

// --- proforma atomic builders ---
const testQuote = {
  id: "q1",
  number: "QUO-2026-2134",
  clientId: "c1",
  clientName: "Client One",
  items: [
    { productId: "p1", description: "Rice Bag", quantity: 2, unitPrice: 100 },
  ],
  subtotal: 200,
  tax: 36,
  discount: 0,
  total: 236,
  status: "Sent" as const,
  createdAt: "2026-10-18T10:00:00.000Z",
  updatedAt: "2026-10-18T10:00:00.000Z",
};

const proformaBuilt = buildConvertQuotationToProformaUpdate?.(testQuote, {
  proformaNumber: "PI-2026-1546",
});
const piPaths = proformaBuilt ? Object.keys(proformaBuilt.updates) : [];
check("quote -> proforma creates proforma record", piPaths.some((p) => p.startsWith("proformaInvoices/")));
check("quote -> proforma marks quote accepted", proformaBuilt?.updates?.["quotations/q1/status"] === "Accepted");
check("quote -> proforma does NOT deduct stock", !piPaths.some((p) => p.includes("stock")));

const testProforma = {
  id: proformaBuilt?.proformaId ?? "pi1",
  number: "PI-2026-1546",
  clientId: "c1",
  clientName: "Client One",
  items: [
    { productId: "p1", description: "Rice Bag", quantity: 2, unitPrice: 100 },
  ],
  subtotal: 200,
  tax: 36,
  discount: 0,
  total: 236,
  status: "Accepted" as const,
  createdAt: "2026-10-18T11:00:00.000Z",
  updatedAt: "2026-10-18T11:00:00.000Z",
};

const proformaToInvBuilt = buildConvertProformaToInvoiceUpdate?.(
  testProforma,
  products,
  {
    orderNumber: "ORD-2026-0002",
    invoiceNumber: "INV-2026-0751",
  }
);
const p2iPaths = proformaToInvBuilt ? Object.keys(proformaToInvBuilt.updates) : [];
check("proforma -> invoice creates order", p2iPaths.some((p) => p.startsWith("orders/")));
check("proforma -> invoice creates invoice", p2iPaths.some((p) => p.startsWith("invoices/")));
check("proforma -> invoice marks proforma invoiced", proformaToInvBuilt?.updates?.[`proformaInvoices/${testProforma.id}/status`] === "Invoiced");
check("proforma -> invoice deducts stock 10->8", proformaToInvBuilt?.updates?.["products/p1/stock"] === 8);
check("proforma -> invoice records stock movement", p2iPaths.some((p) => p.startsWith("stockMovements/")));

// --- auth allowlist checks ---
check("developer aathishpirate allowed", isEmailAllowed("aathishpirate@gmail.com"));
check("developer role matches", getUserRole("aathishpirate@gmail.com") === "developer");
check("owner tagverse allowed", isEmailAllowed("tagverse.iio@gmail.com"));
check("owner role matches", getUserRole("tagverse.iio@gmail.com") === "owner");
check("admin lentone allowed", isEmailAllowed("lentonecp@gmail.com"));
check("admin role matches", getUserRole("lentonecp@gmail.com") === "admin");
check("case-insensitive & trimmed allowed", isEmailAllowed("  AaThIsHpIrAtE@gmail.com  "));
check("unauthorized email rejected", !isEmailAllowed("stranger@example.com"));
check("unauthorized role falls back safely", getUserRole("stranger@example.com") === "viewer");
check("dynamic allowed user works", isEmailAllowed("newperson@lentone.com", { u1: { email: "newperson@lentone.com", role: "admin" } }));
check("dynamic role resolved", getUserRole("newperson@lentone.com", { u1: { email: "newperson@lentone.com", role: "sales" } }) === "sales");

// --- deepClean checks for Firebase persistence ---
const rawNested = {
  quotation_number: "QUO-2026-2134",
  topUndefined: undefined,
  amount: 0,
  active: false,
  emptyStr: "",
  nullVal: null,
  nested: {
    valid: "ok",
    nestedUndefined: undefined,
  },
  items: [
    { name: "Item 1", product_id: undefined, quantity: 1, unitPrice: 50 },
    { name: "Item 2", product_id: "p1", quantity: 2, unitPrice: 100 },
  ],
  arrayWithUndefined: [1, undefined, 2],
};

const cleaned = deepClean(rawNested);
check("deepClean removes topUndefined", !("topUndefined" in cleaned));
check("deepClean removes nestedUndefined", !("nestedUndefined" in (cleaned.nested as any)));
check("deepClean removes product_id undefined from item 0", !("product_id" in (cleaned.items[0] as any)));
check("deepClean preserves product_id on item 1", (cleaned.items[1] as any).product_id === "p1");
check("deepClean preserves 0", cleaned.amount === 0);
check("deepClean preserves false", cleaned.active === false);
check("deepClean preserves empty string", cleaned.emptyStr === "");
check("deepClean preserves null", cleaned.nullVal === null);
check("deepClean removes undefined from primitive array", cleaned.arrayWithUndefined.length === 2 && cleaned.arrayWithUndefined[1] === 2);

function containsAnyUndefined(val: any): boolean {
  if (val === undefined) return true;
  if (val === null) return false;
  if (Array.isArray(val)) return val.some(containsAnyUndefined);
  if (typeof val === "object") return Object.values(val).some(containsAnyUndefined);
  return false;
}
check("cleaned payload has zero undefined properties anywhere", !containsAnyUndefined(cleaned));

if (failures > 0) {
  console.error(`${failures} failure(s)`);
  process.exit(1);
}
console.log("selftest: all passed");
