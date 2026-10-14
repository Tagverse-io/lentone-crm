"use client";

import type { LineItem } from "@/lib/types";
import { Button } from "./button";
import { Input } from "./input";

export function LineItemsEditor({ items, onChange }: { items: LineItem[]; onChange: (items: LineItem[]) => void }): JSX.Element {
  const set = (i: number, patch: Partial<LineItem>): void => {
    onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  };
  return (
    <div className="grid gap-2">
      {items.map((it, i) => (
        <div key={i} className="grid grid-cols-[1fr_80px_100px_40px] items-center gap-2">
          <Input aria-label={`Item ${i + 1} description`} placeholder="Description" value={it.description} onChange={(e) => set(i, { description: e.target.value })} />
          <Input aria-label={`Item ${i + 1} quantity`} type="number" min={1} value={it.quantity} onChange={(e) => set(i, { quantity: Number(e.target.value) })} />
          <Input aria-label={`Item ${i + 1} unit price`} type="number" min={0} value={it.unitPrice} onChange={(e) => set(i, { unitPrice: Number(e.target.value) })} />
          <Button size="sm" variant="ghost" onClick={() => onChange(items.filter((_, idx) => idx !== i))} aria-label={`Remove item ${i + 1}`}>✕</Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={() => onChange([...items, { description: "", quantity: 1, unitPrice: 0 }])}>
        Add item
      </Button>
    </div>
  );
}
