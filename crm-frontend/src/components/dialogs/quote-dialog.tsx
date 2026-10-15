'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { createQuotation, updateQuotation } from '@/lib/firebase/database';
import type { Quotation, QuotationStatus, QuotationItem } from '@/lib/db/types';
import { useAuth } from '@/lib/firebase/auth-context';
import { backend } from '@/lib/backend-client';

interface QuoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  quote?: Quotation | null;
}

const defaultForm = {
  client_name: '',
  client_email: '',
  client_company: '',
  project_title: '',
  quotation_number: '',
  amount: 0,
  currency: 'USD',
  valid_until: '',
  status: 'draft' as QuotationStatus,
  description: '',
  notes: '',
  items: [] as QuotationItem[],
};

export function QuoteDialog({ open, onOpenChange, onSaved, quote }: QuoteDialogProps) {
  const { workspace, user } = useAuth();
  const [form, setForm] = useState({
    ...defaultForm,
    quotation_number: `Q-${Date.now().toString().slice(-6)}`,
    valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (quote) {
      setForm({
        client_name: quote.client_name || '',
        client_email: quote.client_email || '',
        client_company: quote.client_company || '',
        project_title: quote.project_title || '',
        quotation_number: quote.quotation_number,
        amount: quote.amount,
        currency: quote.currency,
        valid_until: quote.valid_until || '',
        status: quote.status,
        description: quote.description || '',
        notes: quote.notes || '',
        items: quote.items || [],
      });
    } else {
      setForm({
        ...defaultForm,
        quotation_number: `Q-${Date.now().toString().slice(-6)}`,
        valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      });
    }
  }, [quote, open]);

  function set<K extends keyof typeof defaultForm>(key: K, value: (typeof defaultForm)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function addItem() {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { description: '', quantity: 1, unit_price: 0, total: 0 }],
    }));
  }

  function updateItem(index: number, field: keyof QuotationItem, value: string | number) {
    setForm((prev) => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };
      if (field === 'quantity' || field === 'unit_price') {
        items[index].total = items[index].quantity * items[index].unit_price;
      }
      const amount = items.reduce((sum, item) => sum + item.total, 0);
      return { ...prev, items, amount };
    });
  }

  function removeItem(index: number) {
    setForm((prev) => {
      const items = prev.items.filter((_, i) => i !== index);
      const amount = items.reduce((sum, item) => sum + item.total, 0);
      return { ...prev, items, amount };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.client_name || !form.quotation_number) {
      toast.error('Client name and quote number are required');
      return;
    }
    setSaving(true);
    try {
      if (quote) {
        await updateQuotation(quote.id, form);
        // Event-driven automation: accepted → invoice (idempotent on backend).
        if (quote.status !== 'accepted' && form.status === 'accepted' && workspace?.id) {
          try {
            await backend.quotationAccepted(workspace.id, quote.id);
            toast.success('Invoice created from accepted quote');
          } catch {
            toast.error('Quote saved, but invoice automation failed');
          }
        }
        toast.success('Quote updated');
      } else {
        await createQuotation({
          ...form,
          client_id: '',
          workspace_id: workspace?.id || '',
          valid_until: form.valid_until ? new Date(form.valid_until).toISOString() : '',
        });
        toast.success('Quote created');
      }
      onSaved();
      onOpenChange(false);
    } catch {
      toast.error('Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{quote ? 'Edit Quote' : 'New Quote'}</DialogTitle>
          <DialogDescription>
            {quote ? 'Update the quote details below.' : 'Enter the quote details below.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="client_name">Client Name *</Label>
              <Input id="client_name" value={form.client_name} onChange={(e) => set('client_name', e.target.value)} placeholder="Acme Corp" />
            </div>
            <div>
              <Label htmlFor="client_email">Client Email</Label>
              <Input id="client_email" type="email" value={form.client_email} onChange={(e) => set('client_email', e.target.value)} placeholder="billing@acme.com" />
            </div>
            <div>
              <Label htmlFor="client_company">Company</Label>
              <Input id="client_company" value={form.client_company} onChange={(e) => set('client_company', e.target.value)} placeholder="Acme Inc." />
            </div>
            <div>
              <Label htmlFor="project_title">Project</Label>
              <Input id="project_title" value={form.project_title} onChange={(e) => set('project_title', e.target.value)} placeholder="Website Redesign" />
            </div>
            <div>
              <Label htmlFor="quotation_number">Quote Number *</Label>
              <Input id="quotation_number" value={form.quotation_number} onChange={(e) => set('quotation_number', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="currency">Currency</Label>
              <Select value={form.currency} onValueChange={(v) => set('currency', v)}>
                <SelectTrigger id="currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                  <SelectItem value="NGN">NGN</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="valid_until">Valid Until</Label>
              <Input id="valid_until" type="date" value={form.valid_until.split('T')[0]} onChange={(e) => set('valid_until', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={form.status} onValueChange={(v: QuotationStatus) => set('status', v)}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Line Items</Label>
              <div className="space-y-2">
                {form.items.map((item, i) => (
                  <div key={i} className="flex items-end gap-2">
                    <div className="flex-1">
                      <Input
                        placeholder="Description"
                        value={item.description}
                        onChange={(e) => updateItem(i, 'description', e.target.value)}
                      />
                    </div>
                    <div className="w-20">
                      <Input
                        type="number"
                        min={1}
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => updateItem(i, 'quantity', Number(e.target.value))}
                      />
                    </div>
                    <div className="w-24">
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        placeholder="Price"
                        value={item.unit_price}
                        onChange={(e) => updateItem(i, 'unit_price', Number(e.target.value))}
                      />
                    </div>
                    <div className="w-20 text-sm pt-2 text-right font-medium">
                      ${item.total.toFixed(2)}
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0" onClick={() => removeItem(i)}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus size={14} className="mr-1" /> Add Item
                </Button>
              </div>
            </div>
            <div className="col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Scope of work..." rows={2} />
            </div>
            <div className="col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Payment terms, conditions..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : quote ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
