import { db } from "./admin";
import { getOrgSettings } from "./settings";

// ---------------------------------------------------------------------------
// Atomic document numbering from Settings prefix/format + RTDB counter.
// Counter lives at /orgs/{orgId}/counters/{invoice|quote}, incremented via
// transaction (safe under concurrent creates). Format tokens:
// {prefix} {year} {num} (num zero-padded to 4).
// ---------------------------------------------------------------------------

export type NumberKind = "invoice" | "quote" | "creditNote";

function renderNumber(format: string, prefix: string, num: number): string {
  const year = String(new Date().getFullYear());
  return format
    .replace("{prefix}", prefix)
    .replace("{year}", year)
    .replace("{num}", String(num).padStart(4, "0"));
}

export async function nextNumber(orgId: string, kind: NumberKind): Promise<string> {
  const s = await getOrgSettings(orgId);
  const prefix = kind === "invoice" ? s.branding.invoice_prefix : kind === "quote" ? s.branding.quote_prefix : s.branding.credit_note_prefix;
  const format = kind === "invoice" ? s.branding.invoice_number_format : kind === "quote" ? s.branding.quote_number_format : s.branding.credit_note_number_format;
  const counterKey = kind === "creditNote" ? "creditNote" : kind;
  const counterRef = db().ref(`/orgs/${orgId}/counters/${counterKey}`);
  const res = await counterRef.transaction((current: number | null) => (current ?? 0) + 1);
  if (!res.committed || typeof res.snapshot.val() !== "number") {
    throw new Error(`Numbering transaction failed for ${kind}`);
  }
  return renderNumber(format, prefix, res.snapshot.val() as number);
}

export async function dueDateFromSettings(orgId: string, from: Date = new Date()): Promise<string> {
  const s = await getOrgSettings(orgId);
  const due = new Date(from);
  due.setDate(due.getDate() + s.branding.invoice_due_days);
  return due.toISOString().slice(0, 10);
}
