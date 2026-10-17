'use client';

import { getCollection } from '@/lib/db';

export interface CreditNoteRecord {
  id: string;
  invoiceId?: string;
  number: string;
  status: string;
  total: number;
}

export const creditNotesService = {
  async list(_orgId: string): Promise<CreditNoteRecord[]> {
    try {
      const items = await getCollection<CreditNoteRecord>('credit_notes');
      return items;
    } catch {
      return [];
    }
  },
};
