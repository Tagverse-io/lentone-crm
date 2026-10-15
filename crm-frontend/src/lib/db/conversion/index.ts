// @ts-nocheck
/**
 * Lead Lifecycle Conversion Pipeline
 * 
 * Flow: Lead → Qualified → Contact → Deal → Quote → Invoice → Payment
 * 
 * Each step auto-fills data from previous steps.
 * No duplicate typing required.
 */

import { 
  NormalizedLead, 
  Contact, 
  Deal, 
  NormalizedQuote, 
  NormalizedInvoice,
  NormalizedPayment,
  QuoteItem,
  InvoiceItem
} from '../types';
import { createContact, getContact } from '../contacts/api';
import { createDeal, getDeal, updateDeal } from '../deals/api';
import { createQuote, getQuote, updateQuote, calculateQuoteTotals, generateQuoteNumber } from '../quotes/api';
import { createInvoice, getInvoice, updateInvoice, calculateInvoiceTotals, generateInvoiceNumber } from '../invoices/api';
import { createPayment, recordPayment } from '../payments/api';
import { logLeadQualified, logLeadCreated, logDealCreated, logQuoteCreated, logInvoiceCreated, logPaymentReceived } from '../activities/api';
import { emitEvent } from '../events';
import { getCompany } from '../companies/api';

// ===== Step 1: Qualify Lead =====

/**
 * Mark a lead as qualified
 */
export async function qualifyLead(
  workspaceId: string,
  leadId: string,
  leadData: NormalizedLead
): Promise<NormalizedLead> {
  // Log activity
  await logLeadQualified(workspaceId, leadId, leadData.name, leadData.workspace_id);
  
  // Emit event
  emitEvent('lead:qualified', { ...leadData, lead_id: leadId });
  
  return { ...leadData, lead_id: leadId, status: 'qualified' };
}

// ===== Step 2: Convert Lead to Contact =====

/**
 * Convert a qualified lead to a contact
 * Auto-fills contact data from lead
 */
export async function convertLeadToContact(
  workspaceId: string,
  leadId: string,
  leadData: NormalizedLead,
  additionalData?: Partial<Contact>
): Promise<Contact> {
  // Create contact from lead data
  const contact = await createContact(workspaceId, {
    workspace_id: leadData.workspace_id || '',
    name: leadData.name,
    email: leadData.email,
    phone: leadData.phone || '',
    designation: additionalData?.designation || '',
    is_primary: additionalData?.is_primary ?? true,
    notes: additionalData?.notes || '',
  });
  
  // Log activity
  await logLeadCreated(workspaceId, leadId, leadData.name, leadData.workspace_id);
  
  // Emit event
  emitEvent('lead:converted', { 
    lead_id: leadId, 
    contact_id: contact.contact_id,
    conversion_type: 'contact'
  });
  
  return contact;
}

// ===== Step 3: Create Deal from Contact =====

/**
 * Create a deal from a contact (usually after lead conversion)
 * Auto-fills deal data from contact and company
 */
export async function createDealFromContact(
  workspaceId: string,
  contactId: string,
  companyId: string,
  dealData: {
    title: string;
    value: number;
    pipeline_id?: string;
    stage_id?: string;
    expected_close_date?: string;
    description?: string;
  }
): Promise<Deal> {
  // Get company for currency and other defaults
  const company = await getCompany(workspaceId, companyId);
  
  const deal = await createDeal(workspaceId, {
    workspace_id: companyId,
    contact_id: contactId,
    lead_id: '',
    pipeline_id: dealData.pipeline_id || '',
    stage_id: dealData.stage_id || '',
    owner_id: '',
    title: dealData.title,
    description: dealData.description || '',
    value: dealData.value,
    currency: company?.currency || 'INR',
    expected_close_date: dealData.expected_close_date || '',
    actual_close_date: '',
    status: 'open',
    probability: 50,
    source: 'Manual',
  });
  
  // Log activity
  await logDealCreated(workspaceId, deal.deal_id, deal.title, companyId, contactId);
  
  return deal;
}

// ===== Step 4: Create Quote from Deal =====

/**
 * Create a quote from a deal
 * Auto-fills quote data from deal, contact, and company
 */
export async function createQuoteFromDeal(
  workspaceId: string,
  dealId: string,
  items: QuoteItem[],
  additionalData?: {
    notes?: string;
    terms_and_conditions?: string;
    valid_until?: string;
    discount?: number;
    discount_type?: 'percentage' | 'fixed';
    tax_rate?: number;
  }
): Promise<NormalizedQuote> {
  const deal = await getDeal(workspaceId, dealId);
  if (!deal) throw new Error('Deal not found');
  
  const company = await getCompany(workspaceId, deal.workspace_id);
  
  // Calculate totals
  const totals = calculateQuoteTotals(
    items,
    additionalData?.tax_rate || 0,
    additionalData?.discount || 0,
    additionalData?.discount_type || 'percentage'
  );
  
  // Generate quote number
  const quoteNumber = await generateQuoteNumber(workspaceId);
  
  const quote = await createQuote(workspaceId, {
    contact_id: deal.contact_id,
    deal_id: dealId,
    quote_number: quoteNumber,
    items,
    subtotal: totals.subtotal,
    discount: additionalData?.discount || 0,
    discount_type: additionalData?.discount_type || 'percentage',
    tax: totals.tax,
    tax_rate: additionalData?.tax_rate || 0,
    total: totals.total,
    currency: deal.currency,
    status: 'draft',
    valid_until: additionalData?.valid_until || getDefaultValidUntil(),
    notes: additionalData?.notes || '',
    terms_and_conditions: additionalData?.terms_and_conditions || '',
    converted_to_invoice: '',
  });
  
  // Log activity
  await logQuoteCreated(workspaceId, quote.quote_id, quote.quote_number, deal.workspace_id, deal.contact_id, dealId);
  
  return quote;
}

// ===== Step 5: Convert Quote to Invoice =====

/**
 * Convert a quote to an invoice
 * Auto-fills invoice data from quote
 */
export async function convertQuoteToInvoice(
  workspaceId: string,
  quoteId: string,
  additionalData?: {
    due_date?: string;
    notes?: string;
    terms_and_conditions?: string;
  }
): Promise<NormalizedInvoice> {
  const quote = await getQuote(workspaceId, quoteId);
  if (!quote) throw new Error('Quote not found');
  
  // Generate invoice number
  const invoiceNumber = await generateInvoiceNumber(workspaceId);
  
  const invoice = await createInvoice(workspaceId, {
    contact_id: quote.contact_id,
    deal_id: quote.deal_id,
    quote_id: quoteId,
    invoice_number: invoiceNumber,
    items: quote.items.map(item => ({
      item_id: item.item_id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total: item.total,
      tax_rate: item.tax_rate,
    })),
    subtotal: quote.subtotal,
    discount: quote.discount,
    discount_type: quote.discount_type,
    tax: quote.tax,
    tax_rate: quote.tax_rate,
    total: quote.total,
    currency: quote.currency,
    status: 'pending',
    issue_date: new Date().toISOString(),
    due_date: additionalData?.due_date || getDefaultDueDate(),
    paid_date: '',
    amount_paid: 0,
    amount_due: quote.total,
    notes: additionalData?.notes || quote.notes,
    terms_and_conditions: additionalData?.terms_and_conditions || quote.terms_and_conditions,
  });
  
  // Update quote status
  await updateQuote(workspaceId, quoteId, {
    status: 'converted',
    converted_to_invoice: invoice.invoice_id,
  });
  
  // Log activity
  await logInvoiceCreated(workspaceId, invoice.invoice_id, invoice.invoice_number, quote.workspace_id, quote.contact_id, quote.deal_id);
  
  return invoice;
}

// ===== Step 6: Record Payment =====

/**
 * Record a payment for an invoice
 * Auto-updates invoice status
 */
export async function recordInvoicePayment(
  workspaceId: string,
  invoiceId: string,
  paymentData: {
    amount: number;
    method: 'cash' | 'bank_transfer' | 'upi' | 'credit_card' | 'debit_card' | 'cheque' | 'other';
    reference?: string;
    date?: string;
    notes?: string;
  }
): Promise<NormalizedPayment> {
  const invoice = await getInvoice(workspaceId, invoiceId);
  if (!invoice) throw new Error('Invoice not found');
  
  // Record payment (this also updates invoice)
  const payment = await recordPayment(workspaceId, invoiceId, paymentData);
  
  // Log activity
  await logPaymentReceived(
    workspaceId, 
    payment.payment_id, 
    paymentData.amount, 
    invoice.invoice_number, 
    invoice.workspace_id, 
    invoice.contact_id
  );
  
  return payment;
}

// ===== Helper Functions =====

/**
 * Get default valid until date (30 days from now)
 */
function getDefaultValidUntil(): string {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString();
}

/**
 * Get default due date (30 days from now)
 */
function getDefaultDueDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString();
}

// ===== Full Conversion Flow =====

/**
 * Complete conversion flow: Lead → Contact → Deal → Quote → Invoice
 * 
 * This is a convenience function that performs the entire flow.
 * Each step is atomic and can be performed independently.
 */
export async function convertLeadToInvoice(
  workspaceId: string,
  leadId: string,
  leadData: NormalizedLead,
  dealData: {
    title: string;
    value: number;
    pipeline_id?: string;
    stage_id?: string;
  },
  items: QuoteItem[],
  invoiceOptions?: {
    due_date?: string;
    notes?: string;
  }
): Promise<{
  contact: Contact;
  deal: Deal;
  quote: NormalizedQuote;
  invoice: NormalizedInvoice;
}> {
  // Step 1: Convert lead to contact
  const contact = await convertLeadToContact(workspaceId, leadId, leadData);
  
  // Step 2: Create deal from contact
  const deal = await createDealFromContact(
    workspaceId, 
    contact.contact_id, 
    leadData.workspace_id || '',
    dealData
  );
  
  // Step 3: Create quote from deal
  const quote = await createQuoteFromDeal(workspaceId, deal.deal_id, items);
  
  // Step 4: Convert quote to invoice
  const invoice = await convertQuoteToInvoice(workspaceId, quote.quote_id, invoiceOptions);
  
  return { contact, deal, quote, invoice };
}

// ===== Status Automation =====

/**
 * Handle quote accepted - automatically create invoice
 */
export async function handleQuoteAccepted(
  workspaceId: string,
  quoteId: string
): Promise<NormalizedInvoice> {
  const quote = await getQuote(workspaceId, quoteId);
  if (!quote) throw new Error('Quote not found');
  
  // Update quote status
  await updateQuote(workspaceId, quoteId, { status: 'accepted' });
  
  // Convert to invoice
  const invoice = await convertQuoteToInvoice(workspaceId, quoteId);
  
  // Update deal if exists
  if (quote.deal_id) {
    await updateDeal(workspaceId, quote.deal_id, {
      status: 'open',
      probability: 80,
    });
  }
  
  return invoice;
}

/**
 * Handle invoice paid - automatically update deal
 */
export async function handleInvoicePaid(
  workspaceId: string,
  invoiceId: string
): Promise<void> {
  const invoice = await getInvoice(workspaceId, invoiceId);
  if (!invoice) throw new Error('Invoice not found');
  
  // Update deal if exists
  if (invoice.deal_id) {
    await updateDeal(workspaceId, invoice.deal_id, {
      status: 'won',
      actual_close_date: new Date().toISOString(),
      probability: 100,
    });
  }
}
