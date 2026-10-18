/**
 * PDF engine for Lentone CRM — Invoice & Quotation
 * Generates a beautiful HTML document, opens it in a hidden iframe and uses
 * window.print() for PDF export (no jsPDF dependency needed at runtime).
 *
 * Styled after tsk-crm's pdf-engine/templates.ts — clean, professional,
 * primary-color-themed with 3 template styles: modern | corporate | minimal.
 */

import type { AppSettings } from './db';

export type PdfTemplateStyle = 'modern' | 'corporate' | 'minimal';

export interface PdfLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface PdfDocOptions {
  kind: 'INVOICE' | 'QUOTATION' | 'PROFORMA';
  number: string;
  issueDate?: string;
  dueDate?: string;
  validUntil?: string;
  status?: string;
  settings: AppSettings;
  clientName?: string;
  clientCompany?: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: string;
  items: PdfLineItem[];
  subtotal: number;
  discount?: number;
  tax?: number;
  total: number;
  amountPaid?: number;
  outstanding?: number;
  notes?: string;
  terms?: string;
  currency?: string;
}

// ── helpers ────────────────────────────────────────────────────────────────────

function esc(s: string | undefined | null): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function money(n: number | undefined, currency: string): string {
  const sym = currency === '₹' ? '₹' : esc(currency);
  return `${sym}${(Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function lightenHex(hex: string, amount = 220): string {
  const clean = hex.replace('#', '');
  const big = parseInt(clean.length === 3
    ? clean.split('').map(c => c + c).join('')
    : clean, 16);
  const r = Math.min(255, ((big >> 16) & 255) + amount);
  const g = Math.min(255, ((big >> 8) & 255) + amount);
  const b = Math.min(255, (big & 255) + amount);
  return `rgb(${r},${g},${b})`;
}

function statusBadge(status: string | undefined): string {
  if (!status) return '';
  const map: Record<string, string> = {
    paid: '#16a34a',
    confirmed: '#16a34a',
    accepted: '#16a34a',
    unpaid: '#d97706',
    pending: '#d97706',
    overdue: '#dc2626',
    draft: '#64748b',
    partial: '#7c3aed',
  };
  const key = status.toLowerCase();
  const color = map[key] ?? '#64748b';
  return `<span style="display:inline-block;font-size:10px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;padding:2px 8px;border-radius:100px;background:${color}1a;color:${color};border:1px solid ${color}33;margin-left:8px;vertical-align:middle">${esc(status)}</span>`;
}

// ── HTML template ──────────────────────────────────────────────────────────────

function buildHtml(opts: PdfDocOptions): string {
  const primary = opts.settings.primaryColor || '#2563eb';
  const style = opts.settings.templateStyle || 'modern';
  const currency = opts.currency ?? opts.settings.currency ?? '₹';
  const s = opts.settings;

  // Header style variations
  const headerBg = style === 'minimal' ? '#ffffff' : primary;
  const headerText = style === 'minimal' ? primary : '#ffffff';
  const tableBg = style === 'corporate' ? primary : style === 'minimal' ? '#f1f5f9' : primary;
  const tableText = style === 'minimal' ? '#1e293b' : '#ffffff';
  const lightBg = lightenHex(primary, 230);

  const rows = opts.items.map((item, i) => {
    const name = esc(item.description || '—').split('\\n');
    const title = name[0];
    const desc = name.slice(1).join(' ').trim();
    return `<tr style="background:${i % 2 === 1 && style !== 'minimal' ? '#f8fafc' : '#ffffff'}">
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;width:36px;text-align:center;color:#94a3b8;font-size:11px">${i + 1}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;max-width:260px">
        <div style="font-weight:500;color:#1e293b">${title}</div>
        ${desc ? `<div style="font-size:11px;color:#94a3b8;margin-top:2px">${desc}</div>` : ''}
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:right;white-space:nowrap;color:#475569">${item.quantity}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:right;white-space:nowrap;color:#475569">${money(item.unitPrice, currency)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:right;white-space:nowrap;font-weight:600;color:#1e293b">${money(item.total, currency)}</td>
    </tr>`;
  }).join('');

  const totals: { label: string; value: string; bold?: boolean }[] = [
    { label: 'Subtotal', value: money(opts.subtotal, currency) },
  ];
  if (opts.discount) totals.push({ label: 'Discount', value: `- ${money(opts.discount, currency)}` });
  if (opts.tax) totals.push({ label: `Tax (${s.taxRate ?? 18}%)`, value: money(opts.tax, currency) });
  totals.push({ label: 'Total', value: money(opts.total, currency), bold: true });
  if (opts.kind === 'INVOICE' && opts.amountPaid !== undefined) {
    totals.push({ label: 'Amount Paid', value: money(opts.amountPaid, currency) });
    totals.push({ label: 'Balance Due', value: money(opts.outstanding ?? 0, currency), bold: true });
  }

  const totalsHtml = totals.map(t => `
    <tr style="${t.bold ? `border-top:2px solid ${primary}` : ''}">
      <td style="padding:${t.bold ? '10' : '5'}px 10px;font-size:${t.bold ? '14' : '12'}px;color:${t.bold ? primary : '#64748b'};font-weight:${t.bold ? '700' : '400'}">${t.label}</td>
      <td style="padding:${t.bold ? '10' : '5'}px 10px;text-align:right;font-size:${t.bold ? '14' : '12'}px;color:${t.bold ? primary : '#475569'};font-weight:${t.bold ? '700' : '400'};white-space:nowrap">${t.value}</td>
    </tr>`).join('');

  const notesHtml = opts.notes?.trim()
    ? `<div style="flex:1"><div style="font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${primary};margin-bottom:6px">Notes</div><p style="font-size:11.5px;color:#64748b;line-height:1.65;margin:0">${esc(opts.notes)}</p></div>`
    : '';

  const defaultNotes = s.defaultNotes?.trim();
  const termsText = opts.terms?.trim() || s.defaultTerms?.trim();
  const termsHtml = termsText
    ? `<div style="flex:1"><div style="font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${primary};margin-bottom:6px">Terms &amp; Conditions</div><p style="font-size:11.5px;color:#64748b;line-height:1.65;margin:0">${esc(termsText)}</p></div>`
    : '';

  const defaultNotesHtml = (!opts.notes?.trim() && defaultNotes)
    ? `<div style="flex:1"><div style="font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${primary};margin-bottom:6px">Notes</div><p style="font-size:11.5px;color:#64748b;line-height:1.65;margin:0">${esc(defaultNotes)}</p></div>`
    : notesHtml;

  const bankHtml = (s.bankName || s.bankAccount || s.upiId)
    ? `<div style="margin-top:20px;padding:14px 20px;background:${lightBg};border-left:4px solid ${primary};border-radius:6px">
        <div style="font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${primary};margin-bottom:8px">Payment Details</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 24px;font-size:11.5px;color:#64748b;line-height:1.7">
          ${s.bankName ? `<div><span style="color:#94a3b8">Bank:</span> ${esc(s.bankName)}</div>` : ''}
          ${s.bankAccount ? `<div><span style="color:#94a3b8">Account:</span> ${esc(s.bankAccount)}</div>` : ''}
          ${s.bankIfsc ? `<div><span style="color:#94a3b8">IFSC:</span> ${esc(s.bankIfsc)}</div>` : ''}
          ${s.upiId ? `<div><span style="color:#94a3b8">UPI:</span> ${esc(s.upiId)}</div>` : ''}
        </div>
      </div>`
    : '';

  const validOrDue = opts.kind === 'QUOTATION'
    ? `<div style="font-size:12px;color:${headerText};opacity:0.85;margin-top:3px"><span style="opacity:0.7">Valid Until</span> &nbsp;${fmtDate(opts.validUntil)}</div>`
    : opts.dueDate
    ? `<div style="font-size:12px;color:${headerText};opacity:0.85;margin-top:3px"><span style="opacity:0.7">Due</span> &nbsp;${fmtDate(opts.dueDate)}</div>`
    : '';

  const companySubline = [s.companyEmail, s.companyPhone].filter(Boolean).join(' · ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(opts.kind)} ${esc(opts.number)}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 13px;
    color: #1e293b;
    background: #ffffff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  @media print {
    body { margin: 0; }
    @page { margin: 0; size: A4 portrait; }
  }
</style>
</head>
<body>

<!-- HEADER -->
<div style="background:${headerBg};color:${headerText};padding:24px 40px;display:flex;justify-content:space-between;align-items:flex-start;${style === 'minimal' ? `border-bottom:3px solid ${primary}` : ''}">
  <div style="display:flex;align-items:center;gap:16px">
    <img src="${esc(s.logo || '/logo.png')}" style="height:56px;width:56px;object-fit:contain;display:block" crossorigin="anonymous"/>
    <div>
      <div style="font-size:22px;font-weight:800;color:${style === 'corporate' ? headerText : '#c38d27'};line-height:1.1">${esc(s.companyName?.toLowerCase().includes('lentone') ? 'LENTONE' : (s.companyName || 'LENTONE'))}</div>
      <div style="font-size:8.5px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:${style === 'corporate' ? 'rgba(255,255,255,0.85)' : '#737373'};margin-top:3px">${esc(s.tagline || 'PREMIUM CLEANING AND HYGIENE SOLUTIONS')}</div>
      <div style="font-size:11px;color:${style === 'corporate' ? 'rgba(255,255,255,0.9)' : '#334155'};margin-top:4px;line-height:1.4">
        Padur, Rajiv Gandhi Salai (OMR),<br/>Chennai – 603103
      </div>
    </div>
  </div>
  <div style="text-align:right">
    <div style="font-size:22px;font-weight:800;letter-spacing:1px;color:${headerText}">${opts.kind}${statusBadge(opts.status)}</div>
    <div style="font-size:12px;color:${headerText};opacity:0.85;margin-top:4px"><span style="opacity:0.7">Number</span> &nbsp;#${esc(opts.number)}</div>
    <div style="font-size:12px;color:${headerText};opacity:0.85;margin-top:3px"><span style="opacity:0.7">Date</span> &nbsp;${fmtDate(opts.issueDate)}</div>
    ${validOrDue}
  </div>
</div>

<!-- BODY -->
<div style="padding:30px 40px">

  <!-- ADDRESSES -->
  <div style="display:flex;gap:20px;margin-bottom:28px">
    <!-- BILL TO -->
    <div style="flex:1;background:${lightBg};border-left:4px solid ${primary};border-radius:6px;padding:16px 20px">
      <div style="font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${primary};margin-bottom:6px">
        ${opts.kind === 'QUOTATION' ? 'Quote To' : 'Bill To'}
      </div>
      <div style="font-size:15px;font-weight:700;color:#1e293b;margin-bottom:4px">${esc(opts.clientCompany || opts.clientName || 'Client')}</div>
      <div style="font-size:11.5px;color:#64748b;line-height:1.65">
        ${opts.clientName && opts.clientName !== opts.clientCompany ? esc(opts.clientName) + '<br/>' : ''}
        ${opts.clientEmail ? esc(opts.clientEmail) + '<br/>' : ''}
        ${opts.clientPhone ? esc(opts.clientPhone) + '<br/>' : ''}
        ${opts.clientAddress ? esc(opts.clientAddress) : ''}
      </div>
    </div>
    <!-- FROM -->
    ${s.address ? `<div style="text-align:right;min-width:160px">
      <div style="font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${primary};margin-bottom:6px">From</div>
      <div style="font-size:11.5px;color:#64748b;line-height:1.7">
        ${esc(s.address)}
        ${s.gstin ? `<br/>GSTIN: ${esc(s.gstin)}` : ''}
      </div>
    </div>` : ''}
  </div>

  <!-- TABLE -->
  <div style="margin-bottom:20px">
    <table style="width:100%;border-collapse:collapse;font-size:12.5px">
      <thead>
        <tr style="background:${tableBg};color:${tableText}">
          <th style="padding:10px 12px;font-weight:600;font-size:11px;letter-spacing:.4px;text-transform:uppercase;width:36px;text-align:center">#</th>
          <th style="padding:10px 12px;font-weight:600;font-size:11px;letter-spacing:.4px;text-transform:uppercase;text-align:left">Item / Description</th>
          <th style="padding:10px 12px;font-weight:600;font-size:11px;letter-spacing:.4px;text-transform:uppercase;text-align:right;width:70px">Qty</th>
          <th style="padding:10px 12px;font-weight:600;font-size:11px;letter-spacing:.4px;text-transform:uppercase;text-align:right;width:100px">Rate</th>
          <th style="padding:10px 12px;font-weight:600;font-size:11px;letter-spacing:.4px;text-transform:uppercase;text-align:right;width:110px">Amount</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>

  <!-- TOTALS -->
  <div style="display:flex;justify-content:flex-end;margin-bottom:24px">
    <table style="width:280px;border-collapse:collapse">
      <tbody>${totalsHtml}</tbody>
    </table>
  </div>

  <!-- BANK + NOTES + TERMS -->
  ${bankHtml}
  ${(defaultNotesHtml || termsHtml)
    ? `<hr style="border:none;border-top:1px dashed #e2e8f0;margin:20px 0"/>
       <div style="display:flex;gap:24px">${defaultNotesHtml}${termsHtml}</div>`
    : ''}

</div>

<!-- FOOTER -->
<div style="background:${primary};color:rgba(255,255,255,0.85);padding:12px 40px;display:flex;justify-content:space-between;align-items:center;font-size:10.5px;margin-top:auto">
  <div>Thank you for your business</div>
  <div>${esc(s.companyName || '')} · ${new Date().getFullYear()}</div>
</div>

</body>
</html>`;
}

// ── Public API ─────────────────────────────────────────────────────────────────

import { generateInvoicePdf, generateQuotationPdf, generateProformaInvoicePdf, downloadPdf } from '@/lib/pdf-engine/generator';

/**
 * Directly generates and downloads a clean, themed PDF matching tsk-crm engine.
 * No browser print dialog or popup required.
 */
export async function exportDocumentPdf(opts: PdfDocOptions): Promise<void> {
  const isInvoice = opts.kind === 'INVOICE';
  const isProforma = opts.kind === 'PROFORMA';
  const kindLabel = isInvoice ? 'Invoice' : isProforma ? 'Proforma' : 'Quotation';
  const filename = `${kindLabel}-${opts.number || 'doc'}.pdf`;

  const mapItem = (it: any) => {
    const rawDesc = String(it.description || '').trim();
    const rawName = String(it.name || '').trim();
    let name = rawName;
    let description = rawDesc;
    if (!name && rawDesc) {
      if (rawDesc.includes('\n')) {
        const parts = rawDesc.split('\n');
        name = parts[0];
        description = parts.slice(1).join('\n');
      } else if (rawDesc.includes(' - ')) {
        const parts = rawDesc.split(' - ');
        name = parts[0];
        description = parts.slice(1).join(' - ');
      } else {
        name = rawDesc;
      }
    }
    return {
      name,
      description,
      quantity: it.quantity,
      unit: it.unit || 'pcs',
      unit_price: it.unitPrice ?? it.unit_price ?? 0,
      unitPrice: it.unitPrice ?? it.unit_price ?? 0,
      total: it.total,
    };
  };

  if (isProforma) {
    const doc = await generateProformaInvoicePdf('', {
      number: opts.number,
      issueDate: opts.issueDate,
      issue_date: opts.issueDate,
      validUntil: opts.validUntil,
      valid_until: opts.validUntil,
      status: opts.status,
      clientName: opts.clientName,
      client_name: opts.clientName,
      clientCompany: opts.clientCompany,
      client_company: opts.clientCompany,
      clientAddress: opts.clientAddress,
      client_address: opts.clientAddress,
      clientEmail: opts.clientEmail,
      client_email: opts.clientEmail,
      clientPhone: opts.clientPhone,
      client_phone: opts.clientPhone,
      items: opts.items.map(mapItem),
      subtotal: opts.subtotal,
      discount: opts.discount,
      discount_amount: opts.discount,
      tax: opts.tax,
      tax_amount: opts.tax,
      total: opts.total,
      amount: opts.total,
      notes: opts.notes,
      terms: opts.terms,
    });
    await downloadPdf(doc, filename);
  } else if (isInvoice) {
    const doc = await generateInvoicePdf('', {
      number: opts.number,
      invoice_number: opts.number,
      issue_date: opts.issueDate,
      issueDate: opts.issueDate,
      due_date: opts.dueDate,
      dueDate: opts.dueDate,
      client_name: opts.clientName,
      clientName: opts.clientName,
      client_company: opts.clientCompany,
      clientCompany: opts.clientCompany,
      client_address: opts.clientAddress,
      clientAddress: opts.clientAddress,
      client_email: opts.clientEmail,
      clientEmail: opts.clientEmail,
      client_phone: opts.clientPhone,
      clientPhone: opts.clientPhone,
      items: opts.items.map(mapItem),
      subtotal: opts.subtotal,
      discount: opts.discount,
      discount_amount: opts.discount,
      tax: opts.tax,
      tax_amount: opts.tax,
      total: opts.total,
      amount: opts.total,
      amount_paid: opts.amountPaid,
      amountPaid: opts.amountPaid,
      notes: opts.notes,
      terms: opts.terms,
    });
    await downloadPdf(doc, filename);
  } else {
    const doc = await generateQuotationPdf('', {
      number: opts.number,
      quotation_number: opts.number,
      issue_date: opts.issueDate,
      issueDate: opts.issueDate,
      valid_until: opts.validUntil,
      validUntil: opts.validUntil,
      client_name: opts.clientName,
      clientName: opts.clientName,
      client_company: opts.clientCompany,
      clientCompany: opts.clientCompany,
      client_address: opts.clientAddress,
      clientAddress: opts.clientAddress,
      client_email: opts.clientEmail,
      clientEmail: opts.clientEmail,
      client_phone: opts.clientPhone,
      clientPhone: opts.clientPhone,
      items: opts.items.map(mapItem),
      subtotal: opts.subtotal,
      discount: opts.discount,
      discount_amount: opts.discount,
      tax: opts.tax,
      tax_amount: opts.tax,
      total: opts.total,
      amount: opts.total,
      notes: opts.notes,
      terms: opts.terms,
    });
    await downloadPdf(doc, filename);
  }
}

// Legacy compat shim — old callers that pass partial opts
export async function exportSimplePdf(
  opts: Omit<PdfDocOptions, 'kind' | 'settings'> & {
    title?: string;
    status?: string;
    clientName?: string;
    settings?: AppSettings;
  },
): Promise<void> {
  const { title, settings: optsSettings, clientName, ...rest } = opts;
  const defaultSettings: AppSettings = {
    companyName: 'Lentone Consumer Products',
    tagline: 'PREMIUM CLEANING AND HYGIENE SOLUTIONS',
    primaryColor: '#2563eb',
    templateStyle: 'modern',
    taxRate: 0,
    currency: '₹',
    invoicePrefix: 'INV',
    quotationPrefix: 'Q',
    proformaPrefix: 'PI',
    orderPrefix: 'ORD',
    defaultRowsPerPage: 25,
    defaultTaskSlot: '10:00',
    lowStockThreshold: 10,
    workingHoursStart: '09:00',
    workingHoursEnd: '18:00',
    clientCategories: [],
    customFields: { clients: [], leads: [], products: [] },
  };
  await exportDocumentPdf({
    kind: (title ?? '').toLowerCase().includes('proforma')
      ? 'PROFORMA'
      : (title ?? '').toLowerCase().includes('invoice')
        ? 'INVOICE'
        : 'QUOTATION',
    settings: optsSettings ?? defaultSettings,
    clientName,
    ...rest,
  });
}

