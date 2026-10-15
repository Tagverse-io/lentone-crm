'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus, GripVertical } from 'lucide-react';
import type { DocumentItem } from './types';
import { calculateItemTotal, formatDocumentCurrency } from './types';

interface ItemsTableProps {
  items: DocumentItem[];
  onItemsChange: (items: DocumentItem[]) => void;
  currency: string;
}

const UNIT_OPTIONS = [
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
  { value: 'lot', label: 'Lot' },
  { value: 'flat', label: 'Flat Rate' },
  { value: 'project', label: 'Per Project' },
];

export function ItemsTable({ items, onItemsChange, currency }: ItemsTableProps) {
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
                    {UNIT_OPTIONS.map((u) => (
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
                  {formatDocumentCurrency(item.total, currency)}
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
