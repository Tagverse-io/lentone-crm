import { 
  ref, 
  push, 
  set, 
  get, 
  update, 
  remove, 
  query, 
  orderByChild, 
  equalTo,
  onValue,
  off
} from 'firebase/database';
import { database as db } from '@/lib/firebase/config';
import { NormalizedInvoice, InvoiceItem, NormalizedInvoiceStatus } from '../types';
import { emitEvent } from '../events';
import { getCurrentUserId } from '@/lib/firebase/auth';

// ===== Collection Reference =====
function invoicesRef(workspaceId: string) {
  return ref(db, `orgs/${workspaceId}/invoices`);
}

function invoiceRef(workspaceId: string, invoiceId: string) {
  return ref(db, `orgs/${workspaceId}/invoices/${invoiceId}`);
}

// ===== Helper Functions =====

/**
 * Calculate invoice totals from items
 */
export function calculateInvoiceTotals(
  items: InvoiceItem[],
  taxRate: number = 0,
  discount: number = 0,
  discountType: 'percentage' | 'fixed' = 'percentage'
): {
  subtotal: number;
  tax: number;
  total: number;
} {
  const subtotal = items.reduce((sum, item) => sum + (item.total || item.quantity * item.unit_price), 0);
  
  let discountAmount = 0;
  if (discountType === 'percentage') {
    discountAmount = (subtotal * discount) / 100;
  } else {
    discountAmount = discount;
  }
  
  const afterDiscount = subtotal - discountAmount;
  const tax = afterDiscount * (taxRate / 100);
  const total = afterDiscount + tax;
  
  return {
    subtotal,
    tax,
    total,
  };
}

/**
 * Generate unique invoice number
 */
export async function generateInvoiceNumber(workspaceId: string): Promise<string> {
  const invoices = await getInvoices(workspaceId);
  const count = invoices.length + 1;
  return `INV-${String(count).padStart(4, '0')}`;
}

// ===== CRUD Operations =====

/**
 * Create a new invoice
 */
export async function createInvoice(
  workspaceId: string,
  data: Omit<NormalizedInvoice, 'invoice_id' | 'workspace_id' | 'created_at' | 'updated_at' | 'created_by' | 'invoice_number'> & { invoice_number?: string }
): Promise<NormalizedInvoice> {
  const newRef = push(invoicesRef(workspaceId));
  const invoiceId = newRef.key!;
  
  // Auto-generate invoice number
  const invoiceNumber = data.invoice_number || await generateInvoiceNumber(workspaceId);
  
  const now = new Date().toISOString();
  const invoice: NormalizedInvoice = {
    ...data,
    invoice_id: invoiceId,
    workspace_id: workspaceId,
    invoice_number: invoiceNumber,
    created_at: now,
    updated_at: now,
    created_by: getCurrentUserId() || '',
  };
  
  await set(newRef, invoice);
  
  emitEvent('invoice:created', invoice);
  
  return invoice;
}

/**
 * Get an invoice by ID
 */
export async function getInvoice(
  workspaceId: string, 
  invoiceId: string
): Promise<NormalizedInvoice | null> {
  const snapshot = await get(invoiceRef(workspaceId, invoiceId));
  if (snapshot.exists()) {
    return snapshot.val() as NormalizedInvoice;
  }
  return null;
}

/**
 * Get all invoices in a workspace
 */
export async function getInvoices(workspaceId: string): Promise<NormalizedInvoice[]> {
  const snapshot = await get(invoicesRef(workspaceId));
  if (snapshot.exists()) {
    const data = snapshot.val();
    return Object.values(data) as NormalizedInvoice[];
  }
  return [];
}

/**
 * Get all invoices for a company
 */
export async function getCompanyInvoices(
  workspaceId: string, 
  companyId: string
): Promise<NormalizedInvoice[]> {
  const q = query(invoicesRef(workspaceId), orderByChild('workspace_id'), equalTo(companyId));
  const snapshot = await get(q);
  
  if (snapshot.exists()) {
    const data = snapshot.val();
    return Object.values(data) as NormalizedInvoice[];
  }
  return [];
}

/**
 * Get all invoices for a deal
 */
export async function getDealInvoices(
  workspaceId: string, 
  dealId: string
): Promise<NormalizedInvoice[]> {
  const q = query(invoicesRef(workspaceId), orderByChild('deal_id'), equalTo(dealId));
  const snapshot = await get(q);
  
  if (snapshot.exists()) {
    const data = snapshot.val();
    return Object.values(data) as NormalizedInvoice[];
  }
  return [];
}

/**
 * Get all invoices for a quote
 */
export async function getQuoteInvoices(
  workspaceId: string, 
  quoteId: string
): Promise<NormalizedInvoice[]> {
  const q = query(invoicesRef(workspaceId), orderByChild('quote_id'), equalTo(quoteId));
  const snapshot = await get(q);
  
  if (snapshot.exists()) {
    const data = snapshot.val();
    return Object.values(data) as NormalizedInvoice[];
  }
  return [];
}

/**
 * Update an invoice
 */
export async function updateInvoice(
  workspaceId: string,
  invoiceId: string,
  data: Partial<Omit<NormalizedInvoice, 'invoice_id' | 'workspace_id' | 'created_at' | 'created_by'>>
): Promise<void> {
  const now = new Date().toISOString();
  await update(invoiceRef(workspaceId, invoiceId), {
    ...data,
    updated_at: now,
  });
  
  const updated = await getInvoice(workspaceId, invoiceId);
  if (updated) {
    emitEvent('invoice:updated', updated);
    
    // Emit specific events for status changes
    if (data.status === 'sent') {
      emitEvent('invoice:sent', updated);
    } else if (data.status === 'paid') {
      emitEvent('invoice:paid', updated);
    } else if (data.status === 'overdue') {
      emitEvent('invoice:overdue', updated);
    }
  }
}

/**
 * Delete an invoice
 */
export async function deleteInvoice(
  workspaceId: string, 
  invoiceId: string
): Promise<void> {
  const invoice = await getInvoice(workspaceId, invoiceId);
  await remove(invoiceRef(workspaceId, invoiceId));
  
  if (invoice) {
    emitEvent('invoice:deleted', invoice);
  }
}

// ===== Status Operations =====

/**
 * Mark invoice as sent
 */
export async function markInvoiceAsSent(
  workspaceId: string,
  invoiceId: string
): Promise<void> {
  await updateInvoice(workspaceId, invoiceId, { status: 'sent' });
}

/**
 * Mark invoice as paid
 */
export async function markInvoiceAsPaid(
  workspaceId: string,
  invoiceId: string
): Promise<void> {
  const invoice = await getInvoice(workspaceId, invoiceId);
  if (invoice) {
    await updateInvoice(workspaceId, invoiceId, { 
      status: 'paid',
      amount_paid: invoice.total,
      amount_due: 0,
      paid_date: new Date().toISOString(),
    });
  }
}

/**
 * Mark invoice as overdue
 */
export async function markInvoiceAsOverdue(
  workspaceId: string,
  invoiceId: string
): Promise<void> {
  await updateInvoice(workspaceId, invoiceId, { status: 'overdue' });
}

// ===== Query Operations =====

/**
 * Search invoices by number (partial match)
 */
export async function searchInvoices(
  workspaceId: string, 
  searchTerm: string
): Promise<NormalizedInvoice[]> {
  const invoices = await getInvoices(workspaceId);
  const lowerSearch = searchTerm.toLowerCase();
  
  return invoices.filter(invoice => 
    invoice.invoice_number.toLowerCase().includes(lowerSearch)
  );
}

/**
 * Get invoices by status
 */
export async function getInvoicesByStatus(
  workspaceId: string, 
  status: NormalizedInvoiceStatus
): Promise<NormalizedInvoice[]> {
  const q = query(invoicesRef(workspaceId), orderByChild('status'), equalTo(status));
  const snapshot = await get(q);
  
  if (snapshot.exists()) {
    const data = snapshot.val();
    return Object.values(data) as NormalizedInvoice[];
  }
  return [];
}

/**
 * Get overdue invoices (due_date has passed and not paid)
 */
export async function getOverdueInvoices(
  workspaceId: string
): Promise<NormalizedInvoice[]> {
  const invoices = await getInvoices(workspaceId);
  const now = new Date();
  
  return invoices.filter(invoice => {
    if (!invoice.due_date) return false;
    const dueDate = new Date(invoice.due_date);
    return dueDate < now && invoice.status !== 'paid' && invoice.status !== 'cancelled';
  });
}

/**
 * Get invoices due within N days
 */
export async function getInvoicesDueSoon(
  workspaceId: string, 
  days: number = 7
): Promise<NormalizedInvoice[]> {
  const invoices = await getInvoices(workspaceId);
  const now = new Date();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  
  return invoices.filter(invoice => {
    if (!invoice.due_date) return false;
    const dueDate = new Date(invoice.due_date);
    return dueDate >= now && dueDate <= futureDate && 
           invoice.status !== 'paid' && invoice.status !== 'cancelled';
  });
}

// ===== Statistics =====

/**
 * Calculate invoice statistics
 */
export async function getInvoiceStats(
  workspaceId: string, 
  companyId?: string
): Promise<{
  total_invoices: number;
  total_value: number;
  total_paid: number;
  total_pending: number;
  total_overdue: number;
  draft_invoices: number;
  sent_invoices: number;
  paid_invoices: number;
  overdue_invoices: number;
  average_invoice_value: number;
  collection_rate: number;
}> {
  const invoices = companyId 
    ? await getCompanyInvoices(workspaceId, companyId)
    : await getInvoices(workspaceId);
  
  const totalValue = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
  const totalPaid = invoices.reduce((sum, inv) => sum + (inv.amount_paid || 0), 0);
  const totalPending = invoices
    .filter(inv => inv.status !== 'paid' && inv.status !== 'cancelled')
    .reduce((sum, inv) => sum + (inv.amount_due || 0), 0);
  const totalOverdue = invoices
    .filter(inv => inv.status === 'overdue')
    .reduce((sum, inv) => sum + (inv.amount_due || 0), 0);
  
  const draftInvoices = invoices.filter(inv => inv.status === 'draft');
  const sentInvoices = invoices.filter(inv => inv.status === 'sent' || inv.status === 'viewed');
  const paidInvoices = invoices.filter(inv => inv.status === 'paid');
  const overdueInvoices = invoices.filter(inv => inv.status === 'overdue');
  
  const collectionRate = totalValue > 0 ? (totalPaid / totalValue) * 100 : 0;
  
  return {
    total_invoices: invoices.length,
    total_value: totalValue,
    total_paid: totalPaid,
    total_pending: totalPending,
    total_overdue: totalOverdue,
    draft_invoices: draftInvoices.length,
    sent_invoices: sentInvoices.length,
    paid_invoices: paidInvoices.length,
    overdue_invoices: overdueInvoices.length,
    average_invoice_value: invoices.length > 0 ? totalValue / invoices.length : 0,
    collection_rate: collectionRate,
  };
}

// ===== Real-time Subscriptions =====

/**
 * Subscribe to invoices changes
 */
export function subscribeToInvoices(
  workspaceId: string,
  callback: (invoices: NormalizedInvoice[]) => void
): () => void {
  const q = invoicesRef(workspaceId);
  
  const unsubscribe = onValue(q, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      callback(Object.values(data) as NormalizedInvoice[]);
    } else {
      callback([]);
    }
  });
  
  return () => off(q, 'value', unsubscribe);
}

/**
 * Subscribe to company invoices changes
 */
export function subscribeToCompanyInvoices(
  workspaceId: string,
  companyId: string,
  callback: (invoices: NormalizedInvoice[]) => void
): () => void {
  const q = query(invoicesRef(workspaceId), orderByChild('workspace_id'), equalTo(companyId));
  
  const unsubscribe = onValue(q, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      callback(Object.values(data) as NormalizedInvoice[]);
    } else {
      callback([]);
    }
  });
  
  return () => off(q, 'value', unsubscribe);
}
