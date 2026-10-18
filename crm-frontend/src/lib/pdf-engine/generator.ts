// @ts-nocheck
/**
 * PDF Generator — Lentone CRM
 *
 * Direct jsPDF coordinate drawing + jspdf-autotable.
 * Premium corporate invoice & quotation layout matching Lentone Consumer Products standard.
 *
 * Format:
 *  - Double gold divider rule under brand header
 *  - Gold FROM & BILL TO address blocks
 *  - 6-column items table with gold header: [# , Description, Qty, Unit, Unit Price, Total]
 *  - Right-aligned totals block with pale gold TOTAL DUE box
 *  - Page 2 dedicated Remittance Sheet with repeating header, 2-column tan BANK DETAILS table,
 *    and bold gold "Thankyou for choosing Lentone" closing greeting
 *  - Uniform footer: "Lentone Consumer Products | www.lentone.in | lentonecp@gmail.com   Page X of Y"
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getCompanySettings, getBase64ImageFromURL } from './helpers';
import type { CompanySettings } from './types';
import type { Contract, User, Project } from '@/lib/db/types';
import { brand } from '@/brand.config';

// ─── Dimensions & Constants ───────────────────────────────────────────────────
const PW = 210;    // A4 width  mm
const PH = 297;    // A4 height mm
const M  = 20;     // Page Margin mm
const RX = PW - M; // Right margin anchor (190mm)

// Colors
const BRAND_GOLD: [number, number, number]   = [200, 138, 44];  // #C88A2C
const C_DARK: [number, number, number]       = [34, 34, 34];    // #222222
const C_MUTED: [number, number, number]      = [100, 100, 100]; // #646464
const C_LIGHT: [number, number, number]      = [140, 140, 140]; // #8C8C8C
const C_LINE: [number, number, number]       = [225, 225, 225]; // subtle row divider
const BG_TOTAL_BOX: [number, number, number] = [253, 246, 233]; // #FDF6E9 pale warm tan/gold
const BG_BANK_HEADER: [number, number, number] = [249, 238, 217]; // #F9EED9 tan bank label fill

// ─── Formatting Helpers ───────────────────────────────────────────────────────

function formatPdfDate(iso: string | undefined | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatAmtS(amount: number): string {
  const v = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;
  const neg = v < 0 ? '-' : '';
  const fixed = Math.abs(v).toFixed(2);
  const [intPart, fracPart] = fixed.split('.');
  const digits = intPart.replace(/\D/g, '') || '0';
  let formattedInt = digits;
  if (digits.length > 3) {
    const last3 = digits.slice(-3);
    const rest = digits.slice(0, -3);
    const pairs = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    formattedInt = `${pairs},${last3}`;
  }
  return `${neg}Rs. ${formattedInt}.${fracPart}`;
}

import { DEFAULT_LOGO_BASE64 } from './logo-base64';

// ─── Header & Section Drawing Helpers ─────────────────────────────────────────

interface HeaderMeta {
  docType: string; // 'INVOICE' | 'QUOTATION' | 'PROFORMA INVOICE'
  number: string;
  numberLabel?: string;
  date: string;
  dueDateOrValidUntil?: { label: string; value: string };
}

async function drawBrandHeader(
  doc: jsPDF,
  s: CompanySettings,
  meta: HeaderMeta
): Promise<number> {
  const rawUrl = s.logo_url || brand.logo;
  const url = (rawUrl && (rawUrl.startsWith('data:') || rawUrl.startsWith('http'))) ? rawUrl : DEFAULT_LOGO_BASE64;
  let drawW = 15;
  let drawH = 15;

  try {
    const data = url.startsWith('data:') ? url : await getBase64ImageFromURL(url);
    doc.addImage(data, 'PNG', M, M, drawW, drawH);
  } catch {
    try {
      doc.addImage(DEFAULT_LOGO_BASE64, 'PNG', M, M, drawW, drawH);
    } catch {
      drawW = 0;
      drawH = 0;
    }
  }

  const textX = drawW > 0 ? M + drawW + 4 : M;

  // 1. Brand name: LENTONE
  doc.setFontSize(20).setFont('helvetica', 'bold').setTextColor(...BRAND_GOLD);
  doc.text('LENTONE', textX, M + 5.5);

  // 2. Subtitle: CONSUMER PRODUCTS
  doc.setFontSize(8).setFont('helvetica', 'bold').setTextColor(40, 40, 40);
  doc.text('CONSUMER PRODUCTS', textX, M + 9.5);

  // 3. Tagline: WHERE QUALITY MEETS CLEAN
  doc.setFontSize(6.5).setFont('helvetica', 'normal').setTextColor(120, 120, 120);
  doc.text('WHERE QUALITY MEETS CLEAN', textX, M + 13.5);

  // Right Header:
  // Title: INVOICE / QUOTATION / PROFORMA INVOICE
  doc.setFontSize(22).setFont('helvetica', 'bold').setTextColor(25, 25, 25);
  doc.text(meta.docType, RX, M + 6, { align: 'right' });

  // Meta Info
  doc.setFontSize(8.5).setFont('helvetica', 'normal').setTextColor(40, 40, 40);
  let yR = M + 11.5;
  const numLabel = meta.numberLabel || (
    meta.docType === 'INVOICE' ? 'Invoice No.:' :
    meta.docType === 'QUOTATION' ? 'Quote No.:' : 'Proforma No.:'
  );
  doc.text(`${numLabel} ${meta.number}`, RX, yR, { align: 'right' });
  yR += 4.5;

  doc.text(`Date: ${formatPdfDate(meta.date)}`, RX, yR, { align: 'right' });
  yR += 4.5;

  if (meta.dueDateOrValidUntil && meta.dueDateOrValidUntil.value) {
    doc.text(`${meta.dueDateOrValidUntil.label}: ${formatPdfDate(meta.dueDateOrValidUntil.value)}`, RX, yR, { align: 'right' });
    yR += 4.5;
  }

  // Double gold divider rule
  const divY = Math.max(M + 18, yR) + 3;
  doc.setDrawColor(...BRAND_GOLD);
  doc.setLineWidth(0.75);
  doc.line(M, divY, RX, divY);
  doc.setLineWidth(0.25);
  doc.line(M, divY + 1.2, RX, divY + 1.2);

  return divY + 3;
}

interface ClientInfo {
  name?: string;
  company?: string;
  address?: string;
  email?: string;
  phone?: string;
  gstin?: string;
}

function drawFromAndBillTo(
  doc: jsPDF,
  s: CompanySettings,
  client: ClientInfo,
  topY: number,
  billToLabel = 'BILL TO'
): number {
  let yL = topY + 4;
  let yBT = topY + 4;

  // FROM Column
  doc.setFontSize(9.5).setFont('helvetica', 'bold').setTextColor(...BRAND_GOLD);
  doc.text('FROM', M, yL);
  yL += 4.5;

  doc.setFontSize(9).setFont('helvetica', 'bold').setTextColor(...C_DARK);
  doc.text(s.company_name || 'Lentone Consumer Products', M, yL);
  yL += 4.2;

  doc.setFontSize(8.5).setFont('helvetica', 'normal').setTextColor(...C_DARK);
  const addr = s.address || 'Padur, Rajiv Gandhi Salai (OMR), Chennai – 603103';
  const addrLines = doc.splitTextToSize(addr, 80);
  doc.text(addrLines, M, yL);
  yL += addrLines.length * 4;

  const email = s.email || 'lentonecp@gmail.com';
  doc.text(`Email: ${email}`, M, yL);
  yL += 4;

  const phone = s.phone || '+91 6374580424';
  doc.text(`Phone: ${phone}`, M, yL);
  yL += 4;

  const gstin = s.gst_number || '33OHMPS7204B1Z6';
  doc.text(`GSTIN: ${gstin}`, M, yL);
  yL += 4;

  // BILL TO Column (right column at x = 112)
  const rightX = 112;
  doc.setFontSize(9.5).setFont('helvetica', 'bold').setTextColor(...BRAND_GOLD);
  doc.text(billToLabel, rightX, yBT);
  yBT += 4.5;

  const compName = client.company || client.name || 'Client';
  doc.setFontSize(9).setFont('helvetica', 'bold').setTextColor(...C_DARK);
  doc.text(compName.toUpperCase(), rightX, yBT);
  yBT += 4.2;

  doc.setFontSize(8.5).setFont('helvetica', 'normal').setTextColor(...C_DARK);
  if (client.name && client.company && client.name.toLowerCase() !== client.company.toLowerCase()) {
    doc.text(client.name, rightX, yBT);
    yBT += 4;
  }

  if (client.address) {
    const cAddrLines = doc.splitTextToSize(client.address, 75);
    doc.text(cAddrLines, rightX, yBT);
    yBT += cAddrLines.length * 4;
  }

  if (client.email) {
    doc.text(`Email: ${client.email}`, rightX, yBT);
    yBT += 4;
  }

  if (client.phone) {
    doc.text(`Phone: ${client.phone}`, rightX, yBT);
    yBT += 4;
  }

  if (client.gstin) {
    doc.text(`GSTIN: ${client.gstin}`, rightX, yBT);
    yBT += 4;
  }

  // Single gold divider rule under FROM & BILL TO
  const dividerY = Math.max(yL, yBT) + 3;
  doc.setDrawColor(...BRAND_GOLD);
  doc.setLineWidth(0.4);
  doc.line(M, dividerY, RX, dividerY);

  return dividerY + 4;
}

function drawItemsTable(
  doc: jsPDF,
  startY: number,
  items: any[]
): number {
  const tableRows = items.map((it: any, i: number) => {
    let title = String(it.name || '').trim();
    let subtitle = '';

    const rawDesc = String(it.description || '').trim();
    if (rawDesc) {
      if (title && rawDesc.startsWith(`${title} - `)) {
        subtitle = rawDesc.slice(title.length + 3).trim();
      } else if (title && rawDesc.startsWith(`${title} – `)) {
        subtitle = rawDesc.slice(title.length + 3).trim();
      } else if (title && rawDesc.toLowerCase() === title.toLowerCase()) {
        subtitle = '';
      } else if (rawDesc.includes('\n')) {
        const parts = rawDesc.split('\n').map((p) => p.trim()).filter(Boolean);
        if (!title) title = parts[0] || '';
        subtitle = parts.slice(1).join('\n');
      } else if (rawDesc.includes(' - ')) {
        const parts = rawDesc.split(' - ').map((p) => p.trim()).filter(Boolean);
        if (!title) title = parts[0] || '';
        subtitle = parts.slice(1).join(' - ');
      } else if (title && rawDesc !== title) {
        subtitle = rawDesc;
      } else if (!title) {
        title = rawDesc;
      }
    }
    if (!title) title = 'ITEM';

    const descText = subtitle ? `${title.toUpperCase()}\n${subtitle.toUpperCase()}` : title.toUpperCase();

    const qty = String(it.quantity ?? 1);
    const unit = String((it.unit && String(it.unit).trim()) || it.unit_name || 'pcs');
    const price = Number(it.unit_price ?? it.unitPrice ?? it.rate ?? 0);
    const total = Number(it.total ?? (price * (Number(it.quantity) || 1)));

    return [
      String(i + 1),
      descText,
      qty,
      unit,
      formatAmtS(price),
      formatAmtS(total),
    ];
  });

  autoTable(doc, {
    startY,
    head: [['#', 'Description', 'Qty', 'Unit', 'Unit Price', 'Total']],
    body: tableRows.length > 0 ? tableRows : [['1', 'General Item', '1', 'pcs', formatAmtS(0), formatAmtS(0)]],
    theme: 'plain',
    headStyles: {
      fillColor: BRAND_GOLD,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      cellPadding: { top: 3.5, bottom: 3.5, left: 3, right: 3 },
    },
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      textColor: C_DARK,
      cellPadding: { top: 4, bottom: 4, left: 3, right: 3 },
    },
    bodyStyles: {
      lineWidth: { bottom: 0.15 },
      lineColor: C_LINE,
    },
    alternateRowStyles: {
      fillColor: [253, 253, 253],
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 'auto', halign: 'left' },
      2: { cellWidth: 16, halign: 'center' },
      3: { cellWidth: 16, halign: 'center' },
      4: { cellWidth: 28, halign: 'right' },
      5: { cellWidth: 32, halign: 'right' },
    },
    margin: { left: M, right: M },
  });

  return (doc as any).lastAutoTable?.finalY ?? startY + 30;
}

function drawTotals(
  doc: jsPDF,
  startY: number,
  subtotal: number,
  discountAmt: number,
  discountPercent: number | undefined,
  taxRate: number,
  cgstAmt: number,
  sgstAmt: number,
  igstAmt: number,
  grandTotal: number,
  amountPaid = 0,
  balanceDue = 0
): number {
  let y = startY + 6;
  const totW = 85;
  const labelX = RX - totW + 4;
  const valX = RX;

  // Subtotal
  doc.setFontSize(9).setFont('helvetica', 'bold').setTextColor(...C_DARK);
  doc.text('Subtotal:', labelX + 15, y);
  doc.setFont('helvetica', 'normal').setTextColor(40, 40, 40);
  doc.text(formatAmtS(subtotal), valX, y, { align: 'right' });
  y += 5.5;

  // Divider
  doc.setDrawColor(...C_LINE);
  doc.setLineWidth(0.15);
  doc.line(labelX, y - 2, RX, y - 2);

  // Discount
  if (discountAmt > 0) {
    const dLabel = discountPercent ? `Discount (${discountPercent}%):` : 'Discount:';
    doc.setFont('helvetica', 'bold').setTextColor(...C_DARK);
    doc.text(dLabel, labelX + 15, y);
    doc.setFont('helvetica', 'normal').setTextColor(40, 40, 40);
    doc.text(`- ${formatAmtS(discountAmt)}`, valX, y, { align: 'right' });
    y += 5.5;
    doc.line(labelX, y - 2, RX, y - 2);
  }

  // CGST & SGST or IGST
  if (cgstAmt > 0 || sgstAmt > 0) {
    const cP = taxRate > 0 ? (taxRate / 2).toFixed(taxRate % 2 === 0 ? 0 : 1) : '9';
    doc.setFont('helvetica', 'bold').setTextColor(...C_DARK);
    doc.text(`CGST (${cP}%):`, labelX + 15, y);
    doc.setFont('helvetica', 'normal').setTextColor(40, 40, 40);
    doc.text(formatAmtS(cgstAmt), valX, y, { align: 'right' });
    y += 5.5;
    doc.line(labelX, y - 2, RX, y - 2);

    doc.setFont('helvetica', 'bold').setTextColor(...C_DARK);
    doc.text(`SGST (${cP}%):`, labelX + 15, y);
    doc.setFont('helvetica', 'normal').setTextColor(40, 40, 40);
    doc.text(formatAmtS(sgstAmt), valX, y, { align: 'right' });
    y += 5.5;
    doc.line(labelX, y - 2, RX, y - 2);
  } else if (igstAmt > 0) {
    doc.setFont('helvetica', 'bold').setTextColor(...C_DARK);
    doc.text(`IGST (${taxRate}%):`, labelX + 15, y);
    doc.setFont('helvetica', 'normal').setTextColor(40, 40, 40);
    doc.text(formatAmtS(igstAmt), valX, y, { align: 'right' });
    y += 5.5;
    doc.line(labelX, y - 2, RX, y - 2);
  }

  if (amountPaid > 0) {
    doc.setFont('helvetica', 'bold').setTextColor(...C_DARK);
    doc.text('Amount Paid:', labelX + 15, y);
    doc.setFont('helvetica', 'normal').setTextColor(40, 40, 40);
    doc.text(`- ${formatAmtS(amountPaid)}`, valX, y, { align: 'right' });
    y += 5.5;
    doc.line(labelX, y - 2, RX, y - 2);
  }

  // TOTAL DUE Box
  y += 2;
  const boxH = 11;
  const boxX = RX - totW;
  doc.setFillColor(...BG_TOTAL_BOX);
  doc.rect(boxX, y - 3, totW, boxH, 'F');

  doc.setFontSize(10).setFont('helvetica', 'bold').setTextColor(...C_DARK);
  doc.text(amountPaid > 0 ? 'BALANCE DUE' : 'TOTAL DUE', boxX + 4, y + 4.5);

  doc.setFontSize(11).setFont('helvetica', 'bold').setTextColor(...C_DARK);
  doc.text(formatAmtS(amountPaid > 0 ? balanceDue : grandTotal), RX - 4, y + 4.5, { align: 'right' });

  return y + boxH + 4;
}

async function drawBankAndClosing(
  doc: jsPDF,
  s: CompanySettings,
  meta: HeaderMeta,
  notes?: string,
  terms?: string
): Promise<void> {
  // Page 2: Dedicated Remittance & Payment Sheet
  doc.addPage();

  // Draw repeating brand header on Page 2
  let y = await drawBrandHeader(doc, s, meta);
  y += 6;

  // Notes
  if (notes && notes.trim()) {
    doc.setFontSize(9.5).setFont('helvetica', 'bold').setTextColor(...BRAND_GOLD);
    doc.text('Notes', M, y);
    y += 4.5;

    doc.setFontSize(8.5).setFont('helvetica', 'normal').setTextColor(60, 60, 60);
    const nLines = doc.splitTextToSize(notes.trim(), PW - 2 * M);
    doc.text(nLines, M, y);
    y += nLines.length * 4 + 6;
  }

  // Terms & Conditions
  if (terms && terms.trim()) {
    doc.setFontSize(9.5).setFont('helvetica', 'bold').setTextColor(...BRAND_GOLD);
    doc.text('Terms & Conditions', M, y);
    y += 4.5;

    doc.setFontSize(8).setFont('helvetica', 'normal').setTextColor(60, 60, 60);
    const tLines = doc.splitTextToSize(terms.trim(), PW - 2 * M);
    doc.text(tLines, M, y);
    y += tLines.length * 3.8 + 6;
  }

  // BANK DETAILS
  const bankHolder = s.bank_holder || s.company_name || 'Lentone';
  const bankName = s.bank_name || 'IndusInd Bank';
  const bankAcc = s.bank_account || '256374580424';
  const bankIfsc = s.bank_ifsc || 'INDB0000932';

  doc.setFontSize(9.5).setFont('helvetica', 'bold').setTextColor(...BRAND_GOLD);
  doc.text('BANK DETAILS', M, y);
  y += 4;

  const bankRows = [
    ['Account Holder', bankHolder],
    ['Bank Name', bankName],
    ['Account Number', bankAcc],
    ['IFSC', bankIfsc],
  ];
  if (s.upi_id) {
    bankRows.push(['UPI ID', s.upi_id]);
  }

  autoTable(doc, {
    startY: y,
    body: bankRows,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      textColor: C_DARK,
      cellPadding: { top: 3.5, bottom: 3.5, left: 4, right: 4 },
      lineColor: [225, 220, 210],
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { cellWidth: 52, fillColor: BG_BANK_HEADER, fontStyle: 'bold' },
      1: { cellWidth: 118, fillColor: [255, 255, 255], fontStyle: 'normal' },
    },
    margin: { left: M, right: M },
  });

  const afterBankY = (doc as any).lastAutoTable?.finalY ?? y + 35;
  const closingY = afterBankY + 16;

  // Closing: Thankyou for choosing Lentone
  doc.setFontSize(16).setFont('helvetica', 'bold').setTextColor(...BRAND_GOLD);
  doc.text('Thankyou for choosing Lentone', M, closingY);

  // LENTONE CONSUMER PRODUCTS
  doc.setFontSize(7.5).setFont('helvetica', 'normal').setTextColor(130, 130, 130);
  doc.text('LENTONE CONSUMER PRODUCTS', M, closingY + 5.5);
}

function addFooter(doc: jsPDF, s: CompanySettings): void {
  const pages = doc.getNumberOfPages();
  const footerText = s.footer_text || `${s.company_name || 'Lentone Consumer Products'} | ${s.website || 'www.lentone.in'} | ${s.email || 'lentonecp@gmail.com'}`;

  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);

    doc.setFontSize(7.5).setFont('helvetica', 'normal').setTextColor(120, 120, 120);
    doc.text(footerText, M, 286);
    doc.text(`Page ${p} of ${pages}`, RX, 286, { align: 'right' });
  }
}

// ─── Document Generators ──────────────────────────────────────────────────────

export async function generateInvoicePdf(
  workspaceId: string,
  invoice: any,
  client: User | null = null,
  _project: Project | null = null
): Promise<jsPDF> {
  const s = await getCompanySettings(workspaceId);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const invNum = invoice.invoice_number || invoice.number || 'INV-001';
  const issueDate = invoice.issue_date || invoice.issueDate || invoice.created_at || invoice.createdAt || new Date().toISOString();
  const dueDate = invoice.due_date || invoice.dueDate;

  const headerMeta: HeaderMeta = {
    docType: 'INVOICE',
    number: invNum,
    numberLabel: 'Invoice No.:',
    date: issueDate,
    dueDateOrValidUntil: dueDate ? { label: 'Due Date', value: dueDate } : undefined,
  };

  // 1. Brand Header
  const headerBottomY = await drawBrandHeader(doc, s, headerMeta);

  // 2. FROM & BILL TO
  const clientInfo: ClientInfo = {
    name: invoice.client_name || invoice.clientName || client?.full_name || client?.name || '',
    company: invoice.client_company || invoice.clientCompany || '',
    address: invoice.client_address || invoice.clientAddress || (client as any)?.address || '',
    email: invoice.client_email || invoice.clientEmail || client?.email || '',
    phone: invoice.client_phone || invoice.clientPhone || client?.phone || '',
    gstin: invoice.client_gstin || invoice.clientGstin || (client as any)?.gstin || '',
  };
  const tableStartY = drawFromAndBillTo(doc, s, clientInfo, headerBottomY, 'BILL TO');

  // 3. Items Table
  const rawItems = invoice.items && invoice.items.length > 0 ? invoice.items : null;
  const items = rawItems || [{
    name: invoice.description || 'Professional Services',
    quantity: 1,
    unit: 'pcs',
    unit_price: invoice.amount || invoice.total || 0,
    total: invoice.amount || invoice.total || 0,
  }];
  const tableFinalY = drawItemsTable(doc, tableStartY, items);

  // 4. Calculations
  const subtotal = Number(invoice.subtotal ?? items.reduce((a: number, i: any) => {
    const price = Number(i.unit_price ?? i.unitPrice ?? i.rate ?? 0);
    const qty = Number(i.quantity ?? 1);
    return a + Number(i.total ?? (price * qty));
  }, 0));

  const discountAmt = Number(invoice.discount_amount ?? invoice.discount ?? 0);
  const discountPercent = invoice.discount_percent ? Number(invoice.discount_percent) : undefined;
  const subAfterDiscount = Math.max(0, subtotal - discountAmt);

  const taxRate = typeof invoice.tax_rate === 'number' ? invoice.tax_rate : (s.tax_cgst + s.tax_sgst || 18);
  const isInterstate = Boolean(invoice.is_interstate || invoice.igst_percent);

  let cgstAmt = 0;
  let sgstAmt = 0;
  let igstAmt = 0;

  if (isInterstate) {
    igstAmt = Number(invoice.igst_amount ?? invoice.tax ?? (subAfterDiscount * taxRate / 100));
  } else {
    const halfRate = taxRate / 2;
    cgstAmt = Number(invoice.cgst_amount ?? (subAfterDiscount * halfRate / 100));
    sgstAmt = Number(invoice.sgst_amount ?? (subAfterDiscount * halfRate / 100));
  }

  const grandTotal = Number(invoice.amount ?? invoice.total ?? (subAfterDiscount + cgstAmt + sgstAmt + igstAmt));
  const amountPaid = Number(invoice.amount_paid ?? invoice.amountPaid ?? 0);
  const balanceDue = Math.max(0, grandTotal - amountPaid);

  // 5. Totals
  drawTotals(
    doc,
    tableFinalY,
    subtotal,
    discountAmt,
    discountPercent,
    taxRate,
    cgstAmt,
    sgstAmt,
    igstAmt,
    grandTotal,
    amountPaid,
    balanceDue
  );

  // 6. Page 2: Dedicated Remittance Sheet with Bank Details & Closing
  const notes = invoice.notes || s.default_notes;
  const terms = invoice.terms || invoice.terms_and_conditions || s.default_terms;
  await drawBankAndClosing(doc, s, headerMeta, notes, terms);

  // 7. Footer across all pages
  addFooter(doc, s);

  return doc;
}

export async function generateQuotationPdf(
  workspaceId: string,
  quotation: any,
  client: User | null = null
): Promise<jsPDF> {
  const s = await getCompanySettings(workspaceId);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const qNum = quotation.quotation_number || quotation.number || 'QUO-001';
  const issueDate = quotation.issue_date || quotation.issueDate || quotation.created_at || quotation.createdAt || new Date().toISOString();
  const validUntil = quotation.valid_until || quotation.validUntil;

  const headerMeta: HeaderMeta = {
    docType: 'QUOTATION',
    number: qNum,
    numberLabel: 'Quote No.:',
    date: issueDate,
    dueDateOrValidUntil: validUntil ? { label: 'Valid Until', value: validUntil } : undefined,
  };

  // 1. Brand Header
  const headerBottomY = await drawBrandHeader(doc, s, headerMeta);

  // 2. FROM & BILL TO / QUOTE TO
  const clientInfo: ClientInfo = {
    name: quotation.client_name || quotation.clientName || client?.full_name || client?.name || '',
    company: quotation.client_company || quotation.clientCompany || '',
    address: quotation.client_address || quotation.clientAddress || (client as any)?.address || '',
    email: quotation.client_email || quotation.clientEmail || client?.email || '',
    phone: quotation.client_phone || quotation.clientPhone || client?.phone || '',
    gstin: quotation.client_gstin || quotation.clientGstin || (client as any)?.gstin || '',
  };
  const tableStartY = drawFromAndBillTo(doc, s, clientInfo, headerBottomY, 'BILL TO');

  // 3. Items Table
  const rawItems = quotation.items && quotation.items.length > 0 ? quotation.items : null;
  const items = rawItems || [{
    name: quotation.description || 'General Items',
    quantity: 1,
    unit: 'pcs',
    unit_price: quotation.amount || quotation.total || 0,
    total: quotation.amount || quotation.total || 0,
  }];
  const tableFinalY = drawItemsTable(doc, tableStartY, items);

  // 4. Calculations
  const subtotal = Number(quotation.subtotal ?? items.reduce((a: number, i: any) => {
    const price = Number(i.unit_price ?? i.unitPrice ?? i.rate ?? 0);
    const qty = Number(i.quantity ?? 1);
    return a + Number(i.total ?? (price * qty));
  }, 0));

  const discountAmt = Number(quotation.discount_amount ?? quotation.discount ?? 0);
  const discountPercent = quotation.discount_percent ? Number(quotation.discount_percent) : undefined;
  const subAfterDiscount = Math.max(0, subtotal - discountAmt);

  const taxRate = typeof quotation.tax_rate === 'number' ? quotation.tax_rate : (s.tax_cgst + s.tax_sgst || 18);
  const isInterstate = Boolean(quotation.is_interstate || quotation.igst_percent);

  let cgstAmt = 0;
  let sgstAmt = 0;
  let igstAmt = 0;

  if (isInterstate) {
    igstAmt = Number(quotation.igst_amount ?? quotation.tax ?? (subAfterDiscount * taxRate / 100));
  } else {
    const halfRate = taxRate / 2;
    cgstAmt = Number(quotation.cgst_amount ?? (subAfterDiscount * halfRate / 100));
    sgstAmt = Number(quotation.sgst_amount ?? (subAfterDiscount * halfRate / 100));
  }

  const grandTotal = Number(quotation.amount ?? quotation.total ?? (subAfterDiscount + cgstAmt + sgstAmt + igstAmt));

  // 5. Totals
  drawTotals(
    doc,
    tableFinalY,
    subtotal,
    discountAmt,
    discountPercent,
    taxRate,
    cgstAmt,
    sgstAmt,
    igstAmt,
    grandTotal
  );

  // 6. Page 2: Dedicated Remittance Sheet with Bank Details & Closing
  const notes = quotation.notes || s.default_notes;
  const terms = quotation.terms || s.default_terms;
  await drawBankAndClosing(doc, s, headerMeta, notes, terms);

  // 7. Footer across all pages
  addFooter(doc, s);

  return doc;
}

export async function generateProformaInvoicePdf(
  workspaceId: string,
  proforma: any,
  client: User | null = null
): Promise<jsPDF> {
  const s = await getCompanySettings(workspaceId);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pNum = proforma.number || proforma.id || 'PI-001';
  const issueDate = proforma.issueDate || proforma.issue_date || proforma.createdAt || proforma.created_at || new Date().toISOString();
  const validUntil = proforma.validUntil || proforma.valid_until;

  const headerMeta: HeaderMeta = {
    docType: 'PROFORMA INVOICE',
    number: pNum,
    numberLabel: 'Proforma No.:',
    date: issueDate,
    dueDateOrValidUntil: validUntil ? { label: 'Valid Until', value: validUntil } : undefined,
  };

  // 1. Brand Header
  const headerBottomY = await drawBrandHeader(doc, s, headerMeta);

  // 2. FROM & BILL TO
  const clientInfo: ClientInfo = {
    name: proforma.clientName || proforma.client_name || client?.full_name || client?.name || '',
    company: proforma.clientCompany || proforma.client_company || '',
    address: proforma.clientAddress || proforma.client_address || (client as any)?.address || '',
    email: proforma.clientEmail || proforma.client_email || client?.email || '',
    phone: proforma.clientPhone || proforma.client_phone || client?.phone || '',
    gstin: proforma.clientGstin || proforma.client_gstin || (client as any)?.gstin || '',
  };
  const tableStartY = drawFromAndBillTo(doc, s, clientInfo, headerBottomY, 'BILL TO');

  // 3. Items Table
  const rawItems = proforma.items && proforma.items.length > 0 ? proforma.items : null;
  const items = rawItems || [{
    name: proforma.description || 'General Items',
    quantity: 1,
    unit: 'pcs',
    unit_price: proforma.total || proforma.amount || 0,
    total: proforma.total || proforma.amount || 0,
  }];
  const tableFinalY = drawItemsTable(doc, tableStartY, items);

  // 4. Calculations
  const subtotal = Number(proforma.subtotal ?? items.reduce((a: number, i: any) => {
    const price = Number(i.unitPrice ?? i.unit_price ?? i.rate ?? 0);
    const qty = Number(i.quantity ?? 1);
    return a + Number(i.total ?? (price * qty));
  }, 0));

  const discountAmt = Number(proforma.discount_amount ?? proforma.discount ?? 0);
  const discountPercent = proforma.discount_percent ? Number(proforma.discount_percent) : undefined;
  const subAfterDiscount = Math.max(0, subtotal - discountAmt);

  const taxRate = typeof proforma.tax_rate === 'number' ? proforma.tax_rate : (s.tax_cgst + s.tax_sgst || 18);
  const isInterstate = Boolean(proforma.is_interstate || proforma.igst_percent);

  let cgstAmt = 0;
  let sgstAmt = 0;
  let igstAmt = 0;

  if (isInterstate) {
    igstAmt = Number(proforma.igst_amount ?? proforma.tax ?? (subAfterDiscount * taxRate / 100));
  } else {
    const halfRate = taxRate / 2;
    cgstAmt = Number(proforma.cgst_amount ?? (subAfterDiscount * halfRate / 100));
    sgstAmt = Number(proforma.sgst_amount ?? (subAfterDiscount * halfRate / 100));
  }

  const grandTotal = Number(proforma.amount ?? proforma.total ?? (subAfterDiscount + cgstAmt + sgstAmt + igstAmt));

  // 5. Totals
  drawTotals(
    doc,
    tableFinalY,
    subtotal,
    discountAmt,
    discountPercent,
    taxRate,
    cgstAmt,
    sgstAmt,
    igstAmt,
    grandTotal
  );

  // 6. Page 2: Dedicated Remittance Sheet with Bank Details & Closing
  const notes = proforma.notes || s.default_notes;
  const terms = proforma.terms || s.default_terms;
  await drawBankAndClosing(doc, s, headerMeta, notes, terms);

  // 7. Footer across all pages
  addFooter(doc, s);

  return doc;
}

export async function generateContractPdf(
  contract: Contract
): Promise<jsPDF> {
  const s = await getCompanySettings();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const headerMeta: HeaderMeta = {
    docType: 'CONTRACT',
    number: contract.contract_number,
    numberLabel: 'Ref:',
    date: contract.created_at,
  };

  const headerBottomY = await drawBrandHeader(doc, s, headerMeta);

  const clientInfo: ClientInfo = {
    name: contract.client_name || 'Client',
    company: (contract as any).client_company || '',
    address: contract.client_address || '',
    email: contract.client_email || '',
  };

  const tableStartY = drawFromAndBillTo(doc, s, clientInfo, headerBottomY, 'CLIENT PARTY');

  const contractType = contract.template_type || 'Service Agreement';
  const contractValue = contract.value ? formatAmtS(contract.value) : '-';

  autoTable(doc, {
    startY: tableStartY,
    head: [['Description', 'Start Date', 'End Date', 'Value']],
    body: [[
      contractType,
      contract.start_date ? formatPdfDate(contract.start_date) : '-',
      contract.end_date   ? formatPdfDate(contract.end_date)   : '-',
      contractValue,
    ]],
    theme: 'plain',
    styles: { font: 'helvetica', fontSize: 9, textColor: C_DARK, cellPadding: { top: 6, bottom: 6, left: 4, right: 4 } },
    headStyles: { fillColor: BRAND_GOLD, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { lineWidth: { bottom: 0.2 }, lineColor: C_LINE },
    columnStyles: {
      0: { cellWidth: 'auto', halign: 'left' },
      1: { cellWidth: 30, halign: 'center' },
      2: { cellWidth: 30, halign: 'center' },
      3: { cellWidth: 35, halign: 'right' },
    },
    margin: { left: M, right: M },
  });

  let y = ((doc as any).lastAutoTable?.finalY ?? tableStartY + 30) + 10;

  doc.setFillColor(...BG_TOTAL_BOX);
  doc.rect(RX - 80, y - 6, 80, 12, 'F');

  doc.setFontSize(11).setFont('helvetica', 'bold').setTextColor(...C_DARK);
  doc.text('Contract Value:', RX - 40, y + 2, { align: 'right' });
  doc.text(contractValue, RX - 4, y + 2, { align: 'right' });

  addFooter(doc, s);
  return doc;
}

// ─── Public download / preview helpers ────────────────────────────────────────

export async function downloadPdf(doc: jsPDF, filename: string): Promise<void> {
  doc.save(filename);
}

export async function openPdfPreview(doc: jsPDF): Promise<string> {
  try {
    const blob = doc.output('blob');
    return URL.createObjectURL(blob);
  } catch {
    return doc.output('datauristring');
  }
}