'use client';

import { nextSequence, getSettings } from '@/lib/db';

export const backend = {
  nextNumber: async (orgId: string, kind: 'invoice' | 'quote' | 'creditNote'): Promise<{ number: string }> => {
    try {
      const settings = await getSettings();
      let prefix = 'DOC';
      let seqKey = 'doc';
      if (kind === 'invoice') {
        prefix = settings.invoicePrefix || 'INV';
        seqKey = 'invoices';
      } else if (kind === 'quote') {
        prefix = settings.quotationPrefix || 'Q';
        seqKey = 'quotations';
      } else if (kind === 'creditNote') {
        prefix = 'CN';
        seqKey = 'credit_notes';
      }
      const seq = await nextSequence(seqKey);
      const numStr = String(seq).padStart(4, '0');
      return { number: `${prefix}-${numStr}` };
    } catch {
      const rand = Math.floor(1000 + Math.random() * 9000);
      return { number: `${kind.toUpperCase()}-${rand}` };
    }
  },
  quotationAccepted: async (_orgId: string, _quotationId: string) => {
    return { invoiceId: '', projectId: null };
  },
  sendNotification: async (_input: any) => {
    return { ok: true };
  },
};
