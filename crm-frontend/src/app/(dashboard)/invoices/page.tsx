'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import {
  INVOICE_STATUSES,
  collectionQuery,
  createItem,
  deriveInvoiceStatus,
  filterEqual,
  fmtMoney,
  formatNumber,
  getCollection,
  invoiceOutstanding,
  logHistory,
  nameKeyOf,
  nextSequence,
  removeItem,
  splitLegacy,
  updateItem,
  type Client,
  type Invoice,
  type Payment,
  type Quotation,
} from '@/lib/db';
import { POLL_FAST_MS, useAppSettings } from '@/lib/realtime';
import { DataTable } from '@/components/ui/data-table';
import { RecordPreview } from '@/components/record-preview';
import { exportDocumentPdf } from '@/lib/pdf';

export default function InvoicesPage() {
  const { data: settings } = useAppSettings();
  const currency = settings?.currency ?? '₹';

  const [clients, setClients] = useState<Client[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [open, setOpen] = useState(false);
  const [quotationId, setQuotationId] = useState('');
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<Invoice | null>(null);
  const [prevRows, setPrevRows] = useState<Invoice[]>([]);
  const [payRows, setPayRows] = useState<Payment[]>([]);

  const fetchRows = useMemo(() => collectionQuery<Invoice>('invoices', 'createdAt', 'numberKey'), []);

  const startCreate = () => {
    getCollection<Client>('clients').then(setClients).catch(() => undefined);
    getCollection<Quotation>('quotations').then(setQuotations).catch(() => undefined);
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
      const seq = await nextSequence('invoices');
      const invNumber = formatNumber(settings?.invoicePrefix ?? 'INV', seq);
      const client = clients.find((c) => c.id === q.clientId);
      const id = await createItem('invoices', {
        number: invNumber,
        numberKey: invNumber.toLowerCase(),
        clientId: q.clientId,
        clientName: client?.name ?? q.clientName,
        clientKey: client ? nameKeyOf(client.name) : q.clientKey,
        quotationId: q.id,
        items: q.items,
        subtotal: q.subtotal,
        tax: q.tax,
        discount: q.discount,
        total: q.total,
        amountPaid: 0,
        status: 'Unpaid',
      });
      await logHistory('invoices', id, 'Invoice created', `${invNumber} · from ${q.number}`);
      toast.success(`Invoice ${invNumber} created`);
      setOpen(false);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (inv: Invoice) => {
    if (!window.confirm(`Delete invoice ${inv.number}?`)) return;
    try {
      await removeItem('invoices', inv.id);
      toast.success('Invoice deleted');
      setRefreshKey((k) => k + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const syncStatus = async (inv: Invoice) => {
    const derived = deriveInvoiceStatus(inv);
    if (derived === inv.status) {
      toast.success(`Status already ${derived}`);
      return;
    }
    try {
      const patch: Record<string, unknown> = { status: derived };
      if (derived === 'Paid') patch.paidAt = new Date().toISOString();
      await updateItem('invoices', inv.id, patch);
      await logHistory('invoices', inv.id, `Status → ${derived}`);
      toast.success(`Status synced: ${derived}`);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Sync failed');
    }
  };

  const downloadPdf = (inv: Invoice) => {
    exportDocumentPdf({
      title: 'Invoice',
      number: inv.number,
      clientName: inv.clientName,
      items: inv.items,
      subtotal: inv.subtotal,
      tax: inv.tax,
      discount: inv.discount,
      total: inv.total,
      status: inv.status,
      extraLines: [`Paid: ${inv.amountPaid ?? 0}`, `Outstanding: ${invoiceOutstanding(inv)}`],
    });
  };

  const openPreview = async (inv: Invoice) => {
    setPreview(inv);
    try {
      const [all, pays] = await Promise.all([
        filterEqual<Invoice>('invoices', 'clientId', inv.clientId),
        filterEqual<Payment>('payments', 'invoiceId', inv.id),
      ]);
      setPrevRows(splitLegacy(all.filter((x) => x.id !== inv.id)).previous);
      setPayRows(pays.sort((a, b) => b.date.localeCompare(a.date)));
    } catch {
      setPrevRows([]);
      setPayRows([]);
    }
  };

  const acceptedQuotes = quotations.filter((q) => q.status === 'Accepted');

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
        <p className="text-sm text-muted-foreground">Auto-numbered invoices — Unpaid, Partial, Paid, Overdue. Sync unpaid past-due to Overdue.</p>
      </div>

      <div key={refreshKey}>
        <DataTable<Invoice>
          title="All invoices"
          queryKey="invoices"
          fetchRows={fetchRows}
          searchPlaceholder="Search number…"
          filters={[{ field: 'status', label: 'Status', options: INVOICE_STATUSES.map((s) => ({ value: s, label: s })) }]}
          defaultPageSize={settings?.defaultRowsPerPage ?? 25}
          pollMs={POLL_FAST_MS}
          addLabel="New invoice"
          onAdd={startCreate}
          onDelete={remove}
          onPreview={openPreview}
          extraActions={(inv) => (
            <>
              <Button variant="ghost" size="icon" title="Export PDF" aria-label="Export PDF" onClick={() => downloadPdf(inv)}>
                <Download size={16} />
              </Button>
              {(inv.status === 'Unpaid' || inv.status === 'Partial') && (
                <Button variant="ghost" size="sm" title="Recompute status from payments + due date" onClick={() => syncStatus(inv)}>
                  Sync
                </Button>
              )}
            </>
          )}
          emptyTitle="No invoices"
          emptyHint="Create an invoice from an accepted quotation."
          columns={[
            { key: 'number', header: 'Number', render: (i) => <span className="font-medium">{i.number}</span> },
            { key: 'clientName', header: 'Client', render: (i) => i.clientName || '—' },
            { key: 'total', header: 'Total', className: 'text-right', render: (i) => fmtMoney(i.total, currency) },
            { key: 'amountPaid', header: 'Paid', className: 'text-right', render: (i) => fmtMoney(i.amountPaid, currency) },
            { key: 'dueDate', header: 'Due', render: (i) => i.dueDate || '—' },
            { key: 'status', header: 'Status', render: (i) => <Badge variant={i.status === 'Paid' ? 'default' : i.status === 'Overdue' ? 'destructive' : 'secondary'}>{deriveInvoiceStatus(i)}</Badge> },
          ]}
        />
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New invoice from quotation</DialogTitle>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label>Accepted quotation *</Label>
            <Select value={quotationId || 'none'} onValueChange={(v) => setQuotationId(v === 'none' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select quotation" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Select quotation</SelectItem>
                {acceptedQuotes.map((q) => (
                  <SelectItem key={q.id} value={q.id}>
                    {q.number} · {q.clientName} · {fmtMoney(q.total, currency)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {acceptedQuotes.length === 0 && (
              <p className="text-xs text-muted-foreground">No accepted quotations yet. Accept one on the Quotations page first.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? 'Creating…' : 'Create invoice'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RecordPreview
        open={Boolean(preview)}
        onOpenChange={(o) => !o && setPreview(null)}
        title={preview ? `Invoice · ${preview.number}` : 'Invoice'}
        page="invoices"
        sections={
          preview
            ? [
                {
                  id: 'info',
                  title: `Invoice info · ${deriveInvoiceStatus(preview)}`,
                  content: (
                    <div className="grid sm:grid-cols-2 gap-2 text-sm">
                      <div><span className="text-muted-foreground">Client: </span>{preview.clientName || '—'}</div>
                      <div><span className="text-muted-foreground">Due: </span>{preview.dueDate || '—'}</div>
                      <div><span className="text-muted-foreground">Subtotal: </span>{fmtMoney(preview.subtotal, currency)}</div>
                      <div><span className="text-muted-foreground">Discount: </span>{fmtMoney(preview.discount, currency)}</div>
                      <div><span className="text-muted-foreground">Tax: </span>{fmtMoney(preview.tax, currency)}</div>
                      <div><span className="text-muted-foreground font-medium">Total: </span>{fmtMoney(preview.total, currency)}</div>
                      <div><span className="text-muted-foreground">Paid: </span>{fmtMoney(preview.amountPaid, currency)}</div>
                      <div><span className="text-muted-foreground font-medium">Outstanding: </span>{fmtMoney(invoiceOutstanding(preview), currency)}</div>
                      <div className="sm:col-span-2">
                        <span className="text-muted-foreground">Items: </span>
                        {preview.items.map((i) => `${i.description} ×${i.quantity}`).join('; ')}
                      </div>
                    </div>
                  ),
                },
                {
                  id: 'payments',
                  title: `Payments (${payRows.length})`,
                  content:
                    payRows.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No payments recorded. Add one on the Payments page.</p>
                    ) : (
                      <ul className="text-sm space-y-1">
                        {payRows.map((p) => (
                          <li key={p.id}>
                            {p.date} · {fmtMoney(p.amount, currency)} · {p.mode}
                            {p.reference ? ` · ${p.reference}` : ''}
                          </li>
                        ))}
                      </ul>
                    ),
                },
              ]
            : []
        }
        history={preview ? { entity: 'invoices', id: preview.id } : undefined}
        previous={
          preview
            ? {
                rows: prevRows,
                render: (rows) => (
                  <ul className="text-sm space-y-1">
                    {(rows as Invoice[]).map((i) => (
                      <li key={i.id}>{i.number} · {i.status} · {fmtMoney(i.total, currency)}</li>
                    ))}
                  </ul>
                ),
              }
            : undefined
        }
      />
    </div>
  );
}
