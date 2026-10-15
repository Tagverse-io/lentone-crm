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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { createInvoice, updateInvoice, getProjects } from '@/lib/firebase/database';
import type { Invoice, InvoiceStatus, Project } from '@/lib/db/types';
import { useAuth } from '@/lib/firebase/auth-context';

interface InvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  invoice?: Invoice | null;
}

export function InvoiceDialog({ open, onOpenChange, onSaved, invoice }: InvoiceDialogProps) {
  const { workspace, user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [form, setForm] = useState({
    project_id: '',
    client_id: '',
    invoice_number: '',
    amount: 0,
    due_date: '',
    status: 'pending' as InvoiceStatus,
    description: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (workspace?.id) {
        getProjects(workspace?.id).then(setProjects).catch(() => {});
      }
      if (invoice) {
        setForm({
          project_id: invoice.project_id || '',
          client_id: invoice.client_id || '',
          invoice_number: invoice.invoice_number,
          amount: invoice.amount,
          due_date: invoice.due_date || '',
          status: invoice.status,
          description: invoice.description || '',
          notes: invoice.notes || '',
        });
      } else {
        setForm({
          project_id: '',
          client_id: '',
          invoice_number: `INV-${Date.now().toString().slice(-6)}`,
          amount: 0,
          due_date: '',
          status: 'pending',
          description: '',
          notes: '',
        });
      }
    }
  }, [open, invoice, user]);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.invoice_number.trim() || form.amount <= 0) {
      toast.error('Invoice number and valid amount are required');
      return;
    }
    setSaving(true);
    try {
      if (invoice) {
        await updateInvoice(invoice.id, form);
        toast.success('Invoice updated');
      } else {
        await createInvoice({
          ...form,
          workspace_id: workspace?.id || '',
        });
        toast.success('Invoice created');
      }
      onSaved();
      onOpenChange(false);
    } catch {
      toast.error('Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{invoice ? 'Edit Invoice' : 'New Invoice'}</DialogTitle>
          <DialogDescription>
            {invoice ? 'Update the invoice details below.' : 'Enter the invoice details below.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="invoice_number">Invoice Number *</Label>
              <Input id="invoice_number" value={form.invoice_number} onChange={(e) => set('invoice_number', e.target.value)} placeholder="INV-001" />
            </div>
            <div className="col-span-2">
              <Label htmlFor="description">Description</Label>
              <Input id="description" value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Professional Services" />
            </div>
            <div>
              <Label htmlFor="amount">Amount *</Label>
              <Input id="amount" type="number" min={0} step={0.01} value={form.amount} onChange={(e) => set('amount', parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={form.status} onValueChange={(v: InvoiceStatus) => set('status', v)}>
                <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="due_date">Due Date</Label>
              <Input id="due_date" type="date" value={form.due_date} onChange={(e) => set('due_date', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="project">Project</Label>
              <Select value={form.project_id || 'none'} onValueChange={(v) => set('project_id', v === 'none' ? '' : v)}>
                <SelectTrigger id="project"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="client_id">Client ID</Label>
              <Input id="client_id" value={form.client_id} onChange={(e) => set('client_id', e.target.value)} placeholder="client-id" />
            </div>
            <div className="col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes"
                className="w-full min-h-[60px] rounded-md border bg-background px-3 py-2 text-sm"
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                placeholder="Optional notes..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : invoice ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
