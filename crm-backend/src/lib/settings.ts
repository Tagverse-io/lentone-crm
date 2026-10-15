import { db } from "./admin";

export interface OrgSettings {
  general: {
    company_name: string;
    default_currency: string;
    currency_symbol: string;
    currency_position: "before" | "after";
    currency_decimals: number;
    number_format: string;
    timezone: string;
    financial_year: string;
    units: string[];
  };
  branding: {
    logo_url: string;
    email: string;
    support_contact: string;
    footer_text: string;
    invoice_prefix: string;
    quote_prefix: string;
    invoice_number_format: string;
    quote_number_format: string;
    invoice_due_days: number;
    default_payment_terms: string;
    default_terms: string;
    default_notes: string;
    date_format: string;
    tax_cgst: number;
    tax_sgst: number;
    tax_igst: number;
    tax_vat: number;
  };
}

const DEFAULTS: OrgSettings = {
  general: {
    company_name: "Your Company",
    default_currency: process.env.CURRENCY ?? "USD",
    currency_symbol: "$",
    currency_position: "before",
    currency_decimals: 2,
    number_format: "1,234.56",
    timezone: "UTC",
    financial_year: "jan-dec",
    units: ["pcs", "hrs", "days", "kg", "box", "lot"],
  },
  branding: {
    logo_url: "",
    email: process.env.SUPPORT_EMAIL ?? "",
    support_contact: "",
    footer_text: "",
    invoice_prefix: "INV",
    quote_prefix: "QTE",
    invoice_number_format: "{prefix}-{year}-{num}",
    quote_number_format: "{prefix}-{year}-{num}",
    invoice_due_days: 30,
    default_payment_terms: "Net 30",
    default_terms: "",
    default_notes: "",
    date_format: "MM/dd/yyyy",
    tax_cgst: 0,
    tax_sgst: 0,
    tax_igst: 0,
    tax_vat: 0,
  },
};

function num(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : fallback;
}

/** Org settings merged over safe defaults (never throws). */
export async function getOrgSettings(orgId: string): Promise<OrgSettings> {
  try {
    const snap = await db().ref(`/orgs/${orgId}/settings`).get();
    const s = (snap.val() ?? {}) as { general?: Record<string, unknown>; branding?: Record<string, unknown> };
    const g = s.general ?? {};
    const b = s.branding ?? {};
    const str = (v: unknown, fb: string): string => (typeof v === "string" && v ? v : fb);
    return {
      general: {
        company_name: str(g.company_name, "Your Company"),
        default_currency: str(g.default_currency, DEFAULTS.general.default_currency),
        currency_symbol: str(g.currency_symbol, DEFAULTS.general.currency_symbol),
        currency_position: g.currency_position === "after" ? "after" : "before",
        currency_decimals: num(g.currency_decimals, 2),
        number_format: str(g.number_format, DEFAULTS.general.number_format),
        timezone: str(g.timezone, DEFAULTS.general.timezone),
        financial_year: str(g.financial_year, DEFAULTS.general.financial_year),
        units: Array.isArray(g.units) && g.units.length > 0 ? (g.units as string[]) : [...DEFAULTS.general.units],
      },
      branding: {
        logo_url: str(b.logo_url, ""),
        email: str(b.email, DEFAULTS.branding.email),
        support_contact: str(b.support_contact, DEFAULTS.branding.support_contact),
        footer_text: str(b.footer_text, DEFAULTS.branding.footer_text),
        invoice_prefix: str(b.invoice_prefix, DEFAULTS.branding.invoice_prefix),
        quote_prefix: str(b.quote_prefix, DEFAULTS.branding.quote_prefix),
        invoice_number_format: str(b.invoice_number_format, DEFAULTS.branding.invoice_number_format),
        quote_number_format: str(b.quote_number_format, DEFAULTS.branding.quote_number_format),
        invoice_due_days: num(b.invoice_due_days, 30),
        default_payment_terms: str(b.default_payment_terms, DEFAULTS.branding.default_payment_terms),
        default_terms: str(b.default_terms, DEFAULTS.branding.default_terms),
        default_notes: str(b.default_notes, DEFAULTS.branding.default_notes),
        date_format: str(b.date_format, DEFAULTS.branding.date_format),
        tax_cgst: num(b.tax_cgst, 0),
        tax_sgst: num(b.tax_sgst, 0),
        tax_igst: num(b.tax_igst, 0),
        tax_vat: num(b.tax_vat, 0),
      },
    };
  } catch {
    return DEFAULTS;
  }
}

function groupInt(digits: string, currency: string, numberFormat: string): string {
  const d = digits.replace(/\D/g, "") || "0";
  const lakh = numberFormat.includes("12,34") || currency === "INR";
  if (lakh) {
    const last3 = d.slice(-3);
    const rest = d.slice(0, -3);
    if (!rest) return last3;
    return `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${last3}`;
  }
  if (numberFormat.includes("1.234,56")) return d.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  if (numberFormat.includes("1 234")) return d.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  if (numberFormat === "1234.56") return d;
  return d.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Format money per org Settings (symbol/position/decimals/grouping). */
export function formatMoneyForSettings(amount: number | undefined | null, s: OrgSettings): string {
  const v = typeof amount === "number" && Number.isFinite(amount) ? amount : 0;
  const neg = v < 0 ? "-" : "";
  const fixed = Math.abs(v).toFixed(s.general.currency_decimals);
  const [intPart, frac] = fixed.split(".");
  const decSep = s.general.number_format.includes("1.234,56") ? "," : ".";
  const num = frac !== undefined
    ? `${groupInt(intPart, s.general.default_currency, s.general.number_format)}${decSep}${frac}`
    : groupInt(intPart, s.general.default_currency, s.general.number_format);
  return s.general.currency_position === "after"
    ? `${neg}${num} ${s.general.currency_symbol}`
    : `${neg}${s.general.currency_symbol}${num}`;
}

export async function formatMoneyForOrg(orgId: string, amount: number | undefined | null): Promise<string> {
  return formatMoneyForSettings(amount, await getOrgSettings(orgId));
}
