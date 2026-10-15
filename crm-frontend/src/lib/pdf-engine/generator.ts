// @ts-nocheck
/**
 * PDF Generator — Strucureo CRM
 *
 * Direct jsPDF coordinate drawing + jspdf-autotable.
 * Minimal, Enterprise-grade aesthetic.
 *
 * Currency: INR symbol ₹ is excluded from all text (jsPDF Helvetica can't render it).
 *           formatAmt() returns e.g. "INR 93.00" instead.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getCompanySettings, getBase64ImageFromURL } from './helpers';
import type { Quotation, QuotationItem, Invoice, Contract, User, Project } from '@/lib/db/types';

// ─── Constants ────────────────────────────────────────────────────────────────
const PW = 210;   // A4 width  mm
const M  = 20;    // Margin    mm (20mm for professional enterprise look)
const RX = PW - M; // Right-align x anchor

// Colors
const C_DARK  = [33, 33, 33] as [number, number, number];
const C_GRAY  = [100, 100, 100] as [number, number, number];
const C_LIGHT = [150, 150, 150] as [number, number, number];
const C_LINE  = [230, 230, 230] as [number, number, number];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAmt(amount: number, currency = 'INR'): string {
  const n = amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const sym: Record<string, string> = {
    USD: '$', EUR: 'EUR', GBP: 'GBP', INR: 'INR',
    AUD: 'AUD', CAD: 'CAD', SGD: 'SGD',
  };
  const s = sym[currency.toUpperCase()] ?? currency;
  return currency === 'USD' ? `${s}${n}` : `${s} ${n}`;
}

async function addLogo(doc: jsPDF, url: string | undefined | null): Promise<number> {
  if (!url) return M;
  try {
    const data = await getBase64ImageFromURL(url);
    // Draw logo at standard size (max 40x20)
    doc.addImage(data, 'PNG', M, M, 35, 35 * 0.7); // Approximate aspect ratio, could be adjusted
    return M + 28; // Return Y position after logo
  } catch {
    return M;
  }
}

function drawDivider(doc: jsPDF, y: number) {
  doc.setDrawColor(...C_LINE);
  doc.setLineWidth(0.3);
  doc.line(M, y, RX, y);
}

// ─── Quotation PDF ────────────────────────────────────────────────────────────

export async function generateQuotationPdf(
  workspaceId: string,
  quotation: Quotation,
  client:    User | null
): Promise<jsPDF> {
  const s   = await getCompanySettings(workspaceId);
  const cur = s.default_currency || 'INR';

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // ── Header ─────────────────────────────────────────────────────────────────
  let startY = await addLogo(doc, s.logo_url);
  
  if (!s.logo_url) {
    doc.setFontSize(18).setFont('helvetica', 'bold').setTextColor(...C_DARK);
    doc.text(s.company_name || 'Company', M, M + 5);
    startY = M + 12;
  }

  // Right Title
  doc.setFontSize(24).setFont('helvetica', 'bold').setTextColor(...C_DARK);
  doc.text('QUOTATION', RX, M + 6, { align: 'right' });

  // Right Meta
  doc.setFontSize(9).setFont('helvetica', 'normal').setTextColor(...C_GRAY);
  let yR = M + 14;
  doc.text(`Reference: ${quotation.quotation_number}`, RX, yR, { align: 'right' }); yR += 5;
  doc.text(`Date: ${new Date(quotation.created_at).toLocaleDateString('en-IN')}`, RX, yR, { align: 'right' }); yR += 5;
  if (quotation.valid_until) {
    const d = new Date(quotation.valid_until);
    if (!isNaN(d.getTime())) {
      doc.text(`Valid Until: ${d.toLocaleDateString('en-IN')}`, RX, yR, { align: 'right' });
    }
  }

  const topSectionY = Math.max(startY, yR) + 12;
  drawDivider(doc, topSectionY);

  // ── Addresses ──────────────────────────────────────────────────────────────
  let yL = topSectionY + 10;
  let yBT = topSectionY + 10;
  
  // FROM
  doc.setFontSize(8).setFont('helvetica', 'bold').setTextColor(...C_LIGHT);
  doc.text('FROM', M, yL); yL += 5;

  doc.setFontSize(10).setFont('helvetica', 'bold').setTextColor(...C_DARK);
  doc.text(s.company_name || 'Company', M, yL); yL += 5;

  doc.setFontSize(9).setFont('helvetica', 'normal').setTextColor(...C_GRAY);
  if (s.address) {
    const ls = doc.splitTextToSize(s.address, 80);
    doc.text(ls, M, yL); yL += ls.length * 4.5;
  }
  if (s.email)   { doc.text(`Email: ${s.email}`, M, yL); yL += 4.5; }
  if (s.phone)   { doc.text(`Phone: ${s.phone}`, M, yL); yL += 4.5; }
  if (s.gst_number) { doc.text(`GSTIN: ${s.gst_number}`, M, yL); yL += 4.5; }

  // BILL TO
  const rightColX = 120;
  doc.setFontSize(8).setFont('helvetica', 'bold').setTextColor(...C_LIGHT);
  doc.text('BILL TO', rightColX, yBT); yBT += 5;

  doc.setFontSize(10).setFont('helvetica', 'bold').setTextColor(...C_DARK);
  const clientName = quotation.client_name || client?.full_name || 'Client';
  doc.text(clientName, rightColX, yBT); yBT += 5;

  doc.setFontSize(9).setFont('helvetica', 'normal').setTextColor(...C_GRAY);
  if (quotation.client_company)  { doc.text(quotation.client_company, rightColX, yBT); yBT += 4.5; }
  if (quotation.client_address)  { 
    const ls = doc.splitTextToSize(quotation.client_address, 70);
    doc.text(ls, rightColX, yBT); yBT += ls.length * 4.5; 
  }
  const cEmail = quotation.client_email || client?.email;
  if (cEmail) { doc.text(`Email: ${cEmail}`, rightColX, yBT); yBT += 4.5; }
  if (quotation.client_gstin) { doc.text(`GSTIN: ${quotation.client_gstin}`, rightColX, yBT); yBT += 4.5; }

  // ── Items Table ────────────────────────────────────────────────────────────
  const tableY = Math.max(yL, yBT) + 12;

  autoTable(doc, {
    startY: tableY,
    head: [['Description', 'Qty', 'Unit Price', 'Total']],
    body: quotation.items.map((it: QuotationItem) => {
      const desc = it.name ? `${it.name}${it.description ? `\n${it.description}` : ''}` : it.description;
      return [
        desc,
        it.quantity.toString(),
        formatAmt(it.unit_price, cur),
        formatAmt(it.total, cur)
      ];
    }),
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 9,
      textColor: C_GRAY,
      cellPadding: { top: 6, bottom: 6, left: 4, right: 4 },
    },
    headStyles: {
      fillColor: [249, 250, 251],
      textColor: C_DARK,
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      lineWidth: { bottom: 0.2 },
      lineColor: C_LINE,
    },
    columnStyles: {
      0: { cellWidth: 'auto', halign: 'left' },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 35, halign: 'right' },
      3: { cellWidth: 35, halign: 'right' },
    },
    margin: { left: M, right: M },
  });

  let y = ((doc as any).lastAutoTable?.finalY ?? tableY + 40) + 8;

  // ── Totals ─────────────────────────────────────────────────────────────────
  const sub = quotation.subtotal ?? quotation.items.reduce((a: number, i: QuotationItem) => a + i.total, 0);

  doc.setFontSize(9).setFont('helvetica', 'normal').setTextColor(...C_GRAY);
  
  doc.text('Subtotal:', RX - 40, y, { align: 'right' });
  doc.text(formatAmt(sub, cur), RX, y, { align: 'right' }); y += 6;

  if (quotation.discount_amount) {
    const dLabel = quotation.discount_percent ? `Discount (${quotation.discount_percent}%):` : 'Discount:';
    doc.text(dLabel, RX - 40, y, { align: 'right' });
    doc.text(`- ${formatAmt(quotation.discount_amount, cur)}`, RX, y, { align: 'right' }); y += 6;
  }

  const subAfterDiscount = sub - (quotation.discount_amount || 0);
  const cP = quotation.cgst_percent ?? s.tax_cgst ?? 0;
  const sP = quotation.sgst_percent ?? s.tax_sgst ?? 0;
  const iP = quotation.igst_percent ?? s.tax_igst ?? 0;

  if (cP) { doc.text(`CGST (${cP}%):`, RX - 40, y, { align: 'right' }); doc.text(formatAmt(subAfterDiscount * cP / 100, cur), RX, y, { align: 'right' }); y += 6; }
  if (sP) { doc.text(`SGST (${sP}%):`, RX - 40, y, { align: 'right' }); doc.text(formatAmt(subAfterDiscount * sP / 100, cur), RX, y, { align: 'right' }); y += 6; }
  if (iP) { doc.text(`IGST (${iP}%):`, RX - 40, y, { align: 'right' }); doc.text(formatAmt(subAfterDiscount * iP / 100, cur), RX, y, { align: 'right' }); y += 6; }
  
  if (!cP && !sP && !iP && quotation.tax_amount) {
    doc.text('Tax:', RX - 40, y, { align: 'right' });
    doc.text(formatAmt(quotation.tax_amount, cur), RX, y, { align: 'right' }); y += 6;
  }

  // Grand Total Block
  y += 2;
  doc.setFillColor(249, 250, 251);
  doc.rect(RX - 80, y - 6, 80, 12, 'F');
  
  doc.setFontSize(11).setFont('helvetica', 'bold').setTextColor(...C_DARK);
  doc.text('Total:', RX - 40, y + 2, { align: 'right' });
  doc.text(formatAmt(quotation.amount, cur), RX - 4, y + 2, { align: 'right' });
  y += 18;

  // ── Details (Notes, Terms, Bank) ──────────────────────────────────────────
  
  const notes = quotation.notes || s.default_notes || '';
  if (notes) {
    if (y > 250) { doc.addPage(); y = M; }
    doc.setFontSize(9).setFont('helvetica', 'bold').setTextColor(...C_DARK);
    doc.text('Notes', M, y); y += 5;
    doc.setFontSize(9).setFont('helvetica', 'normal').setTextColor(...C_GRAY);
    const ls = doc.splitTextToSize(notes, PW - 2 * M);
    doc.text(ls, M, y); y += ls.length * 4.5 + 6;
  }

  const terms = quotation.terms || s.default_terms;
  if (terms) {
    if (y > 250) { doc.addPage(); y = M; }
    doc.setFontSize(9).setFont('helvetica', 'bold').setTextColor(...C_DARK);
    doc.text('Terms & Conditions', M, y); y += 5;
    doc.setFontSize(8).setFont('helvetica', 'normal').setTextColor(...C_GRAY);
    const ls = doc.splitTextToSize(terms, PW - 2 * M);
    doc.text(ls, M, y); y += ls.length * 4 + 6;
  }

  if (quotation.delivery_timeline) {
    if (y > 250) { doc.addPage(); y = M; }
    doc.setFontSize(9).setFont('helvetica', 'bold').setTextColor(...C_DARK);
    doc.text('Delivery Timeline', M, y); y += 5;
    doc.setFontSize(8).setFont('helvetica', 'normal').setTextColor(...C_GRAY);
    const ls = doc.splitTextToSize(quotation.delivery_timeline, PW - 2 * M);
    doc.text(ls, M, y); y += ls.length * 4 + 6;
  }

  if (s.bank_name || s.bank_account || s.upi_id) {
    if (y > 250) { doc.addPage(); y = M; }
    doc.setFontSize(9).setFont('helvetica', 'bold').setTextColor(...C_DARK);
    doc.text('Payment Details', M, y); y += 5;
    doc.setFontSize(9).setFont('helvetica', 'normal').setTextColor(...C_GRAY);
    if (s.bank_name)    { doc.text(`Bank: ${s.bank_name}`, M, y); y += 4.5; }
    if (s.bank_account) { doc.text(`Account: ${s.bank_account}`, M, y); y += 4.5; }
    if (s.bank_ifsc)    { doc.text(`IFSC: ${s.bank_ifsc}`, M, y); y += 4.5; }
    if (s.upi_id)       { doc.text(`UPI: ${s.upi_id}`, M, y); y += 4.5; }
  }

  addFooter(doc, s);
  return doc;
}

// ─── Invoice PDF ──────────────────────────────────────────────────────────────

export async function generateInvoicePdf(
  workspaceId: string,
  invoice:  Invoice,
  client:   User | null,
  project:  Project | null
): Promise<jsPDF> {
  const s   = await getCompanySettings(workspaceId);
  const cur = s.default_currency || 'INR';

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  let startY = await addLogo(doc, s.logo_url);
  
  if (!s.logo_url) {
    doc.setFontSize(18).setFont('helvetica', 'bold').setTextColor(...C_DARK);
    doc.text(s.company_name || 'Company', M, M + 5);
    startY = M + 12;
  }

  doc.setFontSize(24).setFont('helvetica', 'bold').setTextColor(...C_DARK);
  doc.text('INVOICE', RX, M + 6, { align: 'right' });

  doc.setFontSize(9).setFont('helvetica', 'normal').setTextColor(...C_GRAY);
  let yR = M + 14;
  doc.text(`Invoice #: ${invoice.invoice_number}`, RX, yR, { align: 'right' }); yR += 5;
  const issueDate = invoice.issue_date || invoice.created_at;
  doc.text(`Date: ${new Date(issueDate).toLocaleDateString('en-IN')}`, RX, yR, { align: 'right' }); yR += 5;
  if (invoice.due_date) {
    doc.text(`Due Date: ${new Date(invoice.due_date).toLocaleDateString('en-IN')}`, RX, yR, { align: 'right' }); yR += 5;
  }

  const topSectionY = Math.max(startY, yR) + 12;
  drawDivider(doc, topSectionY);

  // Addresses
  let yL = topSectionY + 10;
  let yBT = topSectionY + 10;
  
  // FROM
  doc.setFontSize(8).setFont('helvetica', 'bold').setTextColor(...C_LIGHT);
  doc.text('FROM', M, yL); yL += 5;

  doc.setFontSize(10).setFont('helvetica', 'bold').setTextColor(...C_DARK);
  doc.text(s.company_name || 'Company', M, yL); yL += 5;

  doc.setFontSize(9).setFont('helvetica', 'normal').setTextColor(...C_GRAY);
  if (s.address) {
    const ls = doc.splitTextToSize(s.address, 80);
    doc.text(ls, M, yL); yL += ls.length * 4.5;
  }
  if (s.email)   { doc.text(`Email: ${s.email}`, M, yL); yL += 4.5; }
  if (s.phone)   { doc.text(`Phone: ${s.phone}`, M, yL); yL += 4.5; }
  if (s.gst_number) { doc.text(`GSTIN: ${s.gst_number}`, M, yL); yL += 4.5; }

  // BILL TO
  const rightColX = 120;
  doc.setFontSize(8).setFont('helvetica', 'bold').setTextColor(...C_LIGHT);
  doc.text('BILL TO', rightColX, yBT); yBT += 5;

  doc.setFontSize(10).setFont('helvetica', 'bold').setTextColor(...C_DARK);
  const clientName = invoice.client_name || client?.full_name || 'Client Name';
  doc.text(clientName, rightColX, yBT); yBT += 5;

  doc.setFontSize(9).setFont('helvetica', 'normal').setTextColor(...C_GRAY);
  if (invoice.client_company) { doc.text(invoice.client_company, rightColX, yBT); yBT += 4.5; }
  if (invoice.client_address) { 
    const ls = doc.splitTextToSize(invoice.client_address, 70);
    doc.text(ls, rightColX, yBT); yBT += ls.length * 4.5; 
  }
  const cEmail = invoice.client_email || client?.email;
  if (cEmail)  { doc.text(`Email: ${cEmail}`, rightColX, yBT); yBT += 4.5; }
  if (project?.title) { doc.text(`Project: ${project.title}`, rightColX, yBT); yBT += 4.5; }
  if (invoice.client_gstin) { doc.text(`GSTIN: ${invoice.client_gstin}`, rightColX, yBT); yBT += 4.5; }

  // Items
  const tableY = Math.max(yL, yBT) + 12;

  const rows: string[][] =
    invoice.items && invoice.items.length > 0
      ? invoice.items.map(it => {
          const desc = it.name ? `${it.name}${it.description ? `\n${it.description}` : ''}` : it.description || 'Service';
          return [
            desc,
            it.quantity.toString(),
            formatAmt(it.unit_price, cur),
            formatAmt(it.total, cur),
          ];
        })
      : [[
          invoice.description || 'Professional Services',
          '1',
          formatAmt(invoice.amount, cur),
          formatAmt(invoice.amount, cur),
        ]];

  autoTable(doc, {
    startY: tableY,
    head: [['Description', 'Qty', 'Unit Price', 'Total']],
    body: rows,
    theme: 'plain',
    styles: { font: 'helvetica', fontSize: 9, textColor: C_GRAY, cellPadding: { top: 6, bottom: 6, left: 4, right: 4 } },
    headStyles: { fillColor: [249, 250, 251], textColor: C_DARK, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { lineWidth: { bottom: 0.2 }, lineColor: C_LINE },
    columnStyles: {
      0: { cellWidth: 'auto', halign: 'left' },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 35, halign: 'right' },
      3: { cellWidth: 35, halign: 'right' },
    },
    margin: { left: M, right: M },
  });

  let y = ((doc as any).lastAutoTable?.finalY ?? tableY + 40) + 8;

  // Totals
  const sub = invoice.subtotal ?? (invoice.items && invoice.items.length > 0
    ? invoice.items.reduce((a, i) => a + i.total, 0)
    : invoice.amount);

  doc.setFontSize(9).setFont('helvetica', 'normal').setTextColor(...C_GRAY);
  
  doc.text('Subtotal:', RX - 40, y, { align: 'right' });
  doc.text(formatAmt(sub, cur), RX, y, { align: 'right' }); y += 6;

  if (invoice.discount_amount) {
    const dLabel = invoice.discount_percent ? `Discount (${invoice.discount_percent}%):` : 'Discount:';
    doc.text(dLabel, RX - 40, y, { align: 'right' });
    doc.text(`- ${formatAmt(invoice.discount_amount, cur)}`, RX, y, { align: 'right' }); y += 6;
  }

  const subAfterDiscount = sub - (invoice.discount_amount || 0);
  const cP = invoice.cgst_percent ?? s.tax_cgst ?? 0;
  const sP = invoice.sgst_percent ?? s.tax_sgst ?? 0;
  const iP = invoice.igst_percent ?? s.tax_igst ?? 0;

  if (cP) { doc.text(`CGST (${cP}%):`, RX - 40, y, { align: 'right' }); doc.text(formatAmt(subAfterDiscount * cP / 100, cur), RX, y, { align: 'right' }); y += 6; }
  if (sP) { doc.text(`SGST (${sP}%):`, RX - 40, y, { align: 'right' }); doc.text(formatAmt(subAfterDiscount * sP / 100, cur), RX, y, { align: 'right' }); y += 6; }
  if (iP) { doc.text(`IGST (${iP}%):`, RX - 40, y, { align: 'right' }); doc.text(formatAmt(subAfterDiscount * iP / 100, cur), RX, y, { align: 'right' }); y += 6; }
  
  if (!cP && !sP && !iP && (invoice.tax_amount || invoice.tax)) {
    doc.text('Tax:', RX - 40, y, { align: 'right' });
    doc.text(formatAmt(invoice.tax_amount || invoice.tax || 0, cur), RX, y, { align: 'right' }); y += 6;
  }

  const amountPaid = invoice.amount_paid || 0;
  const balanceDue = Math.max(0, invoice.amount - amountPaid);
  
  if (amountPaid > 0) {
    doc.setFontSize(10).setFont('helvetica', 'normal').setTextColor(...C_GRAY);
    doc.text('Amount Paid:', RX - 40, y + 2, { align: 'right' });
    doc.text(`- ${formatAmt(amountPaid, cur)}`, RX - 4, y + 2, { align: 'right' });
    y += 8;
  }

  y += 2;
  doc.setFillColor(249, 250, 251);
  doc.rect(RX - 80, y - 6, 80, 12, 'F');
  
  doc.setFontSize(11).setFont('helvetica', 'bold').setTextColor(...C_DARK);
  doc.text(amountPaid > 0 ? 'Balance Due:' : 'Total Due:', RX - 40, y + 2, { align: 'right' });
  doc.text(formatAmt(amountPaid > 0 ? balanceDue : invoice.amount, cur), RX - 4, y + 2, { align: 'right' });
  y += 18;

  // Details
  const notes = invoice.notes || s.default_notes || '';
  if (notes) {
    if (y > 250) { doc.addPage(); y = M; }
    doc.setFontSize(9).setFont('helvetica', 'bold').setTextColor(...C_DARK);
    doc.text('Notes', M, y); y += 5;
    doc.setFontSize(9).setFont('helvetica', 'normal').setTextColor(...C_GRAY);
    const ls = doc.splitTextToSize(notes, PW - 2 * M);
    doc.text(ls, M, y); y += ls.length * 4.5 + 6;
  }

  const terms = invoice.terms || invoice.terms_and_conditions || s.default_terms || '';
  if (terms) {
    if (y > 250) { doc.addPage(); y = M; }
    doc.setFontSize(9).setFont('helvetica', 'bold').setTextColor(...C_DARK);
    doc.text('Terms & Conditions', M, y); y += 5;
    doc.setFontSize(8).setFont('helvetica', 'normal').setTextColor(...C_GRAY);
    const ls = doc.splitTextToSize(terms, PW - 2 * M);
    doc.text(ls, M, y); y += ls.length * 4 + 6;
  }

  if (invoice.delivery_timeline) {
    if (y > 250) { doc.addPage(); y = M; }
    doc.setFontSize(9).setFont('helvetica', 'bold').setTextColor(...C_DARK);
    doc.text('Delivery Timeline', M, y); y += 5;
    doc.setFontSize(8).setFont('helvetica', 'normal').setTextColor(...C_GRAY);
    const ls = doc.splitTextToSize(invoice.delivery_timeline, PW - 2 * M);
    doc.text(ls, M, y); y += ls.length * 4 + 6;
  }

  const bankName = invoice.custom_bank_name || s.bank_name;
  const bankAcc = invoice.custom_bank_account || s.bank_account;
  const bankIfsc = invoice.custom_bank_ifsc || s.bank_ifsc;
  const upiId = invoice.custom_upi_id || s.upi_id;

  if (bankName || bankAcc || upiId || invoice.payment_method || invoice.payment_terms) {
    if (y > 250) { doc.addPage(); y = M; }
    doc.setFontSize(9).setFont('helvetica', 'bold').setTextColor(...C_DARK);
    doc.text('Payment Details', M, y); y += 5;
    doc.setFontSize(9).setFont('helvetica', 'normal').setTextColor(...C_GRAY);
    
    if (invoice.payment_terms) { 
      const pt = invoice.payment_terms.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      doc.text(`Terms: ${pt}`, M, y); y += 4.5; 
    }
    if (invoice.payment_method) { 
      const pm = invoice.payment_method.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      doc.text(`Method: ${pm}`, M, y); y += 4.5; 
    }
    if (invoice.transaction_id) { doc.text(`Transaction ID: ${invoice.transaction_id}`, M, y); y += 4.5; }
    if (bankName) { doc.text(`Bank: ${bankName}`, M, y); y += 4.5; }
    if (bankAcc)  { doc.text(`Account: ${bankAcc}`, M, y); y += 4.5; }
    if (bankIfsc) { doc.text(`IFSC: ${bankIfsc}`, M, y); y += 4.5; }
    if (upiId)    { doc.text(`UPI: ${upiId}`, M, y); y += 4.5; }
  }

  addFooter(doc, s);
  return doc;
}

// ─── Contract PDF ─────────────────────────────────────────────────────────────

export async function generateContractPdf(
  contract: Contract
): Promise<jsPDF> {
  const s   = await getCompanySettings();
  const cur = s.default_currency || 'INR';

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  let startY = await addLogo(doc, s.logo_url);
  
  if (!s.logo_url) {
    doc.setFontSize(18).setFont('helvetica', 'bold').setTextColor(...C_DARK);
    doc.text(s.company_name || 'Company', M, M + 5);
    startY = M + 12;
  }

  doc.setFontSize(24).setFont('helvetica', 'bold').setTextColor(...C_DARK);
  doc.text('CONTRACT', RX, M + 6, { align: 'right' });

  doc.setFontSize(9).setFont('helvetica', 'normal').setTextColor(...C_GRAY);
  let yR = M + 14;
  doc.text(`Ref: ${contract.contract_number}`, RX, yR, { align: 'right' }); yR += 5;
  doc.text(`Date: ${new Date(contract.created_at).toLocaleDateString('en-IN')}`, RX, yR, { align: 'right' }); yR += 5;

  const topSectionY = Math.max(startY, yR) + 12;
  drawDivider(doc, topSectionY);

  // Addresses
  let yL = topSectionY + 10;
  let yBT = topSectionY + 10;
  
  // ISSUER
  doc.setFontSize(8).setFont('helvetica', 'bold').setTextColor(...C_LIGHT);
  doc.text('ISSUED BY', M, yL); yL += 5;

  doc.setFontSize(10).setFont('helvetica', 'bold').setTextColor(...C_DARK);
  doc.text(s.company_name || 'Company', M, yL); yL += 5;

  doc.setFontSize(9).setFont('helvetica', 'normal').setTextColor(...C_GRAY);
  if (s.email) { doc.text(`Email: ${s.email}`, M, yL); yL += 4.5; }
  if (s.phone) { doc.text(`Phone: ${s.phone}`, M, yL); yL += 4.5; }

  // CLIENT
  const rightColX = 120;
  doc.setFontSize(8).setFont('helvetica', 'bold').setTextColor(...C_LIGHT);
  doc.text('CLIENT PARTY', rightColX, yBT); yBT += 5;

  doc.setFontSize(10).setFont('helvetica', 'bold').setTextColor(...C_DARK);
  doc.text(contract.client_name || 'Client', rightColX, yBT); yBT += 5;

  doc.setFontSize(9).setFont('helvetica', 'normal').setTextColor(...C_GRAY);
  if (contract.client_email)   { doc.text(`Email: ${contract.client_email}`, rightColX, yBT); yBT += 4.5; }
  if (contract.client_address) { 
    const ls = doc.splitTextToSize(contract.client_address, 70);
    doc.text(ls, rightColX, yBT); yBT += ls.length * 4.5; 
  }

  const tableY = Math.max(yL, yBT) + 12;
  const contractType  = contract.template_type || 'Service Agreement';
  const contractValue = contract.value ? formatAmt(contract.value, cur) : '-';

  autoTable(doc, {
    startY: tableY,
    head: [['Description', 'Start Date', 'End Date', 'Value']],
    body: [[
      contractType,
      contract.start_date ? new Date(contract.start_date).toLocaleDateString('en-IN') : '-',
      contract.end_date   ? new Date(contract.end_date).toLocaleDateString('en-IN')   : '-',
      contractValue,
    ]],
    theme: 'plain',
    styles: { font: 'helvetica', fontSize: 9, textColor: C_GRAY, cellPadding: { top: 6, bottom: 6, left: 4, right: 4 } },
    headStyles: { fillColor: [249, 250, 251], textColor: C_DARK, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { lineWidth: { bottom: 0.2 }, lineColor: C_LINE },
    columnStyles: {
      0: { cellWidth: 'auto', halign: 'left' },
      1: { cellWidth: 30, halign: 'center' },
      2: { cellWidth: 30, halign: 'center' },
      3: { cellWidth: 35, halign: 'right' },
    },
    margin: { left: M, right: M },
  });

  let y = ((doc as any).lastAutoTable?.finalY ?? tableY + 30) + 10;
  
  doc.setFillColor(249, 250, 251);
  doc.rect(RX - 80, y - 6, 80, 12, 'F');

  doc.setFontSize(11).setFont('helvetica', 'bold').setTextColor(...C_DARK);
  doc.text('Contract Value:', RX - 40, y + 2, { align: 'right' });
  doc.text(contractValue, RX - 4, y + 2, { align: 'right' });
  y += 18;


  addFooter(doc, s);
  return doc;
}

// ─── Footer helper ────────────────────────────────────────────────────────────

function addFooter(doc: jsPDF, s: any): void {
  const pages = doc.getNumberOfPages();
  const text  = [s.company_name, s.website, s.email].filter(Boolean).join('  |  ');
  
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    
    // Draw subtle line
    doc.setDrawColor(...C_LINE);
    doc.setLineWidth(0.3);
    doc.line(M, 280, RX, 280);

    // Footer text
    doc.setFontSize(8).setFont('helvetica', 'normal').setTextColor(...C_LIGHT);
    doc.text(text, PW / 2, 285, { align: 'center' });
    
    // Page numbers
    doc.text(`Page ${p} of ${pages}`, RX, 285, { align: 'right' });
  }
}

// ─── Public download / preview helpers ────────────────────────────────────────

export async function downloadPdf(doc: jsPDF, filename: string): Promise<void> {
  doc.save(filename);
}

export async function openPdfPreview(doc: jsPDF): Promise<string> {
  return doc.output('datauristring');
}