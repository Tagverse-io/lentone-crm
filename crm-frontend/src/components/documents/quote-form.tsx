'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ArrowLeft, Download, Eye, Save, Send } from 'lucide-react';
import { generateQuotationPdf, downloadPdf as savePdf, openPdfPreview } from '@/lib/pdf-engine/generator';
import { DocumentHeader } from './document-header';
import { ClientSection } from './client-section';
import { ItemsTable } from './items-table';
import { PricingSummary } from './pricing-summary';
import { NotesSection } from './notes-section';
import { useWorkspace } from '@/lib/settings/workspace-context';
import { useAuth } from '@/lib/firebase/auth-context';
import { getCollection, getItem, createItem, updateItem, nameKeyOf, type Client } from '@/lib/db';
import type { Quotation, QuotationStatus } from '@/lib/db/types';
import type {
  DocumentMeta,
  DocumentClient,
  DocumentItem,
  DocumentPricing,
  DocumentNotes,
} from './types';
import {
  createEmptyItem,
  calculatePricing,
  backend,
  createQuotation,
  updateQuotation,
} from './types';

interface QuoteFormProps {
  existingQuote?: Quotation | null;
}

export function QuoteForm({ existingQuote }: QuoteFormProps) {
  const router = useRouter();
  const { settings } = useWorkspace();
  const { workspace, user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  const rawQuote = existingQuote as any;

  // Form state
  const [meta, setMeta] = useState<DocumentMeta>({
    document_number: existingQuote?.quotation_number || rawQuote?.number || '',
    status: (existingQuote?.status || 'draft').toLowerCase(),
    issue_date: rawQuote?.issueDate
      ? rawQuote.issueDate
      : existingQuote?.created_at
      ? new Date(existingQuote.created_at).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0],
    valid_until: rawQuote?.validUntil
      ? rawQuote.validUntil
      : existingQuote?.valid_until
      ? new Date(existingQuote.valid_until).toISOString().split('T')[0]
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    currency: existingQuote?.currency || settings.general.default_currency || 'INR',
  });

  const [client, setClient] = useState<DocumentClient>({
    company: existingQuote?.client_company || rawQuote?.clientCompany || rawQuote?.company || rawQuote?.clientName || '',
    contact_person: existingQuote?.client_name || rawQuote?.contact_person || rawQuote?.contactPerson || rawQuote?.clientName || '',
    email: existingQuote?.client_email || rawQuote?.clientEmail || rawQuote?.email || '',
    phone: rawQuote?.client_phone || rawQuote?.clientPhone || rawQuote?.phone || '',
    address: existingQuote?.client_address || rawQuote?.clientAddress || rawQuote?.address || '',
    gstin: existingQuote?.client_gstin || rawQuote?.clientGstin || rawQuote?.gstin || '',
  });

  // Hydrate client details from clients collection if missing
  useEffect(() => {
    if (!existingQuote) return;
    const cid = rawQuote?.clientId;
    const cname = rawQuote?.clientName || existingQuote.client_company;
    (async () => {
      let matched: Client | null = null;
      if (cid) matched = await getItem<Client>('clients', cid).catch(() => null);
      if (!matched && cname) {
        const list = await getCollection<Client>('clients').catch(() => []);
        matched = list.find((c) => c.name?.toLowerCase() === cname.toLowerCase()) || null;
      }
      if (matched) {
        setClient((prev) => ({
          company: prev.company || matched?.name || '',
          contact_person: prev.contact_person || matched?.contactPerson || matched?.name || '',
          email: prev.email || matched?.email || '',
          phone: prev.phone || matched?.phone || '',
          address: prev.address || matched?.address || '',
          gstin: prev.gstin || matched?.gstin || '',
        }));
      }
    })();
  }, [existingQuote]);

  const [items, setItems] = useState<DocumentItem[]>(() => {
    if (existingQuote?.items && existingQuote.items.length > 0) {
      return existingQuote.items.map((item: any) => ({
        id: item.item_id || item.id || crypto.randomUUID(),
        product_id: item.product_id || undefined,
        name: item.name || item.description || '',
        description: item.name ? (item.description || '') : '',
        quantity: item.quantity || 1,
        unit: item.unit || 'pcs',
        unit_price: item.unit_price ?? item.unitPrice ?? 0,
        total: item.total ?? ((item.quantity || 1) * (item.unit_price ?? item.unitPrice ?? 0)),
      }));
    }
    return [createEmptyItem()];
  });

  const [discountPercent, setDiscountPercent] = useState(
    existingQuote?.discount_percent ?? (existingQuote as any)?.discount ?? 0
  );
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
        currency: settings.general.default_currency || 'INR',
      }));
      setNotes((prev) => ({
        ...prev,
        terms: settings.branding.default_terms || '',
      }));
    }
  }, [settings, existingQuote]);

  // Reserve the next atomic document number from Settings (new quotes only).
  useEffect(() => {
    if (existingQuote) return;
    backend.nextNumber(workspace?.id || 'default', 'quote')
      .then(({ number }: { number: string }) => setMeta((prev) => ({ ...prev, document_number: number })))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingQuote?.id, workspace?.id]);

  const handleSave = useCallback(
    async (status?: QuotationStatus) => {
      const clientDisplayName = client.company || client.contact_person;
      if (!clientDisplayName) {
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
        const titleCaseStatus =
          finalStatus === 'accepted' ? 'Accepted' :
          finalStatus === 'rejected' ? 'Rejected' :
          finalStatus === 'sent' ? 'Sent' : 'Draft';

        let docNumber = meta.document_number;
        if (!existingQuote && !docNumber) {
          docNumber = (await backend.nextNumber(workspace?.id || 'default', 'quote')).number;
        }

        const quotationData = {
          quotation_number: docNumber,
          number: docNumber,
          numberKey: docNumber.toLowerCase(),
          clientId: (existingQuote as any)?.clientId || clientDisplayName,
          clientName: clientDisplayName,
          clientKey: clientDisplayName.toLowerCase(),
          client_id: (existingQuote as any)?.clientId || clientDisplayName,
          client_name: client.contact_person,
          client_email: client.email,
          clientEmail: client.email,
          client_company: client.company,
          clientCompany: client.company,
          client_address: client.address,
          clientAddress: client.address,
          client_gstin: client.gstin,
          clientGstin: client.gstin,
          client_phone: client.phone,
          clientPhone: client.phone,
          project_title: '',
          amount: pricing.grand_total,
          subtotal: pricing.subtotal,
          tax: pricing.tax_amount,
          discount: pricing.discount_amount,
          total: pricing.grand_total,
          discount_percent: pricing.discount_percent,
          discount_amount: pricing.discount_amount,
          tax_amount: pricing.tax_amount,
          cgst_percent: pricing.cgst_percent,
          sgst_percent: pricing.sgst_percent,
          igst_percent: pricing.igst_percent,
          currency: meta.currency,
          issueDate: meta.issue_date || new Date().toISOString().slice(0, 10),
          validUntil: meta.valid_until ? meta.valid_until.slice(0, 10) : '',
          valid_until: meta.valid_until ? new Date(meta.valid_until).toISOString() : '',
          status: titleCaseStatus,
          description: '',
          notes: notes.notes,
          terms: notes.terms,
          internal_notes: notes.internal_notes,
          delivery_timeline: notes.delivery_timeline,
          workspace_id: workspace?.id || 'default',
          items: items.map((item) => ({
            item_id: item.id,
            product_id: item.product_id,
            name: item.name,
            description: item.name ? (item.description ? `${item.name} - ${item.description}` : item.name) : item.description || '',
            quantity: item.quantity,
            unit: item.unit || 'pcs',
            unitPrice: item.unit_price,
            unit_price: item.unit_price,
            total: item.total,
          })),
        };

        // Sync/upsert client to clients collection so details persist across CRM
        const clientCompany = client.company || client.contact_person;
        if (clientCompany) {
          try {
            const allClients = await getCollection<Client>('clients').catch(() => []);
            const matchedClient = allClients.find((c) =>
              (c.id && c.id === (existingQuote as any)?.clientId) ||
              (c.name && c.name.toLowerCase() === clientCompany.toLowerCase())
            );
            if (matchedClient) {
              await updateItem('clients', matchedClient.id, {
                contactPerson: client.contact_person || matchedClient.contactPerson || undefined,
                email: client.email || matchedClient.email || undefined,
                phone: client.phone || matchedClient.phone || undefined,
                address: client.address || matchedClient.address || undefined,
                gstin: client.gstin || matchedClient.gstin || undefined,
              });
            } else if (client.email || client.phone || client.address || client.gstin) {
              await createItem('clients', {
                name: clientCompany,
                nameKey: nameKeyOf(clientCompany),
                contactPerson: client.contact_person || clientCompany,
                email: client.email || undefined,
                phone: client.phone || undefined,
                address: client.address || undefined,
                gstin: client.gstin || undefined,
                category: 'Corporate',
              });
            }
          } catch (e) {
            console.warn('Could not sync client:', e);
          }
        }

        if (existingQuote) {
          await updateQuotation(existingQuote.id, quotationData);
          toast.success(finalStatus === 'draft' ? 'Quote updated' : 'Quote sent');
        } else {
          const newId = await createQuotation(quotationData);
          if (!newId) throw new Error('Failed to create quotation');
          toast.success(finalStatus === 'draft' ? 'Quote created' : 'Quote created and sent');
        }

        router.push('/quotes');
      } catch (err: any) {
        toast.error(err?.message || 'Something went wrong');
      } finally {
        setSaving(false);
        setSending(false);
      }
    },
    [meta, client, items, pricing, notes, existingQuote, router, workspace?.id]
  );

  const handleDownloadPdf = async () => {
    const id = toast.loading('Generating PDF…');
    try {
      const quotePayload = {
        number: meta.document_number,
        quotation_number: meta.document_number,
        client_name: client.contact_person || client.company || 'Client',
        clientName: client.contact_person || client.company || 'Client',
        client_company: client.company,
        clientCompany: client.company,
        client_address: client.address,
        clientAddress: client.address,
        client_email: client.email,
        clientEmail: client.email,
        client_phone: client.phone,
        clientPhone: client.phone,
        client_gstin: client.gstin,
        clientGstin: client.gstin,
        currency: meta.currency,
        amount: pricing.grand_total,
        total: pricing.grand_total,
        subtotal: pricing.subtotal,
        tax: pricing.tax_amount,
        tax_amount: pricing.tax_amount,
        discount: pricing.discount_amount,
        discount_amount: pricing.discount_amount,
        discount_percent: pricing.discount_percent,
        cgst_percent: pricing.cgst_percent,
        sgst_percent: pricing.sgst_percent,
        igst_percent: pricing.igst_percent,
        issue_date: meta.issue_date,
        valid_until: meta.valid_until,
        notes: notes.notes,
        terms: notes.terms,
        delivery_timeline: notes.delivery_timeline,
        items: items.map((item) => ({
          name: item.name,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit || 'pcs',
          unit_price: item.unit_price,
          unitPrice: item.unit_price,
          total: item.total,
        })),
      };
      const pdf = await generateQuotationPdf('', quotePayload, null);
      await savePdf(pdf, `Quotation-${meta.document_number || 'draft'}.pdf`);
      toast.success('Quote downloaded', { id });
    } catch {
      toast.error('Failed to generate PDF', { id });
    }
  };

  const handlePreviewPdf = async () => {
    const id = toast.loading('Generating preview…');
    try {
      const quotePayload = {
        number: meta.document_number,
        quotation_number: meta.document_number,
        client_name: client.contact_person || client.company || 'Client',
        clientName: client.contact_person || client.company || 'Client',
        client_company: client.company,
        clientCompany: client.company,
        client_address: client.address,
        clientAddress: client.address,
        client_email: client.email,
        clientEmail: client.email,
        client_phone: client.phone,
        clientPhone: client.phone,
        client_gstin: client.gstin,
        clientGstin: client.gstin,
        currency: meta.currency,
        amount: pricing.grand_total,
        total: pricing.grand_total,
        subtotal: pricing.subtotal,
        tax: pricing.tax_amount,
        tax_amount: pricing.tax_amount,
        discount: pricing.discount_amount,
        discount_amount: pricing.discount_amount,
        discount_percent: pricing.discount_percent,
        cgst_percent: pricing.cgst_percent,
        sgst_percent: pricing.sgst_percent,
        igst_percent: pricing.igst_percent,
        issue_date: meta.issue_date,
        valid_until: meta.valid_until,
        notes: notes.notes,
        terms: notes.terms,
        delivery_timeline: notes.delivery_timeline,
        items: items.map((item) => ({
          name: item.name,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit || 'pcs',
          unit_price: item.unit_price,
          unitPrice: item.unit_price,
          total: item.total,
        })),
      };
      const pdf = await generateQuotationPdf('', quotePayload, null);
      const url = await openPdfPreview(pdf);
      window.open(url, '_blank');
      toast.dismiss(id);
    } catch {
      toast.error('Failed to generate preview', { id });
    }
  };

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
          <Button variant="outline" size="sm" onClick={handlePreviewPdf}>
            <Eye className="h-4 w-4 mr-1.5" />
            Preview PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadPdf}>
            <Download className="h-4 w-4 mr-1.5" />
            Download PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleSave()} disabled={saving || sending}>
            <Save className="h-4 w-4 mr-1.5" />
            {saving ? 'Saving...' : 'Save'}
          </Button>
          <Button size="sm" onClick={() => handleSave('sent')} disabled={saving || sending}>
            <Send className="h-4 w-4 mr-1.5" />
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
