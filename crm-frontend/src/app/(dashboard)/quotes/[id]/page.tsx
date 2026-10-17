'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { QuoteForm } from '@/components/documents/quote-form';
import { getQuotation } from '@/lib/firebase/database';
import type { Quotation } from '@/lib/db/types';
import { toast } from 'sonner';

export default function EditQuotePage() {
  const params = useParams();
  const id = params.id as string;
  const [quote, setQuote] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await getQuotation(id);
        setQuote(data);
      } catch {
        toast.error('Failed to load quote');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading quote...</p>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Quote not found</p>
      </div>
    );
  }

  return <QuoteForm existingQuote={quote} />;
}
