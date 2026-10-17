'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus, GripVertical } from 'lucide-react';
import type { DocumentItem } from './types';
import { calculateItemTotal, formatDocumentCurrency } from './types';
import { useWorkspace } from '@/lib/settings/workspace-context';
import { useFmt } from '@/lib/format';
import { getCollection } from '@/lib/db';
import type { Product } from '@/lib/db';

interface ItemsTableProps {
  items: DocumentItem[];
  onItemsChange: (items: DocumentItem[]) => void;
  currency: string;
  units?: string[];
}

const FALLBACK_UNITS = [
  { value: 'pcs', label: 'Pieces' },
  { value: 'hrs', label: 'Hours' },
  { value: 'days', label: 'Days' },
  { value: 'mths', label: 'Months' },
  { value: 'sqft', label: 'Sq Ft' },
  { value: 'kg', label: 'Kilograms' },
  { value: 'tons', label: 'Tons' },
  { value: 'sets', label: 'Sets' },
  { value: 'boxes', label: 'Boxes' },
  { value: 'lot', label: 'Lot' },
  { value: 'flat', label: 'Flat Rate' },
  { value: 'project', label: 'Per Project' },
];

export function ItemsTable({ items, onItemsChange, currency, units }: ItemsTableProps) {
  const { settings } = useWorkspace();
  const unitOptions = units ?? settings?.general?.units ?? FALLBACK_UNITS.map((u) => u.value);
  const fmt = useFmt();
  const options = unitOptions.map((u) => ({ value: u, label: u }));

  // Inventory products for the "pick from inventory" select.
  const [products, setProducts] = useState<Product[]>([]);
  useEffect(() => {
    let alive = true;
    getCollection<Product>('products')
      .then((list) => { if (alive) setProducts(list); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, []);

  const addItem = () => {
    onItemsChange([
      ...items,
      {
        id: crypto.randomUUID(),
        name: '',
        description: '',
        quantity: 1,
        unit: 'pcs',
        unit_price: 0,
        total: 0,
      },
    ]);
  };

  /** Fill the row from an inventory product; "custom" clears the link (manual entry). */
  const pickProduct = (id: string, productId: string) => {
    if (productId === 'custom') {
      onItemsChange(
        items.map((item) =>
          item.id === id ? { ...item, product_id: undefined, name: '', unit_price: 0 } : item
        )
      );
      return;
    }
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    onItemsChange(
      items.map((item) => {
        if (item.id !== id) return item;
        const updated: DocumentItem = {
          ...item,
          product_id: p.id,
          name: p.name,
          unit_price: p.price,
          unit: unitOptions.includes(p.unit) ? p.unit : item.unit,
        };
        updated.total = calculateItemTotal(updated);
        return updated;
      })
    );
  };

  const removeItem = (id: string) => {
    if (items.length === 1) return;
    onItemsChange(items.filter((i) => i.id !== id));
  };

  const updateItem = (id: string, field: keyof DocumentItem, value: string | number) => {
    onItemsChange(
      items.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        if (field === 'quantity' || field === 'unit_price') {
          updated.total = calculateItemTotal(updated);
        }
        return updated;
      })
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Line Items</h2>
          <p className="text-sm text-muted-foreground">Add items, services, or tasks with pricing.</p>
        </div>
        <Button variant="outline" size="sm" onClick={addItem} type="button">
          <Plus className="h-4 w-4 mr-1" /> Add Item
        </Button>
      </div>

      <div className="space-y-3">
        {items.map((item, index) => (
          <div
            key={item.id}
            className="flex items-start gap-2 p-3 border rounded-lg bg-card"
          >
            <div className="flex items-center pt-2 text-muted-foreground">
              <GripVertical className="h-4 w-4" />
              <span className="ml-1 text-xs font-medium">{index + 1}</span>
            </div>

            <div className="flex-1 grid grid-cols-12 gap-2">
              <div className="col-span-6 space-y-1">
                {index === 0 && <Label className="text-xs">Product (from inventory)</Label>}
                <Select
                  value={item.product_id ?? 'custom'}
                  onValueChange={(v) => pickProduct(item.id, v)}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Pick product or enter manually below" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">Custom item (manual)…</SelectItem>
                    {products.map((prod) => (
                      <SelectItem key={prod.id} value={prod.id}>
                        {prod.name} · {formatDocumentCurrency(prod.price, currency, fmt.fs)}
                        {typeof prod.stock === 'number' ? ` · stock ${prod.stock}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-6" />
              <div className="col-span-3 space-y-1">
                {index === 0 && <Label className="text-xs">Name *</Label>}
                <Input
                  value={item.name}
                  onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                  placeholder="Item name"
                  className="h-8 text-sm"
                />
              </div>
              <div className="col-span-3 space-y-1">
                {index === 0 && <Label className="text-xs">Description</Label>}
                <Input
                  value={item.description}
                  onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                  placeholder="Brief description"
                  className="h-8 text-sm"
                />
              </div>
              <div className="col-span-1 space-y-1">
                {index === 0 && <Label className="text-xs">Qty</Label>}
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  value={item.quantity}
                  onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="col-span-2 space-y-1">
                {index === 0 && <Label className="text-xs">Unit</Label>}
                <Select value={item.unit} onValueChange={(v) => updateItem(item.id, 'unit', v)}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((u) => (
                      <SelectItem key={u.value} value={u.value}>
                        {u.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1">
                {index === 0 && <Label className="text-xs">Unit Price</Label>}
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.unit_price}
                  onChange={(e) => updateItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="col-span-1 space-y-1">
                {index === 0 && <Label className="text-xs">Total</Label>}
                <div className="h-8 flex items-center text-sm font-medium">
                  {formatDocumentCurrency(item.total, currency, fmt.fs)}
                </div>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeItem(item.id)}
              disabled={items.length === 1}
              className="mt-1 h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
              type="button"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
