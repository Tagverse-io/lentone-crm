# Proforma Invoice, Numbering Sequences, and PDF Watermark Design Spec

**Date:** 2026-10-18  
**Author:** Antigravity  
**Status:** Approved  

---

## 1. Overview & Goals

This specification details three core enhancements to the Lentone CRM web application:
1. **Configurable Document Sequence Starts:**
   - Invoices start at sequence **751** (`INV-2026-0751`).
   - Quotations start at sequence **2134** (`QUO-2026-2134`).
   - Proforma Invoices start at sequence **1546** (`PI-2026-1546`).
2. **Proforma Invoice Document Module & Conversion Pipeline:**
   - Introduce Proforma Invoices as a first-class document entity stored at `/proformaInvoices/{id}`.
   - Surface a dedicated **"Proforma Invoices"** page under the **Revenue** navigation section in the sidebar.
   - Support a complete commercial pipeline:
     - **Quotation → Proforma Invoice**: Generates a proforma document without deducting inventory stock.
     - **Proforma Invoice → Order & Invoice**: Deducts stock atomically, marks Proforma as `Invoiced`, and creates the confirmed Order and unpaid Invoice.
     - **Quotation → Order & Invoice**: Direct shortcut remains available.
3. **PDF Generation Watermarking:**
   - Render a centered, subtle (8% opacity) company logo watermark across all generated pages for Quotations, Proforma Invoices, and Invoices.
   - Provide a dedicated PDF generator for Proforma Invoices.

---

## 2. Sequence Numbering & Counter Architecture

### Minimum Offsets
In `crm-frontend/src/lib/db.ts`, `nextSequence(name: string)` runs a Firebase transaction on `/counters/{name}`. We configure baseline minimums:
- `invoices`: minimum start = **751** (if current value < 750, the transaction sets it to 751).
- `quotations`: minimum start = **2134** (if current value < 2133, sets to 2134).
- `proformaInvoices`: minimum start = **1546** (if current value < 1545, sets to 1546).

### Formatting Rules
Standard format:
```typescript
formatNumber(prefix, seq, year) // e.g. prefix="INV", seq=751, year=2026 -> "INV-2026-0751"
```
- Invoices: prefix `INV` → `INV-2026-0751`
- Quotations: prefix `QUO` → `QUO-2026-2134`
- Proforma Invoices: prefix `PI` → `PI-2026-1546`

---

## 3. Proforma Invoice Data Model & Workflows

### Database Path
`/proformaInvoices/{id}` in Firebase Realtime Database.

### Schema (`ProformaInvoice`)
```typescript
export const PROFORMA_STATUSES = ['Draft', 'Sent', 'Accepted', 'Invoiced', 'Cancelled'] as const;
export type ProformaStatus = (typeof PROFORMA_STATUSES)[number];

export interface ProformaInvoice {
  id: string;
  number: string;
  numberKey?: string;
  quotationId?: string;
  quotationNumber?: string;
  clientId: string;
  clientName: string;
  clientKey?: string;
  items: QuotationLineItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  currency?: string;
  status: ProformaStatus;
  orderId?: string;
  invoiceId?: string;
  issueDate?: string;
  validUntil?: string;
  notes?: string;
  terms?: string;
  createdAt: string;
  updatedAt: string;
}
```

### Atomic Multi-Path Transactions

#### `convertQuotationToProformaAtomic`
- **Trigger:** Quotation row action "Convert to Proforma Invoice".
- **Actions:**
  1. Retrieves next `proformaInvoices` sequence (`PI-2026-1546`).
  2. Sets Quotation status to `Accepted` and links `proformaInvoiceId`.
  3. Writes `/proformaInvoices/{proformaId}` with Quotation line items, totals, and `quotationId`.
  4. Does **not** deduct inventory stock.
  5. Records history entries for quotation and proforma invoice.

#### `convertProformaToOrderAndInvoiceAtomic`
- **Trigger:** Proforma Invoice row action "Convert to Order & Invoice".
- **Actions:**
  1. Validates available stock for each line item; throws `InsufficientStockError` if short.
  2. Retrieves next `orders` sequence and next `invoices` sequence.
  3. Writes `/orders/{orderId}` with status `Confirmed`.
  4. Writes `/invoices/{invoiceId}` with status `Unpaid`.
  5. Updates `/proformaInvoices/{proformaId}`: status → `Invoiced`, `orderId`, `invoiceId`.
  6. Deducts inventory stock from `/products/{productId}/stock` and appends `/stockMovements`.
  7. Records audit history entries.

### User Interface & Navigation
- **Sidebar:** Add `Proforma Invoices` under the `Revenue` group in `app-sidebar.tsx`, with a badge indicating count of active proformas.
- **List Page (`src/app/(dashboard)/proforma-invoices/page.tsx`):**
  - Search by number/client, filter by status, SWR polling.
  - Row actions: View details modal, Preview PDF, Download PDF, Convert to Order & Invoice, Delete.
- **Quotes Page Integration (`src/app/(dashboard)/quotes/page.tsx`):**
  - Add "Convert to Proforma Invoice" in the action dropdown.

---

## 4. PDF Generation & Watermark

### Logo Watermark Implementation
In `crm-frontend/src/lib/pdf-engine/generator.ts`:
- Create `drawWatermarkLogo(doc: jsPDF, logoUrl?: string)`:
  - Fetches and caches the company logo base64.
  - Calculates proportional dimensions (target width: ~90mm).
  - Calculates center coordinates on the page (`(PW - w) / 2`, `(PH - h) / 2`).
  - Sets `GState({ opacity: 0.08 })`.
  - Stamps the image.
  - Restores `GState({ opacity: 1.0 })`.
- Invoked on each page before or after content rendering in:
  - `generateQuotationPdf`
  - `generateProformaInvoicePdf`
  - `generateInvoicePdf`

### Proforma Invoice PDF Generator
- Create `generateProformaInvoicePdf(...)` in `generator.ts` with title `"PROFORMA INVOICE"`, displaying dates, line items, banking details, and terms.

---

## 5. Verification & Testing

1. **Selftest Updates (`scripts/selftest.ts`):**
   - Verify `nextSequence` counter minimums (`invoices` >= 751, `quotations` >= 2134, `proformaInvoices` >= 1546).
   - Verify `convertQuotationToProformaAtomic` does not deduct stock.
   - Verify `convertProformaToOrderAndInvoiceAtomic` validates stock, deducts stock, and writes linked records.
2. **Type Checking:**
   - Execute `npx tsc --noEmit` in `crm-frontend`.
3. **Manual Verification:**
   - Verify sidebar navigation displays Proforma Invoices.
   - Verify PDF download has the faint centered logo watermark.
