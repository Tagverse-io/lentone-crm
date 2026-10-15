'use client';

/**
 * Shared types for Quote and Invoice document modules.
 */

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

export function formatDocumentCurrency(amount: number, currency: string = 'INR'): string {
  const symbols: Record<string, string> = {
    INR: '₹', USD: '$', EUR: '€', GBP: '£', AED: 'د.إ', SGD: 'S$',
  };
  const symbol = symbols[currency] || currency;
  return `${symbol}${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDateForDocument(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
