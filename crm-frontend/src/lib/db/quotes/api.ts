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
import { NormalizedQuote, QuoteItem, NormalizedQuoteStatus } from '../types';
import { emitEvent } from '../events';
import { getCurrentUserId } from '@/lib/firebase/auth';
import { getCompany } from '../companies/api';

// ===== Collection Reference =====
function quotesRef(workspaceId: string) {
  return ref(db, `orgs/${workspaceId}/quotes`);
}

function quoteRef(workspaceId: string, quoteId: string) {
  return ref(db, `orgs/${workspaceId}/quotes/${quoteId}`);
}

// ===== Helper Functions =====

/**
 * Calculate quote totals from items
 */
export function calculateQuoteTotals(
  items: QuoteItem[],
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
 * Generate unique quote number
 */
export async function generateQuoteNumber(workspaceId: string): Promise<string> {
  const quotes = await getQuotes(workspaceId);
  const count = quotes.length + 1;
  return `QT-${String(count).padStart(4, '0')}`;
}

// ===== CRUD Operations =====

/**
 * Create a new quote
 */
export async function createQuote(
  workspaceId: string,
  data: Omit<NormalizedQuote, 'quote_id' | 'workspace_id' | 'created_at' | 'updated_at' | 'created_by' | 'quote_number'> & { quote_number?: string }
): Promise<NormalizedQuote> {
  const newRef = push(quotesRef(workspaceId));
  const quoteId = newRef.key!;
  
  // Auto-generate quote number
  const quoteNumber = data.quote_number || await generateQuoteNumber(workspaceId);
  
  const now = new Date().toISOString();
  const quote: NormalizedQuote = {
    ...data,
    quote_id: quoteId,
    workspace_id: workspaceId,
    quote_number: quoteNumber,
    created_at: now,
    updated_at: now,
    created_by: getCurrentUserId() || '',
  };
  
  await set(newRef, quote);
  
  emitEvent('quote:created', quote);
  
  return quote;
}

/**
 * Get a quote by ID
 */
export async function getQuote(
  workspaceId: string, 
  quoteId: string
): Promise<NormalizedQuote | null> {
  const snapshot = await get(quoteRef(workspaceId, quoteId));
  if (snapshot.exists()) {
    return snapshot.val() as NormalizedQuote;
  }
  return null;
}

/**
 * Get all quotes in a workspace
 */
export async function getQuotes(workspaceId: string): Promise<NormalizedQuote[]> {
  const snapshot = await get(quotesRef(workspaceId));
  if (snapshot.exists()) {
    const data = snapshot.val();
    return Object.values(data) as NormalizedQuote[];
  }
  return [];
}

/**
 * Get all quotes for a company
 */
export async function getCompanyQuotes(
  workspaceId: string, 
  companyId: string
): Promise<NormalizedQuote[]> {
  const q = query(quotesRef(workspaceId), orderByChild('workspace_id'), equalTo(companyId));
  const snapshot = await get(q);
  
  if (snapshot.exists()) {
    const data = snapshot.val();
    return Object.values(data) as NormalizedQuote[];
  }
  return [];
}

/**
 * Get all quotes for a deal
 */
export async function getDealQuotes(
  workspaceId: string, 
  dealId: string
): Promise<NormalizedQuote[]> {
  const q = query(quotesRef(workspaceId), orderByChild('deal_id'), equalTo(dealId));
  const snapshot = await get(q);
  
  if (snapshot.exists()) {
    const data = snapshot.val();
    return Object.values(data) as NormalizedQuote[];
  }
  return [];
}

/**
 * Update a quote
 */
export async function updateQuote(
  workspaceId: string,
  quoteId: string,
  data: Partial<Omit<NormalizedQuote, 'quote_id' | 'workspace_id' | 'created_at' | 'created_by'>>
): Promise<void> {
  const now = new Date().toISOString();
  await update(quoteRef(workspaceId, quoteId), {
    ...data,
    updated_at: now,
  });
  
  const updated = await getQuote(workspaceId, quoteId);
  if (updated) {
    emitEvent('quote:updated', updated);
    
    // Emit specific events for status changes
    if (data.status === 'sent') {
      emitEvent('quote:sent', updated);
    } else if (data.status === 'accepted') {
      emitEvent('quote:accepted', updated);
    } else if (data.status === 'rejected') {
      emitEvent('quote:rejected', updated);
    }
  }
}

/**
 * Delete a quote
 */
export async function deleteQuote(
  workspaceId: string, 
  quoteId: string
): Promise<void> {
  const quote = await getQuote(workspaceId, quoteId);
  await remove(quoteRef(workspaceId, quoteId));
  
  if (quote) {
    emitEvent('quote:deleted', quote);
  }
}

// ===== Status Operations =====

/**
 * Mark quote as sent
 */
export async function markQuoteAsSent(
  workspaceId: string,
  quoteId: string
): Promise<void> {
  await updateQuote(workspaceId, quoteId, { status: 'sent' });
}

/**
 * Mark quote as accepted
 */
export async function markQuoteAsAccepted(
  workspaceId: string,
  quoteId: string
): Promise<void> {
  await updateQuote(workspaceId, quoteId, { status: 'accepted' });
}

/**
 * Mark quote as rejected
 */
export async function markQuoteAsRejected(
  workspaceId: string,
  quoteId: string
): Promise<void> {
  await updateQuote(workspaceId, quoteId, { status: 'rejected' });
}

// ===== Query Operations =====

/**
 * Search quotes by number or client name (partial match)
 */
export async function searchQuotes(
  workspaceId: string, 
  searchTerm: string
): Promise<NormalizedQuote[]> {
  const quotes = await getQuotes(workspaceId);
  const lowerSearch = searchTerm.toLowerCase();
  
  return quotes.filter(quote => 
    quote.quote_number.toLowerCase().includes(lowerSearch)
  );
}

/**
 * Get quotes by status
 */
export async function getQuotesByStatus(
  workspaceId: string, 
  status: NormalizedQuoteStatus
): Promise<NormalizedQuote[]> {
  const q = query(quotesRef(workspaceId), orderByChild('status'), equalTo(status));
  const snapshot = await get(q);
  
  if (snapshot.exists()) {
    const data = snapshot.val();
    return Object.values(data) as NormalizedQuote[];
  }
  return [];
}

/**
 * Get expiring quotes (valid_until is within next N days)
 */
export async function getExpiringQuotes(
  workspaceId: string, 
  days: number = 7
): Promise<NormalizedQuote[]> {
  const quotes = await getQuotes(workspaceId);
  const now = new Date();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  
  return quotes.filter(quote => {
    if (!quote.valid_until) return false;
    const validUntil = new Date(quote.valid_until);
    return validUntil >= now && validUntil <= futureDate && 
           quote.status !== 'accepted' && quote.status !== 'rejected';
  });
}

// ===== Statistics =====

/**
 * Calculate quote statistics
 */
export async function getQuoteStats(
  workspaceId: string, 
  companyId?: string
): Promise<{
  total_quotes: number;
  total_value: number;
  draft_quotes: number;
  sent_quotes: number;
  accepted_quotes: number;
  rejected_quotes: number;
  expired_quotes: number;
  acceptance_rate: number;
  average_quote_value: number;
}> {
  const quotes = companyId 
    ? await getCompanyQuotes(workspaceId, companyId)
    : await getQuotes(workspaceId);
  
  const totalValue = quotes.reduce((sum, q) => sum + (q.total || 0), 0);
  
  const draftQuotes = quotes.filter(q => q.status === 'draft');
  const sentQuotes = quotes.filter(q => q.status === 'sent' || q.status === 'viewed');
  const acceptedQuotes = quotes.filter(q => q.status === 'accepted');
  const rejectedQuotes = quotes.filter(q => q.status === 'rejected');
  const expiredQuotes = quotes.filter(q => q.status === 'expired');
  
  const totalWithOutcome = acceptedQuotes.length + rejectedQuotes.length;
  const acceptanceRate = totalWithOutcome > 0 ? (acceptedQuotes.length / totalWithOutcome) * 100 : 0;
  
  return {
    total_quotes: quotes.length,
    total_value: totalValue,
    draft_quotes: draftQuotes.length,
    sent_quotes: sentQuotes.length,
    accepted_quotes: acceptedQuotes.length,
    rejected_quotes: rejectedQuotes.length,
    expired_quotes: expiredQuotes.length,
    acceptance_rate: acceptanceRate,
    average_quote_value: quotes.length > 0 ? totalValue / quotes.length : 0,
  };
}

// ===== Real-time Subscriptions =====

/**
 * Subscribe to quotes changes
 */
export function subscribeToQuotes(
  workspaceId: string,
  callback: (quotes: NormalizedQuote[]) => void
): () => void {
  const q = quotesRef(workspaceId);
  
  const unsubscribe = onValue(q, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      callback(Object.values(data) as NormalizedQuote[]);
    } else {
      callback([]);
    }
  });
  
  return () => off(q, 'value', unsubscribe);
}

/**
 * Subscribe to company quotes changes
 */
export function subscribeToCompanyQuotes(
  workspaceId: string,
  companyId: string,
  callback: (quotes: NormalizedQuote[]) => void
): () => void {
  const q = query(quotesRef(workspaceId), orderByChild('workspace_id'), equalTo(companyId));
  
  const unsubscribe = onValue(q, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      callback(Object.values(data) as NormalizedQuote[]);
    } else {
      callback([]);
    }
  });
  
  return () => off(q, 'value', unsubscribe);
}
