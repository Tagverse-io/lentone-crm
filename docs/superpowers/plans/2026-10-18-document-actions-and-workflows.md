# Document Actions & Conversion Workflows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clean up the cluttered 6-button action strip on Quotations into an intuitive menu, make "Convert to Order & Invoice" visible and accessible across statuses, and add direct "Create Delivery" dispatch workflows to Orders and Invoices.

**Architecture:** 
1. Modernize row actions across Quotations, Invoices, and Orders tables with a unified, clean Radix DropdownMenu (`MoreHorizontal` / `Actions ▾`) + clear text labels instead of multiple raw icons.
2. Allow quotations to be converted to Order + Invoice across all active statuses (`Draft`, `Sent`, `Accepted`), marking status `Accepted` and deducting stock atomically.
3. Introduce an atomic "Dispatch Delivery" dialog/helper for Orders (`/orders`) and Invoices (`/invoices`) that links `deliveries/{id}`, `orders/{id}`, and `invoices/{id}` with worker assignment.

**Tech Stack:** Next.js 15, React 19, Firebase Realtime Database, Radix UI DropdownMenu & Dialog, Tailwind CSS, Lucide icons.

**Spec:** User feedback on cluttered action buttons and missing conversion/dispatch workflows between Quotation, Invoice, Order, and Delivery.

## Global Constraints
- Preserve existing atomic transaction patterns and stock deduction logic in `convertQuotationAtomic` and `buildAssignWorkUpdate`.
- Keep responsive behavior intact (mobile-friendly buttons and touch targets).
- All changes must pass `npx tsx scripts/selftest.ts` and `npx tsc --noEmit`.

---

### Task 1: Quotations Page Actions & Conversion Flow

**Files:**
- Modify: `crm-frontend/src/app/(dashboard)/quotes/page.tsx`

**Interfaces:**
- Consumes: `convertQuotationAtomic`, `Quotation`, `DropdownMenu` components.
- Produces: Clean action column with primary "Convert" action (or icon) and DropdownMenu (`...`) containing View Details, Edit in Document Builder, Preview PDF, Download PDF, Convert to Order & Invoice, and Delete.

- [ ] **Step 1: Update `convert` function to support unaccepted quotes**
Update `convert` so that if `q.status !== 'Accepted'`, it confirms:
`"Convert quotation ${q.number} to an order and invoice? This will mark it Accepted and deduct inventory stock."`
Upon confirmation, it executes `convertQuotationAtomic(q, ...)` which atomically sets status to `Accepted`, creates the order and invoice, and deducts inventory.

- [ ] **Step 2: Replace raw 6-icon clutter in `extraActions` with clean action buttons and DropdownMenu**
Remove duplicate `Eye` (keep 1 preview action), duplicate edit button, and replace the cluttered row with:
- A prominent button or clear convert option.
- A DropdownMenu with labeled items:
  - `Eye`: "View details" (`openPreview(q)`)
  - `FileText`: "Edit in Document Builder" (`/quotes/${q.id}`)
  - `ExternalLink`: "Preview PDF" (`previewPdf(q)`)
  - `Download`: "Download PDF" (`downloadPdf(q)`)
  - `FileCheck`: "Convert to Order & Invoice" (`convert(q)`)
  - `Trash2`: "Delete" (`remove(q)`)

- [ ] **Step 3: Run selftest and typecheck**
Run `npm run selftest` and `npx tsc --noEmit` in `crm-frontend`.

- [ ] **Step 4: Commit**
`git commit -m "feat(quotes): streamline action buttons and enable quote conversion across statuses"`

---

### Task 2: Dispatch Delivery Workflow on Orders Page

**Files:**
- Modify: `crm-frontend/src/app/(dashboard)/orders/page.tsx`
- Modify: `crm-frontend/src/lib/db.ts` (helper if needed)

**Interfaces:**
- Consumes: `Delivery`, `Worker`, `createItem('deliveries', ...)`
- Produces: Dispatch Delivery dialog on Orders, creating delivery record linked to `orderId`, `clientId`, and assigned worker.

- [ ] **Step 1: Add Dispatch Delivery modal state and handler in `orders/page.tsx`**
Add state `dispatchOrder: Order | null`, load active workers from `getCollection<Worker>('workers')`, and add a handler `handleDispatch(workerId, notes, mapsUrl)` that creates the delivery and links `order.deliveryId`.

- [ ] **Step 2: Add "Create Delivery" action to Order rows**
In `orders/page.tsx` `columns` / `extraActions`:
- If `o.deliveryId` exists, display status badge with link to `/deliveries`.
- If `!o.deliveryId`, provide a clear "Dispatch Delivery" button.

- [ ] **Step 3: Run selftest and typecheck**
Run `npm run selftest` and `npx tsc --noEmit`.

- [ ] **Step 4: Commit**
`git commit -m "feat(orders): add direct delivery dispatch action on orders"`

---

### Task 3: Invoices Page Actions & Delivery Dispatch Integration

**Files:**
- Modify: `crm-frontend/src/app/(dashboard)/invoices/page.tsx`

**Interfaces:**
- Consumes: `Invoice`, `orders`, `workers`, `deliveries`
- Produces: Clean DropdownMenu on Invoices row with "Dispatch Delivery" action that creates or links delivery.

- [ ] **Step 1: Add Delivery dispatch modal & logic to `invoices/page.tsx`**
Allow creating a delivery directly for an invoice: if invoice has `orderId`, link it; if not, atomically link or create order + delivery.

- [ ] **Step 2: Replace icon clutter in `invoices/page.tsx` with unified DropdownMenu**
Replace raw FileText, Eye, Download, Sync, Pencil, Trash icons with unified DropdownMenu with clear labels.

- [ ] **Step 3: Verify and typecheck**
Run `npm run selftest` and `npx tsc --noEmit`.

- [ ] **Step 4: Commit**
`git commit -m "feat(invoices): streamline invoice actions and add delivery dispatch"`
