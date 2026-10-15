'use client';

import { useWorkspace } from '@/lib/settings/workspace-context';
import type { DocumentClient, DocumentItem, DocumentPricing, DocumentMeta, DocumentNotes, DocumentPayment, DocumentTemplate } from './types';
import { formatDocumentCurrency, formatDateForDocument } from './types';

interface LivePreviewProps {
  docType: 'quote' | 'invoice';
  template: DocumentTemplate;
  meta: DocumentMeta;
  client: DocumentClient;
  items: DocumentItem[];
  pricing: DocumentPricing;
  notes: DocumentNotes;
  payment?: DocumentPayment;
}

const TEMPLATE_GRADIENTS: Record<DocumentTemplate, string> = {
  modern: 'from-blue-600 to-blue-800',
  corporate: 'from-gray-700 to-gray-900',
  minimal: 'from-gray-400 to-gray-500',
  creative: 'from-purple-600 via-pink-500 to-orange-400',
};

const TEMPLATE_ACCENTS: Record<DocumentTemplate, string> = {
  modern: 'bg-blue-50 border-blue-100',
  corporate: 'bg-gray-50 border-gray-200',
  minimal: 'bg-white border-gray-100',
  creative: 'bg-purple-50 border-purple-100',
};

export function LivePreview({
  docType,
  template,
  meta,
  client,
  items,
  pricing,
  notes,
  payment,
}: LivePreviewProps) {
  const { settings } = useWorkspace();
  const branding = settings.branding;

  const gradient = TEMPLATE_GRADIENTS[template];
  const accent = TEMPLATE_ACCENTS[template];

  return (
    <div className="bg-white border rounded-lg shadow-sm overflow-hidden text-xs">
      {/* Header */}
      <div className={`bg-gradient-to-r ${gradient} text-white p-6`}>
        <div className="flex justify-between items-start">
          <div>
            {branding.logo_url ? (
              <img src={branding.logo_url} alt={settings.general.company_name} className="h-8 mb-2 object-contain" />
            ) : (
              <div className="text-lg font-bold mb-1">{settings.general.company_name}</div>
            )}
            <div className="text-white/80 text-[10px] space-y-0.5">
              {branding.address && <div>{branding.address.split('\n')[0]}</div>}
              {branding.phone && <div>{branding.phone}</div>}
              {branding.email && <div>{branding.email}</div>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold uppercase tracking-wider">
              {docType === 'quote' ? 'Quotation' : 'Invoice'}
            </div>
            <div className="mt-2 space-y-0.5 text-white/80">
              <div><span className="font-medium text-white">No:</span> {meta.document_number}</div>
              <div><span className="font-medium text-white">Date:</span> {formatDateForDocument(meta.issue_date)}</div>
              {docType === 'quote' && meta.valid_until && (
                <div><span className="font-medium text-white">Valid Until:</span> {formatDateForDocument(meta.valid_until)}</div>
              )}
              {docType === 'invoice' && meta.due_date && (
                <div><span className="font-medium text-white">Due Date:</span> {formatDateForDocument(meta.due_date)}</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bill To */}
      <div className={`p-4 ${accent} border-b`}>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Bill To</div>
        <div className="font-semibold text-sm">{client.company || 'Client Company'}</div>
        <div className="text-muted-foreground space-y-0.5">
          {client.contact_person && <div>{client.contact_person}</div>}
          {client.email && <div>{client.email}</div>}
          {client.phone && <div>{client.phone}</div>}
          {client.address && <div className="whitespace-pre-line">{client.address}</div>}
          {client.gstin && <div className="font-mono">GSTIN: {client.gstin}</div>}
        </div>
      </div>

      {/* Items Table */}
      <div className="p-4">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b">
              <th className="text-left py-1 font-semibold">#</th>
              <th className="text-left py-1 font-semibold">Item</th>
              <th className="text-center py-1 font-semibold">Qty</th>
              <th className="text-right py-1 font-semibold">Rate</th>
              <th className="text-right py-1 font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={item.id} className="border-b border-dashed">
                <td className="py-1.5 text-muted-foreground">{idx + 1}</td>
                <td className="py-1.5">
                  <div className="font-medium">{item.name || 'Item'}</div>
                  {item.description && <div className="text-[10px] text-muted-foreground">{item.description}</div>}
                </td>
                <td className="py-1.5 text-center">{item.quantity} {item.unit}</td>
                <td className="py-1.5 text-right">{formatDocumentCurrency(item.unit_price, meta.currency)}</td>
                <td className="py-1.5 text-right font-medium">{formatDocumentCurrency(item.total, meta.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pricing Summary */}
      <div className="px-4 pb-4">
        <div className="flex justify-end">
          <div className="w-48 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatDocumentCurrency(pricing.subtotal, meta.currency)}</span>
            </div>
            {pricing.discount_amount > 0 && (
              <div className="flex justify-between text-xs text-green-600">
                <span>Discount ({pricing.discount_percent}%)</span>
                <span>-{formatDocumentCurrency(pricing.discount_amount, meta.currency)}</span>
              </div>
            )}
            {pricing.tax_amount > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Tax</span>
                <span>{formatDocumentCurrency(pricing.tax_amount, meta.currency)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-bold border-t pt-1">
              <span>Grand Total</span>
              <span>{formatDocumentCurrency(pricing.grand_total, meta.currency)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Payment (Invoice only) */}
      {docType === 'invoice' && payment && payment.amount_paid > 0 && (
        <div className="px-4 pb-4">
          <div className={`p-3 rounded ${accent} border`}>
            <div className="font-semibold text-xs mb-1">Payment Summary</div>
            <div className="space-y-0.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount Paid</span>
                <span className="text-green-600 font-medium">{formatDocumentCurrency(payment.amount_paid, meta.currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Balance Due</span>
                <span className={`font-semibold ${pricing.grand_total - payment.amount_paid > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatDocumentCurrency(Math.max(0, Math.round((pricing.grand_total - payment.amount_paid) * 100) / 100), meta.currency)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notes */}
      {notes.notes && (
        <div className="px-4 pb-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Notes</div>
          <div className="text-xs text-muted-foreground whitespace-pre-line">{notes.notes}</div>
        </div>
      )}

      {/* Terms */}
      {notes.terms && (
        <div className="px-4 pb-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Terms & Conditions</div>
          <div className="text-[10px] text-muted-foreground whitespace-pre-line">{notes.terms}</div>
        </div>
      )}

      {/* Footer */}
      <div className="bg-gray-50 border-t px-6 py-3 text-center text-[10px] text-muted-foreground">
        {branding.footer_text || `${settings.general.company_name} | ${branding.phone || ''} | ${branding.email || ''}`}
      </div>
    </div>
  );
}
