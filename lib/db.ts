import { ref, get, set, push, update, remove, onValue, type Unsubscribe } from "firebase/database";
import { getFirebaseDatabase } from "./firebase";

// ===== Flat Realtime Database model (single source of truth) =====
// /clients/{id}, /leads/{id}, /workers/{id}, /tasks/{id},
// /attendance/{workerId}/{date}, /locations/{workerId}/latest,
// /locations/{workerId}/history/{pushId}, /quotations/{id},
// /invoices/{id}, /deliveries/{id}, /deliveryProofs/{deliveryId}

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

export interface Client {
  id: string;
  name: string;
  category: ClientCategory;
  phone?: string;
  email?: string;
  address?: string;
  mapsUrl?: string;
  notes?: string;
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
  phone?: string;
  clientId?: string;
  clientName?: string;
  stage: LeadStage;
  value?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Worker {
  id: string;
  name: string;
  phone?: string;
  active: boolean;
  createdAt: string;
}

export const FIELD_TASK_STATUSES = ["Assigned", "In Progress", "Done"] as const;
export type FieldTaskStatus = (typeof FIELD_TASK_STATUSES)[number];
export type FieldTaskType = "visit" | "sample";

export interface FieldTask {
  id: string;
  workerId: string;
  workerName?: string;
  clientId: string;
  clientName?: string;
  type: FieldTaskType;
  dueDate: string;
  status: FieldTaskStatus;
  notes?: string;
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

export interface QuotationLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

export const QUOTATION_STATUSES = ["Draft", "Sent", "Accepted"] as const;
export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];

export interface Quotation {
  id: string;
  number: string;
  clientId: string;
  clientName?: string;
  items: QuotationLineItem[];
  total: number;
  status: QuotationStatus;
  createdAt: string;
  updatedAt: string;
}

export const INVOICE_STATUSES = ["Unpaid", "Paid"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export interface Invoice {
  id: string;
  number: string;
  clientId: string;
  clientName?: string;
  quotationId?: string;
  items: QuotationLineItem[];
  total: number;
  status: InvoiceStatus;
  createdAt: string;
  updatedAt: string;
  paidAt?: string;
}

export const DELIVERY_STATUSES = ["Pending", "Out for Delivery", "Delivered"] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export interface Delivery {
  id: string;
  clientId: string;
  clientName?: string;
  invoiceId?: string;
  workerId?: string;
  workerName?: string;
  status: DeliveryStatus;
  mapsUrl?: string;
  proofAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type CollectionPath =
  | "clients"
  | "leads"
  | "workers"
  | "tasks"
  | "quotations"
  | "invoices"
  | "deliveries";

export function nowIso(): string {
  return new Date().toISOString();
}

export function quotationTotal(items: QuotationLineItem[]): number {
  return items.reduce((sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);
}

/** Build the Google Maps URL the Expo app sends for a GPS fix. No map SDK involved. */
export function buildMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

/** Parse a Google Maps URL back to coordinates. Returns null when unparseable. */
export function parseMapsUrl(mapsUrl: string): { lat: number; lng: number } | null {
  const m = mapsUrl.match(/[?&]?q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
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

// ----- Generic helpers (client SDK, authenticated user) -----

export function subscribeCollection<T>(
  path: string,
  callback: (items: (T & { id: string })[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const db = getFirebaseDatabase();
  return onValue(
    ref(db, path),
    (snap) => callback(toList<T>(snap.val())),
    (e) => onError?.(e instanceof Error ? e : new Error(String(e))),
  );
}

export async function getCollection<T>(path: string): Promise<(T & { id: string })[]> {
  const snap = await get(ref(getFirebaseDatabase(), path));
  return toList<T>(snap.val());
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

// ----- Typed collection shortcuts -----

export const subscribeClients = (cb: (c: Client[]) => void, onError?: (e: Error) => void) =>
  subscribeCollection<Client>("clients", cb, onError);
export const subscribeLeads = (cb: (l: Lead[]) => void, onError?: (e: Error) => void) =>
  subscribeCollection<Lead>("leads", cb, onError);
export const subscribeWorkers = (cb: (w: Worker[]) => void, onError?: (e: Error) => void) =>
  subscribeCollection<Worker>("workers", cb, onError);
export const subscribeFieldTasks = (cb: (t: FieldTask[]) => void, onError?: (e: Error) => void) =>
  subscribeCollection<FieldTask>("tasks", cb, onError);
export const subscribeQuotations = (cb: (q: Quotation[]) => void, onError?: (e: Error) => void) =>
  subscribeCollection<Quotation>("quotations", cb, onError);
export const subscribeInvoices = (cb: (i: Invoice[]) => void, onError?: (e: Error) => void) =>
  subscribeCollection<Invoice>("invoices", cb, onError);
export const subscribeDeliveries = (cb: (d: Delivery[]) => void, onError?: (e: Error) => void) =>
  subscribeCollection<Delivery>("deliveries", cb, onError);

/** Live attendance table for one worker: /attendance/{workerId}. */
export function subscribeAttendance(
  workerId: string,
  cb: (rows: AttendanceRecord[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  return subscribeCollection<AttendanceRecord>(`attendance/${workerId}`, cb, onError);
}

/** Latest GPS location per worker (one small object each — safe to list). */
export function subscribeLatestLocations(
  cb: (rows: (LocationLatest & { workerId: string })[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const db = getFirebaseDatabase();
  return onValue(
    ref(db, "locations"),
    (snap) => {
      const val = snap.val() as Record<string, { latest?: LocationLatest }> | null;
      if (!val) return cb([]);
      cb(
        Object.entries(val)
          .filter(([, v]) => v && typeof v === "object" && v.latest)
          .map(([workerId, v]) => ({ workerId, ...(v.latest as LocationLatest) })),
      );
    },
    (e) => onError?.(e instanceof Error ? e : new Error(String(e))),
  );
}

/** Location history for one worker (paginated views should limit this client-side). */
export function subscribeLocationHistory(
  workerId: string,
  cb: (rows: LocationHistoryEntry[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  return subscribeCollection<LocationHistoryEntry>(`locations/${workerId}/history`, cb, onError);
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
