'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus } from 'lucide-react';
import type { OrderLineItem, Product } from '@/lib/db';
import { fmtMoney } from '@/lib/db';

interface LineItemsEditorProps {
  items: OrderLineItem[];
  onChange: (items: OrderLineItem[]) => void;
  products: Product[];
  currency?: string;
  showStock?: boolean;
}

/** Pick inventory products with quantities; price auto-fills from the product. */
export function LineItemsEditor({ items, onChange, products, currency = '₹', showStock = true }: LineItemsEditorProps) {
  const setItem = (idx: number, patch: Partial<OrderLineItem>) => {
    onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const pickProduct = (idx: number, productId: string) => {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    setItem(idx, { productId: p.id, description: p.name, unitPrice: p.price });
  };

  return (
    <div className="grid gap-2">
      <Label>Line items (from inventory)</Label>
      {items.map((it, idx) => {
        const p = products.find((x) => x.id === it.productId);
        return (
          <div key={idx} className="grid grid-cols-[1fr_64px_96px_32px] gap-2 items-center">
            <Select value={it.productId || 'custom'} onValueChange={(v) => (v === 'custom' ? setItem(idx, { productId: undefined }) : pickProduct(idx, v))}>
              <SelectTrigger>
                <SelectValue placeholder="Select product" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">Custom item…</SelectItem>
                {products.map((prod) => (
                  <SelectItem key={prod.id} value={prod.id}>
                    {prod.name} · {fmtMoney(prod.price, currency)}
                    {showStock ? ` · stock ${prod.stock}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              min={1}
              placeholder="Qty"
              value={it.quantity}
              max={p && showStock ? p.stock : undefined}
              onChange={(e) => setItem(idx, { quantity: Number(e.target.value) })}
            />
            <Input
              type="number"
              min={0}
              placeholder="Unit ₹"
              value={it.unitPrice}
              onChange={(e) => setItem(idx, { unitPrice: Number(e.target.value) })}
            />
            <Button variant="ghost" size="icon" onClick={() => onChange(items.filter((_, i) => i !== idx))} aria-label="Remove line">
              <Trash2 size={16} />
            </Button>
            {!it.productId && (
              <Input
                className="col-span-4"
                placeholder="Custom item description"
                value={it.description}
                onChange={(e) => setItem(idx, { description: e.target.value })}
              />
            )}
            {p && showStock && (Number(it.quantity) || 0) > p.stock && (
              <p className="col-span-4 text-xs text-destructive">
                Only {p.stock} in stock — save will be blocked.
              </p>
            )}
          </div>
        );
      })}
      <Button
        variant="outline"
        size="sm"
        className="w-fit"
        onClick={() => onChange([...items, { description: '', quantity: 1, unitPrice: 0 }])}
      >
        <Plus size={14} className="mr-1" /> Add line
      </Button>
    </div>
  );
}
