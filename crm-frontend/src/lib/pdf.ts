'use client';

import { jsPDF } from 'jspdf';

export interface PdfLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

export function exportDocumentPdf(opts: {
  title: string;
  number: string;
  clientName?: string;
  items: PdfLineItem[];
  subtotal?: number;
  tax?: number;
  discount?: number;
  total: number;
  status: string;
  extraLines?: string[];
}): void {
  const doc = new jsPDF();
  const money = (n: number) => `${n.toLocaleString('en-IN')}`;
  let y = 20;
  doc.setFontSize(18);
  doc.text(opts.title, 14, y);
  y += 8;
  doc.setFontSize(11);
  doc.text(`Number: ${opts.number}`, 14, y);
  y += 7;
  doc.text(`Client: ${opts.clientName || '—'}`, 14, y);
  y += 7;
  doc.text(`Status: ${opts.status}`, 14, y);
  y += 7;
  for (const line of opts.extraLines ?? []) {
    doc.text(line.slice(0, 90), 14, y);
    y += 7;
  }
  y += 3;

  doc.setFontSize(11);
  doc.text('Description', 14, y);
  doc.text('Qty', 120, y);
  doc.text('Unit', 145, y);
  doc.text('Amount', 175, y);
  y += 6;
  doc.line(14, y, 196, y);
  y += 6;

  for (const item of opts.items) {
    if (y > 260) {
      doc.addPage();
      y = 20;
    }
    const amount = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
    doc.setFontSize(10);
    doc.text(String(item.description || '—').slice(0, 60), 14, y);
    doc.text(String(item.quantity ?? 0), 120, y);
    doc.text(String(item.unitPrice ?? 0), 145, y);
    doc.text(String(amount), 175, y);
    y += 7;
  }
  y += 4;
  doc.setFontSize(11);
  if (opts.subtotal !== undefined) {
    doc.text(`Subtotal: ${money(opts.subtotal)}`, 14, y);
    y += 7;
  }
  if (opts.discount) {
    doc.text(`Discount: ${money(opts.discount)}`, 14, y);
    y += 7;
  }
  if (opts.tax) {
    doc.text(`Tax: ${money(opts.tax)}`, 14, y);
    y += 7;
  }
  doc.setFontSize(12);
  doc.text(`Total: ${money(opts.total)}`, 14, y);
  doc.save(`${opts.number}.pdf`);
}
