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
import { PaymentSection } from './payment-section';
import { NotesSection } from './notes-section';
import { useWorkspace } from '@/lib/settings/workspace-context';
import { useAuth } from '@/lib/firebase/auth-context';
import { createInvoice, updateInvoice } from '@/lib/firebase/database';
import type { Invoice, InvoiceStatus } from '@/lib/db/types';
import type {
  DocumentMeta,
  DocumentClient,
  DocumentItem,
  DocumentPricing,
  DocumentPayment,
  DocumentNotes,
} from './types';
import { createEmptyItem, calculatePricing } from './types';

interface InvoiceFormProps {
  existingInvoice?: Invoice | null;
}

export function InvoiceForm({ existingInvoice }: InvoiceFormProps) {
  const router = useRouter();
  const { settings } = useWorkspace();
  const { workspace, user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  const [meta, setMeta] = useState<DocumentMeta>({
    document_number: existingInvoice?.invoice_number || `INV-${Date.now().toString().slice(-6)}`,
    status: existingInvoice?.status || 'draft',
    issue_date: existingInvoice?.issue_date
      ? new Date(existingInvoice.issue_date).toISOString().split('T')[0]
      : existingInvoice?.created_at
      ? new Date(existingInvoice.created_at).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0],
    due_date: existingInvoice?.due_date || '',
    currency: existingInvoice?.currency || settings.general.default_currency || 'INR',
  });

  const [client, setClient] = useState<DocumentClient>({
    company: existingInvoice?.client_company || '',
    contact_person: existingInvoice?.client_name || '',
    email: existingInvoice?.client_email || '',
    phone: (existingInvoice as any)?.client_phone || (existingInvoice as any)?.phone || '',
    address: existingInvoice?.client_address || '',
    gstin: existingInvoice?.client_gstin || '',
  });

  const [items, setItems] = useState<DocumentItem[]>(() => {
    if (existingInvoice?.items && existingInvoice.items.length > 0) {
      return existingInvoice.items.map((item) => ({
        id: item.item_id || crypto.randomUUID(),
        name: item.name || '',
        description: item.description || '',
        quantity: item.quantity || 1,
        unit: 'flat',
        unit_price: item.unit_price || 0,
        total: item.total || 0,
      }));
    }
    return [createEmptyItem()];
  });

  const [discountPercent, setDiscountPercent] = useState(existingInvoice?.discount_percent || 0);
  const [taxCgst, setTaxCgst] = useState(existingInvoice?.cgst_percent ?? settings.branding.tax_cgst ?? 0);
  const [taxSgst, setTaxSgst] = useState(existingInvoice?.sgst_percent ?? settings.branding.tax_sgst ?? 0);
  const [taxIgst, setTaxIgst] = useState(existingInvoice?.igst_percent ?? settings.branding.tax_igst ?? 0);

  const [payment, setPayment] = useState<DocumentPayment>({
    amount_paid: existingInvoice?.amount_paid ?? (existingInvoice?.paid_at ? existingInvoice.amount : 0),
    balance_due: existingInvoice?.amount_due ?? 0,
    payment_date: existingInvoice?.paid_date || (existingInvoice?.paid_at
      ? new Date(existingInvoice.paid_at).toISOString().split('T')[0]
      : ''),
    transaction_id: existingInvoice?.transaction_id || '',
    payment_terms: existingInvoice?.payment_terms || 'net_30',
    payment_method: existingInvoice?.payment_method || 'bank_transfer',
    custom_bank_name: existingInvoice?.custom_bank_name || '',
    custom_bank_account: existingInvoice?.custom_bank_account || '',
    custom_bank_ifsc: existingInvoice?.custom_bank_ifsc || '',
    custom_upi_id: existingInvoice?.custom_upi_id || '',
  });

  const [notes, setNotes] = useState<DocumentNotes>({
    notes: existingInvoice?.notes || '',
    terms: existingInvoice?.terms ?? settings.branding.default_terms ?? '',
    internal_notes: existingInvoice?.internal_notes || '',
    delivery_timeline: existingInvoice?.delivery_timeline || '',
  });

  // Calculate pricing
  const pricing = calculatePricing(
    items,
    discountPercent,
    taxCgst,
    taxSgst,
    taxIgst
  );

  // Update payment balance (clamped at zero so overpayment never goes negative)
  useEffect(() => {
    setPayment((prev) => ({
      ...prev,
      balance_due: Math.max(0, Math.round((pricing.grand_total - prev.amount_paid) * 100) / 100),
    }));
  }, [pricing.grand_total, payment.amount_paid]);

  const handleSave = useCallback(
    async (status: InvoiceStatus = 'pending') => {
      if (!client.company && !client.contact_person) {
        toast.error('Client name or company is required');
        return;
      }

      if (status === 'pending') {
        setSaving(true);
      } else {
        setSending(true);
      }

      try {
        let finalStatus = status;
        if (payment.amount_paid > 0) {
          if (payment.amount_paid >= pricing.grand_total) {
            finalStatus = 'paid';
          } else {
            finalStatus = 'partially_paid';
          }
        }

        const invoiceData = {
          invoice_number: meta.document_number,
          project_id: '',
          client_id: '',
          client_name: client.contact_person,
          client_email: client.email,
          client_company: client.company,
          client_address: client.address,
          client_gstin: client.gstin,
          client_phone: client.phone,
          currency: meta.currency || 'INR',
          amount: pricing.grand_total,
          subtotal: pricing.subtotal,
          discount_percent: pricing.discount_percent,
          discount_amount: pricing.discount_amount,
          tax_amount: pricing.tax_amount,
          cgst_percent: pricing.cgst_percent,
          sgst_percent: pricing.sgst_percent,
          igst_percent: pricing.igst_percent,
          due_date: meta.due_date || '',
          status: finalStatus,
          description: items[0]?.name || '',
          notes: notes.notes,
          terms: notes.terms,
          internal_notes: notes.internal_notes,
          delivery_timeline: notes.delivery_timeline,
          payment_terms: payment.payment_terms,
          payment_method: payment.payment_method,
          amount_paid: payment.amount_paid,
          paid_date: payment.payment_date || '',
          transaction_id: payment.transaction_id || '',
          custom_bank_name: payment.custom_bank_name || '',
          custom_bank_account: payment.custom_bank_account || '',
          custom_bank_ifsc: payment.custom_bank_ifsc || '',
          custom_upi_id: payment.custom_upi_id || '',
          workspace_id: workspace?.id || '',
          items: items.map((item) => ({
            item_id: item.id,
            name: item.name,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total: item.total,
            tax_rate: 0,
          })),
        };

        if (existingInvoice) {
          await updateInvoice(existingInvoice.id, invoiceData);
          toast.success(status === 'pending' ? 'Invoice updated' : 'Invoice sent');
        } else {
          await createInvoice(invoiceData);
          toast.success(status === 'pending' ? 'Invoice created' : 'Invoice created and sent');
        }

        router.push('/invoices');
      } catch {
        toast.error('Something went wrong');
      } finally {
        setSaving(false);
        setSending(false);
      }
    },
    [meta, client, items, pricing, notes, existingInvoice, router]
  );

  return (
    <div className="space-y-4">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push('/invoices')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">{existingInvoice ? 'Edit Invoice' : 'New Invoice'}</h1>
            <p className="text-sm text-muted-foreground">
              {existingInvoice ? 'Update the invoice details' : 'Create a new invoice for your client'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => handleSave('pending')} disabled={saving || sending}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Draft'}
          </Button>
          <Button onClick={() => handleSave('pending')} disabled={saving || sending}>
            <Send className="h-4 w-4 mr-2" />
            {sending ? 'Sending...' : 'Send Invoice'}
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto w-full mt-8 pb-24 space-y-8">
        <DocumentHeader
          meta={meta}
          onMetaChange={(m) => setMeta((prev) => ({ ...prev, ...m }))}
          docType="invoice"
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
        <PaymentSection
          payment={payment}
          onPaymentChange={(p) => setPayment((prev) => ({ ...prev, ...p }))}
          grandTotal={pricing.grand_total}
          currency={meta.currency}
        />
        <NotesSection notes={notes} onNotesChange={(n) => setNotes((prev) => ({ ...prev, ...n }))} docType="invoice" />
      </div>
    </div>
  );
}
