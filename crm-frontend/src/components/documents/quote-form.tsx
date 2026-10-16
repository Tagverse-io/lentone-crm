'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ArrowLeft, Save, Send } from 'lucide-react';
import { DocumentHeader } from './document-header';
import { ClientSection } from './client-section';
import { ItemsTable } from './items-table';
import { PricingSummary } from './pricing-summary';
import { NotesSection } from './notes-section';
import { useWorkspace } from '@/lib/settings/workspace-context';
import { useAuth } from '@/lib/firebase/auth-context';
import { backend } from '@/lib/backend-client';
import { createQuotation, updateQuotation } from '@/lib/firebase/database';
import type { Quotation, QuotationStatus } from '@/lib/db/types';
import type {
  DocumentMeta,
  DocumentClient,
  DocumentItem,
  DocumentPricing,
  DocumentNotes,
} from './types';
import { createEmptyItem, calculatePricing } from './types';

interface QuoteFormProps {
  existingQuote?: Quotation | null;
}

export function QuoteForm({ existingQuote }: QuoteFormProps) {
  const router = useRouter();
  const { settings } = useWorkspace();
  const { workspace, user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  // Form state
  const [meta, setMeta] = useState<DocumentMeta>({
    document_number: existingQuote?.quotation_number || '',
    status: existingQuote?.status || 'draft',
    issue_date: existingQuote?.created_at
      ? new Date(existingQuote.created_at).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0],
    valid_until: existingQuote?.valid_until
      ? new Date(existingQuote.valid_until).toISOString().split('T')[0]
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    currency: existingQuote?.currency || settings.general.default_currency || 'USD',
  });

  const [client, setClient] = useState<DocumentClient>({
    company: existingQuote?.client_company || '',
    contact_person: existingQuote?.client_name || '',
    email: existingQuote?.client_email || '',
    phone: '',
    address: existingQuote?.client_address || '',
    gstin: existingQuote?.client_gstin || '',
  });

  const [items, setItems] = useState<DocumentItem[]>(() => {
    if (existingQuote?.items && existingQuote.items.length > 0) {
      return existingQuote.items.map((item, idx) => ({
        id: item.item_id || crypto.randomUUID(),
        name: item.name || item.description || '',
        description: item.name ? (item.description || '') : '',
        quantity: item.quantity,
        unit: (item as { unit?: string }).unit || 'pcs',
        unit_price: item.unit_price,
        total: item.total,
      }));
    }
    return [createEmptyItem()];
  });

  const [discountPercent, setDiscountPercent] = useState(existingQuote?.discount_percent || 0);
  const [taxCgst, setTaxCgst] = useState(existingQuote?.cgst_percent ?? settings.branding.tax_cgst ?? 0);
  const [taxSgst, setTaxSgst] = useState(existingQuote?.sgst_percent ?? settings.branding.tax_sgst ?? 0);
  const [taxIgst, setTaxIgst] = useState(existingQuote?.igst_percent ?? settings.branding.tax_igst ?? 0);

  const [notes, setNotes] = useState<DocumentNotes>({
    notes: existingQuote?.notes || '',
    terms: existingQuote?.terms ?? settings.branding.default_terms ?? '',
    internal_notes: existingQuote?.internal_notes || '',
    delivery_timeline: existingQuote?.delivery_timeline || '',
  });

  // Calculate pricing
  const pricing = calculatePricing(
    items,
    discountPercent,
    taxCgst,
    taxSgst,
    taxIgst
  );

  // Update meta defaults when settings change
  useEffect(() => {
    if (!existingQuote) {
      setMeta((prev) => ({
        ...prev,
        currency: settings.general.default_currency || 'USD',
      }));
      setNotes((prev) => ({
        ...prev,
        terms: settings.branding.default_terms || '',
      }));
    }
  }, [settings, existingQuote]);

  // Reserve the next atomic document number from Settings (new quotes only).
  useEffect(() => {
    if (existingQuote || !workspace?.id) return;
    backend.nextNumber(workspace.id, 'quote')
      .then(({ number }) => setMeta((prev) => ({ ...prev, document_number: number })))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingQuote?.id, workspace?.id]);

  const handleSave = useCallback(
    async (status?: QuotationStatus) => {
      if (!client.company && !client.contact_person) {
        toast.error('Client name or company is required');
        return;
      }
      // Header status select is the source of truth; explicit actions override it.
      const finalStatus = status ?? (meta.status as QuotationStatus);

      if (finalStatus === 'draft') {
        setSaving(true);
      } else {
        setSending(true);
      }

      try {
        const quotationData = {
          quotation_number: meta.document_number,
          client_id: '',
          client_name: client.contact_person,
          client_email: client.email,
          client_company: client.company,
          client_address: client.address,
          client_gstin: client.gstin,
          project_title: '',
          amount: pricing.grand_total,
          subtotal: pricing.subtotal,
          discount_percent: pricing.discount_percent,
          discount_amount: pricing.discount_amount,
          tax_amount: pricing.tax_amount,
          cgst_percent: pricing.cgst_percent,
          sgst_percent: pricing.sgst_percent,
          igst_percent: pricing.igst_percent,
          currency: meta.currency,
          valid_until: meta.valid_until ? new Date(meta.valid_until).toISOString() : '',
          status: finalStatus,
          description: '',
          notes: notes.notes,
          terms: notes.terms,
          internal_notes: notes.internal_notes,
          delivery_timeline: notes.delivery_timeline,
          workspace_id: workspace?.id || '',
          items: items.map((item) => ({
            item_id: item.id,
            name: item.name,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit || 'pcs',
            unit_price: item.unit_price,
            total: item.total,
          })),
        };

        if (existingQuote) {
          await updateQuotation(existingQuote.id, quotationData);
          // Event-driven automation: accepted → invoice (idempotent on backend).
          if (existingQuote.status !== 'accepted' && finalStatus === 'accepted' && workspace?.id) {
            try {
              await backend.quotationAccepted(workspace.id, existingQuote.id);
              toast.success('Invoice created from accepted quote');
            } catch {
              toast.error('Quote saved, but invoice automation failed');
            }
          }
          toast.success(finalStatus === 'draft' ? 'Quote updated' : 'Quote sent');
        } else {
          await createQuotation(quotationData);
          toast.success(finalStatus === 'draft' ? 'Quote created' : 'Quote created and sent');
        }

        router.push('/quotes');
      } catch {
        toast.error('Something went wrong');
      } finally {
        setSaving(false);
        setSending(false);
      }
    },
    [meta, client, items, pricing, notes, existingQuote, router, workspace?.id]
  );

  return (
    <div className="space-y-4">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push('/quotes')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">{existingQuote ? 'Edit Quote' : 'New Quote'}</h1>
            <p className="text-sm text-muted-foreground">
              {existingQuote ? 'Update the quotation details' : 'Create a new quotation for your client'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => handleSave()} disabled={saving || sending}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save'}
          </Button>
          <Button onClick={() => handleSave('sent')} disabled={saving || sending}>
            <Send className="h-4 w-4 mr-2" />
            {sending ? 'Sending...' : 'Send Quote'}
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto w-full mt-8 pb-24 space-y-8">
        <DocumentHeader
          meta={meta}
          onMetaChange={(m) => setMeta((prev) => ({ ...prev, ...m }))}
          docType="quote"
        />
        <ClientSection client={client} onClientChange={(c) => setClient((prev) => ({ ...prev, ...c }))} />
        <ItemsTable items={items} onItemsChange={setItems} currency={meta.currency} />
        <PricingSummary
          pricing={pricing}
          onPricingChange={(p) => {
            if (p.discount_percent !== undefined) setDiscountPercent(p.discount_percent);
            if (p.cgst_percent !== undefined) setTaxCgst(p.cgst_percent);
            if (p.sgst_percent !== undefined) setTaxSgst(p.sgst_percent);
            if (p.igst_percent !== undefined) setTaxIgst(p.igst_percent);
          }}
          currency={meta.currency}
        />
        <NotesSection notes={notes} onNotesChange={(n) => setNotes((prev) => ({ ...prev, ...n }))} docType="quote" />
      </div>
    </div>
  );
}
