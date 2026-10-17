'use client';

/**
 * Central settings-driven formatters — the single source of truth for
 * money and date rendering. Reads currency (code/symbol/position/decimals),
 * number grouping (incl. INR lakh), date format and timezone from Settings.
 */
import { useMemo } from 'react';
import { useWorkspace } from '@/lib/settings/workspace-context';
import type { GeneralSettings, BrandingSettings } from '@/lib/settings/types';

export interface FormatSettings {
  currency: string;
  symbol: string;
  position: 'before' | 'after';
  decimals: number;
  grouping: 'western' | 'lakh' | 'european' | 'space' | 'none';
  dateFormat: string;
  timezone: string;
}

const DEFAULTS: FormatSettings = {
  currency: 'USD',
  symbol: '$',
  position: 'before',
  decimals: 2,
  grouping: 'western',
  dateFormat: 'MM/dd/yyyy',
  timezone: 'UTC',
};

export function resolveFormatSettings(
  general?: Partial<GeneralSettings> | null,
  branding?: Partial<BrandingSettings> | null,
): FormatSettings {
  const g = general ?? {};
  const b = branding ?? {};
  const numberFormat = g.number_format ?? '1,234.56';
  let grouping: FormatSettings['grouping'] = 'western';
  if (numberFormat.includes('12,34') || numberFormat.toLowerCase().includes('lakh')) grouping = 'lakh';
  else if (g.default_currency === 'INR') grouping = 'lakh';
  else if (numberFormat.includes('1.234,56')) grouping = 'european';
  else if (numberFormat.includes('1 234')) grouping = 'space';
  else if (numberFormat === '1234.56') grouping = 'none';
  const decimalsMatch = /\.([0#,]+)/.exec(numberFormat);
  return {
    currency: g.default_currency ?? 'USD',
    symbol: g.currency_symbol ?? '$',
    position: g.currency_position ?? 'before',
    decimals: typeof g.currency_decimals === 'number' ? g.currency_decimals : decimalsMatch ? decimalsMatch[1].length : 2,
    grouping,
    dateFormat: b.date_format ?? 'MM/dd/yyyy',
    timezone: g.timezone ?? 'UTC',
  };
}

function groupInteger(intPart: string, grouping: FormatSettings['grouping']): string {
  const digits = intPart.replace(/\D/g, '') || '0';
  if (grouping === 'none') return digits;
  if (grouping === 'lakh') {
    // Indian grouping: last 3 digits, then pairs (12,34,567)
    const last3 = digits.slice(-3);
    const rest = digits.slice(0, -3);
    if (!rest) return last3;
    const pairs = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    return `${pairs},${last3}`;
  }
  const sep = grouping === 'european' ? '.' : grouping === 'space' ? ' ' : ',';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

/** Format money per Settings: symbol/position/decimals/grouping. */
export function formatMoney(value: number | undefined | null, fs: FormatSettings = DEFAULTS): string {
  const v = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  const neg = v < 0 ? '-' : '';
  const abs = Math.abs(v);
  const fixed = abs.toFixed(fs.decimals);
  const [intPart, fracPart] = fixed.split('.');
  const decSep = fs.grouping === 'european' ? ',' : '.';
  const num = fracPart !== undefined ? `${groupInteger(intPart, fs.grouping)}${decSep}${fracPart}` : groupInteger(intPart, fs.grouping);
  return fs.position === 'after' ? `${neg}${num} ${fs.symbol}` : `${neg}${fs.symbol}${num}`;
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function partsInTimezone(d: Date, timezone: string): { y: number; m: number; day: number; hh: number; mm: number } {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
    const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
    return {
      y: Number(parts.year), m: Number(parts.month), day: Number(parts.day),
      hh: Number(parts.hour) % 24, mm: Number(parts.minute),
    };
  } catch {
    return { y: d.getFullYear(), m: d.getMonth() + 1, day: d.getDate(), hh: d.getHours(), mm: d.getMinutes() };
  }
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** Format a date per Settings date_format + timezone. Empty/invalid → '—'. */
export function formatDateS(iso: string | undefined | null, fs: FormatSettings = DEFAULTS): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const p = partsInTimezone(d, fs.timezone);
  const f = fs.dateFormat;
  if (f === 'DD/MM/YYYY') return `${pad(p.day)}/${pad(p.m)}/${p.y}`;
  if (f === 'YYYY-MM-DD') return `${p.y}-${pad(p.m)}-${pad(p.day)}`;
  if (f === 'DD MMM YYYY') return `${pad(p.day)} ${MONTHS_SHORT[p.m - 1]} ${p.y}`;
  if (f === 'MMM DD, YYYY') return `${MONTHS_SHORT[p.m - 1]} ${pad(p.day)}, ${p.y}`;
  if (f === 'DD.MM.YYYY') return `${pad(p.day)}.${pad(p.m)}.${p.y}`;
  return `${pad(p.m)}/${pad(p.day)}/${p.y}`; // MM/DD/YYYY default
}

/** Format date+time per Settings. */
export function formatDateTimeS(iso: string | undefined | null, fs: FormatSettings = DEFAULTS): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${formatDateS(iso, fs)} ${pad(partsInTimezone(d, fs.timezone).hh)}:${pad(partsInTimezone(d, fs.timezone).mm)}`;
}

/** Normalize a stored financial-year value: accepts codes (jan-dec/apr-mar/jul-jun/custom)
 * and display labels ("January - December", "April - March", …). Unknown → jan-dec. Read-only. */
export function normalizeFinancialYearKind(raw: string | undefined | null): 'jan-dec' | 'apr-mar' | 'jul-jun' | 'custom' {
  const v = (raw ?? '').toLowerCase();
  if (v.includes('apr')) return 'apr-mar';
  if (v.includes('jul') || v.includes('jun')) return 'jul-jun';
  if (v === 'custom') return 'custom';
  return 'jan-dec';
}

/** Financial-year window for a reference date. Kinds: jan-dec/apr-mar/jul-jun/custom(Jan). */
export function getFinancialYearRange(kind: string, refDate: Date = new Date()): { start: Date; end: Date; label: string } {
  const y = refDate.getFullYear();
  const m = refDate.getMonth();
  const norm = normalizeFinancialYearKind(kind);
  let startMonth = 0;
  if (norm === 'apr-mar') startMonth = 3;
  else if (norm === 'jul-jun') startMonth = 6;
  const startYear = m >= startMonth ? y : y - 1;
  const start = new Date(startYear, startMonth, 1);
  const end = new Date(startYear + 1, startMonth, 0, 23, 59, 59);
  const label = `${MONTHS_SHORT[startMonth]} ${startYear} – ${MONTHS_SHORT[(startMonth + 11) % 12]} ${startYear + 1}`;
  return { start, end, label };
}

/** React hook: bound formatters + raw settings for the current org. */
export function useFmt(): {
  money: (v: number | undefined | null) => string;
  date: (iso: string | undefined | null) => string;
  datetime: (iso: string | undefined | null) => string;
  fs: FormatSettings;
} {
  const { settings } = useWorkspace();
  const fs = useMemo(
    () => resolveFormatSettings(settings?.general, settings?.branding),
    [settings],
  );
  return useMemo(
    () => ({
      money: (v) => formatMoney(v, fs),
      date: (iso) => formatDateS(iso, fs),
      datetime: (iso) => formatDateTimeS(iso, fs),
      fs,
    }),
    [fs],
  );
}
