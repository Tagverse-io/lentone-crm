import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { brand } from "@/brand.config";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | undefined | null): string {
  const v = typeof amount === "number" && Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat(brand.locale, { style: "currency", currency: brand.currency }).format(v);
  } catch {
    return `${brand.currency} ${v.toFixed(2)}`;
  }
}

export function formatDate(iso: string | undefined | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(brand.locale, { year: "numeric", month: "short", day: "numeric" });
}

export function formatDateTime(iso: string | undefined | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(brand.locale, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function uid(prefix = "id"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Strip undefined values — RTDB rejects them. */
export function cleanData<T extends object>(data: T): T {
  const out = { ...data };
  for (const k of Object.keys(out) as (keyof T)[]) {
    if (out[k] === undefined) delete out[k];
  }
  return out;
}

export function totals(items: { quantity: number; unitPrice: number }[], taxRate = 0): { subtotal: number; taxAmount: number; total: number } {
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const taxAmount = (subtotal * taxRate) / 100;
  return { subtotal, taxAmount, total: subtotal + taxAmount };
}
