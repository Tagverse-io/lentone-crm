'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { InvoiceForm } from '@/components/documents/invoice-form';
import { getQuotation } from '@/lib/firebase/database';
import type { Invoice } from '@/lib/db/types';

function NewInvoiceContent() {
  const searchParams = useSearchParams();
  const quoteId = searchParams.get('quotationId') || searchParams.get('quoteId');
  const [initialInvoice, setInitialInvoice] = useState<Partial<Invoice> | null>(null);
  const [loading, setLoading] = useState(!!quoteId);

  useEffect(() => {
    if (!quoteId) return;
    getQuotation(quoteId)
      .then((q: any) => {
        if (!q) return;
        setInitialInvoice({
          quotationId: q.id,
          client_id: q.clientId || q.client_id,
          client_company: q.clientCompany || q.client_company || q.clientName,
          client_name: q.clientName || q.client_name,
          client_email: q.clientEmail || q.client_email,
          client_address: q.clientAddress || q.client_address,
          client_gstin: q.clientGstin || q.client_gstin,
          currency: q.currency,
          subtotal: q.subtotal,
          tax: q.tax,
          discount: q.discount,
          total: q.total,
          amount: q.total,
          items: q.items,
          notes: q.notes,
        } as any);
      })
      .finally(() => setLoading(false));
  }, [quoteId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Loading quotation details...
      </div>
    );
  }

  return <InvoiceForm existingInvoice={initialInvoice as any} />;
}

export default function NewInvoicePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading...</div>}>
      <NewInvoiceContent />
    </Suspense>
  );
}
