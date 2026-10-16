'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Download, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  createItem,
  getCollection,
  removeItem,
  subscribeInvoices,
  updateItem,
  type Client,
  type Invoice,
  type Quotation,
} from '@/lib/db';
import { exportDocumentPdf } from '@/lib/pdf';
import { EmptyState, LoadingState } from '@/components/ui/states';

function money(n: number): string {
  return `₹${(n || 0).toLocaleString('en-IN')}`;
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [quotationId, setQuotationId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getCollection<Client>('clients').then(setClients).catch(() => undefined);
    getCollection<Quotation>('quotations').then(setQuotations).catch(() => undefined);
    return subscribeInvoices(
      (list) => {
        setInvoices(list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, []);

  if (loading) return <LoadingState label="Loading invoices…" />;

  const acceptedQuotes = quotations.filter((q) => q.status === 'Accepted');

  const startCreate = () => {
    setQuotationId('');
    setOpen(true);
  };

  const save = async () => {
    if (!quotationId) {
      toast.error('Select an accepted quotation');
      return;
    }
    const q = quotations.find((x) => x.id === quotationId);
    if (!q) {
      toast.error('Quotation not found');
      return;
    }
    setSaving(true);
    try {
      const invNumber = `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
      const client = clients.find((c) => c.id === q.clientId);
      await createItem('invoices', {
        number: invNumber,
        clientId: q.clientId,
        clientName: client?.name ?? q.clientName,
        quotationId: q.id,
        items: q.items,
        total: q.total,
        status: 'Unpaid',
      });
      toast.success(`Invoice ${invNumber} created`);
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setSaving(false);
    }
  };

  const markPaid = async (inv: Invoice) => {
    try {
      await updateItem('invoices', inv.id, { status: 'Paid', paidAt: new Date().toISOString() });
      toast.success('Marked as paid');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Delete this invoice?')) return;
    try {
      await removeItem('invoices', id);
      toast.success('Invoice deleted');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const downloadPdf = (inv: Invoice) => {
    exportDocumentPdf({
      title: 'Invoice',
      number: inv.number,
      clientName: inv.clientName,
      items: inv.items,
      total: inv.total,
      status: inv.status,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
          <p className="text-sm text-muted-foreground">
            {invoices.filter((i) => i.status === 'Unpaid').length} unpaid ·{' '}
            {money(invoices.filter((i) => i.status === 'Paid').reduce((s, i) => s + (i.total || 0), 0))} collected
          </p>
        </div>
        <Button onClick={startCreate}><Plus size={16} className="mr-2" />New invoice</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>All invoices</CardTitle></CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <EmptyState title="No invoices" description="Create an invoice from an accepted quotation." />
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <Table className="min-w-[720px]">
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
                  {invoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{inv.number}</TableCell>
                      <TableCell>{inv.clientName || '—'}</TableCell>
                      <TableCell className="text-right">{money(inv.total)}</TableCell>
                      <TableCell><Badge variant={inv.status === 'Paid' ? 'default' : 'secondary'}>{inv.status}</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" title="Export PDF" onClick={() => downloadPdf(inv)} aria-label="Export PDF"><Download size={16} /></Button>
                          {inv.status === 'Unpaid' && (
                            <Button variant="ghost" size="icon" title="Mark paid" onClick={() => markPaid(inv)} aria-label="Mark paid"><CheckCircle size={16} /></Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => remove(inv.id)} aria-label="Delete invoice"><Trash2 size={16} /></Button>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New invoice from quotation</DialogTitle>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label>Accepted quotation *</Label>
            <Select value={quotationId || 'none'} onValueChange={(v) => setQuotationId(v === 'none' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="Select quotation" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Select quotation</SelectItem>
                {acceptedQuotes.map((q) => (
                  <SelectItem key={q.id} value={q.id}>{q.number} · {q.clientName} · {money(q.total)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {acceptedQuotes.length === 0 && (
              <p className="text-xs text-muted-foreground">No accepted quotations yet. Accept one on the Quotations page first.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Creating…' : 'Create invoice'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
