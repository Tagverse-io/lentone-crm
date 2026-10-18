# Proforma Invoice, Numbering Sequences, and PDF Watermark Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement sequence number starts (`INV-2026-0751`, `QUO-2026-2134`, `PI-2026-1546`), a complete Proforma Invoice module with pipeline conversions, and centered logo watermarks on generated PDFs.

**Architecture:** Extend the flat Firebase Realtime Database schema with `/proformaInvoices/{id}`, update `nextSequence` to enforce baseline sequence minimums, add atomic multi-path converters (`convertQuotationToProformaAtomic`, `convertProformaToOrderAndInvoiceAtomic`), add `/proforma-invoices` in the web ERP sidebar, and enhance `generator.ts` with a reusable 8% opacity watermark helper.

**Tech Stack:** Next.js 15, React 19, Firebase Realtime Database, jsPDF, Radix UI, Tailwind CSS, Lucide icons.

**Spec:** `docs/superpowers/specs/2026-10-18-proforma-invoice-and-numbering-design.md`

## Global Constraints
- Preserve existing atomic multi-path update patterns and stock validation rules.
- Do not deduct inventory stock upon Proforma Invoice creation; deduct stock only upon conversion to Order & Invoice.
- Maintain SWR polling-only realtime architecture (no persistent WebSockets).
- All changes must pass `npx tsx scripts/selftest.ts` and `npx tsc --noEmit`.

## Review Focus
- Starting sequence minimums work on fresh or uninitialized counters without skipping numbers.
- Quoting line items preserve descriptions, quantities, unit prices, and units during quote → proforma → invoice transitions.
- Attempting to convert a Proforma Invoice with insufficient stock is blocked by `InsufficientStockError`.
- PDF watermark does not obscure text or crash when logo decoding fails.
- Proforma Invoices table correctly supports search, status filters, and preview/download modals.

---

### Task 1: Sequence Number Starting Thresholds

**Files:**
- Modify: `crm-frontend/src/lib/db.ts:660-675`
- Modify: `crm-frontend/scripts/selftest.ts`

**Interfaces:**
- Consumes: Firebase `runTransaction`, `formatNumber`
- Produces: `nextSequence(name: string): Promise<number>` respecting configured counter baseline starts:
  - `invoices`: 751
  - `quotations`: 2134
  - `proformaInvoices`: 1546

- [ ] **Step 1: Write tests in `scripts/selftest.ts` for counter threshold logic**
Add verification to `selftest.ts` verifying that minimum counter thresholds resolve to `751`, `2134`, and `1546`, and format numbers produce `INV-2026-0751`, `QUO-2026-2134`, and `PI-2026-1546`.

- [ ] **Step 2: Update `nextSequence` and counter initial minimums in `src/lib/db.ts`**
Define `COUNTER_MINIMUMS: Record<string, number> = { invoices: 751, quotations: 2134, proformaInvoices: 1546 }`. In `nextSequence(name)`, if `cur` is undefined or less than `COUNTER_MINIMUMS[name] - 1`, start at `COUNTER_MINIMUMS[name]`.

- [ ] **Step 3: Run selftest to verify it passes**
Run `npm run selftest` in `crm-frontend`.

- [ ] **Step 4: Commit**
```bash
git add src/lib/db.ts scripts/selftest.ts
git commit -m "feat(counters): configure minimum sequence starts for invoices, quotes, and proformas"
```

---

### Task 2: Proforma Invoice Schema & Atomic Conversion Functions

**Files:**
- Modify: `crm-frontend/src/lib/db.ts`
- Modify: `crm-frontend/src/lib/db/types.ts`
- Modify: `crm-frontend/database.rules.json`
- Modify: `crm-frontend/scripts/selftest.ts`

**Interfaces:**
- Consumes: `Quotation`, `QuotationLineItem`, `Product`, `buildAssignWorkUpdate`
- Produces:
  - `ProformaInvoice` type and `PROFORMA_STATUSES`
  - `buildConvertQuotationToProformaUpdate` & `convertQuotationToProformaAtomic`
  - `buildConvertProformaToInvoiceUpdate` & `convertProformaToOrderAndInvoiceAtomic`
  - Database index rules for `proformaInvoices`

- [ ] **Step 1: Add unit tests in `scripts/selftest.ts` for proforma conversions**
Test pure builder `buildConvertQuotationToProformaUpdate`:
- Verifies `quotations/{id}/status` -> `Accepted`.
- Verifies `proformaInvoices/{id}` created with matching items and totals.
- Verifies stock is NOT deducted.
Test pure builder `buildConvertProformaToInvoiceUpdate`:
- Verifies stock deduction and `InsufficientStockError` if short.
- Verifies creation of `orders/{id}` (`Confirmed`) and `invoices/{id}` (`Unpaid`).
- Verifies `proformaInvoices/{id}/status` -> `Invoiced`.

- [ ] **Step 2: Add `ProformaInvoice` types and conversion functions in `src/lib/db.ts`**
Export `PROFORMA_STATUSES`, `ProformaInvoice`, `buildConvertQuotationToProformaUpdate`, `convertQuotationToProformaAtomic`, `buildConvertProformaToInvoiceUpdate`, and `convertProformaToOrderAndInvoiceAtomic`.

- [ ] **Step 3: Update `database.rules.json`**
Add `.indexOn: ["createdAt", "numberKey", "clientKey", "status", "clientId"]` for `proformaInvoices`.

- [ ] **Step 4: Run selftest and typecheck**
Run `npm run selftest` and `npx tsc --noEmit`.

- [ ] **Step 5: Commit**
```bash
git add src/lib/db.ts src/lib/db/types.ts database.rules.json scripts/selftest.ts
git commit -m "feat(proforma): add proforma invoice schema, database rules, and atomic conversions"
```

---

### Task 3: PDF Logo Watermark & Proforma Invoice PDF Generation

**Files:**
- Modify: `crm-frontend/src/lib/pdf-engine/generator.ts`
- Modify: `crm-frontend/src/lib/pdf.ts`

**Interfaces:**
- Consumes: `jsPDF`, `getCompanySettings`, `getBase64ImageFromURL`, `AppSettings`
- Produces:
  - `drawWatermarkLogo(doc: jsPDF, logoUrl?: string): Promise<void>`
  - `generateProformaInvoicePdf(workspaceId: string, proforma: any, client?: any): Promise<jsPDF>`
  - PDF watermark integration on Quotation, Proforma Invoice, and Invoice PDFs

- [ ] **Step 1: Implement `drawWatermarkLogo` helper in `generator.ts`**
Implement centered drawing using `doc.GState({ opacity: 0.08 })`, rendering the logo at ~90mm width centered in the page background on all pages, restoring `GState({ opacity: 1.0 })`.

- [ ] **Step 2: Integrate `drawWatermarkLogo` in Quotation and Invoice PDF generators**
Call `await drawWatermarkLogo(doc, s.logo_url || brand.logo)` in `generateQuotationPdf` and `generateInvoicePdf`.

- [ ] **Step 3: Implement `generateProformaInvoicePdf` in `generator.ts` and export via `pdf.ts`**
Generate enterprise-grade PDF with header `"PROFORMA INVOICE"`, proforma number, dates, client details, line items table, totals, banking details, and watermark.

- [ ] **Step 4: Typecheck and test**
Run `npx tsc --noEmit`.

- [ ] **Step 5: Commit**
```bash
git add src/lib/pdf-engine/generator.ts src/lib/pdf.ts
git commit -m "feat(pdf): add centered logo watermark and proforma invoice PDF generation"
```

---

### Task 4: UI: Proforma Invoices Page, Sidebar & Quotation Actions

**Files:**
- Create: `crm-frontend/src/app/(dashboard)/proforma-invoices/page.tsx`
- Modify: `crm-frontend/src/components/dashboard/app-sidebar.tsx`
- Modify: `crm-frontend/src/app/(dashboard)/quotes/page.tsx`

**Interfaces:**
- Consumes: `ProformaInvoice`, `convertQuotationToProformaAtomic`, `convertProformaToOrderAndInvoiceAtomic`, `generateProformaInvoicePdf`
- Produces:
  - "Proforma Invoices" navigation entry in sidebar
  - Complete `/proforma-invoices` table page with search, filters, preview modal, PDF download, and "Convert to Order & Invoice"
  - "Convert to Proforma Invoice" action item on Quotes table

- [ ] **Step 1: Add "Proforma Invoices" link in `app-sidebar.tsx`**
In `navItems` under the `Revenue` group, add `{ title: 'Proforma Invoices', href: '/proforma-invoices', icon: FileSpreadsheet, badgeKey: 'proformaInvoices' }`.

- [ ] **Step 2: Create `crm-frontend/src/app/(dashboard)/proforma-invoices/page.tsx`**
Implement the page with SWR polling, search by number and client, status filter pills, status badges (`Draft`, `Sent`, `Accepted`, `Invoiced`, `Cancelled`), row action dropdown with "View details", "Preview PDF", "Download PDF", "Convert to Order & Invoice", and "Delete".

- [ ] **Step 3: Add "Convert to Proforma Invoice" in `quotes/page.tsx`**
In the Quotations row action dropdown, add "Convert to Proforma Invoice" calling `convertQuotationToProformaAtomic`, prompting confirmation, creating the proforma, and displaying toast notification with direct link to the new proforma.

- [ ] **Step 4: Verify typecheck and selftest**
Run `npm run selftest` and `npx tsc --noEmit`.

- [ ] **Step 5: Commit**
```bash
git add src/app/\(dashboard\)/proforma-invoices/page.tsx src/components/dashboard/app-sidebar.tsx src/app/\(dashboard\)/quotes/page.tsx
git commit -m "feat(ui): add proforma invoices page, sidebar navigation, and quote conversion action"
```

---

### Task 5: End-to-End Verification

**Files:**
- Verify all modified files across `crm-frontend`.

- [ ] **Step 1: Run full test and typecheck suite**
Run:
- `npm run selftest`
- `npx tsc --noEmit`

- [ ] **Step 2: Git status and branch summary**
Verify working directory is clean and all files are committed.
