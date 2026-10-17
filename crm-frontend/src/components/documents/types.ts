'use client';

/**
 * Shared types for Quote and Invoice document modules.
 */
import { formatMoney, formatDateS, type FormatSettings } from '@/lib/format';

export type DocumentTemplate = 'modern' | 'corporate' | 'minimal' | 'creative';

export interface DocumentItem {
  id: string;
  name: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
}

export interface DocumentClient {
  company: string;
  contact_person: string;
  email: string;
  phone: string;
  address?: string;
  gstin?: string;
}

export interface DocumentPricing {
  discount_percent: number;
  discount_amount: number;
  cgst_percent: number;
  sgst_percent: number;
  igst_percent: number;
  subtotal: number;
  tax_amount: number;
  grand_total: number;
}

export interface DocumentPayment {
  payment_terms: string;
  payment_method: string;
  amount_paid: number;
  balance_due: number;
  payment_date: string;
  transaction_id: string;
  custom_bank_name?: string;
  custom_bank_account?: string;
  custom_bank_ifsc?: string;
  custom_upi_id?: string;
}

export interface DocumentNotes {
  notes: string;
  internal_notes?: string;
  terms: string;
  delivery_timeline?: string;
}

export interface DocumentMeta {
  document_number: string;
  status: string;
  issue_date: string;
  due_date?: string;
  valid_until?: string;
  currency: string;
}

export function createEmptyItem(): DocumentItem {
  return {
    id: crypto.randomUUID(),
    name: '',
    description: '',
    quantity: 1,
    unit: 'pcs',
    unit_price: 0,
    total: 0,
  };
}

export function calculateItemTotal(item: DocumentItem): number {
  return Math.round(item.quantity * item.unit_price * 100) / 100;
}

export function calculatePricing(
  items: DocumentItem[],
  discountPercent: number,
  cgstPercent: number,
  sgstPercent: number,
  igstPercent: number = 0
): DocumentPricing {
  const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
  const subtotal = round2(items.reduce((sum, item) => sum + item.total, 0));
  const discountAmount = round2((subtotal * discountPercent) / 100);
  const afterDiscount = round2(subtotal - discountAmount);
  const cgstAmount = round2((afterDiscount * cgstPercent) / 100);
  const sgstAmount = round2((afterDiscount * sgstPercent) / 100);
  const igstAmount = round2((afterDiscount * igstPercent) / 100);
  const taxAmount = round2(cgstAmount + sgstAmount + igstAmount);
  const grandTotal = round2(afterDiscount + taxAmount);

  return {
    discount_percent: discountPercent,
    discount_amount: discountAmount,
    cgst_percent: cgstPercent,
    sgst_percent: sgstPercent,
    igst_percent: igstPercent,
    subtotal,
    tax_amount: taxAmount,
    grand_total: grandTotal,
  };
}

export function formatDocumentCurrency(amount: number, currency: string = 'INR', fs?: FormatSettings): string {
  if (fs) {
    const symbol = symbolForCurrency(currency, fs.symbol);
    return formatMoney(amount, { ...fs, currency, symbol });
  }
  const symbol = symbolForCurrency(currency, currency);
  return `${symbol}${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function symbolForCurrency(currency: string, fallback: string): string {
  const symbols: Record<string, string> = {
    INR: '₹', USD: '$', EUR: '€', GBP: '£', AED: 'د.إ', SGD: 'S$',
  };
  return symbols[currency] || fallback;
}

export function formatDateForDocument(dateStr: string, fs?: FormatSettings): string {
  if (!dateStr) return '';
  if (fs) {
    const out = formatDateS(dateStr, fs);
    return out === '—' ? '' : out;
  }
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

import { createItem, updateItem, getItem, nextSequence, getSettings } from '@/lib/db';

export const backend = {
  nextNumber: async (_orgId: string, kind: 'invoice' | 'quote' | 'creditNote'): Promise<{ number: string }> => {
    try {
      const settings = await getSettings();
      let prefix = 'DOC';
      let seqKey = 'doc';
      if (kind === 'invoice') {
        prefix = settings.invoicePrefix || 'INV';
        seqKey = 'invoices';
      } else if (kind === 'quote') {
        prefix = settings.quotationPrefix || 'Q';
        seqKey = 'quotations';
      } else if (kind === 'creditNote') {
        prefix = 'CN';
        seqKey = 'credit_notes';
      }
      const seq = await nextSequence(seqKey);
      const numStr = String(seq).padStart(4, '0');
      return { number: `${prefix}-${numStr}` };
    } catch {
      const rand = Math.floor(1000 + Math.random() * 9000);
      return { number: `${kind.toUpperCase()}-${rand}` };
    }
  },
  quotationAccepted: async (_orgId: string, _quotationId: string) => {
    return { invoiceId: '', projectId: null };
  },
  sendNotification: async (_input: any) => {
    return { ok: true };
  },
};

export async function createInvoice(invoice: any): Promise<string | null> {
  try {
    return await createItem('invoices', {
      ...invoice,
      createdAt: invoice.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  } catch {
    return null;
  }
}

export async function updateInvoice(id: string, patch: any): Promise<boolean> {
  try {
    await updateItem('invoices', id, {
      ...patch,
      updatedAt: new Date().toISOString(),
    });
    return true;
  } catch {
    return false;
  }
}

export async function createQuotation(quotation: any): Promise<string | null> {
  try {
    return await createItem('quotations', {
      ...quotation,
      createdAt: quotation.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  } catch {
    return null;
  }
}

export async function updateQuotation(id: string, patch: any): Promise<boolean> {
  try {
    await updateItem('quotations', id, {
      ...patch,
      updatedAt: new Date().toISOString(),
    });
    return true;
  } catch {
    return false;
  }
}

