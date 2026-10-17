import { PdfTemplateStyle, PdfDocumentInput } from './types';

function hexToRgbArr(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const big = parseInt(clean, 16);
  return [(big >> 16) & 255, (big >> 8) & 255, big & 255];
}

export interface PdfTemplateColors {
  primary: [number, number, number];
  primaryLight: [number, number, number];
  secondary: [number, number, number];
  accent: [number, number, number];
  text: [number, number, number];
  textLight: [number, number, number];
  background: [number, number, number];
  tableHead: [number, number, number];
  tableHeadText: [number, number, number];
  tableBorder: [number, number, number];
  tableAlt: [number, number, number];
  footer: [number, number, number];
  headerBg?: [number, number, number];
  headerText?: [number, number, number];
}

export interface PdfTemplateConfig {
  name: string;
  colors: PdfTemplateColors;
  headerStyle: 'filled' | 'line' | 'minimal';
  tableStyle: 'grid' | 'striped' | 'clean';
  titleFontSize: number;
  bodyFontSize: number;
  smallFontSize: number;
  logoHeight: number;
  spacing: number;
}

const defaults = {
  text: [51, 51, 51] as [number, number, number],
  textLight: [102, 102, 102] as [number, number, number],
  background: [255, 255, 255] as [number, number, number],
  tableHeadText: [255, 255, 255] as [number, number, number],
  tableBorder: [220, 220, 220] as [number, number, number],
  footer: [128, 128, 128] as [number, number, number],
};

export function getTemplateConfig(style: PdfTemplateStyle, primaryHex: string): PdfTemplateConfig {
  const p = hexToRgbArr(primaryHex);
  const lighten = (c: [number, number, number]): [number, number, number] => [
    Math.min(255, c[0] + 60),
    Math.min(255, c[1] + 60),
    Math.min(255, c[2] + 60),
  ];
  const darken = (c: [number, number, number]): [number, number, number] => [
    Math.max(0, c[0] - 40),
    Math.max(0, c[1] - 40),
    Math.max(0, c[2] - 40),
  ];

  if (style === 'corporate') {
    return {
      name: 'Corporate',
      colors: {
        primary: p,
        primaryLight: lighten(p),
        secondary: darken(p),
        accent: [212, 175, 55],
        ...defaults,
        tableHead: p,
        tableAlt: [247, 248, 250],
        headerBg: p,
        headerText: [255, 255, 255],
      },
      headerStyle: 'filled',
      tableStyle: 'grid',
      titleFontSize: 22,
      bodyFontSize: 9,
      smallFontSize: 8,
      logoHeight: 30,
      spacing: 5,
    };
  }

  if (style === 'minimal') {
    return {
      name: 'Minimal',
      colors: {
        primary: p,
        primaryLight: lighten(p),
        secondary: darken(p),
        accent: [100, 100, 100],
        ...defaults,
        tableHead: [245, 245, 245],
        tableHeadText: [51, 51, 51],
        tableAlt: [250, 250, 250],
        headerBg: [255, 255, 255],
        headerText: p,
      },
      headerStyle: 'minimal',
      tableStyle: 'clean',
      titleFontSize: 20,
      bodyFontSize: 9,
      smallFontSize: 7.5,
      logoHeight: 28,
      spacing: 4,
    };
  }

  return {
    name: 'Modern',
    colors: {
      primary: p,
      primaryLight: lighten(p),
      secondary: darken(p),
      accent: [245, 158, 11],
      ...defaults,
      tableHead: p,
      tableAlt: [246, 249, 252],
      headerBg: [255, 255, 255],
      headerText: p,
    },
    headerStyle: 'line',
    tableStyle: 'striped',
    titleFontSize: 24,
    bodyFontSize: 9,
    smallFontSize: 8,
    logoHeight: 30,
    spacing: 5,
  };
}

function hexToRgb(hex: string): string {
  const clean = hex.replace('#', '');
  const big = parseInt(clean, 16);
  const r = (big >> 16) & 255;
  const g = (big >> 8) & 255;
  const b = big & 255;
  return `${r}, ${g}, ${b}`;
}

function lightenHex(hex: string): string {
  const clean = hex.replace('#', '');
  const big = parseInt(clean, 16);
  const r = Math.min(255, ((big >> 16) & 255) + 60);
  const g = Math.min(255, ((big >> 8) & 255) + 60);
  const b = Math.min(255, (big & 255) + 60);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export function generateHtmlTemplate(
  input: PdfDocumentInput,
  primaryColor: string = '#2563eb',
): string {
  const lightBg = lightenHex(primaryColor) + '18'; // 10% opacity
  const rgb = hexToRgb(primaryColor);

  const rows = input.items
    .map(
      (item, i) => `
      <tr class="${i % 2 === 1 ? 'alt' : ''}">
        <td class="num">${i + 1}</td>
        <td class="item-name">${item.name || ''}${item.description ? `<span class="item-desc">${item.description}</span>` : ''}</td>
        <td class="right">${item.quantity}</td>
        <td class="right">${item.unit_price}</td>
        <td class="right bold">${item.total}</td>
      </tr>`,
    )
    .join('');

  const totalsRows = input.totals
    .map(
      (t) => `
      <tr class="${t.bold ? 'grand-total' : ''}">
        <td>${t.label}</td>
        <td>${t.value}</td>
      </tr>`,
    )
    .join('');

  const paymentSummary =
    input.payment_summary
      ? `
      <div class="payment-summary">
        <div class="ps-row">
          <span>Amount Paid</span>
          <span class="paid">₹${input.payment_summary.amount_paid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </div>
        <div class="ps-row balance">
          <span>Balance Due</span>
          <span>₹${input.payment_summary.balance_due.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </div>
      </div>`
      : '';

  const notesBlock = input.notes
    ? `<div class="section-block">
        <div class="section-title">Notes</div>
        <p class="section-text">${input.notes}</p>
       </div>`
    : '';

  const termsBlock = input.terms
    ? `<div class="section-block">
        <div class="section-title">Terms &amp; Conditions</div>
        <p class="section-text">${input.terms}</p>
       </div>`
    : '';

  const statusBadge = input.meta.status
    ? `<span class="status-badge status-${input.meta.status.toLowerCase()}">${input.meta.status}</span>`
    : '';

  const validOrDue = input.meta.valid_until
    ? `<div class="meta-row"><span class="meta-label">Valid Until</span><span>${input.meta.valid_until}</span></div>`
    : input.meta.due_date
    ? `<div class="meta-row"><span class="meta-label">Due Date</span><span>${input.meta.due_date}</span></div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --primary: ${primaryColor};
    --primary-rgb: ${rgb};
    --primary-light: ${lightBg};
    --text: #1e293b;
    --text-muted: #64748b;
    --border: #e2e8f0;
    --alt-row: #f8fafc;
    --font: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  }

  body {
    font-family: var(--font);
    font-size: 13px;
    color: var(--text);
    background: #fff;
    padding: 0;
    margin: 0;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* ── HEADER ── */
  .header {
    background: var(--primary);
    color: #fff;
    padding: 28px 40px 24px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  .header-left {}
  .company-name {
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.3px;
    margin-bottom: 4px;
  }
  .company-tagline {
    font-size: 11px;
    opacity: 0.75;
    font-weight: 400;
  }
  .header-right { text-align: right; }
  .doc-type {
    font-size: 30px;
    font-weight: 800;
    letter-spacing: -1px;
    line-height: 1;
    margin-bottom: 10px;
  }
  .meta-row {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    font-size: 11.5px;
    margin-bottom: 3px;
    opacity: 0.9;
  }
  .meta-label { opacity: 0.7; }

  /* ── BODY ── */
  .body { padding: 30px 40px; }

  /* ── BILL TO ── */
  .bill-to-wrap {
    background: var(--primary-light);
    border-left: 4px solid var(--primary);
    border-radius: 6px;
    padding: 16px 20px;
    margin-bottom: 28px;
  }
  .bill-to-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    color: var(--primary);
    margin-bottom: 6px;
  }
  .bill-to-company {
    font-size: 16px;
    font-weight: 700;
    color: var(--text);
    margin-bottom: 4px;
  }
  .bill-to-meta {
    font-size: 11.5px;
    color: var(--text-muted);
    line-height: 1.6;
  }

  /* ── FROM (right side if needed) ── */
  .from-section {
    margin-bottom: 24px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 20px;
  }
  .from-block {
    font-size: 11.5px;
    color: var(--text-muted);
    line-height: 1.7;
    text-align: right;
  }
  .from-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    color: var(--primary);
    margin-bottom: 4px;
  }

  /* ── TABLE ── */
  .table-wrap { margin-bottom: 20px; }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12.5px;
  }
  thead tr {
    background: var(--primary);
    color: #fff;
  }
  thead th {
    padding: 10px 12px;
    font-weight: 600;
    font-size: 11px;
    letter-spacing: 0.4px;
    text-transform: uppercase;
  }
  thead th.right { text-align: right; }
  thead th.num { width: 36px; text-align: center; }

  tbody tr td {
    padding: 10px 12px;
    border-bottom: 1px solid var(--border);
    vertical-align: top;
  }
  tbody tr.alt { background: var(--alt-row); }
  tbody tr:last-child td { border-bottom: none; }

  td.num { text-align: center; color: var(--text-muted); font-size: 11px; width: 36px; }
  td.item-name { max-width: 260px; }
  .item-desc {
    display: block;
    font-size: 11px;
    color: var(--text-muted);
    margin-top: 2px;
  }
  td.right { text-align: right; white-space: nowrap; }
  td.bold { font-weight: 600; }

  /* ── TOTALS ── */
  .bottom-wrap {
    display: flex;
    justify-content: flex-end;
    margin-top: 4px;
    margin-bottom: 24px;
  }
  .totals-table {
    width: 280px;
    border-collapse: collapse;
  }
  .totals-table tr td {
    padding: 6px 10px;
    font-size: 12.5px;
    color: var(--text-muted);
  }
  .totals-table tr td:last-child { text-align: right; white-space: nowrap; }
  .totals-table tr.grand-total {
    border-top: 2px solid var(--primary);
    margin-top: 4px;
  }
  .totals-table tr.grand-total td {
    font-size: 15px;
    font-weight: 700;
    color: var(--primary);
    padding-top: 10px;
  }

  /* ── PAYMENT SUMMARY ── */
  .payment-summary {
    width: 280px;
    margin-left: auto;
    margin-bottom: 24px;
    border: 1px solid var(--border);
    border-radius: 6px;
    overflow: hidden;
  }
  .ps-row {
    display: flex;
    justify-content: space-between;
    padding: 8px 14px;
    font-size: 12px;
    color: var(--text-muted);
    border-bottom: 1px solid var(--border);
  }
  .ps-row:last-child { border-bottom: none; }
  .ps-row.balance {
    font-weight: 700;
    font-size: 13px;
    color: var(--text);
    background: var(--primary-light);
  }
  .paid { color: #16a34a; font-weight: 600; }

  /* ── STATUS BADGE ── */
  .status-badge {
    display: inline-block;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    padding: 3px 9px;
    border-radius: 100px;
    margin-left: 8px;
    vertical-align: middle;
  }
  .status-paid { background: #dcfce7; color: #15803d; }
  .status-pending { background: #fef9c3; color: #a16207; }
  .status-overdue { background: #fee2e2; color: #dc2626; }
  .status-draft { background: #f1f5f9; color: #64748b; }

  /* ── NOTES / TERMS ── */
  .bottom-sections {
    display: flex;
    gap: 24px;
    margin-top: 8px;
    margin-bottom: 20px;
  }
  .section-block { flex: 1; }
  .section-title {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    color: var(--primary);
    margin-bottom: 6px;
  }
  .section-text {
    font-size: 11.5px;
    color: var(--text-muted);
    line-height: 1.65;
  }

  /* ── FOOTER ── */
  .footer {
    background: var(--primary);
    color: rgba(255,255,255,0.85);
    padding: 12px 40px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 10.5px;
    margin-top: auto;
  }
  .footer-left { opacity: 0.8; }
  .footer-right { opacity: 0.8; }

  /* ── DIVIDER ── */
  .divider {
    border: none;
    border-top: 1px dashed var(--border);
    margin: 20px 0;
  }

  /* ── PRINT ── */
  @media print {
    body { margin: 0; }
    .header, .footer {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  }

  @page {
    margin: 0;
    size: A4 portrait;
  }
</style>
</head>
<body>

<!-- HEADER -->
<div class="header">
  <div class="header-left">
    <div class="company-name">${input.from.name || 'Company'}</div>
    ${input.from.email || input.from.phone
      ? `<div class="company-tagline">${[input.from.email, input.from.phone].filter(Boolean).join(' · ')}</div>`
      : ''}
  </div>
  <div class="header-right">
    <div class="doc-type">${input.meta.title || 'DOCUMENT'}${statusBadge}</div>
    <div class="meta-row"><span class="meta-label">Number</span><span>#${input.meta.number}</span></div>
    <div class="meta-row"><span class="meta-label">Date</span><span>${input.meta.date}</span></div>
    ${validOrDue}
  </div>
</div>

<!-- BODY -->
<div class="body">

  <!-- FROM + BILL TO -->
  <div class="from-section">
    <!-- BILL TO -->
    <div class="bill-to-wrap" style="flex:1; margin-bottom:0;">
      <div class="bill-to-label">Bill To</div>
      <div class="bill-to-company">${input.to.company || input.to.name || 'Client'}</div>
      <div class="bill-to-meta">
        ${input.to.name && input.to.name !== input.to.company ? `${input.to.name}<br/>` : ''}
        ${input.to.email ? `${input.to.email}<br/>` : ''}
        ${input.to.address ? `${input.to.address}` : ''}
      </div>
    </div>

    <!-- FROM -->
    ${input.from.address || input.from.company
      ? `<div style="text-align:right; min-width:180px;">
          <div class="from-label">From</div>
          <div class="from-block">
            ${input.from.company ? `<strong style="color:var(--text)">${input.from.company}</strong><br/>` : ''}
            ${input.from.address ? `${input.from.address}<br/>` : ''}
          </div>
         </div>`
      : ''}
  </div>

  <!-- TABLE -->
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th class="num">#</th>
          <th>Item / Description</th>
          <th class="right" style="width:70px">Qty</th>
          <th class="right" style="width:100px">Rate</th>
          <th class="right" style="width:110px">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  </div>

  <!-- TOTALS -->
  <div class="bottom-wrap">
    <table class="totals-table">
      <tbody>
        ${totalsRows}
      </tbody>
    </table>
  </div>

  <!-- PAYMENT SUMMARY -->
  ${paymentSummary}

  <!-- NOTES + TERMS -->
  ${notesBlock || termsBlock
    ? `<hr class="divider"/>
       <div class="bottom-sections">
         ${notesBlock}
         ${termsBlock}
       </div>`
    : ''}

</div>

<!-- FOOTER -->
<div class="footer">
  <div class="footer-left">Thank you for your business</div>
  <div class="footer-right">${input.from.name || ''} · ${new Date().getFullYear()}</div>
</div>

</body>
</html>`;
}
