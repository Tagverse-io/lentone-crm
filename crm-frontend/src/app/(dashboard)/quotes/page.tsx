'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2, Download, FileCheck } from 'lucide-react';
import { toast } from 'sonner';
import {
  QUOTATION_STATUSES,
  createItem,
  getCollection,
  quotationTotal,
  removeItem,
  subscribeQuotations,
  updateItem,
  type Client,
  type Quotation,
  type QuotationLineItem,
  type QuotationStatus,
} from '@/lib/db';
import { exportDocumentPdf } from '@/lib/pdf';
import { EmptyState, LoadingState } from '@/components/ui/states';

const EMPTY_ITEM: QuotationLineItem = { description: '', quantity: 1, unitPrice: 0 };

function money(n: number): string {
  return `₹${(n || 0).toLocaleString('en-IN')}`;
}

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<Quotation[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Quotation | null>(null);
  const [clientId, setClientId] = useState('');
  const [items, setItems] = useState<QuotationLineItem[]>([{ ...EMPTY_ITEM }]);
  const [status, setStatus] = useState<QuotationStatus>('Draft');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getCollection<Client>('clients').then(setClients).catch(() => undefined);
    return subscribeQuotations(
      (list) => {
        setQuotes(list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, []);

  if (loading) return <LoadingState label="Loading quotations…" />;

  const total = quotationTotal(items);
  const nextNumber = `Q-${new Date().getFullYear()}-${String(quotes.length + 1).padStart(3, '0')}`;

  const startCreate = () => {
    setEditing(null);
    setClientId('');
    setItems([{ ...EMPTY_ITEM }]);
    setStatus('Draft');
    setOpen(true);
  };
  const startEdit = (q: Quotation) => {
    setEditing(q);
    setClientId(q.clientId);
    setItems(q.items.length > 0 ? q.items.map((i) => ({ ...i })) : [{ ...EMPTY_ITEM }]);
    setStatus(q.status);
    setOpen(true);
  };

  const save = async () => {
    if (!clientId) {
      toast.error('Client is required');
      return;
    }
    const cleanItems = items.filter((i) => i.description.trim());
    if (cleanItems.length === 0) {
      toast.error('Add at least one line item');
      return;
    }
    setSaving(true);
    try {
      const client = clients.find((c) => c.id === clientId);
      const data = {
        clientId,
        clientName: client?.name,
        items: cleanItems,
        total: quotationTotal(cleanItems),
        status,
      };
      if (editing) await updateItem('quotations', editing.id, data);
      else await createItem('quotations', { number: nextNumber, ...data });
      toast.success(editing ? 'Quotation updated' : 'Quotation created');
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Delete this quotation?')) return;
    try {
      await removeItem('quotations', id);
      toast.success('Quotation deleted');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const createInvoice = async (q: Quotation) => {
    try {
      const invNumber = `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
      await createItem('invoices', {
        number: invNumber,
        clientId: q.clientId,
        clientName: q.clientName,
        quotationId: q.id,
        items: q.items,
        total: q.total,
        status: 'Unpaid',
      });
      toast.success(`Invoice ${invNumber} created from quotation`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Invoice creation failed');
    }
  };

  const downloadPdf = (q: Quotation) => {
    exportDocumentPdf({
      title: 'Quotation',
      number: q.number,
      clientName: q.clientName,
      items: q.items,
      total: q.total,
      status: q.status,
    });
  };

  const setItem = (idx: number, patch: Partial<QuotationLineItem>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Quotations</h1>
          <p className="text-sm text-muted-foreground">{quotes.length} quotations · accept one to create its invoice</p>
        </div>
        <Button onClick={startCreate}><Plus size={16} className="mr-2" />New quotation</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>All quotations</CardTitle></CardHeader>
        <CardContent>
          {quotes.length === 0 ? (
            <EmptyState title="No quotations" description="Create your first quotation with line items." />
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <Table className="min-w-[760px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Number</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotes.map((q) => (
                    <TableRow key={q.id}>
                      <TableCell className="font-medium">{q.number}</TableCell>
                      <TableCell>{q.clientName || '—'}</TableCell>
                      <TableCell className="text-right">{money(q.total)}</TableCell>
                      <TableCell><Badge variant={q.status === 'Accepted' ? 'default' : 'secondary'}>{q.status}</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" title="Export PDF" onClick={() => downloadPdf(q)} aria-label="Export PDF"><Download size={16} /></Button>
                          {q.status === 'Accepted' && (
                            <Button variant="ghost" size="icon" title="Create invoice" onClick={() => createInvoice(q)} aria-label="Create invoice"><FileCheck size={16} /></Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => startEdit(q)} aria-label="Edit quotation"><Pencil size={16} /></Button>
                          <Button variant="ghost" size="icon" onClick={() => remove(q.id)} aria-label="Delete quotation"><Trash2 size={16} /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.number}` : `New quotation ${nextNumber}`}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Client *</Label>
                <Select value={clientId || 'none'} onValueChange={(v) => setClientId(v === 'none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select client</SelectItem>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as QuotationStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {QUOTATION_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Line items</Label>
              {items.map((it, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_70px_100px_32px] gap-2">
                  <Input placeholder="Description" value={it.description} onChange={(e) => setItem(idx, { description: e.target.value })} />
                  <Input type="number" placeholder="Qty" value={it.quantity} onChange={(e) => setItem(idx, { quantity: Number(e.target.value) })} />
                  <Input type="number" placeholder="Unit ₹" value={it.unitPrice} onChange={(e) => setItem(idx, { unitPrice: Number(e.target.value) })} />
                  <Button variant="ghost" size="icon" onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))} aria-label="Remove line"><Trash2 size={16} /></Button>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-fit" onClick={() => setItems((prev) => [...prev, { ...EMPTY_ITEM }])}>
                <Plus size={14} className="mr-1" />Add line
              </Button>
            </div>
            <div className="text-right font-semibold">Total: {money(total)}</div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
