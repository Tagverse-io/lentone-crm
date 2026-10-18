import {
  ref,
  child,
  get,
  set,
  push,
  update,
  remove,
  query,
  orderByChild,
  limitToFirst,
  limitToLast,
  startAt,
  endAt,
  equalTo,
  runTransaction,
} from "firebase/database";
import { getFirebaseDatabase } from "./firebase";

// ===== Flat Realtime Database model (single source of truth) =====
// /clients/{id}, /leads/{id}, /workers/{id}, /tasks/{id},
// /attendance/{workerId}/{date}, /locations/{workerId}/latest,
// /locations/{workerId}/history/{pushId}, /products/{id},
// /stockMovements/{id}, /orders/{id}, /quotations/{id},
// /invoices/{id}, /payments/{id}, /deliveries/{id},
// /deliveryProofs/{deliveryId}, /history/{entity}/{id}/{pushId},
// /counters/{name}, /settings
//
// NOTE: the web UI uses polling only (see lib/realtime.ts). No realtime
// listeners (onValue), SSE or WebSocket code lives in the frontend.

export const CLIENT_CATEGORIES = [
  "Hotel",
  "Restaurant",
  "Mall",
  "School",
  "Office",
  "PG",
  "Bakery",
  "Catering",
] as const;
export type ClientCategory = (typeof CLIENT_CATEGORIES)[number];

export type CustomValue = string | number | boolean | null | undefined;

export interface Client {
  id: string;
  name: string;
  nameKey?: string;
  category: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  gstin?: string;
  mapsUrl?: string;
  notes?: string;
  custom?: Record<string, CustomValue>;
  legacy?: boolean;
  migratedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export const LEAD_STAGES = [
  "New",
  "Contacted",
  "Qualified",
  "Proposal",
  "Negotiation",
  "Won",
  "Lost",
] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

export interface Lead {
  id: string;
  contactName: string;
  nameKey?: string;
  email?: string;
  phone?: string;
  clientId?: string;
  clientName?: string;
  stage: LeadStage;
  value?: number;
  notes?: string;
  custom?: Record<string, CustomValue>;
  legacy?: boolean;
  migratedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Worker {
  id: string;
  name: string;
  nameKey?: string;
  phone?: string;
  active: boolean;
  legacy?: boolean;
  createdAt: string;
}

export const FIELD_TASK_STATUSES = ["Assigned", "In Progress", "Done"] as const;
export type FieldTaskStatus = (typeof FIELD_TASK_STATUSES)[number];
export const FIELD_TASK_TYPES = ["Visit", "Sample", "Delivery"] as const;
export type FieldTaskType = (typeof FIELD_TASK_TYPES)[number];

export interface FieldTask {
  id: string;
  workerId: string;
  workerName?: string;
  workerKey?: string;
  clientId: string;
  clientName?: string;
  clientKey?: string;
  type: FieldTaskType;
  dueDate: string; // YYYY-MM-DD (kept for compat)
  scheduledAt?: string; // ISO datetime of the visit
  mapsUrl?: string;
  orderId?: string;
  deliveryId?: string;
  invoiceId?: string;
  status: FieldTaskStatus;
  notes?: string;
  legacy?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceRecord {
  date: string; // YYYY-MM-DD
  loginAt?: string; // ISO timestamp
  logoutAt?: string; // ISO timestamp
  hoursWorked?: number;
}

export interface LocationLatest {
  mapsUrl: string;
  timestamp: string;
  workerName?: string;
}

export interface LocationHistoryEntry {
  id: string;
  mapsUrl: string;
  timestamp: string;
}

// ----- Inventory -----

export interface Product {
  id: string;
  name: string;
  nameKey?: string;
  sku: string;
  category: string;
  unit: string; // L, can, piece, ...
  stock: number;
  price: number;
  lowThreshold: number;
  custom?: Record<string, CustomValue>;
  legacy?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StockMovement {
  id: string;
  productId: string;
  productName?: string;
  delta: number; // negative = out, positive = in
  reason: string;
  refType?: string; // e.g. "order", "adjustment", "seed"
  refId?: string;
  createdAt: string;
}

// ----- Orders -----

export const ORDER_STATUSES = ["Draft", "Confirmed", "Delivered", "Cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface OrderLineItem extends QuotationLineItem {
  productId?: string;
}

export interface Order {
  id: string;
  number: string;
  numberKey?: string;
  clientId: string;
  clientName?: string;
  clientKey?: string;
  taskId?: string;
  quotationId?: string;
  proformaInvoiceId?: string;
  invoiceId?: string;
  deliveryId?: string;
  items: OrderLineItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  status: OrderStatus;
  mapsUrl?: string;
  legacy?: boolean;
  createdAt: string;
  updatedAt: string;
}

// ----- Revenue -----

export interface QuotationLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  productId?: string;
  unit?: string;
}

export const QUOTATION_STATUSES = ["Draft", "Sent", "Accepted", "Rejected"] as const;
export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];

export interface Quotation {
  id: string;
  number: string;
  numberKey?: string;
  clientId: string;
  clientName?: string;
  clientKey?: string;
  items: QuotationLineItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  status: QuotationStatus;
  issueDate?: string; // YYYY-MM-DD
  validUntil?: string; // YYYY-MM-DD
  notes?: string;
  orderId?: string;
  invoiceId?: string;
  proformaInvoiceId?: string;
  legacy?: boolean;
  createdAt: string;
  updatedAt: string;
}

export const PROFORMA_STATUSES = ["Draft", "Sent", "Accepted", "Invoiced", "Cancelled"] as const;
export type ProformaStatus = (typeof PROFORMA_STATUSES)[number];

export interface ProformaInvoice {
  id: string;
  number: string;
  numberKey?: string;
  quotationId?: string;
  quotationNumber?: string;
  clientId: string;
  clientName?: string;
  clientKey?: string;
  items: QuotationLineItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  currency?: string;
  status: ProformaStatus;
  orderId?: string;
  invoiceId?: string;
  issueDate?: string; // YYYY-MM-DD
  validUntil?: string; // YYYY-MM-DD
  notes?: string;
  terms?: string;
  custom?: Record<string, CustomValue>;
  legacy?: boolean;
  createdAt: string;
  updatedAt: string;
}

export const INVOICE_STATUSES = ["Unpaid", "Partial", "Paid", "Overdue"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export interface Invoice {
  id: string;
  number: string;
  numberKey?: string;
  clientId: string;
  clientName?: string;
  clientKey?: string;
  quotationId?: string;
  proformaInvoiceId?: string;
  orderId?: string;
  items: QuotationLineItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  amountPaid: number;
  issueDate?: string; // YYYY-MM-DD
  dueDate?: string; // YYYY-MM-DD
  notes?: string;
  status: InvoiceStatus;
  createdAt: string;
  updatedAt: string;
  paidAt?: string;
}

export const PAYMENT_MODES = ["Cash", "UPI", "Card", "Bank Transfer", "Cheque"] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

export interface Payment {
  id: string;
  invoiceId: string;
  invoiceNumber?: string;
  invoiceKey?: string;
  clientId?: string;
  clientName?: string;
  clientKey?: string;
  amount: number;
  mode: PaymentMode;
  date: string; // YYYY-MM-DD
  reference?: string;
  legacy?: boolean;
  createdAt: string;
}

export const DELIVERY_STATUSES = ["Pending", "Out for Delivery", "Delivered"] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export interface Delivery {
  id: string;
  clientId: string;
  clientName?: string;
  clientKey?: string;
  invoiceId?: string;
  orderId?: string;
  taskId?: string;
  workerId?: string;
  workerName?: string;
  status: DeliveryStatus;
  mapsUrl?: string;
  proofAt?: string;
  legacy?: boolean;
  createdAt: string;
  updatedAt: string;
}

// ----- History -----

export interface HistoryEntry {
  id: string;
  action: string;
  detail?: string;
  at: string;
  by?: string;
}

// ----- Settings -----

export type CustomFieldType = "text" | "number" | "date" | "select";

export interface CustomFieldDef {
  key: string;
  label: string;
  type: CustomFieldType;
  options?: string[];
}

export type CustomFieldEntity = "clients" | "leads" | "products";

export type PdfTemplateStyle = 'modern' | 'corporate' | 'minimal';

export interface AppSettings {
  companyName: string;
  logo?: string;
  tagline?: string;
  address?: string;
  gstin?: string;
  taxRate: number; // percent, e.g. 18
  currency: string; // symbol, e.g. ₹
  invoicePrefix: string;
  quotationPrefix: string;
  proformaPrefix: string;
  orderPrefix: string;
  defaultRowsPerPage: number;
  defaultTaskSlot: string; // "HH:MM"
  lowStockThreshold: number;
  workingHoursStart: string; // "HH:MM"
  workingHoursEnd: string; // "HH:MM"
  clientCategories: string[];
  customFields: Record<CustomFieldEntity, CustomFieldDef[]>;
  // PDF / Document branding
  primaryColor: string;        // hex, e.g. #2563eb
  templateStyle: PdfTemplateStyle;
  companyPhone?: string;
  companyEmail?: string;
  companyWebsite?: string;
  bankName?: string;
  bankAccount?: string;
  bankIfsc?: string;
  upiId?: string;
  defaultNotes?: string;
  defaultTerms?: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  companyName: "Lentone Consumer Products",
  tagline: "PREMIUM CLEANING AND HYGIENE SOLUTIONS",
  address: "Padur, Rajiv Gandhi Salai (OMR), Chennai – 603103",
  gstin: "33OHMPS7204B1Z6",
  taxRate: 18,
  currency: "₹",
  invoicePrefix: "INV",
  quotationPrefix: "QUO",
  proformaPrefix: "PI",
  orderPrefix: "ORD",
  defaultRowsPerPage: 25,
  defaultTaskSlot: "10:00",
  lowStockThreshold: 10,
  workingHoursStart: "09:00",
  workingHoursEnd: "18:00",
  clientCategories: [...CLIENT_CATEGORIES],
  customFields: { clients: [], leads: [], products: [] },
  primaryColor: "#2563eb",
  templateStyle: "modern",
  companyPhone: "+91 74489 98628",
  companyEmail: "aathishpirate@gmail.com",
  companyWebsite: "",
  bankName: "",
  bankAccount: "",
  bankIfsc: "",
  upiId: "",
  defaultNotes: "",
  defaultTerms: "",
};

export type CollectionPath =
  | "clients"
  | "leads"
  | "workers"
  | "tasks"
  | "products"
  | "stockMovements"
  | "orders"
  | "quotations"
  | "proformaInvoices"
  | "invoices"
  | "payments"
  | "deliveries";

// ----- Pure helpers (no Firebase — unit-testable) -----

export function nowIso(): string {
  return new Date().toISOString();
}

export function nameKeyOf(name: string): string {
  return name.trim().toLowerCase();
}

export function quotationTotal(items: QuotationLineItem[]): number {
  return items.reduce((sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);
}

export function calcTotals(
  items: QuotationLineItem[],
  taxRate: number,
  discount: number,
): { subtotal: number; tax: number; discount: number; total: number } {
  const subtotal = quotationTotal(items);
  const d = Math.min(Math.max(Number(discount) || 0, 0), subtotal);
  const tax = Math.round(((subtotal - d) * (Number(taxRate) || 0)) / 100 * 100) / 100;
  return { subtotal, tax, discount: d, total: Math.round((subtotal - d + tax) * 100) / 100 };
}

export function fmtMoney(n: number | undefined, currency = "₹"): string {
  return `${currency}${(Number(n) || 0).toLocaleString("en-IN")}`;
}

/** Build the Google Maps URL the Expo app sends for a GPS fix. No map SDK involved. */
export function buildMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

/** Accept google.com/maps, maps.google.com and maps.app.goo.gl links. */
export function isMapsUrl(url: string): boolean {
  if (!url) return false;
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  const host = u.hostname.toLowerCase();
  if (host === "maps.app.goo.gl" || host.endsWith(".app.goo.gl")) return true;
  if (host === "maps.google.com" || host.endsWith(".maps.google.com")) {
    return u.pathname.startsWith("/maps") || u.searchParams.has("q");
  }
  if (host === "google.com" || host.endsWith(".google.com")) {
    return u.pathname.startsWith("/maps");
  }
  return false;
}

/** Parse a google.com/maps?q=lat,lng URL back to coordinates. Returns null when unparseable. */
export function parseMapsUrl(mapsUrl: string): { lat: number; lng: number } | null {
  const m = mapsUrl.match(/[?&]?q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

/** Derive the effective invoice status from totals + payments + due date. */
export function deriveInvoiceStatus(inv: {
  total: number;
  amountPaid?: number;
  dueDate?: string;
  status?: InvoiceStatus;
}): InvoiceStatus {
  const paid = Number(inv.amountPaid) || 0;
  const total = Number(inv.total) || 0;
  const today = new Date().toISOString().slice(0, 10);
  if (paid >= total && total > 0) return "Paid";
  if (paid > 0) return "Partial";
  if (inv.dueDate && inv.dueDate < today) return "Overdue";
  return "Unpaid";
}

export function invoiceOutstanding(inv: { total: number; amountPaid?: number }): number {
  return Math.max(0, (Number(inv.total) || 0) - (Number(inv.amountPaid) || 0));
}

function clean<T extends object>(data: T): T {
  const out = { ...data } as Record<string, unknown>;
  for (const k of Object.keys(out)) {
    if (out[k] === undefined) delete out[k];
  }
  return out as T;
}

function toList<T>(val: unknown): (T & { id: string })[] {
  if (!val || typeof val !== "object") return [];
  return Object.entries(val as Record<string, unknown>)
    .filter(([, v]) => v && typeof v === "object")
    .map(([id, v]) => ({ id, ...(v as object) }) as T & { id: string });
}

export function newPushKey(path: string): string {
  return push(child(ref(getFirebaseDatabase()), path)).key as string;
}

// ----- Generic helpers (client SDK, authenticated user, polling reads) -----

export async function getCollection<T>(path: string): Promise<(T & { id: string })[]> {
  const snap = await get(ref(getFirebaseDatabase(), path));
  return toList<T>(snap.val());
}

const countCache = new Map<string, { n: number; at: number }>();

/** Collection size, cached 60s per path so polling tables stay cheap. */
export async function getCount(path: string): Promise<number> {
  const c = countCache.get(path);
  if (c && Date.now() - c.at < 60_000) return c.n;
  const snap = await get(ref(getFirebaseDatabase(), path));
  const v = snap.val();
  const n = v && typeof v === "object" ? Object.keys(v).length : 0;
  countCache.set(path, { n, at: Date.now() });
  return n;
}

export async function createItem<T extends object>(path: string, data: T): Promise<string> {
  const db = getFirebaseDatabase();
  const r = push(ref(db, path));
  const stamp = nowIso();
  await set(r, clean({ ...data, createdAt: stamp, updatedAt: stamp }));
  return r.key as string;
}

export async function updateItem(path: string, id: string, patch: Record<string, unknown>): Promise<void> {
  await update(ref(getFirebaseDatabase(), `${path}/${id}`), clean({ ...patch, updatedAt: nowIso() }));
}

export async function removeItem(path: string, id: string): Promise<void> {
  await remove(ref(getFirebaseDatabase(), `${path}/${id}`));
}

export async function getItem<T>(path: string, id: string): Promise<(T & { id: string }) | null> {
  const snap = await get(ref(getFirebaseDatabase(), `${path}/${id}`));
  if (!snap.exists()) return null;
  return { id, ...(snap.val() as object) } as T & { id: string };
}

// ----- Cursor pagination (orderByChild + limitToLast/endAt — never loads everything) -----

export interface PageCursor {
  value: string | number;
  key: string;
}

export interface PageResult<T> {
  rows: (T & { id: string })[];
  next: PageCursor | null;
  hasMore: boolean;
}

function cursorOf<T>(orderBy: string, row: T & { id: string }): PageCursor {
  const v = (row as Record<string, unknown>)[orderBy];
  return { value: (typeof v === "number" ? v : String(v ?? "")) as string | number, key: row.id };
}

function sortRowsDesc<T>(rows: (T & { id: string })[], orderBy: string): (T & { id: string })[] {
  return [...rows].sort((a, b) => {
    const av = String((a as Record<string, unknown>)[orderBy] ?? "");
    const bv = String((b as Record<string, unknown>)[orderBy] ?? "");
    if (bv !== av) return bv < av ? -1 : 1;
    return b.id < a.id ? -1 : 1;
  });
}

/**
 * Newest-first cursor page over `orderBy` (usually `createdAt`).
 * Page 1: limitToLast(pageSize+1). Next: endAt(cursor)+limitToLast.
 */
export async function fetchPage<T>(
  path: string,
  orderBy: string,
  pageSize: number,
  endBefore?: PageCursor | null,
): Promise<PageResult<T>> {
  const db = getFirebaseDatabase();
  const base = ref(db, path);
  const q = endBefore
    ? query(base, orderByChild(orderBy), endAt(endBefore.value, endBefore.key), limitToLast(pageSize + 1))
    : query(base, orderByChild(orderBy), limitToLast(pageSize + 1));
  let asc = toList<T>((await get(q)).val());
  if (endBefore && asc.length > 0) asc = asc.slice(0, -1); // drop inclusive boundary
  const hasMore = asc.length > pageSize;
  if (hasMore) asc = asc.slice(asc.length - pageSize);
  // rows newest-first; next cursor anchors the oldest row of this page
  const oldest = asc.length > 0 ? asc[0] : null;
  return { rows: sortRowsDesc(asc, orderBy), next: hasMore && oldest ? cursorOf(orderBy, oldest) : null, hasMore };
}

/** Bounded prefix search (case-insensitive contains filter on the fetched window). */
export async function searchByPrefix<T>(
  path: string,
  field: string,
  prefix: string,
  limit = 100,
): Promise<(T & { id: string })[]> {
  const db = getFirebaseDatabase();
  const p = prefix.trim().toLowerCase();
  if (!p) return [];
  const q = query(ref(db, path), orderByChild(field), startAt(p), endAt(`${p}\uf8ff`), limitToFirst(limit));
  const rows = toList<T>((await get(q)).val());
  const needle = p;
  return rows.filter((r) =>
    String((r as Record<string, unknown>)[field] ?? "").toLowerCase().includes(needle),
  );
}

/** Bounded equality filter (e.g. status/category/clientId), newest-first. */
export async function filterEqual<T>(
  path: string,
  field: string,
  value: string,
  orderBy = "createdAt",
  limit = 500,
): Promise<(T & { id: string })[]> {
  const db = getFirebaseDatabase();
  const q = query(ref(db, path), orderByChild(field), equalTo(value), limitToFirst(limit));
  return sortRowsDesc(toList<T>((await get(q)).val()), orderBy);
}

// ----- History -----

export async function logHistory(
  entity: string,
  id: string,
  action: string,
  detail?: string,
  by?: string,
): Promise<void> {
  const entry: Record<string, unknown> = { action, at: nowIso() };
  if (detail) entry.detail = detail;
  if (by) entry.by = by;
  await set(push(child(ref(getFirebaseDatabase()), `history/${entity}/${id}`)), entry);
}

export async function getHistory(entity: string, id: string): Promise<HistoryEntry[]> {
  const snap = await get(ref(getFirebaseDatabase(), `history/${entity}/${id}`));
  return toList<HistoryEntry>(snap.val()).sort((a, b) => b.at.localeCompare(a.at));
}

// ----- Counters → auto-numbering (INV-2026-0007 style) -----

export const COUNTER_MINIMUMS: Record<string, number> = {
  invoices: 751,
  quotations: 2134,
  proformaInvoices: 1546,
};

export function computeNextSequence(current: number | null | undefined, name: string): number {
  const min = COUNTER_MINIMUMS[name] ?? 1;
  if (typeof current !== "number" || current < min) {
    return min;
  }
  return current + 1;
}

export async function nextSequence(name: string): Promise<number> {
  const db = getFirebaseDatabase();
  const res = await runTransaction(ref(db, `counters/${name}`), (cur) => computeNextSequence(cur, name));
  return (res.snapshot.val() as number) ?? (COUNTER_MINIMUMS[name] ?? 1);
}

export function formatNumber(prefix: string, seq: number, year = new Date().getFullYear()): string {
  return `${prefix}-${year}-${String(seq).padStart(4, "0")}`;
}

// ----- Settings -----

export async function getSettings(): Promise<AppSettings> {
  try {
    const snap = await get(ref(getFirebaseDatabase(), "settings"));
    const v = snap.val() as Partial<AppSettings> | null;
    if (!v || typeof v !== "object") return DEFAULT_SETTINGS;
    return {
      ...DEFAULT_SETTINGS,
      ...v,
      customFields: { ...DEFAULT_SETTINGS.customFields, ...(v.customFields ?? {}) },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(s: AppSettings): Promise<void> {
  await set(ref(getFirebaseDatabase(), "settings"), clean(s));
}

// ----- Assign Work: one atomic multi-path update -----
// Creates task + order + delivery + invoice, deducts stock, writes history.
// Throws InsufficientStockError (lists the short items) before writing anything.

export class InsufficientStockError extends Error {
  readonly short: { productId: string; name: string; need: number; have: number }[];
  constructor(short: { productId: string; name: string; need: number; have: number }[]) {
    super(
      `Not enough stock: ${short.map((s) => `${s.name} (need ${s.need}, have ${s.have})`).join("; ")}`,
    );
    this.name = "InsufficientStockError";
    this.short = short;
  }
}

export interface AssignWorkLine {
  productId: string;
  quantity: number;
}

export interface AssignWorkInput {
  workerId: string;
  workerName?: string;
  clientId: string;
  clientName?: string;
  type: FieldTaskType;
  scheduledAt: string; // ISO datetime
  mapsUrl?: string;
  items: AssignWorkLine[];
  notes?: string;
  by?: string;
  orderNumber: string;
  invoiceNumber: string;
}

export interface AssignWorkProduct {
  id: string;
  name: string;
  price: number;
  stock: number;
}

/** Pure builder: validates stock + builds every path update. No Firebase I/O. */
export function buildAssignWorkUpdate(
  input: AssignWorkInput,
  products: AssignWorkProduct[],
  taxRate: number,
): {
  updates: Record<string, unknown>;
  ids: { taskId: string; orderId: string; deliveryId: string; invoiceId: string };
} {
  const stamp = nowIso();
  const byId = new Map(products.map((p) => [p.id, p]));
  const short: { productId: string; name: string; need: number; have: number }[] = [];
  const lines: OrderLineItem[] = [];
  for (const it of input.items) {
    const p = byId.get(it.productId);
    if (!p) throw new Error(`Product not found: ${it.productId}`);
    const qty = Number(it.quantity) || 0;
    if (qty <= 0) throw new Error(`Quantity must be positive for ${p.name}`);
    if (p.stock < qty) short.push({ productId: p.id, name: p.name, need: qty, have: p.stock });
    lines.push({ productId: p.id, description: p.name, quantity: qty, unitPrice: p.price });
  }
  if (short.length > 0) throw new InsufficientStockError(short);

  // Push-style keys without writing (same shape as push().key).
  const rid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  const taskId = rid();
  const orderId = rid();
  const deliveryId = rid();
  const invoiceId = rid();

  const totals = calcTotals(lines, taxRate, 0);
  const dueDate = input.scheduledAt.slice(0, 10);
  const updates: Record<string, unknown> = {};

  updates[`tasks/${taskId}`] = clean({
    workerId: input.workerId,
    workerName: input.workerName,
    workerKey: input.workerName ? nameKeyOf(input.workerName) : undefined,
    clientId: input.clientId,
    clientName: input.clientName,
    clientKey: input.clientName ? nameKeyOf(input.clientName) : undefined,
    type: input.type,
    dueDate,
    scheduledAt: input.scheduledAt,
    mapsUrl: input.mapsUrl,
    orderId,
    deliveryId,
    invoiceId,
    status: "Assigned",
    notes: input.notes,
    createdAt: stamp,
    updatedAt: stamp,
  });

  updates[`orders/${orderId}`] = clean({
    number: input.orderNumber,
    numberKey: nameKeyOf(input.orderNumber),
    clientId: input.clientId,
    clientName: input.clientName,
    clientKey: input.clientName ? nameKeyOf(input.clientName) : undefined,
    taskId,
    deliveryId,
    invoiceId,
    items: lines,
    ...totals,
    discount: 0,
    status: "Confirmed",
    mapsUrl: input.mapsUrl,
    createdAt: stamp,
    updatedAt: stamp,
  });

  updates[`deliveries/${deliveryId}`] = clean({
    clientId: input.clientId,
    clientName: input.clientName,
    clientKey: input.clientName ? nameKeyOf(input.clientName) : undefined,
    invoiceId,
    orderId,
    taskId,
    workerId: input.workerId,
    workerName: input.workerName,
    status: "Pending",
    mapsUrl: input.mapsUrl,
    createdAt: stamp,
    updatedAt: stamp,
  });

  updates[`invoices/${invoiceId}`] = clean({
    number: input.invoiceNumber,
    numberKey: nameKeyOf(input.invoiceNumber),
    clientId: input.clientId,
    clientName: input.clientName,
    clientKey: input.clientName ? nameKeyOf(input.clientName) : undefined,
    orderId,
    items: lines,
    ...totals,
    discount: 0,
    amountPaid: 0,
    status: "Unpaid",
    createdAt: stamp,
    updatedAt: stamp,
  });

  for (const it of input.items) {
    const p = byId.get(it.productId)!;
    updates[`products/${p.id}/stock`] = p.stock - (Number(it.quantity) || 0);
    updates[`products/${p.id}/updatedAt`] = stamp;
    updates[`stockMovements/${rid()}`] = {
      productId: p.id,
      productName: p.name,
      delta: -(Number(it.quantity) || 0),
      reason: `Assigned work → order ${input.orderNumber}`,
      refType: "order",
      refId: orderId,
      createdAt: stamp,
    };
  }

  const hist = (msg: string, detail?: string) => ({ action: msg, detail, at: stamp, ...(input.by ? { by: input.by } : {}) });
  updates[`history/tasks/${taskId}/${rid()}`] = hist("Task assigned", `${input.type} for ${input.clientName ?? input.clientId} at ${input.scheduledAt}`);
  updates[`history/orders/${orderId}/${rid()}`] = hist("Order created", `${input.orderNumber} · ${lines.length} line(s) · total ${totals.total}`);
  updates[`history/deliveries/${deliveryId}/${rid()}`] = hist("Delivery created", "Status Pending");
  updates[`history/invoices/${invoiceId}/${rid()}`] = hist("Invoice created", `${input.invoiceNumber} · Unpaid`);

  return { updates, ids: { taskId, orderId, deliveryId, invoiceId } };
}

/** Reads fresh stock, then commits the atomic update. */
export async function assignWorkAtomic(input: AssignWorkInput, taxRate: number): Promise<AssignWorkInput & { taskId: string; orderId: string; deliveryId: string; invoiceId: string }> {
  const snap = await get(ref(getFirebaseDatabase(), "products"));
  const products = toList<Product>(snap.val()).map((p) => ({
    id: p.id,
    name: p.name ?? "(unnamed)",
    price: Number(p.price) || 0,
    stock: Number(p.stock) || 0,
  }));
  const { updates, ids } = buildAssignWorkUpdate(input, products, taxRate);
  await update(ref(getFirebaseDatabase()), updates);
  return { ...input, ...ids };
}

/** Mark a delivery Delivered → completes the linked task + order, with history. */
export async function completeDeliveryCascade(deliveryId: string, by?: string): Promise<void> {
  const db = getFirebaseDatabase();
  const snap = await get(ref(db, `deliveries/${deliveryId}`));
  if (!snap.exists()) throw new Error("Delivery not found");
  const d = snap.val() as Delivery & { taskId?: string; orderId?: string };
  const stamp = nowIso();
  const updates: Record<string, unknown> = {
    [`deliveries/${deliveryId}/status`]: "Delivered",
    [`deliveries/${deliveryId}/proofAt`]: d.proofAt ?? stamp,
    [`deliveries/${deliveryId}/updatedAt`]: stamp,
  };
  const hist = (msg: string, detail?: string) => ({ action: msg, detail, at: stamp, ...(by ? { by } : {}) });
  updates[`history/deliveries/${deliveryId}/${push(child(ref(db), "history/placeholder")).key}`] = hist("Delivered", d.proofAt ? "Proof photo attached" : undefined);
  if (d.taskId) {
    updates[`tasks/${d.taskId}/status`] = "Done";
    updates[`tasks/${d.taskId}/updatedAt`] = stamp;
    updates[`history/tasks/${d.taskId}/${push(child(ref(db), "history/placeholder")).key}`] = hist("Task done", "Delivery delivered");
  }
  if (d.orderId) {
    updates[`orders/${d.orderId}/status`] = "Delivered";
    updates[`orders/${d.orderId}/updatedAt`] = stamp;
    updates[`history/orders/${d.orderId}/${push(child(ref(db), "history/placeholder")).key}`] = hist("Order delivered", `Delivery ${deliveryId}`);
  }
  await update(ref(db), clean(updates));
}

/** Record a payment → recalculates invoice status/paid totals automatically. */
export async function recordPaymentAtomic(args: {
  invoiceId: string;
  amount: number;
  mode: PaymentMode;
  date: string;
  reference?: string;
  by?: string;
}): Promise<void> {
  const db = getFirebaseDatabase();
  const snap = await get(ref(db, `invoices/${args.invoiceId}`));
  if (!snap.exists()) throw new Error("Invoice not found");
  const inv = snap.val() as Invoice;
  if ((Number(args.amount) || 0) <= 0) throw new Error("Amount must be positive");
  const outstanding = invoiceOutstanding(inv);
  if ((Number(args.amount) || 0) - outstanding > 0.009) {
    throw new Error(`Amount exceeds outstanding ${outstanding}`);
  }
  const stamp = nowIso();
  const paid = (Number(inv.amountPaid) || 0) + (Number(args.amount) || 0);
  const status = deriveInvoiceStatus({ total: inv.total, amountPaid: paid, dueDate: inv.dueDate });
  const updates: Record<string, unknown> = {};
  const payId = push(child(ref(db), "payments")).key as string;
  updates[`payments/${payId}`] = clean({
    invoiceId: args.invoiceId,
    invoiceNumber: inv.number,
    clientId: inv.clientId,
    clientName: inv.clientName,
    amount: Number(args.amount),
    mode: args.mode,
    date: args.date,
    reference: args.reference,
    createdAt: stamp,
  });
  updates[`invoices/${args.invoiceId}/amountPaid`] = Math.round(paid * 100) / 100;
  updates[`invoices/${args.invoiceId}/status`] = status;
  updates[`invoices/${args.invoiceId}/updatedAt`] = stamp;
  if (status === "Paid") updates[`invoices/${args.invoiceId}/paidAt`] = stamp;
  const hist = { action: `Payment ${args.amount} (${args.mode})`, detail: args.reference, at: stamp, ...(args.by ? { by: args.by } : {}) };
  updates[`history/invoices/${args.invoiceId}/${push(child(ref(db), "history/placeholder")).key}`] = clean(hist);
  await update(ref(db), clean(updates));
}

/** Convert an accepted quotation → order + invoice (deducts stock atomically). */
export async function convertQuotationAtomic(
  quotation: Quotation,
  args: { orderNumber: string; invoiceNumber: string; taskId?: string; deliveryId?: string; by?: string },
): Promise<{ orderId: string; invoiceId: string }> {
  const db = getFirebaseDatabase();
  const snap = await get(ref(db, "products"));
  const products = toList<Product>(snap.val()).map((p) => ({
    id: p.id,
    name: p.name ?? "(unnamed)",
    price: Number(p.price) || 0,
    stock: Number(p.stock) || 0,
  }));
  const byId = new Map(products.map((p) => [p.id, p]));
  const short: { productId: string; name: string; need: number; have: number }[] = [];
  for (const it of quotation.items) {
    if (!it.productId) continue;
    const p = byId.get(it.productId);
    if (!p) throw new Error(`Product not found: ${it.productId}`);
    if (p.stock < (Number(it.quantity) || 0)) {
      short.push({ productId: p.id, name: p.name, need: Number(it.quantity) || 0, have: p.stock });
    }
  }
  if (short.length > 0) throw new InsufficientStockError(short);

  const stamp = nowIso();
  const rid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  const orderId = rid();
  const invoiceId = rid();
  const updates: Record<string, unknown> = {};
  updates[`orders/${orderId}`] = clean({
    number: args.orderNumber,
    numberKey: nameKeyOf(args.orderNumber),
    clientId: quotation.clientId,
    clientName: quotation.clientName,
    clientKey: quotation.clientName ? nameKeyOf(quotation.clientName) : undefined,
    taskId: args.taskId,
    quotationId: quotation.id,
    invoiceId,
    deliveryId: args.deliveryId,
    items: quotation.items,
    subtotal: quotation.subtotal,
    tax: quotation.tax,
    discount: quotation.discount,
    total: quotation.total,
    status: "Confirmed",
    createdAt: stamp,
    updatedAt: stamp,
  });
  updates[`invoices/${invoiceId}`] = clean({
    number: args.invoiceNumber,
    numberKey: nameKeyOf(args.invoiceNumber),
    clientId: quotation.clientId,
    clientName: quotation.clientName,
    clientKey: quotation.clientName ? nameKeyOf(quotation.clientName) : undefined,
    quotationId: quotation.id,
    orderId,
    items: quotation.items,
    subtotal: quotation.subtotal,
    tax: quotation.tax,
    discount: quotation.discount,
    total: quotation.total,
    amountPaid: 0,
    status: "Unpaid",
    createdAt: stamp,
    updatedAt: stamp,
  });
  for (const it of quotation.items) {
    if (!it.productId) continue;
    const p = byId.get(it.productId)!;
    updates[`products/${p.id}/stock`] = p.stock - (Number(it.quantity) || 0);
    updates[`products/${p.id}/updatedAt`] = stamp;
    updates[`stockMovements/${rid()}`] = {
      productId: p.id,
      productName: p.name,
      delta: -(Number(it.quantity) || 0),
      reason: `Quotation ${quotation.number} converted → order ${args.orderNumber}`,
      refType: "order",
      refId: orderId,
      createdAt: stamp,
    };
  }
  const hist = (msg: string, detail?: string) => ({ action: msg, detail, at: stamp, ...(args.by ? { by: args.by } : {}) });
  updates[`quotations/${quotation.id}/status`] = "Accepted";
  updates[`quotations/${quotation.id}/orderId`] = orderId;
  updates[`quotations/${quotation.id}/invoiceId`] = invoiceId;
  updates[`quotations/${quotation.id}/updatedAt`] = stamp;
  updates[`history/quotations/${quotation.id}/${rid()}`] = hist("Converted to order + invoice", `${args.orderNumber} / ${args.invoiceNumber}`);
  updates[`history/orders/${orderId}/${rid()}`] = hist("Order created", `From quotation ${quotation.number}`);
  updates[`history/invoices/${invoiceId}/${rid()}`] = hist("Invoice created", `${args.invoiceNumber} · Unpaid`);
  await update(ref(db), updates);
  return { orderId, invoiceId };
}

/** Pure builder: converts quotation → proforma invoice. Does NOT deduct stock. */
export function buildConvertQuotationToProformaUpdate(
  quotation: Quotation,
  args: { proformaNumber: string; by?: string },
): { updates: Record<string, unknown>; proformaId: string } {
  const stamp = nowIso();
  const rid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  const proformaId = rid();
  const updates: Record<string, unknown> = {};

  updates[`proformaInvoices/${proformaId}`] = clean({
    number: args.proformaNumber,
    numberKey: nameKeyOf(args.proformaNumber),
    quotationId: quotation.id,
    quotationNumber: quotation.number,
    clientId: quotation.clientId,
    clientName: quotation.clientName,
    clientKey: quotation.clientName ? nameKeyOf(quotation.clientName) : undefined,
    items: quotation.items,
    subtotal: quotation.subtotal,
    tax: quotation.tax,
    discount: quotation.discount,
    total: quotation.total,
    status: "Accepted",
    createdAt: stamp,
    updatedAt: stamp,
  });

  const hist = (msg: string, detail?: string) => ({ action: msg, detail, at: stamp, ...(args.by ? { by: args.by } : {}) });
  updates[`quotations/${quotation.id}/status`] = "Accepted";
  updates[`quotations/${quotation.id}/proformaInvoiceId`] = proformaId;
  updates[`quotations/${quotation.id}/updatedAt`] = stamp;
  updates[`history/quotations/${quotation.id}/${rid()}`] = hist("Converted to proforma invoice", args.proformaNumber);
  updates[`history/proformaInvoices/${proformaId}/${rid()}`] = hist("Proforma created", `From quotation ${quotation.number}`);

  return { updates, proformaId };
}

export async function convertQuotationToProformaAtomic(
  quotation: Quotation,
  args: { proformaNumber: string; by?: string },
): Promise<{ proformaId: string }> {
  const db = getFirebaseDatabase();
  const { updates, proformaId } = buildConvertQuotationToProformaUpdate(quotation, args);
  await update(ref(db), updates);
  return { proformaId };
}

/** Pure builder: converts proforma invoice → order + final invoice (deducts stock). */
export function buildConvertProformaToInvoiceUpdate(
  proforma: ProformaInvoice,
  products: AssignWorkProduct[],
  args: { orderNumber: string; invoiceNumber: string; taskId?: string; deliveryId?: string; by?: string },
): { updates: Record<string, unknown>; ids: { orderId: string; invoiceId: string } } {
  const byId = new Map(products.map((p) => [p.id, p]));
  const short: { productId: string; name: string; need: number; have: number }[] = [];
  for (const it of proforma.items) {
    if (!it.productId) continue;
    const p = byId.get(it.productId);
    if (!p) throw new Error(`Product not found: ${it.productId}`);
    if (p.stock < (Number(it.quantity) || 0)) {
      short.push({ productId: p.id, name: p.name, need: Number(it.quantity) || 0, have: p.stock });
    }
  }
  if (short.length > 0) throw new InsufficientStockError(short);

  const stamp = nowIso();
  const rid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  const orderId = rid();
  const invoiceId = rid();
  const updates: Record<string, unknown> = {};

  updates[`orders/${orderId}`] = clean({
    number: args.orderNumber,
    numberKey: nameKeyOf(args.orderNumber),
    clientId: proforma.clientId,
    clientName: proforma.clientName,
    clientKey: proforma.clientName ? nameKeyOf(proforma.clientName) : undefined,
    taskId: args.taskId,
    quotationId: proforma.quotationId,
    proformaInvoiceId: proforma.id,
    invoiceId,
    deliveryId: args.deliveryId,
    items: proforma.items,
    subtotal: proforma.subtotal,
    tax: proforma.tax,
    discount: proforma.discount,
    total: proforma.total,
    status: "Confirmed",
    createdAt: stamp,
    updatedAt: stamp,
  });

  updates[`invoices/${invoiceId}`] = clean({
    number: args.invoiceNumber,
    numberKey: nameKeyOf(args.invoiceNumber),
    clientId: proforma.clientId,
    clientName: proforma.clientName,
    clientKey: proforma.clientName ? nameKeyOf(proforma.clientName) : undefined,
    quotationId: proforma.quotationId,
    proformaInvoiceId: proforma.id,
    orderId,
    items: proforma.items,
    subtotal: proforma.subtotal,
    tax: proforma.tax,
    discount: proforma.discount,
    total: proforma.total,
    amountPaid: 0,
    status: "Unpaid",
    createdAt: stamp,
    updatedAt: stamp,
  });

  for (const it of proforma.items) {
    if (!it.productId) continue;
    const p = byId.get(it.productId)!;
    updates[`products/${p.id}/stock`] = p.stock - (Number(it.quantity) || 0);
    updates[`products/${p.id}/updatedAt`] = stamp;
    updates[`stockMovements/${rid()}`] = {
      productId: p.id,
      productName: p.name,
      delta: -(Number(it.quantity) || 0),
      reason: `Proforma ${proforma.number} converted → order ${args.orderNumber}`,
      refType: "order",
      refId: orderId,
      createdAt: stamp,
    };
  }

  const hist = (msg: string, detail?: string) => ({ action: msg, detail, at: stamp, ...(args.by ? { by: args.by } : {}) });
  updates[`proformaInvoices/${proforma.id}/status`] = "Invoiced";
  updates[`proformaInvoices/${proforma.id}/orderId`] = orderId;
  updates[`proformaInvoices/${proforma.id}/invoiceId`] = invoiceId;
  updates[`proformaInvoices/${proforma.id}/updatedAt`] = stamp;
  updates[`history/proformaInvoices/${proforma.id}/${rid()}`] = hist("Converted to order + invoice", `${args.orderNumber} / ${args.invoiceNumber}`);
  updates[`history/orders/${orderId}/${rid()}`] = hist("Order created", `From proforma invoice ${proforma.number}`);
  updates[`history/invoices/${invoiceId}/${rid()}`] = hist("Invoice created", `${args.invoiceNumber} · Unpaid`);

  return { updates, ids: { orderId, invoiceId } };
}

export async function convertProformaToOrderAndInvoiceAtomic(
  proforma: ProformaInvoice,
  args: { orderNumber: string; invoiceNumber: string; taskId?: string; deliveryId?: string; by?: string },
): Promise<{ orderId: string; invoiceId: string }> {
  const db = getFirebaseDatabase();
  const snap = await get(ref(db, "products"));
  const products = toList<Product>(snap.val()).map((p) => ({
    id: p.id,
    name: p.name ?? "(unnamed)",
    price: Number(p.price) || 0,
    stock: Number(p.stock) || 0,
  }));
  const { updates, ids } = buildConvertProformaToInvoiceUpdate(proforma, products, args);
  await update(ref(db), updates);
  return ids;
}

// ----- Typed collection shortcuts (polling reads) -----

export async function listClients(): Promise<Client[]> {
  return getCollection<Client>("clients");
}
export async function listLeads(): Promise<Lead[]> {
  return getCollection<Lead>("leads");
}
export async function listWorkers(): Promise<Worker[]> {
  return getCollection<Worker>("workers");
}
export async function listFieldTasks(): Promise<FieldTask[]> {
  return getCollection<FieldTask>("tasks");
}
export async function listQuotations(): Promise<Quotation[]> {
  return getCollection<Quotation>("quotations");
}
export async function listProformaInvoices(): Promise<ProformaInvoice[]> {
  return getCollection<ProformaInvoice>("proformaInvoices");
}
export async function listInvoices(): Promise<Invoice[]> {
  return getCollection<Invoice>("invoices");
}
export async function listDeliveries(): Promise<Delivery[]> {
  return getCollection<Delivery>("deliveries");
}
export async function listProducts(): Promise<Product[]> {
  return getCollection<Product>("products");
}
export async function listOrders(): Promise<Order[]> {
  return getCollection<Order>("orders");
}
export async function listPayments(): Promise<Payment[]> {
  return getCollection<Payment>("payments");
}

/** Latest GPS location per worker (one small object each — safe to poll). */
export async function listLatestLocations(): Promise<(LocationLatest & { workerId: string })[]> {
  const snap = await get(ref(getFirebaseDatabase(), "locations"));
  const val = snap.val() as Record<string, { latest?: LocationLatest }> | null;
  if (!val) return [];
  return Object.entries(val)
    .filter(([, v]) => v && typeof v === "object" && v.latest)
    .map(([workerId, v]) => ({ workerId, ...(v.latest as LocationLatest) }));
}

/** Location history for one worker (use paging in the UI). */
export async function listLocationHistory(workerId: string): Promise<LocationHistoryEntry[]> {
  return getCollection<LocationHistoryEntry>(`locations/${workerId}/history`);
}

/** Attendance rows across workers (small cardinality: one row per worker/day). */
export async function listAttendance(workerIds: string[]): Promise<{ workerId: string; date: string; loginAt?: string; logoutAt?: string; hoursWorked?: number }[]> {
  const db = getFirebaseDatabase();
  const out: { workerId: string; date: string; loginAt?: string; logoutAt?: string; hoursWorked?: number }[] = [];
  await Promise.all(
    workerIds.map(async (workerId) => {
      const snap = await get(ref(db, `attendance/${workerId}`));
      for (const r of toList<AttendanceRecord>(snap.val())) {
        out.push({ workerId, date: r.date ?? r.id, loginAt: r.loginAt, logoutAt: r.logoutAt, hoursWorked: r.hoursWorked });
      }
    }),
  );
  return out;
}

/**
 * Proof photos live ONLY at /deliveryProofs/{deliveryId} — never under a
 * listed path. Load strictly on demand (thumbnail click), never in bulk.
 */
export async function getDeliveryProof(deliveryId: string): Promise<string | null> {
  const snap = await get(ref(getFirebaseDatabase(), `deliveryProofs/${deliveryId}/proofBase64`));
  const v = snap.val();
  return typeof v === "string" ? v : null;
}

/** Purchase history for a client detail page (derived from invoices). */
export function invoicesForClient(invoices: Invoice[], clientId: string): Invoice[] {
  return invoices
    .filter((i) => i.clientId === clientId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export interface FetchRowsArgs {
  pageSize: number;
  cursor: PageCursor | null;
  pageIndex: number;
  search: string;
  filters: [string, string][];
  includeLegacy: boolean;
}

export interface FetchRowsResult<T> {
  rows: (T & { id: string })[];
  total: number;
  hasMore: boolean;
  next: PageCursor | null;
}

/**
 * Default cursor-paged fetcher for a flat collection. Excludes legacy
 * ("previous") records from the main list — they live in the collapsed
 * "Previous records" sections. Search/filters persist across pages.
 */
export function collectionQuery<T extends { id: string; legacy?: boolean; createdAt?: string }>(
  path: string,
  orderBy = "createdAt",
  searchField = "nameKey",
): (args: FetchRowsArgs) => Promise<FetchRowsResult<T>> {
  return async ({ pageSize, cursor, pageIndex, search, filters, includeLegacy }) => {
    if (search || filters.length > 0) {
      let rows: (T & { id: string })[];
      if (search) {
        rows = await searchByPrefix<T>(path, searchField, search, 400);
      } else {
        const [field, value] = filters[0];
        rows = await filterEqual<T>(path, field, value, orderBy, 500);
      }
      const rest = search ? filters : filters.slice(1);
      let out = includeLegacy ? rows : rows.filter((r) => !r.legacy);
      if (search) {
        out = out.filter((r) => String((r as Record<string, unknown>)[searchField] ?? "").includes(search));
      }
      for (const [f, v] of rest) {
        out = out.filter((r) => String((r as Record<string, unknown>)[f] ?? "") === v);
      }
      out.sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")) || (b.id < a.id ? -1 : 1));
      const start = pageIndex * pageSize;
      return { rows: out.slice(start, start + pageSize), total: out.length, hasMore: start + pageSize < out.length, next: null };
    }
    const page = await fetchPage<T>(path, orderBy, pageSize + 1, cursor);
    // Fetch one extra to absorb legacy rows without breaking the page.
    const current = (includeLegacy ? page.rows : page.rows.filter((r) => !r.legacy)).slice(0, pageSize);
    const total = await getCount(path);
    return { rows: current, total, hasMore: page.hasMore, next: page.next };
  };
}

/** Split current vs legacy ("Previous records") rows. */
export function splitLegacy<T extends { id: string; legacy?: boolean }>(rows: T[]): {
  current: T[];
  previous: T[];
} {
  return {
    current: rows.filter((r) => !r.legacy),
    previous: rows.filter((r) => r.legacy),
  };
}
