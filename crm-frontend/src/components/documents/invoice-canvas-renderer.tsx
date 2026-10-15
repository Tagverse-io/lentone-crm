// @ts-nocheck
'use client';

import React, { useEffect, useState, useTransition } from 'react';
import type { DocumentClient, DocumentMeta, DocumentPricing, DocumentNotes, DocumentPayment } from './types';
import { generateQuotationPdf, generateInvoicePdf } from '@/lib/pdf-engine/generator';

export interface CanvasRendererProps {
  docType: 'quotation' | 'invoice' | 'quote';
  meta: DocumentMeta;
  client: DocumentClient;
  items: {
    name: string;
    description?: string;
    quantity: number;
    unit_price: number;
    total: number;
  }[];
  pricing: DocumentPricing;
  notes?: DocumentNotes | string;
  terms?: string;
  primaryColor?: string; // Kept for compatibility, though jsPDF doesn't strictly use it yet
  scale?: number;
  companyName?: string;
  companyTagline?: string;
  payment?: DocumentPayment;
}

export function InvoiceCanvasRenderer({
  docType,
  meta,
  client,
  items,
  pricing,
  notes,
}: CanvasRendererProps) {
  const [pdfDataUri, setPdfDataUri] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;

    async function updatePreview() {
      try {
        const _notes = typeof notes === 'object' ? notes?.notes : notes;
        let doc;

        if (docType === 'quote' || docType === 'quotation') {
          // Map to Quotation shape expected by generator
          const fakeQuote = {
            id: 'preview',
            quotation_number: meta.document_number,
            client_id: 'preview',
            client_name: client.contact_person || client.company || 'Client Name',
            client_company: client.company,
            client_address: client.address,
            client_email: client.email,
            amount: pricing.grand_total,
            subtotal: pricing.subtotal,
            discount_percent: pricing.discount_percent,
            discount_amount: pricing.discount_amount,
            tax_amount: pricing.tax_amount,
            cgst_percent: pricing.cgst_percent,
            sgst_percent: pricing.sgst_percent,
            igst_percent: pricing.igst_percent,
            status: meta.status as any,
            items: items.map(i => ({
              description: i.name + (i.description ? `\n${i.description}` : ''),
              quantity: i.quantity,
              unit_price: i.unit_price,
              total: i.total,
            })),
            created_at: meta.issue_date || new Date().toISOString(),
            valid_until: meta.valid_until,
            notes: _notes,
          } as any;
          
          doc = await generateQuotationPdf(fakeQuote, null);
        } else {
          // Map to Invoice shape expected by generator
          const fakeInvoice = {
            id: 'preview',
            invoice_number: meta.document_number,
            client_id: 'preview',
            amount: pricing.grand_total,
            subtotal: pricing.subtotal,
            tax_amount: pricing.tax_amount,
            discount_percent: pricing.discount_percent,
            discount_amount: pricing.discount_amount,
            cgst_percent: pricing.cgst_percent,
            sgst_percent: pricing.sgst_percent,
            igst_percent: pricing.igst_percent,
            status: meta.status as any,
            items: items.map(i => ({
              description: i.name + (i.description ? `\n${i.description}` : ''),
              quantity: i.quantity,
              unit_price: i.unit_price,
              total: i.total,
            })),
            created_at: meta.issue_date || new Date().toISOString(),
            issue_date: meta.issue_date || new Date().toISOString(),
            due_date: meta.due_date,
            notes: _notes,
          } as any;

          const fakeClient = {
            full_name: client.contact_person || client.company || 'Client Name',
            email: client.email,
          } as any;

          doc = await generateInvoicePdf(fakeInvoice, fakeClient, null);
        }

        if (!active) return;

        // Generate data URI without saving
        const dataUri = doc.output('datauristring');
        setPdfDataUri(dataUri);
      } catch (err) {
        console.error('Failed to generate preview', err);
      }
    }

    startTransition(() => {
      updatePreview();
    });

    return () => {
      active = false;
    };
  }, [docType, meta, client, items, pricing, notes]);

  return (
    <div className="flex flex-col h-full bg-slate-200 dark:bg-slate-800 p-4 rounded-lg items-center relative min-h-[600px]">
      {isPending && (
        <div className="absolute top-4 right-4 bg-primary text-white text-xs px-2 py-1 rounded shadow animate-pulse z-10">
          Updating...
        </div>
      )}
      
      {pdfDataUri ? (
        <iframe
          src={`${pdfDataUri}#toolbar=0&navpanes=0&scrollbar=0`}
          className="w-full h-full aspect-[1/1.414] bg-white rounded shadow-xl border-none max-w-full"
          style={{ maxHeight: '1000px', minHeight: '800px' }}
        />
      ) : (
        <div className="w-full h-full aspect-[1/1.414] bg-white rounded shadow-xl animate-pulse flex items-center justify-center">
          <span className="text-muted-foreground text-sm font-medium">Generating preview...</span>
        </div>
      )}
    </div>
  );
}

export default InvoiceCanvasRenderer;
