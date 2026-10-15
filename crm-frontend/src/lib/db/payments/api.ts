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
import { NormalizedPayment, PaymentMethod, PaymentStatus } from '../types';
import { emitEvent } from '../events';
import { getCurrentUserId } from '@/lib/firebase/auth';
import { getInvoice, updateInvoice } from '../invoices/api';

// ===== Collection Reference =====
function paymentsRef(workspaceId: string) {
  return ref(db, `orgs/${workspaceId}/payments`);
}

function paymentRef(workspaceId: string, paymentId: string) {
  return ref(db, `orgs/${workspaceId}/payments/${paymentId}`);
}

// ===== CRUD Operations =====

/**
 * Create a new payment
 */
export async function createPayment(
  workspaceId: string,
  data: Omit<NormalizedPayment, 'payment_id' | 'workspace_id' | 'created_at' | 'updated_at' | 'created_by'>
): Promise<NormalizedPayment> {
  const newRef = push(paymentsRef(workspaceId));
  const paymentId = newRef.key!;
  
  const now = new Date().toISOString();
  const payment: NormalizedPayment = {
    ...data,
    payment_id: paymentId,
    workspace_id: workspaceId,
    created_at: now,
    updated_at: now,
    created_by: getCurrentUserId() || '',
  };
  
  await set(newRef, payment);
  
  emitEvent('payment:created', payment);
  
  return payment;
}

/**
 * Get a payment by ID
 */
export async function getPayment(
  workspaceId: string, 
  paymentId: string
): Promise<NormalizedPayment | null> {
  const snapshot = await get(paymentRef(workspaceId, paymentId));
  if (snapshot.exists()) {
    return snapshot.val() as NormalizedPayment;
  }
  return null;
}

/**
 * Get all payments in a workspace
 */
export async function getPayments(workspaceId: string): Promise<NormalizedPayment[]> {
  const snapshot = await get(paymentsRef(workspaceId));
  if (snapshot.exists()) {
    const data = snapshot.val();
    return Object.values(data) as NormalizedPayment[];
  }
  return [];
}

/**
 * Get all payments for a company
 */
export async function getCompanyPayments(
  workspaceId: string, 
  companyId: string
): Promise<NormalizedPayment[]> {
  const q = query(paymentsRef(workspaceId), orderByChild('workspace_id'), equalTo(companyId));
  const snapshot = await get(q);
  
  if (snapshot.exists()) {
    const data = snapshot.val();
    return Object.values(data) as NormalizedPayment[];
  }
  return [];
}

/**
 * Get all payments for an invoice
 */
export async function getInvoicePayments(
  workspaceId: string, 
  invoiceId: string
): Promise<NormalizedPayment[]> {
  const q = query(paymentsRef(workspaceId), orderByChild('invoice_id'), equalTo(invoiceId));
  const snapshot = await get(q);
  
  if (snapshot.exists()) {
    const data = snapshot.val();
    return Object.values(data) as NormalizedPayment[];
  }
  return [];
}

/**
 * Get all payments for a deal
 */
export async function getDealPayments(
  workspaceId: string, 
  dealId: string
): Promise<NormalizedPayment[]> {
  const q = query(paymentsRef(workspaceId), orderByChild('deal_id'), equalTo(dealId));
  const snapshot = await get(q);
  
  if (snapshot.exists()) {
    const data = snapshot.val();
    return Object.values(data) as NormalizedPayment[];
  }
  return [];
}

/**
 * Update a payment
 */
export async function updatePayment(
  workspaceId: string,
  paymentId: string,
  data: Partial<Omit<NormalizedPayment, 'payment_id' | 'workspace_id' | 'created_at' | 'created_by'>>
): Promise<void> {
  const now = new Date().toISOString();
  await update(paymentRef(workspaceId, paymentId), {
    ...data,
    updated_at: now,
  });
  
  const updated = await getPayment(workspaceId, paymentId);
  if (updated) {
    emitEvent('payment:updated', updated);
  }
}

/**
 * Delete a payment
 */
export async function deletePayment(
  workspaceId: string, 
  paymentId: string
): Promise<void> {
  const payment = await getPayment(workspaceId, paymentId);
  await remove(paymentRef(workspaceId, paymentId));
  
  if (payment) {
    emitEvent('payment:deleted', payment);
  }
}

// ===== Payment Processing =====

/**
 * Record a payment and update invoice
 */
export async function recordPayment(
  workspaceId: string,
  invoiceId: string,
  paymentData: {
    amount: number;
    method: PaymentMethod;
    reference?: string;
    date?: string;
    notes?: string;
  }
): Promise<NormalizedPayment> {
  const invoice = await getInvoice(workspaceId, invoiceId);
  if (!invoice) {
    throw new Error('Invoice not found');
  }

  const amount = Math.max(0, Math.round((paymentData.amount || 0) * 100) / 100);
  if (amount <= 0) {
    throw new Error('Payment amount must be greater than zero');
  }

  // Create payment
  const payment = await createPayment(workspaceId, {
    contact_id: invoice.contact_id,
    invoice_id: invoiceId,
    deal_id: invoice.deal_id,
    quote_id: invoice.quote_id,
    amount,
    currency: invoice.currency,
    method: paymentData.method,
    reference: paymentData.reference || '',
    status: 'completed',
    date: paymentData.date || new Date().toISOString(),
    notes: paymentData.notes || '',
  });

  // Update invoice — clamp amount_due at zero so overpayments never
  // produce a negative balance due (credit balance).
  const newAmountPaid = Math.round(((invoice.amount_paid || 0) + amount) * 100) / 100;
  const newAmountDue = Math.max(0, Math.round((invoice.total - newAmountPaid) * 100) / 100);
  const newStatus = newAmountDue <= 0 ? 'paid' : 'partially_paid';
  
  await updateInvoice(workspaceId, invoiceId, {
    amount_paid: newAmountPaid,
    amount_due: newAmountDue,
    status: newStatus,
    paid_date: newStatus === 'paid' ? new Date().toISOString() : undefined,
  });
  
  // Emit payment received event
  emitEvent('payment:received', payment);
  
  // If invoice fully paid, update deal
  if (newStatus === 'paid' && invoice.deal_id) {
    // Import deal update function dynamically to avoid circular dependency
    const { updateDeal } = await import('../deals/api');
    await updateDeal(workspaceId, invoice.deal_id, {
      status: 'won',
      actual_close_date: new Date().toISOString(),
    });
  }
  
  return payment;
}

// ===== Query Operations =====

/**
 * Search payments by reference (partial match)
 */
export async function searchPayments(
  workspaceId: string, 
  searchTerm: string
): Promise<NormalizedPayment[]> {
  const payments = await getPayments(workspaceId);
  const lowerSearch = searchTerm.toLowerCase();
  
  return payments.filter(payment => 
    payment.reference.toLowerCase().includes(lowerSearch)
  );
}

/**
 * Get payments by status
 */
export async function getPaymentsByStatus(
  workspaceId: string, 
  status: PaymentStatus
): Promise<NormalizedPayment[]> {
  const q = query(paymentsRef(workspaceId), orderByChild('status'), equalTo(status));
  const snapshot = await get(q);
  
  if (snapshot.exists()) {
    const data = snapshot.val();
    return Object.values(data) as NormalizedPayment[];
  }
  return [];
}

/**
 * Get payments by method
 */
export async function getPaymentsByMethod(
  workspaceId: string, 
  method: PaymentMethod
): Promise<NormalizedPayment[]> {
  const q = query(paymentsRef(workspaceId), orderByChild('method'), equalTo(method));
  const snapshot = await get(q);
  
  if (snapshot.exists()) {
    const data = snapshot.val();
    return Object.values(data) as NormalizedPayment[];
  }
  return [];
}

/**
 * Get payments in date range
 */
export async function getPaymentsInDateRange(
  workspaceId: string, 
  startDate: string, 
  endDate: string
): Promise<NormalizedPayment[]> {
  const payments = await getPayments(workspaceId);
  
  return payments.filter(payment => {
    const paymentDate = new Date(payment.date);
    return paymentDate >= new Date(startDate) && paymentDate <= new Date(endDate);
  });
}

// ===== Statistics =====

/**
 * Calculate payment statistics
 */
export async function getPaymentStats(
  workspaceId: string, 
  companyId?: string
): Promise<{
  total_payments: number;
  total_amount: number;
  completed_payments: number;
  completed_amount: number;
  pending_payments: number;
  pending_amount: number;
  failed_payments: number;
  failed_amount: number;
  average_payment: number;
  by_method: Record<PaymentMethod, { count: number; amount: number }>;
}> {
  const payments = companyId 
    ? await getCompanyPayments(workspaceId, companyId)
    : await getPayments(workspaceId);
  
  const totalAmount = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  
  const completedPayments = payments.filter(p => p.status === 'completed');
  const completedAmount = completedPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  
  const pendingPayments = payments.filter(p => p.status === 'pending');
  const pendingAmount = pendingPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  
  const failedPayments = payments.filter(p => p.status === 'failed');
  const failedAmount = failedPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  
  // Group by method
  const byMethod: Record<PaymentMethod, { count: number; amount: number }> = {
    cash: { count: 0, amount: 0 },
    bank_transfer: { count: 0, amount: 0 },
    upi: { count: 0, amount: 0 },
    credit_card: { count: 0, amount: 0 },
    debit_card: { count: 0, amount: 0 },
    cheque: { count: 0, amount: 0 },
    other: { count: 0, amount: 0 },
  };
  
  payments.forEach(p => {
    byMethod[p.method].count++;
    byMethod[p.method].amount += p.amount || 0;
  });
  
  return {
    total_payments: payments.length,
    total_amount: totalAmount,
    completed_payments: completedPayments.length,
    completed_amount: completedAmount,
    pending_payments: pendingPayments.length,
    pending_amount: pendingAmount,
    failed_payments: failedPayments.length,
    failed_amount: failedAmount,
    average_payment: payments.length > 0 ? totalAmount / payments.length : 0,
    by_method: byMethod,
  };
}

// ===== Real-time Subscriptions =====

/**
 * Subscribe to payments changes
 */
export function subscribeToPayments(
  workspaceId: string,
  callback: (payments: NormalizedPayment[]) => void
): () => void {
  const q = paymentsRef(workspaceId);
  
  const unsubscribe = onValue(q, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      callback(Object.values(data) as NormalizedPayment[]);
    } else {
      callback([]);
    }
  });
  
  return () => off(q, 'value', unsubscribe);
}

/**
 * Subscribe to company payments changes
 */
export function subscribeToCompanyPayments(
  workspaceId: string,
  companyId: string,
  callback: (payments: NormalizedPayment[]) => void
): () => void {
  const q = query(paymentsRef(workspaceId), orderByChild('workspace_id'), equalTo(companyId));
  
  const unsubscribe = onValue(q, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      callback(Object.values(data) as NormalizedPayment[]);
    } else {
      callback([]);
    }
  });
  
  return () => off(q, 'value', unsubscribe);
}
