// @ts-nocheck
/**
 * PDF Generator — Lentone CRM
 *
 * Direct jsPDF coordinate drawing + jspdf-autotable.
 * Minimal, Enterprise-grade aesthetic matching tsk-crm with theme settings support.
 *
 * Currency: INR symbol ₹ is excluded from raw font drawing (jsPDF standard Helvetica can't render it).
 *           formatAmtS() safely returns e.g. "Rs. 93.00" or "INR 93.00".
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getCompanySettings, getBase64ImageFromURL } from './helpers';
import type { CompanySettings } from './types';
import type { Quotation, QuotationItem, Invoice, Contract, User, Project } from '@/lib/db/types';
import { formatMoney, formatDateS, resolveFormatSettings, type FormatSettings } from '@/lib/format';
import { brand } from '@/brand.config';

// ─── Constants ────────────────────────────────────────────────────────────────
const PW = 210;    // A4 width  mm
const M  = 20;     // Margin    mm (20mm for professional enterprise look)
const RX = PW - M; // Right-align x anchor

// Colors
const C_DARK  = [33, 33, 33] as [number, number, number];
const C_GRAY  = [100, 100, 100] as [number, number, number];
const C_LIGHT = [150, 150, 150] as [number, number, number];
const C_LINE  = [230, 230, 230] as [number, number, number];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const clean = (hex || '#2563eb').replace('#', '');
  const val = parseInt(clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean, 16);
  if (isNaN(val)) return [37, 99, 235];
  return [(val >> 16) & 255, (val >> 8) & 255, val & 255];
}

function fsFromCompany(s: CompanySettings, currency: string): FormatSettings {
  return resolveFormatSettings(
    {
      default_currency: currency,
      currency_symbol: s.currency_symbol,
      currency_position: s.currency_position,
      currency_decimals: s.currency_decimals,
      number_format: s.number_format,
    },
    { date_format: s.date_format, timezone: s.timezone },
  );
}

/** jsPDF-Helvetica-safe money: non-latin symbols fall back to code/Rs. */
function formatAmtS(amount: number, fs: FormatSettings): string {
  let symbol = fs.symbol;
  if (/[^\x20-\x7E]/.test(symbol)) {
    symbol = fs.currency === 'INR' ? 'Rs.' : fs.currency;
  }
  return formatMoney(amount, { ...fs, symbol });
}

async function drawBrandHeader(
  doc: jsPDF,
  s: CompanySettings,
  style: string,
  primaryRgb: [number, number, number]
): Promise<number> {
  const url = s.logo_url || brand.logo;
  let drawW = 0;
  let drawH = 0;

  if (url) {
    try {
      const data = await getBase64ImageFromURL(url);
      const size = await new Promise<{ w: number; h: number }>((resolve, reject) => {
        if (typeof Image !== 'undefined') {
          const img = new Image();
          img.onload = () => resolve({ w: img.naturalWidth || img.width || 1, h: img.naturalHeight || img.height || 1 });
          img.onerror = () => reject(new Error('logo decode failed'));
          img.src = data;
        } else {
          resolve({ w: 1, h: 1 });
        }
      });
      // Brand mark height: 21mm (matches the height of the right-hand text block)
      const ratio = (size.w || 1) / (size.h || 1);
      drawH = 21;
      drawW = drawH * ratio;
      if (drawW > 25) {
        drawW = 25;
        drawH = drawW / ratio;
      }
      doc.addImage(data, 'PNG', M, M, drawW, drawH);
    } catch {
      drawW = 0;
      drawH = 0;
    }
  }

  // Anchor text to the right of logo (with 4.5mm spacing), or left margin M if logo not available
  const textX = drawW > 0 ? M + drawW + 4.5 : M;

  // 1. Company Name: LENTONE (bold, brand gold #c38d27)
  const rawName = s.company_name || 'LENTONE';
  const companyTitle = rawName.toLowerCase().includes('lentone') ? 'LENTONE' : rawName;
  const brandGold: [number, number, number] = [195, 141, 39];
  doc.setFontSize(17).setFont('helvetica', 'bold').setTextColor(...(style === 'corporate' ? primaryRgb : brandGold));
  doc.text(companyTitle, textX, M + 5.5);

  // 2. Tagline: PREMIUM CLEANING AND HYGIENE SOLUTIONS
  const tagline = (s.tagline && s.tagline !== 'Your Professional Solution Partner' ? s.tagline : 'PREMIUM CLEANING AND HYGIENE SOLUTIONS').toUpperCase();
  doc.setFontSize(7).setFont('helvetica', 'bold').setTextColor(115, 115, 115);
  doc.text(tagline, textX, M + 9.5);

  // 3. Address Lines
  const rawAddr = s.address || 'Padur, Rajiv Gandhi Salai (OMR),\nChennai – 603103';
  let addrLines: string[] = [];
  if (rawAddr.includes('\n')) {
    addrLines = rawAddr.split('\n').map((l: string) => l.trim()).filter(Boolean);
  } else if (rawAddr.toUpperCase().includes('PADUR') && rawAddr.toUpperCase().includes('CHENNAI')) {
    addrLines = ['Padur, Rajiv Gandhi Salai (OMR),', 'Chennai – 603103'];
  } else {
    addrLines = doc.splitTextToSize(rawAddr, 75);
  }

  doc.setFontSize(8).setFont('helvetica', 'normal').setTextColor(...C_DARK);
  let addrY = M + 14;
  for (const line of addrLines.slice(0, 2)) {
    doc.text(line, textX, addrY);
    addrY += 4;
  }

  const bottomY = Math.max(M + drawH, addrY);
  return bottomY + 2;
}

async function addLogo(doc: jsPDF, url: string | undefined | null): Promise<number> {
  return drawBrandHeader(doc, {} as any, 'modern', [37, 99, 235]);
}

async function applyLogoWatermark(doc: jsPDF, url: string | undefined | null): Promise<void> {
  if (!url) return;
  try {
    const data = await getBase64ImageFromURL(url);
    const size = await new Promise<{ w: number; h: number }>((resolve, reject) => {
      if (typeof Image !== 'undefined') {
        const img = new Image();
        img.onload = () => resolve({ w: img.naturalWidth || img.width || 1, h: img.naturalHeight || img.height || 1 });
        img.onerror = () => reject(new Error('logo decode failed'));
        img.src = data;
      } else {
        resolve({ w: 100, h: 100 });
      }
    });

    const PH = doc.internal.pageSize.getHeight();
    const PW = doc.internal.pageSize.getWidth();
    const ratio = (size.w || 1) / (size.h || 1);
    let drawW = 90;
    let drawH = drawW / ratio;
    if (drawH > 90) {
      drawH = 90;
      drawW = drawH * ratio;
    }
    const x = (PW - drawW) / 2;
    const y = (PH - drawH) / 2;

    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      try {
        const gs = new (doc as any).GState({ opacity: 0.08 });
        doc.setGState(gs);
        doc.addImage(data, 'PNG', x, y, drawW, drawH);
        const gsReset = new (doc as any).GState({ opacity: 1.0 });
        doc.setGState(gsReset);
      } catch {
        // Fallback gracefully if GState not supported
      }
    }
  } catch {
    // Fallback gracefully if logo decode fails
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
  quotation: any,
  client: User | null = null
): Promise<jsPDF> {
  const s = await getCompanySettings(workspaceId);
  const cur = quotation.currency || s.default_currency || 'INR';
  const fs = fsFromCompany(s, cur);
  const primaryRgb = hexToRgb(s.primary_color);
  const style = s.template_style || 'modern';

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // Corporate top accent bar
  if (style === 'corporate') {
    doc.setFillColor(...primaryRgb);
    doc.rect(0, 0, PW, 4, 'F');
  }

  // ── Header ─────────────────────────────────────────────────────────────────
  let startY = await drawBrandHeader(doc, s, style, primaryRgb);

  // Right Title
  const titleColor = style === 'corporate' ? primaryRgb : C_DARK;
  doc.setFontSize(24).setFont('helvetica', 'bold').setTextColor(...titleColor);
  doc.text('QUOTATION', RX, M + 6, { align: 'right' });

  // Right Meta
  doc.setFontSize(9).setFont('helvetica', 'normal').setTextColor(...C_GRAY);
  let yR = M + 14;
  const qNum = quotation.quotation_number || quotation.number || 'QUOTE-001';
  doc.text(`Reference: ${qNum}`, RX, yR, { align: 'right' }); yR += 5;

  const qDate = quotation.issue_date || quotation.issueDate || quotation.created_at || quotation.createdAt || new Date().toISOString();
  doc.text(`Date: ${formatDateS(qDate, fs)}`, RX, yR, { align: 'right' }); yR += 5;

  const qValidUntil = quotation.valid_until || quotation.validUntil;
  if (qValidUntil) {
    const d = new Date(qValidUntil);
    if (!isNaN(d.getTime())) {
      doc.text(`Valid Until: ${formatDateS(qValidUntil, fs)}`, RX, yR, { align: 'right' });
    }
  }

  const topSectionY = Math.max(startY, yR) + 6;
  drawDivider(doc, topSectionY);

  // ── Addresses ──────────────────────────────────────────────────────────────
  let yL = topSectionY + 8;
  let yBT = topSectionY + 8;

  // FROM
  doc.setFontSize(8).setFont('helvetica', 'bold').setTextColor(...(style === 'corporate' ? primaryRgb : C_LIGHT));
  doc.text('FROM', M, yL); yL += 5;

  doc.setFontSize(10).setFont('helvetica', 'bold').setTextColor(...C_DARK);
  doc.text(s.company_name || 'Company', M, yL); yL += 5;

  doc.setFontSize(9).setFont('helvetica', 'normal').setTextColor(...C_GRAY);
  if (s.address) {
    const ls = doc.splitTextToSize(s.address, 80);
    doc.text(ls, M, yL); yL += ls.length * 4.5;
  }
  if (s.email) { doc.text(`Email: ${s.email}`, M, yL); yL += 4.5; }
  if (s.phone) { doc.text(`Phone: ${s.phone}`, M, yL); yL += 4.5; }
  if (s.gst_number) { doc.text(`GSTIN: ${s.gst_number}`, M, yL); yL += 4.5; }

  // BILL TO
  const rightColX = 120;
  doc.setFontSize(8).setFont('helvetica', 'bold').setTextColor(...(style === 'corporate' ? primaryRgb : C_LIGHT));
  doc.text('BILL TO', rightColX, yBT); yBT += 5;

  doc.setFontSize(10).setFont('helvetica', 'bold').setTextColor(...C_DARK);
  const clientName = quotation.client_name || quotation.clientName || client?.full_name || client?.name || 'Client';
  doc.text(clientName, rightColX, yBT); yBT += 5;

  doc.setFontSize(9).setFont('helvetica', 'normal').setTextColor(...C_GRAY);
  const cCompany = quotation.client_company || quotation.clientCompany;
  if (cCompany) { doc.text(cCompany, rightColX, yBT); yBT += 4.5; }
  const cAddress = quotation.client_address || quotation.clientAddress || (client as any)?.address;
  if (cAddress) {
    const ls = doc.splitTextToSize(cAddress, 70);
    doc.text(ls, rightColX, yBT); yBT += ls.length * 4.5;
  }
  const cEmail = quotation.client_email || quotation.clientEmail || client?.email;
  if (cEmail) { doc.text(`Email: ${cEmail}`, rightColX, yBT); yBT += 4.5; }
  const cGstin = quotation.client_gstin || quotation.clientGstin;
  if (cGstin) { doc.text(`GSTIN: ${cGstin}`, rightColX, yBT); yBT += 4.5; }

  // ── Items Table ────────────────────────────────────────────────────────────
  const tableY = Math.max(yL, yBT) + 12;
  const qItems = quotation.items && quotation.items.length > 0 ? quotation.items : [];

  const tableHeadFill = style === 'corporate' ? primaryRgb : [249, 250, 251];
  const tableHeadText = style === 'corporate' ? [255, 255, 255] : C_DARK;

  autoTable(doc, {
    startY: tableY,
    head: [['Description', 'Qty', 'Unit', 'Unit Price', 'Total']],
    body: qItems.map((it: any) => {
      const name = it.name || it.description || 'Item';
      const desc = it.name && it.description && it.description !== it.name ? `${it.name}\n${it.description}` : name;
      const qty = (it.quantity ?? 1).toString();
      const unit = (it.unit && String(it.unit).trim()) || (it as any).unit_name || 'pcs';
      const price = Number(it.unit_price ?? it.unitPrice ?? 0);
      const total = Number(it.total ?? (price * (Number(it.quantity) || 1)));
      return [
        desc,
        qty,
        unit,
        formatAmtS(price, fs),
        formatAmtS(total, fs),
      ];
    }),
    theme: style === 'minimal' ? 'plain' : style === 'corporate' ? 'grid' : 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 9,
      textColor: C_GRAY,
      cellPadding: { top: 6, bottom: 6, left: 4, right: 4 },
    },
    headStyles: {
      fillColor: tableHeadFill,
      textColor: tableHeadText,
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      lineWidth: { bottom: 0.2 },
      lineColor: C_LINE,
    },
    columnStyles: {
      0: { cellWidth: 'auto', halign: 'left' },
      1: { cellWidth: 18, halign: 'center' },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 32, halign: 'right' },
      4: { cellWidth: 32, halign: 'right' },
    },
    margin: { left: M, right: M },
  });

  let y = ((doc as any).lastAutoTable?.finalY ?? tableY + 40) + 8;

  // ── Totals ─────────────────────────────────────────────────────────────────
  const sub = Number(quotation.subtotal ?? (qItems.length > 0
    ? qItems.reduce((a: number, i: any) => a + Number(i.total ?? ((Number(i.unit_price ?? i.unitPrice) || 0) * (Number(i.quantity) || 1))), 0)
    : quotation.amount || quotation.total || 0));

  doc.setFontSize(9).setFont('helvetica', 'normal').setTextColor(...C_GRAY);

  doc.text('Subtotal:', RX - 40, y, { align: 'right' });
  doc.text(formatAmtS(sub, fs), RX, y, { align: 'right' }); y += 6;

  const discountAmt = Number(quotation.discount_amount ?? quotation.discount ?? 0);
  if (discountAmt) {
    const dLabel = quotation.discount_percent ? `Discount (${quotation.discount_percent}%):` : 'Discount:';
    doc.text(dLabel, RX - 40, y, { align: 'right' });
    doc.text(`- ${formatAmtS(discountAmt, fs)}`, RX, y, { align: 'right' }); y += 6;
  }

  const subAfterDiscount = sub - discountAmt;
  const cP = quotation.cgst_percent ?? s.tax_cgst ?? 0;
  const sP = quotation.sgst_percent ?? s.tax_sgst ?? 0;
  const iP = quotation.igst_percent ?? s.tax_igst ?? 0;

  if (cP) { doc.text(`CGST (${cP}%):`, RX - 40, y, { align: 'right' }); doc.text(formatAmtS(subAfterDiscount * cP / 100, fs), RX, y, { align: 'right' }); y += 6; }
  if (sP) { doc.text(`SGST (${sP}%):`, RX - 40, y, { align: 'right' }); doc.text(formatAmtS(subAfterDiscount * sP / 100, fs), RX, y, { align: 'right' }); y += 6; }
  if (iP) { doc.text(`IGST (${iP}%):`, RX - 40, y, { align: 'right' }); doc.text(formatAmtS(subAfterDiscount * iP / 100, fs), RX, y, { align: 'right' }); y += 6; }

  const taxAmt = Number(quotation.tax_amount ?? quotation.tax ?? 0);
  if (!cP && !sP && !iP && taxAmt) {
    doc.text('Tax:', RX - 40, y, { align: 'right' });
    doc.text(formatAmtS(taxAmt, fs), RX, y, { align: 'right' }); y += 6;
  }

  // Grand Total Block
  y += 2;
  doc.setFillColor(249, 250, 251);
  doc.rect(RX - 80, y - 6, 80, 12, 'F');

  doc.setFontSize(11).setFont('helvetica', 'bold').setTextColor(...(style === 'corporate' ? primaryRgb : C_DARK));
  doc.text('Total:', RX - 40, y + 2, { align: 'right' });
  const finalTotal = Number(quotation.amount ?? quotation.total ?? (subAfterDiscount + taxAmt));
  doc.text(formatAmtS(finalTotal, fs), RX - 4, y + 2, { align: 'right' });
  y += 18;

  // ── Details (Notes, Terms, Bank) ──────────────────────────────────────────
  const notes = quotation.notes || s.default_notes || '';
  if (notes) {
    if (y > 250) { doc.addPage(); y = M; }
    doc.setFontSize(9).setFont('helvetica', 'bold').setTextColor(...(style === 'corporate' ? primaryRgb : C_DARK));
    doc.text('Notes', M, y); y += 5;
    doc.setFontSize(9).setFont('helvetica', 'normal').setTextColor(...C_GRAY);
    const ls = doc.splitTextToSize(notes, PW - 2 * M);
    doc.text(ls, M, y); y += ls.length * 4.5 + 6;
  }

  const terms = quotation.terms || s.default_terms;
  if (terms) {
    if (y > 250) { doc.addPage(); y = M; }
    doc.setFontSize(9).setFont('helvetica', 'bold').setTextColor(...(style === 'corporate' ? primaryRgb : C_DARK));
    doc.text('Terms & Conditions', M, y); y += 5;
    doc.setFontSize(8).setFont('helvetica', 'normal').setTextColor(...C_GRAY);
    const ls = doc.splitTextToSize(terms, PW - 2 * M);
    doc.text(ls, M, y); y += ls.length * 4 + 6;
  }

  if (quotation.delivery_timeline) {
    if (y > 250) { doc.addPage(); y = M; }
    doc.setFontSize(9).setFont('helvetica', 'bold').setTextColor(...(style === 'corporate' ? primaryRgb : C_DARK));
    doc.text('Delivery Timeline', M, y); y += 5;
    doc.setFontSize(8).setFont('helvetica', 'normal').setTextColor(...C_GRAY);
    const ls = doc.splitTextToSize(quotation.delivery_timeline, PW - 2 * M);
    doc.text(ls, M, y); y += ls.length * 4 + 6;
  }

  if (s.bank_name || s.bank_account || s.upi_id) {
    if (y > 250) { doc.addPage(); y = M; }
    doc.setFontSize(9).setFont('helvetica', 'bold').setTextColor(...(style === 'corporate' ? primaryRgb : C_DARK));
    doc.text('Payment Details', M, y); y += 5;
    doc.setFontSize(9).setFont('helvetica', 'normal').setTextColor(...C_GRAY);
    if (s.bank_name) { doc.text(`Bank: ${s.bank_name}`, M, y); y += 4.5; }
    if (s.bank_account) { doc.text(`Account: ${s.bank_account}`, M, y); y += 4.5; }
    if (s.bank_ifsc) { doc.text(`IFSC: ${s.bank_ifsc}`, M, y); y += 4.5; }
    if (s.upi_id) { doc.text(`UPI: ${s.upi_id}`, M, y); y += 4.5; }
  }

  addFooter(doc, s);
  await applyLogoWatermark(doc, s.logo_url || brand.logo);
  return doc;
}

// ─── Invoice PDF ──────────────────────────────────────────────────────────────

export async function generateInvoicePdf(
  workspaceId: string,
  invoice: any,
  client: User | null = null,
  project: Project | null = null
): Promise<jsPDF> {
  const s = await getCompanySettings(workspaceId);
  const cur = invoice.currency || s.default_currency || 'INR';
  const fs = fsFromCompany(s, cur);
  const primaryRgb = hexToRgb(s.primary_color);
  const style = s.template_style || 'modern';

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // Corporate top accent bar
  if (style === 'corporate') {
    doc.setFillColor(...primaryRgb);
    doc.rect(0, 0, PW, 4, 'F');
  }

  let startY = await drawBrandHeader(doc, s, style, primaryRgb);

  const titleColor = style === 'corporate' ? primaryRgb : C_DARK;
  doc.setFontSize(24).setFont('helvetica', 'bold').setTextColor(...titleColor);
  doc.text('INVOICE', RX, M + 6, { align: 'right' });

  doc.setFontSize(9).setFont('helvetica', 'normal').setTextColor(...C_GRAY);
  let yR = M + 14;
  const invNum = invoice.invoice_number || invoice.number || 'INV-001';
  doc.text(`Invoice #: ${invNum}`, RX, yR, { align: 'right' }); yR += 5;

  const issueDate = invoice.issue_date || invoice.issueDate || invoice.created_at || invoice.createdAt || new Date().toISOString();
  doc.text(`Date: ${formatDateS(issueDate, fs)}`, RX, yR, { align: 'right' }); yR += 5;

  const dueDate = invoice.due_date || invoice.dueDate;
  if (dueDate) {
    doc.text(`Due Date: ${formatDateS(dueDate, fs)}`, RX, yR, { align: 'right' }); yR += 5;
  }

  const topSectionY = Math.max(startY, yR) + 6;
  drawDivider(doc, topSectionY);

  // Addresses
  let yL = topSectionY + 8;
  let yBT = topSectionY + 8;

  // FROM
  doc.setFontSize(8).setFont('helvetica', 'bold').setTextColor(...(style === 'corporate' ? primaryRgb : C_LIGHT));
  doc.text('FROM', M, yL); yL += 5;

  doc.setFontSize(10).setFont('helvetica', 'bold').setTextColor(...C_DARK);
  doc.text(s.company_name || 'Company', M, yL); yL += 5;

  doc.setFontSize(9).setFont('helvetica', 'normal').setTextColor(...C_GRAY);
  if (s.address) {
    const ls = doc.splitTextToSize(s.address, 80);
    doc.text(ls, M, yL); yL += ls.length * 4.5;
  }
  if (s.email) { doc.text(`Email: ${s.email}`, M, yL); yL += 4.5; }
  if (s.phone) { doc.text(`Phone: ${s.phone}`, M, yL); yL += 4.5; }
  if (s.gst_number) { doc.text(`GSTIN: ${s.gst_number}`, M, yL); yL += 4.5; }

  // BILL TO
  const rightColX = 120;
  doc.setFontSize(8).setFont('helvetica', 'bold').setTextColor(...(style === 'corporate' ? primaryRgb : C_LIGHT));
  doc.text('BILL TO', rightColX, yBT); yBT += 5;

  doc.setFontSize(10).setFont('helvetica', 'bold').setTextColor(...C_DARK);
  const clientName = invoice.client_name || invoice.clientName || client?.full_name || client?.name || 'Client Name';
  doc.text(clientName, rightColX, yBT); yBT += 5;

  doc.setFontSize(9).setFont('helvetica', 'normal').setTextColor(...C_GRAY);
  const cCompany = invoice.client_company || invoice.clientCompany;
  if (cCompany) { doc.text(cCompany, rightColX, yBT); yBT += 4.5; }
  const cAddress = invoice.client_address || invoice.clientAddress || (client as any)?.address;
  if (cAddress) {
    const ls = doc.splitTextToSize(cAddress, 70);
    doc.text(ls, rightColX, yBT); yBT += ls.length * 4.5;
  }
  const cEmail = invoice.client_email || invoice.clientEmail || client?.email;
  if (cEmail) { doc.text(`Email: ${cEmail}`, rightColX, yBT); yBT += 4.5; }
  if (project?.title) { doc.text(`Project: ${project.title}`, rightColX, yBT); yBT += 4.5; }
  const cGstin = invoice.client_gstin || invoice.clientGstin;
  if (cGstin) { doc.text(`GSTIN: ${cGstin}`, rightColX, yBT); yBT += 4.5; }

  // Items
  const tableY = Math.max(yL, yBT) + 12;

  const rawItems = invoice.items && invoice.items.length > 0 ? invoice.items : null;
  const rows: string[][] =
    rawItems
      ? rawItems.map((it: any) => {
          const name = it.name || it.description || 'Item';
          const desc = it.name && it.description && it.description !== it.name ? `${it.name}\n${it.description}` : name;
          const qty = (it.quantity ?? 1).toString();
          const unit = (it.unit && String(it.unit).trim()) || (it as any).unit_name || 'pcs';
          const price = Number(it.unit_price ?? it.unitPrice ?? 0);
          const total = Number(it.total ?? (price * (Number(it.quantity) || 1)));
          return [
            desc,
            qty,
            unit,
            formatAmtS(price, fs),
            formatAmtS(total, fs),
          ];
        })
      : [[
          invoice.description || 'Professional Services',
          '1',
          'pcs',
          formatAmtS(invoice.amount || invoice.total || 0, fs),
          formatAmtS(invoice.amount || invoice.total || 0, fs),
        ]];

  const tableHeadFill = style === 'corporate' ? primaryRgb : [249, 250, 251];
  const tableHeadText = style === 'corporate' ? [255, 255, 255] : C_DARK;

  autoTable(doc, {
    startY: tableY,
    head: [['Description', 'Qty', 'Unit', 'Unit Price', 'Total']],
    body: rows,
    theme: style === 'minimal' ? 'plain' : style === 'corporate' ? 'grid' : 'plain',
    styles: { font: 'helvetica', fontSize: 9, textColor: C_GRAY, cellPadding: { top: 6, bottom: 6, left: 4, right: 4 } },
    headStyles: { fillColor: tableHeadFill, textColor: tableHeadText, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { lineWidth: { bottom: 0.2 }, lineColor: C_LINE },
    columnStyles: {
      0: { cellWidth: 'auto', halign: 'left' },
      1: { cellWidth: 18, halign: 'center' },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 32, halign: 'right' },
      4: { cellWidth: 32, halign: 'right' },
    },
    margin: { left: M, right: M },
  });

  let y = ((doc as any).lastAutoTable?.finalY ?? tableY + 40) + 8;

  // Totals
  const sub = Number(invoice.subtotal ?? (rawItems
    ? rawItems.reduce((a: number, i: any) => a + Number(i.total ?? ((Number(i.unit_price ?? i.unitPrice) || 0) * (Number(i.quantity) || 1))), 0)
    : (invoice.amount || invoice.total || 0)));

  doc.setFontSize(9).setFont('helvetica', 'normal').setTextColor(...C_GRAY);

  doc.text('Subtotal:', RX - 40, y, { align: 'right' });
  doc.text(formatAmtS(sub, fs), RX, y, { align: 'right' }); y += 6;

  const discountAmt = Number(invoice.discount_amount ?? invoice.discount ?? 0);
  if (discountAmt) {
    const dLabel = invoice.discount_percent ? `Discount (${invoice.discount_percent}%):` : 'Discount:';
    doc.text(dLabel, RX - 40, y, { align: 'right' });
    doc.text(`- ${formatAmtS(discountAmt, fs)}`, RX, y, { align: 'right' }); y += 6;
  }

  const subAfterDiscount = sub - discountAmt;
  const cP = invoice.cgst_percent ?? s.tax_cgst ?? 0;
  const sP = invoice.sgst_percent ?? s.tax_sgst ?? 0;
  const iP = invoice.igst_percent ?? s.tax_igst ?? 0;

  if (cP) { doc.text(`CGST (${cP}%):`, RX - 40, y, { align: 'right' }); doc.text(formatAmtS(subAfterDiscount * cP / 100, fs), RX, y, { align: 'right' }); y += 6; }
  if (sP) { doc.text(`SGST (${sP}%):`, RX - 40, y, { align: 'right' }); doc.text(formatAmtS(subAfterDiscount * sP / 100, fs), RX, y, { align: 'right' }); y += 6; }
  if (iP) { doc.text(`IGST (${iP}%):`, RX - 40, y, { align: 'right' }); doc.text(formatAmtS(subAfterDiscount * iP / 100, fs), RX, y, { align: 'right' }); y += 6; }

  const taxAmt = Number(invoice.tax_amount ?? invoice.tax ?? 0);
  if (!cP && !sP && !iP && taxAmt) {
    doc.text('Tax:', RX - 40, y, { align: 'right' });
    doc.text(formatAmtS(taxAmt, fs), RX, y, { align: 'right' }); y += 6;
  }

  const invTotal = Number(invoice.amount ?? invoice.total ?? (subAfterDiscount + taxAmt));
  const amountPaid = Number(invoice.amount_paid ?? invoice.amountPaid ?? 0);
  const balanceDue = Math.max(0, invTotal - amountPaid);

  if (amountPaid > 0) {
    doc.setFontSize(10).setFont('helvetica', 'normal').setTextColor(...C_GRAY);
    doc.text('Amount Paid:', RX - 40, y + 2, { align: 'right' });
    doc.text(`- ${formatAmtS(amountPaid, fs)}`, RX - 4, y + 2, { align: 'right' });
    y += 8;
  }

  y += 2;
  doc.setFillColor(249, 250, 251);
  doc.rect(RX - 80, y - 6, 80, 12, 'F');

  doc.setFontSize(11).setFont('helvetica', 'bold').setTextColor(...(style === 'corporate' ? primaryRgb : C_DARK));
  doc.text(amountPaid > 0 ? 'Balance Due:' : 'Total Due:', RX - 40, y + 2, { align: 'right' });
  doc.text(formatAmtS(amountPaid > 0 ? balanceDue : invTotal, fs), RX - 4, y + 2, { align: 'right' });
  y += 18;

  // Details
  const notes = invoice.notes || s.default_notes || '';
  if (notes) {
    if (y > 250) { doc.addPage(); y = M; }
    doc.setFontSize(9).setFont('helvetica', 'bold').setTextColor(...(style === 'corporate' ? primaryRgb : C_DARK));
    doc.text('Notes', M, y); y += 5;
    doc.setFontSize(9).setFont('helvetica', 'normal').setTextColor(...C_GRAY);
    const ls = doc.splitTextToSize(notes, PW - 2 * M);
    doc.text(ls, M, y); y += ls.length * 4.5 + 6;
  }

  const terms = invoice.terms || invoice.terms_and_conditions || s.default_terms || '';
  if (terms) {
    if (y > 250) { doc.addPage(); y = M; }
    doc.setFontSize(9).setFont('helvetica', 'bold').setTextColor(...(style === 'corporate' ? primaryRgb : C_DARK));
    doc.text('Terms & Conditions', M, y); y += 5;
    doc.setFontSize(8).setFont('helvetica', 'normal').setTextColor(...C_GRAY);
    const ls = doc.splitTextToSize(terms, PW - 2 * M);
    doc.text(ls, M, y); y += ls.length * 4 + 6;
  }

  if (invoice.delivery_timeline) {
    if (y > 250) { doc.addPage(); y = M; }
    doc.setFontSize(9).setFont('helvetica', 'bold').setTextColor(...(style === 'corporate' ? primaryRgb : C_DARK));
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
    doc.setFontSize(9).setFont('helvetica', 'bold').setTextColor(...(style === 'corporate' ? primaryRgb : C_DARK));
    doc.text('Payment Details', M, y); y += 5;
    doc.setFontSize(9).setFont('helvetica', 'normal').setTextColor(...C_GRAY);

    if (invoice.payment_terms) {
      const pt = invoice.payment_terms.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
      doc.text(`Terms: ${pt}`, M, y); y += 4.5;
    }
    if (invoice.payment_method) {
      const pm = invoice.payment_method.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
      doc.text(`Method: ${pm}`, M, y); y += 4.5;
    }
    if (invoice.transaction_id) { doc.text(`Transaction ID: ${invoice.transaction_id}`, M, y); y += 4.5; }
    if (bankName) { doc.text(`Bank: ${bankName}`, M, y); y += 4.5; }
    if (bankAcc)  { doc.text(`Account: ${bankAcc}`, M, y); y += 4.5; }
    if (bankIfsc) { doc.text(`IFSC: ${bankIfsc}`, M, y); y += 4.5; }
    if (upiId)    { doc.text(`UPI: ${upiId}`, M, y); y += 4.5; }
  }

  addFooter(doc, s);
  await applyLogoWatermark(doc, s.logo_url || brand.logo);
  return doc;
}

// ─── Proforma Invoice PDF ─────────────────────────────────────────────────────

export async function generateProformaInvoicePdf(
  workspaceId: string,
  proforma: any,
  client: User | null = null,
): Promise<jsPDF> {
  const s = await getCompanySettings(workspaceId);
  const cur = proforma.currency || s.default_currency || 'INR';
  const fs = fsFromCompany(s, cur);
  const primaryRgb = hexToRgb(s.primary_color);
  const style = s.template_style || 'modern';

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  if (style === 'corporate') {
    doc.setFillColor(...primaryRgb);
    doc.rect(0, 0, PW, 4, 'F');
  }

  let startY = await drawBrandHeader(doc, s, style, primaryRgb);

  const titleColor = style === 'corporate' ? primaryRgb : C_DARK;
  doc.setFontSize(22).setFont('helvetica', 'bold').setTextColor(...titleColor);
  doc.text('PROFORMA INVOICE', RX, M + 6, { align: 'right' });

  doc.setFontSize(9).setFont('helvetica', 'normal').setTextColor(...C_GRAY);
  let yR = M + 14;
  const num = proforma.number || proforma.id || 'PI-001';
  doc.text(`Proforma #: ${num}`, RX, yR, { align: 'right' }); yR += 5;

  const issueDate = proforma.issueDate || proforma.issue_date || proforma.createdAt || proforma.created_at || new Date().toISOString();
  doc.text(`Date: ${formatDateS(issueDate, fs)}`, RX, yR, { align: 'right' }); yR += 5;

  const validUntil = proforma.validUntil || proforma.valid_until;
  if (validUntil) {
    doc.text(`Valid Until: ${formatDateS(validUntil, fs)}`, RX, yR, { align: 'right' }); yR += 5;
  }
  if (proforma.status) {
    doc.text(`Status: ${proforma.status}`, RX, yR, { align: 'right' }); yR += 5;
  }

  const topSectionY = Math.max(startY, yR) + 6;
  drawDivider(doc, topSectionY);

  let yL = topSectionY + 10;
  let yBT = topSectionY + 10;

  // FROM
  doc.setFontSize(8).setFont('helvetica', 'bold').setTextColor(...(style === 'corporate' ? primaryRgb : C_LIGHT));
  doc.text('FROM', M, yL); yL += 5;

  doc.setFontSize(10).setFont('helvetica', 'bold').setTextColor(...C_DARK);
  doc.text(s.company_name || 'Company', M, yL); yL += 5;

  doc.setFontSize(9).setFont('helvetica', 'normal').setTextColor(...C_GRAY);
  if (s.address) {
    const ls = doc.splitTextToSize(s.address, 80);
    doc.text(ls, M, yL); yL += ls.length * 4.5;
  }
  if (s.email) { doc.text(`Email: ${s.email}`, M, yL); yL += 4.5; }
  if (s.phone) { doc.text(`Phone: ${s.phone}`, M, yL); yL += 4.5; }
  if (s.gst_number) { doc.text(`GSTIN: ${s.gst_number}`, M, yL); yL += 4.5; }

  // BILL TO
  const rightColX = 120;
  doc.setFontSize(8).setFont('helvetica', 'bold').setTextColor(...(style === 'corporate' ? primaryRgb : C_LIGHT));
  doc.text('BILL TO', rightColX, yBT); yBT += 5;

  doc.setFontSize(10).setFont('helvetica', 'bold').setTextColor(...C_DARK);
  const clientName = proforma.clientName || proforma.client_name || client?.full_name || client?.name || 'Client Name';
  doc.text(clientName, rightColX, yBT); yBT += 5;

  doc.setFontSize(9).setFont('helvetica', 'normal').setTextColor(...C_GRAY);
  const cCompany = proforma.clientCompany || proforma.client_company;
  if (cCompany) { doc.text(cCompany, rightColX, yBT); yBT += 4.5; }
  const cAddress = proforma.clientAddress || proforma.client_address || (client as any)?.address;
  if (cAddress) {
    const ls = doc.splitTextToSize(cAddress, 70);
    doc.text(ls, rightColX, yBT); yBT += ls.length * 4.5;
  }
  const cEmail = proforma.clientEmail || proforma.client_email || client?.email;
  if (cEmail) { doc.text(`Email: ${cEmail}`, rightColX, yBT); yBT += 4.5; }
  const cGstin = proforma.clientGstin || proforma.client_gstin;
  if (cGstin) { doc.text(`GSTIN: ${cGstin}`, rightColX, yBT); yBT += 4.5; }

  const tableY = Math.max(yL, yBT) + 12;
  const rawItems = proforma.items && proforma.items.length > 0 ? proforma.items : null;
  const rows: string[][] =
    rawItems && rawItems.length > 0
      ? rawItems.map((item: any, i: number) => {
          const qty = Number(item.quantity) || 1;
          const rate = Number(item.unitPrice || item.unit_price || item.rate) || 0;
          const tot = Number(item.total) || qty * rate;
          return [
            String(i + 1),
            item.description || item.name || 'Item',
            item.unit ? `${qty} ${item.unit}` : String(qty),
            formatAmtS(rate, fs),
            formatAmtS(tot, fs),
          ];
        })
      : [['1', 'General Items', '1', formatAmtS(Number(proforma.total) || 0, fs), formatAmtS(Number(proforma.total) || 0, fs)]];

  autoTable(doc, {
    startY: tableY,
    head: [['#', 'Item', 'Qty', 'Rate', 'Total']],
    body: rows,
    theme: 'plain',
    headStyles: {
      fillColor: style === 'corporate' ? primaryRgb : [245, 245, 245],
      textColor: style === 'corporate' ? [255, 255, 255] : C_DARK,
      fontStyle: 'bold',
      fontSize: 9,
    },
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 3.5, textColor: C_DARK },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 32, halign: 'right' },
      4: { cellWidth: 32, halign: 'right' },
    },
    margin: { left: M, right: M },
  });

  let curY = ((doc as any).lastAutoTable?.finalY ?? tableY + 30) + 8;
  const rightW = 85;
  const rightX = RX - rightW;

  const subtotal = Number(proforma.subtotal) || Number(proforma.total) || 0;
  const discount = Number(proforma.discount) || 0;
  const tax = Number(proforma.tax) || 0;
  const grandTotal = Number(proforma.total) || (subtotal - discount + tax);

  const drawRow = (label: string, val: string, isBold = false) => {
    doc.setFontSize(9).setFont('helvetica', isBold ? 'bold' : 'normal');
    doc.setTextColor(...(isBold ? C_DARK : C_GRAY));
    doc.text(label, rightX, curY);
    doc.text(val, RX, curY, { align: 'right' });
    curY += 5.5;
  };

  drawRow('Subtotal:', formatAmtS(subtotal, fs));
  if (discount > 0) drawRow('Discount:', `-${formatAmtS(discount, fs)}`);
  if (tax > 0) drawRow(`Tax (${s.tax_rate ?? 18}%):`, formatAmtS(tax, fs));

  doc.setDrawColor(...C_LINE);
  doc.setLineWidth(0.3);
  doc.line(rightX, curY - 2, RX, curY - 2);

  doc.setFillColor(...(style === 'corporate' ? [primaryRgb[0], primaryRgb[1], primaryRgb[2]] : [245, 245, 245]));
  doc.rect(rightX, curY - 1, rightW, 9, 'F');
  doc.setFontSize(10).setFont('helvetica', 'bold');
  doc.setTextColor(...(style === 'corporate' ? [255, 255, 255] : C_DARK));
  doc.text('Total Due:', rightX + 3, curY + 5);
  doc.text(formatAmtS(grandTotal, fs), RX - 3, curY + 5, { align: 'right' });
  curY += 14;

  let y = curY;
  if (proforma.notes) {
    doc.setFontSize(8).setFont('helvetica', 'bold').setTextColor(...(style === 'corporate' ? primaryRgb : C_LIGHT));
    doc.text('NOTES', M, y); y += 4.5;
    doc.setFontSize(8.5).setFont('helvetica', 'normal').setTextColor(...C_GRAY);
    const nl = doc.splitTextToSize(proforma.notes, 120);
    doc.text(nl, M, y); y += nl.length * 4 + 4;
  }
  if (proforma.terms || s.default_terms) {
    doc.setFontSize(8).setFont('helvetica', 'bold').setTextColor(...(style === 'corporate' ? primaryRgb : C_LIGHT));
    doc.text('TERMS & CONDITIONS', M, y); y += 4.5;
    doc.setFontSize(8).setFont('helvetica', 'normal').setTextColor(...C_GRAY);
    const tl = doc.splitTextToSize(proforma.terms || s.default_terms, 120);
    doc.text(tl, M, y); y += tl.length * 3.8 + 4;
  }

  // Bank & payment details
  if (s.bank_name || s.upi_id) {
    doc.setFontSize(8).setFont('helvetica', 'bold').setTextColor(...(style === 'corporate' ? primaryRgb : C_LIGHT));
    doc.text('BANK & PAYMENT DETAILS', M, y); y += 4.5;
    doc.setFontSize(8.5).setFont('helvetica', 'normal').setTextColor(...C_GRAY);
    if (s.bank_name) { doc.text(`Bank: ${s.bank_name}`, M, y); y += 4; }
    if (s.bank_account) { doc.text(`Account: ${s.bank_account}`, M, y); y += 4; }
    if (s.bank_ifsc) { doc.text(`IFSC: ${s.bank_ifsc}`, M, y); y += 4; }
    if (s.upi_id) { doc.text(`UPI: ${s.upi_id}`, M, y); y += 4; }
  }

  addFooter(doc, s);
  await applyLogoWatermark(doc, s.logo_url || brand.logo);
  return doc;
}

// ─── Contract PDF ─────────────────────────────────────────────────────────────

export async function generateContractPdf(
  contract: Contract
): Promise<jsPDF> {
  const s = await getCompanySettings();
  const cur = s.default_currency || 'INR';
  const fs = fsFromCompany(s, cur);
  const primaryRgb = hexToRgb(s.primary_color);
  const style = s.template_style || 'modern';

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  if (style === 'corporate') {
    doc.setFillColor(...primaryRgb);
    doc.rect(0, 0, PW, 4, 'F');
  }

  let startY = await drawBrandHeader(doc, s, style, primaryRgb);

  const titleColor = style === 'corporate' ? primaryRgb : C_DARK;
  doc.setFontSize(24).setFont('helvetica', 'bold').setTextColor(...titleColor);
  doc.text('CONTRACT', RX, M + 6, { align: 'right' });

  doc.setFontSize(9).setFont('helvetica', 'normal').setTextColor(...C_GRAY);
  let yR = M + 14;
  doc.text(`Ref: ${contract.contract_number}`, RX, yR, { align: 'right' }); yR += 5;
  doc.text(`Date: ${formatDateS(contract.created_at, fs)}`, RX, yR, { align: 'right' }); yR += 5;

  const topSectionY = Math.max(startY, yR) + 6;
  drawDivider(doc, topSectionY);

  // Addresses
  let yL = topSectionY + 8;
  let yBT = topSectionY + 8;

  // ISSUER
  doc.setFontSize(8).setFont('helvetica', 'bold').setTextColor(...(style === 'corporate' ? primaryRgb : C_LIGHT));
  doc.text('ISSUED BY', M, yL); yL += 5;

  doc.setFontSize(10).setFont('helvetica', 'bold').setTextColor(...C_DARK);
  doc.text(s.company_name || 'Company', M, yL); yL += 5;

  doc.setFontSize(9).setFont('helvetica', 'normal').setTextColor(...C_GRAY);
  if (s.email) { doc.text(`Email: ${s.email}`, M, yL); yL += 4.5; }
  if (s.phone) { doc.text(`Phone: ${s.phone}`, M, yL); yL += 4.5; }

  // CLIENT
  const rightColX = 120;
  doc.setFontSize(8).setFont('helvetica', 'bold').setTextColor(...(style === 'corporate' ? primaryRgb : C_LIGHT));
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
  const contractValue = contract.value ? formatAmtS(contract.value, fs) : '-';

  autoTable(doc, {
    startY: tableY,
    head: [['Description', 'Start Date', 'End Date', 'Value']],
    body: [[
      contractType,
      contract.start_date ? formatDateS(contract.start_date, fs) : '-',
      contract.end_date   ? formatDateS(contract.end_date, fs)   : '-',
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
  await applyLogoWatermark(doc, s.logo_url || brand.logo);
  return doc;
}

// ─── Footer helper ────────────────────────────────────────────────────────────

function addFooter(doc: jsPDF, s: any): void {
  const pages = doc.getNumberOfPages();
  const text  = s.footer_text || [s.company_name, s.website, s.email].filter(Boolean).join('  |  ');

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
  try {
    const blob = doc.output('blob');
    return URL.createObjectURL(blob);
  } catch {
    return doc.output('datauristring');
  }
}