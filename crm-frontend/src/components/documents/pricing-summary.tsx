'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { DocumentPricing } from './types';
import { formatDocumentCurrency } from './types';

interface PricingSummaryProps {
  pricing: DocumentPricing;
  onPricingChange: (pricing: Partial<DocumentPricing>) => void;
  currency: string;
}

export function PricingSummary({ pricing, onPricingChange, currency }: PricingSummaryProps) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Pricing & Tax</h2>
        <p className="text-sm text-muted-foreground">Configure discounts and tax rates.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Discount (%)</Label>
          <Input
            type="number"
            min="0"
            max="100"
            step="0.5"
            value={pricing.discount_percent === 0 ? '' : pricing.discount_percent}
            onChange={(e) => {
              let val = e.target.value === '' ? 0 : parseFloat(e.target.value);
              val = isNaN(val) ? 0 : val;
              val = Math.min(100, Math.max(0, val));
              onPricingChange({ discount_percent: val });
            }}
          />
        </div>
        <div className="space-y-2">
          <Label>Discount Amount</Label>
          <div className="h-10 flex items-center text-sm font-medium border rounded-md px-3 bg-muted">
            {formatDocumentCurrency(pricing.discount_amount, currency)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>CGST (%)</Label>
          <Input
            type="number"
            min="0"
            max="50"
            step="0.5"
            value={pricing.cgst_percent === 0 ? '' : pricing.cgst_percent}
            onChange={(e) => {
              let val = e.target.value === '' ? 0 : parseFloat(e.target.value);
              val = isNaN(val) ? 0 : val;
              onPricingChange({ cgst_percent: Math.max(0, val) });
            }}
          />
        </div>
        <div className="space-y-2">
          <Label>SGST (%)</Label>
          <Input
            type="number"
            min="0"
            max="50"
            step="0.5"
            value={pricing.sgst_percent === 0 ? '' : pricing.sgst_percent}
            onChange={(e) => {
              let val = e.target.value === '' ? 0 : parseFloat(e.target.value);
              val = isNaN(val) ? 0 : val;
              onPricingChange({ sgst_percent: Math.max(0, val) });
            }}
          />
        </div>
        <div className="space-y-2">
          <Label>IGST (%)</Label>
          <Input
            type="number"
            min="0"
            max="50"
            step="0.5"
            value={pricing.igst_percent === 0 ? '' : pricing.igst_percent}
            onChange={(e) => {
              let val = e.target.value === '' ? 0 : parseFloat(e.target.value);
              val = isNaN(val) ? 0 : val;
              onPricingChange({ igst_percent: Math.max(0, val) });
            }}
          />
        </div>
      </div>

      <div className="border-t pt-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-medium">{formatDocumentCurrency(pricing.subtotal, currency)}</span>
        </div>
        {pricing.discount_amount > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Discount ({pricing.discount_percent}%)</span>
            <span className="text-green-600">-{formatDocumentCurrency(pricing.discount_amount, currency)}</span>
          </div>
        )}
        {pricing.tax_amount > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tax</span>
            <span className="font-medium">{formatDocumentCurrency(pricing.tax_amount, currency)}</span>
          </div>
        )}
        <div className="flex justify-between text-base font-semibold border-t pt-2">
          <span>Grand Total</span>
          <span>{formatDocumentCurrency(pricing.grand_total, currency)}</span>
        </div>
      </div>
    </div>
  );
}
