'use client';

import { jsPDF } from 'jspdf';

export interface PdfLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface PdfBillTo {
  name?: string;
  address?: string;
  email?: string;
  phone?: string;
}

export interface PdfCompany {
  name: string;
  sub?: string;
  logoUrl?: string;
}

export interface PdfDocOptions {
  kind: 'QUOTATION' | 'INVOICE';
  number: string;
  issueDate?: string; // YYYY-MM-DD
  validUntil?: string; // YYYY-MM-DD (quotations)
  dueDate?: string; // YYYY-MM-DD (invoices)
  company: PdfCompany;
  billTo: PdfBillTo;
  items: PdfLineItem[];
  subtotal: number;
  discount?: number;
  tax?: number;
  total: number;
  amountPaid?: number; // invoices
  outstanding?: number; // invoices
  notes?: string;
  currency?: string;
}

function money(n: number | undefined, currency: string): string {
  // Standard PDF fonts lack the ₹ glyph — render it as Rs. instead.
  const symbol = currency === '₹' ? 'Rs. ' : currency;
  return `${symbol}${(Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US');
}

function fetchImageDataUrl(src: string): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const timer = window.setTimeout(() => resolve(null), 4000);
      img.onload = () => {
        window.clearTimeout(timer);
        try {
          const c = document.createElement('canvas');
          c.width = img.naturalWidth || 200;
          c.height = img.naturalHeight || 200;
          c.getContext('2d')?.drawImage(img, 0, 0);
          resolve(c.toDataURL('image/png'));
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => {
        window.clearTimeout(timer);
        resolve(null);
      };
      img.src = src;
    } catch {
      resolve(null);
    }
  });
}

/**
 * Render a quotation / invoice PDF matching the company template:
 * logo + company header, big title, reference/date block, BILL TO block,
 * shaded items table, right-aligned totals with shaded Total row, notes.
 */
export async function exportDocumentPdf(opts: PdfDocOptions): Promise<void> {
  const currency = opts.currency ?? '₹';
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210;
  const M = 14; // margin
  const R = W - M; // right edge
  const gray: [number, number, number] = [110, 110, 110];
  const shade: [number, number, number] = [243, 244, 246];
  let y = 14;

  // ---- Company header ----
  doc.setDrawColor(200, 200, 200);
  doc.rect(M, y - 2, 30, 15);
  let logo: string | null = null;
  if (opts.company.logoUrl) logo = await fetchImageDataUrl(opts.company.logoUrl);
  if (logo) {
    try {
      doc.addImage(logo, 'PNG', M + 1.5, y - 0.5, 27, 12);
    } catch {
      // fall through to no-logo header
    }
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(20, 20, 20);
  doc.text(opts.company.name || 'Company', M + 34, y + 4);
  if (opts.company.sub) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...gray);
    doc.text(opts.company.sub.slice(0, 80), M + 34, y + 9);
  }
  y += 18;
  doc.setDrawColor(220, 220, 220);
  doc.line(M, y, R, y);
  y += 10;

  // ---- Title + meta (left), BILL TO (right) ----
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(20, 20, 20);
  doc.text(opts.kind, M, y);
  const metaY = y + 8;
  doc.setFontSize(9);
  const meta: [string, string][] = [
    ['Reference:', opts.number],
    ['Date:', fmtDate(opts.issueDate)],
    ...(opts.kind === 'QUOTATION' ? [['Valid Until:', fmtDate(opts.validUntil)] as [string, string]] : []),
    ...(opts.kind === 'INVOICE' ? [['Due Date:', fmtDate(opts.dueDate)] as [string, string]] : []),
  ];
  meta.forEach(([label, value], i) => {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...gray);
    doc.text(label, M, metaY + i * 5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(40, 40, 40);
    doc.text(String(value).slice(0, 40), M + 22, metaY + i * 5);
  });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...gray);
  doc.text('BILL TO', R, y - 2, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);
  doc.text((opts.billTo.name || '—').slice(0, 42), R, y + 4, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...gray);
  let by = y + 9;
  for (const line of [opts.billTo.address, opts.billTo.phone, opts.billTo.email ? `Email: ${opts.billTo.email}` : '']) {
    if (!line) continue;
    doc.text(line.slice(0, 48), R, by, { align: 'right' });
    by += 5;
  }

  y = Math.max(metaY + meta.length * 5 + 8, by + 6);

  // ---- Items table ----
  const colQty = 122;
  const colUnit = 152;
  doc.setFillColor(...shade);
  doc.rect(M, y - 5, R - M, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(40, 40, 40);
  doc.text('Description', M + 2, y);
  doc.text('Qty', colQty, y, { align: 'right' });
  doc.text('Unit Price', colUnit, y, { align: 'right' });
  doc.text('Total', R - 2, y, { align: 'right' });
  y += 7;

  doc.setFont('helvetica', 'normal');
  for (const item of opts.items) {
    if (y > 265) {
      doc.addPage();
      y = 20;
    }
    const amount = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
    doc.setFontSize(9);
    doc.setTextColor(40, 40, 40);
    doc.text(String(item.description || '—').slice(0, 58), M + 2, y);
    doc.text(String(item.quantity ?? 0), colQty, y, { align: 'right' });
    doc.text(money(item.unitPrice, currency), colUnit, y, { align: 'right' });
    doc.text(money(amount, currency), R - 2, y, { align: 'right' });
    y += 7;
  }
  doc.setDrawColor(220, 220, 220);
  doc.line(M, y - 2, R, y - 2);
  y += 4;

  // ---- Totals (right aligned) ----
  const totalRow = (label: string, value: string, bold: boolean, shaded: boolean) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    if (shaded) {
      doc.setFillColor(...shade);
      doc.rect(R - 90, y - 5, 90, 8, 'F');
    }
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(bold ? 11 : 9);
    doc.setTextColor(40, 40, 40);
    doc.text(label, R - 45, y, { align: 'right' });
    doc.text(value, R - 2, y, { align: 'right' });
    y += 7;
  };
  totalRow('Subtotal:', money(opts.subtotal, currency), false, false);
  if (opts.discount) totalRow('Discount:', money(opts.discount, currency), false, false);
  if (opts.tax) totalRow('Tax:', money(opts.tax, currency), false, false);
  totalRow('Total:', money(opts.total, currency), true, true);
  if (opts.kind === 'INVOICE') {
    if (opts.amountPaid) totalRow('Paid:', money(opts.amountPaid, currency), false, false);
    if (opts.outstanding !== undefined) totalRow('Outstanding:', money(opts.outstanding, currency), true, false);
  }
  y += 4;

  // ---- Notes ----
  if (opts.notes?.trim()) {
    if (y > 250) {
      doc.addPage();
      y = 20;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(20, 20, 20);
    doc.text('Notes', M, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...gray);
    for (const line of doc.splitTextToSize(opts.notes.trim(), R - M)) {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      doc.text(line, M, y);
      y += 5;
    }
  }

  doc.save(`${opts.number}.pdf`);
}

/** Backwards-compatible fire-and-forget wrapper for simple callers. */
export function exportSimplePdf(opts: Omit<PdfDocOptions, 'kind' | 'company' | 'billTo'> & { title: string; status: string; clientName?: string }): void {
  void exportDocumentPdf({
    kind: opts.title.toLowerCase().includes('invoice') ? 'INVOICE' : 'QUOTATION',
    number: opts.number,
    company: { name: 'Company' },
    billTo: { name: opts.clientName },
    items: opts.items,
    subtotal: opts.subtotal ?? opts.total,
    tax: opts.tax,
    discount: opts.discount,
    total: opts.total,
  });
}
