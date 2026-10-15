import { 
  ref, 
  query, 
  orderByChild, 
  equalTo, 
  get 
} from 'firebase/database';
import { database as db } from '@/lib/firebase/config';
import { 
  RelationshipCheck, 
  DeleteCheckResult,
  Contact,
  Deal,
  NormalizedQuote,
  NormalizedInvoice,
  NormalizedPayment
} from './types';

/**
 * Check how many contacts are linked to a company
 */
async function checkCompanyContacts(companyId: string, workspaceId: string): Promise<number> {
  try {
    const contactsRef = ref(db, `orgs/${workspaceId}/contacts`);
    const q = query(contactsRef, orderByChild('workspace_id'), equalTo(companyId));
    const snapshot = await get(q);
    return snapshot.exists() ? Object.keys(snapshot.val()).length : 0;
  } catch (error) {
    console.error('Error checking company contacts:', error);
    return 0;
  }
}

/**
 * Check how many deals are linked to a company
 */
async function checkCompanyDeals(companyId: string, workspaceId: string): Promise<number> {
  try {
    const dealsRef = ref(db, `orgs/${workspaceId}/deals`);
    const q = query(dealsRef, orderByChild('workspace_id'), equalTo(companyId));
    const snapshot = await get(q);
    return snapshot.exists() ? Object.keys(snapshot.val()).length : 0;
  } catch (error) {
    console.error('Error checking company deals:', error);
    return 0;
  }
}

/**
 * Check how many quotes are linked to a company
 */
async function checkCompanyQuotes(companyId: string, workspaceId: string): Promise<number> {
  try {
    const quotesRef = ref(db, `orgs/${workspaceId}/quotes`);
    const q = query(quotesRef, orderByChild('workspace_id'), equalTo(companyId));
    const snapshot = await get(q);
    return snapshot.exists() ? Object.keys(snapshot.val()).length : 0;
  } catch (error) {
    console.error('Error checking company quotes:', error);
    return 0;
  }
}

/**
 * Check how many invoices are linked to a company
 */
async function checkCompanyInvoices(companyId: string, workspaceId: string): Promise<number> {
  try {
    const invoicesRef = ref(db, `orgs/${workspaceId}/invoices`);
    const q = query(invoicesRef, orderByChild('workspace_id'), equalTo(companyId));
    const snapshot = await get(q);
    return snapshot.exists() ? Object.keys(snapshot.val()).length : 0;
  } catch (error) {
    console.error('Error checking company invoices:', error);
    return 0;
  }
}

/**
 * Check all relationships for a company
 */
export async function checkCompanyRelationships(
  companyId: string, 
  workspaceId: string
): Promise<RelationshipCheck[]> {
  const checks: RelationshipCheck[] = [];
  
  const [contactCount, dealCount, quoteCount, invoiceCount] = await Promise.all([
    checkCompanyContacts(companyId, workspaceId),
    checkCompanyDeals(companyId, workspaceId),
    checkCompanyQuotes(companyId, workspaceId),
    checkCompanyInvoices(companyId, workspaceId),
  ]);
  
  checks.push(
    { entity_type: 'company', entity_id: companyId, related_count: contactCount, related_type: 'contacts' },
    { entity_type: 'company', entity_id: companyId, related_count: dealCount, related_type: 'deals' },
    { entity_type: 'company', entity_id: companyId, related_count: quoteCount, related_type: 'quotes' },
    { entity_type: 'company', entity_id: companyId, related_count: invoiceCount, related_type: 'invoices' }
  );
  
  return checks;
}

/**
 * Check if a company can be deleted
 */
export async function canDeleteCompany(
  companyId: string, 
  workspaceId: string
): Promise<DeleteCheckResult> {
  const relationships = await checkCompanyRelationships(companyId, workspaceId);
  
  const hasRelated = relationships.some(r => r.related_count > 0);
  
  if (hasRelated) {
    const summary = relationships
      .filter(r => r.related_count > 0)
      .map(r => `${r.related_count} ${r.related_type}`)
      .join(', ');
    
    return {
      canDelete: false,
      reason: `Cannot delete company. Still has ${summary} linked.`,
      relationships,
    };
  }
  
  return {
    canDelete: true,
    relationships,
  };
}

/**
 * Check how many deals are linked to a contact
 */
async function checkContactDeals(contactId: string, workspaceId: string): Promise<number> {
  try {
    const dealsRef = ref(db, `orgs/${workspaceId}/deals`);
    const q = query(dealsRef, orderByChild('contact_id'), equalTo(contactId));
    const snapshot = await get(q);
    return snapshot.exists() ? Object.keys(snapshot.val()).length : 0;
  } catch (error) {
    console.error('Error checking contact deals:', error);
    return 0;
  }
}

/**
 * Check how many quotes are linked to a contact
 */
async function checkContactQuotes(contactId: string, workspaceId: string): Promise<number> {
  try {
    const quotesRef = ref(db, `orgs/${workspaceId}/quotes`);
    const q = query(quotesRef, orderByChild('contact_id'), equalTo(contactId));
    const snapshot = await get(q);
    return snapshot.exists() ? Object.keys(snapshot.val()).length : 0;
  } catch (error) {
    console.error('Error checking contact quotes:', error);
    return 0;
  }
}

/**
 * Check how many invoices are linked to a contact
 */
async function checkContactInvoices(contactId: string, workspaceId: string): Promise<number> {
  try {
    const invoicesRef = ref(db, `orgs/${workspaceId}/invoices`);
    const q = query(invoicesRef, orderByChild('contact_id'), equalTo(contactId));
    const snapshot = await get(q);
    return snapshot.exists() ? Object.keys(snapshot.val()).length : 0;
  } catch (error) {
    console.error('Error checking contact invoices:', error);
    return 0;
  }
}

/**
 * Check all relationships for a contact
 */
export async function checkContactRelationships(
  contactId: string, 
  workspaceId: string
): Promise<RelationshipCheck[]> {
  const checks: RelationshipCheck[] = [];
  
  const [dealCount, quoteCount, invoiceCount] = await Promise.all([
    checkContactDeals(contactId, workspaceId),
    checkContactQuotes(contactId, workspaceId),
    checkContactInvoices(contactId, workspaceId),
  ]);
  
  checks.push(
    { entity_type: 'contact', entity_id: contactId, related_count: dealCount, related_type: 'deals' },
    { entity_type: 'contact', entity_id: contactId, related_count: quoteCount, related_type: 'quotes' },
    { entity_type: 'contact', entity_id: contactId, related_count: invoiceCount, related_type: 'invoices' }
  );
  
  return checks;
}

/**
 * Check if a contact can be deleted
 */
export async function canDeleteContact(
  contactId: string, 
  workspaceId: string
): Promise<DeleteCheckResult> {
  const relationships = await checkContactRelationships(contactId, workspaceId);
  
  const hasRelated = relationships.some(r => r.related_count > 0);
  
  if (hasRelated) {
    const summary = relationships
      .filter(r => r.related_count > 0)
      .map(r => `${r.related_count} ${r.related_type}`)
      .join(', ');
    
    return {
      canDelete: false,
      reason: `Cannot delete contact. Still has ${summary} linked.`,
      relationships,
    };
  }
  
  return {
    canDelete: true,
    relationships,
  };
}

/**
 * Check how many quotes/invoices are linked to a deal
 */
async function checkDealQuotes(dealId: string, workspaceId: string): Promise<number> {
  try {
    const quotesRef = ref(db, `orgs/${workspaceId}/quotes`);
    const q = query(quotesRef, orderByChild('deal_id'), equalTo(dealId));
    const snapshot = await get(q);
    return snapshot.exists() ? Object.keys(snapshot.val()).length : 0;
  } catch (error) {
    console.error('Error checking deal quotes:', error);
    return 0;
  }
}

async function checkDealInvoices(dealId: string, workspaceId: string): Promise<number> {
  try {
    const invoicesRef = ref(db, `orgs/${workspaceId}/invoices`);
    const q = query(invoicesRef, orderByChild('deal_id'), equalTo(dealId));
    const snapshot = await get(q);
    return snapshot.exists() ? Object.keys(snapshot.val()).length : 0;
  } catch (error) {
    console.error('Error checking deal invoices:', error);
    return 0;
  }
}

async function checkDealPayments(dealId: string, workspaceId: string): Promise<number> {
  try {
    const paymentsRef = ref(db, `orgs/${workspaceId}/payments`);
    const q = query(paymentsRef, orderByChild('deal_id'), equalTo(dealId));
    const snapshot = await get(q);
    return snapshot.exists() ? Object.keys(snapshot.val()).length : 0;
  } catch (error) {
    console.error('Error checking deal payments:', error);
    return 0;
  }
}

/**
 * Check all relationships for a deal
 */
export async function checkDealRelationships(
  dealId: string, 
  workspaceId: string
): Promise<RelationshipCheck[]> {
  const checks: RelationshipCheck[] = [];
  
  const [quoteCount, invoiceCount, paymentCount] = await Promise.all([
    checkDealQuotes(dealId, workspaceId),
    checkDealInvoices(dealId, workspaceId),
    checkDealPayments(dealId, workspaceId),
  ]);
  
  checks.push(
    { entity_type: 'deal', entity_id: dealId, related_count: quoteCount, related_type: 'quotes' },
    { entity_type: 'deal', entity_id: dealId, related_count: invoiceCount, related_type: 'invoices' },
    { entity_type: 'deal', entity_id: dealId, related_count: paymentCount, related_type: 'payments' }
  );
  
  return checks;
}

/**
 * Check if a deal can be deleted
 */
export async function canDeleteDeal(
  dealId: string, 
  workspaceId: string
): Promise<DeleteCheckResult> {
  const relationships = await checkDealRelationships(dealId, workspaceId);
  
  const hasRelated = relationships.some(r => r.related_count > 0);
  
  if (hasRelated) {
    const summary = relationships
      .filter(r => r.related_count > 0)
      .map(r => `${r.related_count} ${r.related_type}`)
      .join(', ');
    
    return {
      canDelete: false,
      reason: `Cannot delete deal. Still has ${summary} linked.`,
      relationships,
    };
  }
  
  return {
    canDelete: true,
    relationships,
  };
}

/**
 * Check if a quote has an invoice linked
 */
async function checkQuoteInvoices(quoteId: string, workspaceId: string): Promise<number> {
  try {
    const invoicesRef = ref(db, `orgs/${workspaceId}/invoices`);
    const q = query(invoicesRef, orderByChild('quote_id'), equalTo(quoteId));
    const snapshot = await get(q);
    return snapshot.exists() ? Object.keys(snapshot.val()).length : 0;
  } catch (error) {
    console.error('Error checking quote invoices:', error);
    return 0;
  }
}

/**
 * Check if a quote can be deleted
 */
export async function canDeleteQuote(
  quoteId: string, 
  workspaceId: string
): Promise<DeleteCheckResult> {
  const invoiceCount = await checkQuoteInvoices(quoteId, workspaceId);
  
  const relationships: RelationshipCheck[] = [
    { entity_type: 'quote', entity_id: quoteId, related_count: invoiceCount, related_type: 'invoices' }
  ];
  
  if (invoiceCount > 0) {
    return {
      canDelete: false,
      reason: `Cannot delete quote. It has been converted to an invoice.`,
      relationships,
    };
  }
  
  return {
    canDelete: true,
    relationships,
  };
}

/**
 * Check if an invoice has payments linked
 */
async function checkInvoicePayments(invoiceId: string, workspaceId: string): Promise<number> {
  try {
    const paymentsRef = ref(db, `orgs/${workspaceId}/payments`);
    const q = query(paymentsRef, orderByChild('invoice_id'), equalTo(invoiceId));
    const snapshot = await get(q);
    return snapshot.exists() ? Object.keys(snapshot.val()).length : 0;
  } catch (error) {
    console.error('Error checking invoice payments:', error);
    return 0;
  }
}

/**
 * Check if an invoice can be deleted
 */
export async function canDeleteInvoice(
  invoiceId: string, 
  workspaceId: string
): Promise<DeleteCheckResult> {
  const paymentCount = await checkInvoicePayments(invoiceId, workspaceId);
  
  const relationships: RelationshipCheck[] = [
    { entity_type: 'invoice', entity_id: invoiceId, related_count: paymentCount, related_type: 'payments' }
  ];
  
  if (paymentCount > 0) {
    return {
      canDelete: false,
      reason: `Cannot delete invoice. It has ${paymentCount} payments linked.`,
      relationships,
    };
  }
  
  return {
    canDelete: true,
    relationships,
  };
}

/**
 * Get relationship summary for display
 */
export function getRelationshipSummary(relationships: RelationshipCheck[]): string {
  const linked = relationships.filter(r => r.related_count > 0);
  
  if (linked.length === 0) {
    return 'No linked entities';
  }
  
  return linked
    .map(r => `${r.related_count} ${r.related_type}`)
    .join(', ');
}
