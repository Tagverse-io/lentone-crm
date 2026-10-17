'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { InvoiceForm } from '@/components/documents/invoice-form';
import { getInvoice } from '@/lib/firebase/database';
import type { Invoice } from '@/lib/db/types';
import { toast } from 'sonner';

export default function EditInvoicePage() {
  const params = useParams();
  const id = params.id as string;
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await getInvoice(id);
        setInvoice(data);
      } catch {
        toast.error('Failed to load invoice');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading invoice...</p>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Invoice not found</p>
      </div>
    );
  }

  return <InvoiceForm existingInvoice={invoice} />;
}
