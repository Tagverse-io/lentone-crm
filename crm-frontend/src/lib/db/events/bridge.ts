// @ts-nocheck
import { database } from '../../firebase/config';
import { ref, get, update, onValue } from 'firebase/database';
import { emitEvent } from './index';
import { handleQuoteAccepted, handleInvoicePaid, convertLeadToContact } from '../conversion';
import type { NormalizedLead } from '../types';

function companyRef(companyId: string, ...segments: string[]) {
  return ref(database, `orgs/${companyId}/${segments.join('/')}`);
}

/**
 * Initialize event bridge: subscribe to relevant Firebase paths
 * and wire them to the conversion pipeline.
 */
export function initEventBridge(companyId: string): () => void {
  // Lead status change → auto-convert to contact when qualified
  const leadsRef = companyRef(companyId, 'leads');
  const leadsListener = (snapshot: any) => {
    const data = snapshot.val();
    if (!data) return;

    Object.entries(data).forEach(async ([id, lead]: [string, any]) => {
      if (lead.status === 'qualified' && !lead.contact_id) {
        try {
          // Fetch full lead data for conversion
          const leadSnap = await get(companyRef(companyId, `leads/${id}`));
          const leadData = leadSnap.val();
          if (!leadData) return;

          const normalizedLead: NormalizedLead = {
            lead_id: id,
            workspace_id: companyId,
            workspace_id: companyId,
            contact_id: leadData.contact_id || '',
            name: leadData.name || '',
            email: leadData.email || '',
            phone: leadData.phone || '',
            source: leadData.source || 'unknown',
            status: leadData.status || 'new',
            intent: leadData.intent || 'warm',
            lead_score: leadData.lead_score || 0,
            probability: leadData.probability || 0,
            potential_value: leadData.potential_value || 0,
            tags: leadData.tags || [],
            last_contacted: leadData.last_contacted || '',
            next_follow_up: leadData.next_follow_up || '',
            follow_up_notes: leadData.follow_up_notes || '',
            converted_to_contact: leadData.converted_to_contact || '',
            converted_to_deal: leadData.converted_to_deal || '',
            converted_at: leadData.converted_at || '',
            created_at: leadData.created_at || '',
            updated_at: leadData.updated_at || '',
            created_by: leadData.created_by || '',
          };

          const contact = await convertLeadToContact(companyId, id, normalizedLead);
          if (contact) {
            // Update the lead with the new contact_id so it doesn't trigger again
            await update(companyRef(companyId, `leads/${id}`), {
              contact_id: contact.contact_id || contact.id || 'converted'
            });
            emitEvent('lead:qualified', {
              leadId: id,
              contactId: contact.contact_id,
              status: 'qualified',
              companyId,
            });
          }
        } catch (err) {
          console.error('[EventBridge] Failed to convert lead:', id, err);
        }
      }
    });
  };

  // Deal status change → emit deal:won when status changes to won
  const dealsRef = companyRef(companyId, 'deals');
  const dealsListener = (snapshot: any) => {
    const data = snapshot.val();
    if (!data) return;

    Object.entries(data).forEach(([id, deal]: [string, any]) => {
      if (deal.status === 'won' && !deal.invoice_id) {
        emitEvent('deal:won', {
          dealId: id,
          companyId,
          amount: deal.amount,
        });
      }
    });
  };

  // Quote status change → create invoice when accepted
  const quotesRef = companyRef(companyId, 'quotes');
  const quotesListener = (snapshot: any) => {
    const data = snapshot.val();
    if (!data) return;

    Object.entries(data).forEach(async ([id, quote]: [string, any]) => {
      if (quote.status === 'accepted' && !quote.invoice_id) {
        try {
          const invoice = await handleQuoteAccepted(companyId, id);
          if (invoice) {
            emitEvent('quote:accepted', {
              quoteId: id,
              invoiceId: invoice.invoice_id,
              companyId,
            });
          }
        } catch (err) {
          console.error('[EventBridge] Failed to handle quote accepted:', id, err);
        }
      }
    });
  };

  // Invoice payment → update deal and contact
  const invoicesRef = companyRef(companyId, 'invoices');
  const invoicesListener = (snapshot: any) => {
    const data = snapshot.val();
    if (!data) return;

    Object.entries(data).forEach(async ([id, invoice]: [string, any]) => {
      if (invoice.status === 'paid' && !invoice._bridge_processed) {
        try {
          await handleInvoicePaid(companyId, id);
          await update(companyRef(companyId, `invoices/${id}`), { _bridge_processed: true });
          emitEvent('invoice:paid', {
            invoiceId: id,
            companyId,
            amount: invoice.amount,
          });
        } catch (err) {
          console.error('[EventBridge] Failed to handle invoice paid:', id, err);
        }
      }
    });
  };

  // Subscribe
  const unsubs = [
    onValue(leadsRef, leadsListener),
    onValue(dealsRef, dealsListener),
    onValue(quotesRef, quotesListener),
    onValue(invoicesRef, invoicesListener),
  ];

  // Cleanup
  return () => {
    unsubs.forEach((unsub: () => void) => unsub());
  };
}
