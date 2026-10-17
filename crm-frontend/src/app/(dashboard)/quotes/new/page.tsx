'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { QuoteForm } from '@/components/documents/quote-form';
import { getItem } from '@/lib/db';
import type { Quotation } from '@/lib/db/types';

function NewQuoteContent() {
  const searchParams = useSearchParams();
  const clientId = searchParams.get('clientId');
  const [initialQuote, setInitialQuote] = useState<Partial<Quotation> | null>(null);

  useEffect(() => {
    if (!clientId) return;
    getItem<any>('clients', clientId)
      .then((c) => {
        if (!c) return;
        setInitialQuote({
          client_id: c.id,
          client_company: c.company || c.name,
          client_name: c.name,
          client_email: c.email,
          client_address: c.address,
          client_gstin: c.gstin,
        } as any);
      })
      .catch(() => undefined);
  }, [clientId]);

  return <QuoteForm existingQuote={initialQuote as any} />;
}

export default function NewQuotePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading...</div>}>
      <NewQuoteContent />
    </Suspense>
  );
}
