'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Download, ExternalLink, Eye, FileText, MoreHorizontal, Pencil, RefreshCw, Trash2, Truck } from 'lucide-react';
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
  getItem,
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
  type Worker,
} from '@/lib/db';
import { POLL_FAST_MS, useAppSettings } from '@/lib/realtime';
import { DataTable } from '@/components/ui/data-table';
import { RecordPreview } from '@/components/record-preview';
import { generateInvoicePdf, downloadPdf as savePdf, openPdfPreview } from '@/lib/pdf-engine/generator';

export default function InvoicesPage() {
  const router = useRouter();
  const { data: settings } = useAppSettings();
  const currency = settings?.currency ?? '₹';

  const [clients, setClients] = useState<Client[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [open, setOpen] = useState(false);
  const [quotationId, setQuotationId] = useState('');
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().slice(0, 10);
  });
  const [invNotes, setInvNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editDueDate, setEditDueDate] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [preview, setPreview] = useState<Invoice | null>(null);
  const [prevRows, setPrevRows] = useState<Invoice[]>([]);
  const [payRows, setPayRows] = useState<Payment[]>([]);

  // Dispatch Delivery modal state
  const [dispatchInvoice, setDispatchInvoice] = useState<Invoice | null>(null);
  const [dispatchWorkerId, setDispatchWorkerId] = useState('');
  const [dispatching, setDispatching] = useState(false);

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
        issueDate: new Date().toISOString().slice(0, 10),
        dueDate: dueDate || undefined,
        notes: invNotes.trim() || undefined,
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

  const billToFor = async (inv: Invoice) => {
    const c = clients.find((x) => x.id === inv.clientId) ?? (await getItem<Client>('clients', inv.clientId).catch(() => null));
    return {
      name: inv.clientName || c?.name,
      company: c?.name || inv.clientName,
      address: c?.address,
      email: c?.email,
      phone: c?.phone,
      gstin: c?.gstin,
    };
  };

  const downloadPdf = async (inv: Invoice) => {
    const id = toast.loading('Generating PDF…');
    try {
      const billTo = await billToFor(inv);
      const invoicePayload = {
        ...inv,
        number: inv.number,
        invoice_number: inv.number,
        client_name: billTo?.name || inv.clientName,
        clientName: billTo?.name || inv.clientName,
        client_company: billTo?.company || billTo?.name || inv.clientName,
        clientCompany: billTo?.company || billTo?.name || inv.clientName,
        client_address: billTo?.address,
        clientAddress: billTo?.address,
        client_email: billTo?.email,
        clientEmail: billTo?.email,
        client_phone: billTo?.phone,
        clientPhone: billTo?.phone,
        client_gstin: billTo?.gstin,
        clientGstin: billTo?.gstin,
        amount: inv.total,
        total: inv.total,
        amount_paid: inv.amountPaid || 0,
        amountPaid: inv.amountPaid || 0,
        issue_date: inv.issueDate ?? inv.createdAt?.slice(0, 10),
        due_date: inv.dueDate,
        items: (inv.items ?? []).map((it: any) => ({
          name: it.name || it.description || '',
          description: it.description || '',
          quantity: Number(it.quantity) || 1,
          unit: it.unit || 'pcs',
          unit_price: Number(it.unitPrice ?? it.unit_price) || 0,
          unitPrice: Number(it.unitPrice ?? it.unit_price) || 0,
          total: Number(it.total) || (Number(it.quantity) || 1) * (Number(it.unitPrice ?? it.unit_price) || 0),
        })),
        notes: inv.notes,
      };
      const pdf = await generateInvoicePdf('', invoicePayload, null, null);
      await savePdf(pdf, `Invoice-${inv.number}.pdf`);
      toast.success('Invoice downloaded', { id });
    } catch (e) {
      toast.error('Failed to generate PDF', { id });
    }
  };

  const previewPdf = async (inv: Invoice) => {
    const id = toast.loading('Generating preview…');
    try {
      const billTo = await billToFor(inv);
      const invoicePayload = {
        ...inv,
        number: inv.number,
        invoice_number: inv.number,
        client_name: billTo?.name || inv.clientName,
        clientName: billTo?.name || inv.clientName,
        client_company: billTo?.company || billTo?.name || inv.clientName,
        clientCompany: billTo?.company || billTo?.name || inv.clientName,
        client_address: billTo?.address,
        clientAddress: billTo?.address,
        client_email: billTo?.email,
        clientEmail: billTo?.email,
        client_phone: billTo?.phone,
        clientPhone: billTo?.phone,
        client_gstin: billTo?.gstin,
        clientGstin: billTo?.gstin,
        amount: inv.total,
        total: inv.total,
        amount_paid: inv.amountPaid || 0,
        amountPaid: inv.amountPaid || 0,
        issue_date: inv.issueDate ?? inv.createdAt?.slice(0, 10),
        due_date: inv.dueDate,
        items: (inv.items ?? []).map((it: any) => ({
          name: it.name || it.description || '',
          description: it.description || '',
          quantity: Number(it.quantity) || 1,
          unit: it.unit || 'pcs',
          unit_price: Number(it.unitPrice ?? it.unit_price) || 0,
          unitPrice: Number(it.unitPrice ?? it.unit_price) || 0,
          total: Number(it.total) || (Number(it.quantity) || 1) * (Number(it.unitPrice ?? it.unit_price) || 0),
        })),
        notes: inv.notes,
      };
      const pdf = await generateInvoicePdf('', invoicePayload, null, null);
      const url = await openPdfPreview(pdf);
      window.open(url, '_blank');
      toast.dismiss(id);
    } catch (e) {
      toast.error('Failed to generate preview', { id });
    }
  };

  const startEdit = (inv: Invoice) => {
    setEditing(inv);
    setEditDueDate(inv.dueDate ?? '');
    setEditNotes(inv.notes ?? '');
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editing) return;
    setEditSaving(true);
    try {
      await updateItem('invoices', editing.id, {
        dueDate: editDueDate || undefined,
        notes: editNotes.trim() || undefined,
      });
      await logHistory('invoices', editing.id, 'Invoice updated', `Due ${editDueDate || '—'}`);
      toast.success('Invoice updated');
      setEditOpen(false);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setEditSaving(false);
    }
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

  const openDispatch = (inv: Invoice) => {
    Promise.all([
      getCollection<Client>('clients').then(setClients),
      getCollection<Worker>('workers').then(setWorkers),
    ]).catch(() => undefined);
    setDispatchInvoice(inv);
    setDispatchWorkerId('');
  };

  const submitDispatch = async () => {
    if (!dispatchInvoice) return;
    setDispatching(true);
    try {
      const client = clients.find((c) => c.id === dispatchInvoice.clientId) ?? (await getItem<Client>('clients', dispatchInvoice.clientId).catch(() => null));
      const worker = workers.find((w) => w.id === dispatchWorkerId);

      let orderId = dispatchInvoice.orderId;
      if (!orderId) {
        const oSeq = await nextSequence('orders');
        const orderNumber = formatNumber(settings?.orderPrefix ?? 'ORD', oSeq);
        orderId = await createItem('orders', {
          number: orderNumber,
          numberKey: nameKeyOf(orderNumber),
          clientId: dispatchInvoice.clientId,
          clientName: dispatchInvoice.clientName || client?.name,
          clientKey: dispatchInvoice.clientName ? nameKeyOf(dispatchInvoice.clientName) : undefined,
          invoiceId: dispatchInvoice.id,
          items: dispatchInvoice.items || [],
          subtotal: dispatchInvoice.subtotal || dispatchInvoice.total,
          tax: dispatchInvoice.tax || 0,
          discount: dispatchInvoice.discount || 0,
          total: dispatchInvoice.total,
          status: 'Confirmed',
        });
        await updateItem('invoices', dispatchInvoice.id, { orderId });
      }

      const deliveryId = await createItem('deliveries', {
        clientId: dispatchInvoice.clientId,
        clientName: dispatchInvoice.clientName || client?.name,
        clientKey: dispatchInvoice.clientName ? nameKeyOf(dispatchInvoice.clientName) : undefined,
        invoiceId: dispatchInvoice.id,
        orderId: orderId || undefined,
        workerId: dispatchWorkerId || undefined,
        workerName: worker?.name,
        status: 'Pending',
        mapsUrl: client?.mapsUrl || undefined,
      });

      await updateItem('invoices', dispatchInvoice.id, { deliveryId });
      if (orderId) {
        await updateItem('orders', orderId, { deliveryId });
      }
      await logHistory('invoices', dispatchInvoice.id, 'Delivery dispatched', `Assigned to ${worker?.name || 'Unassigned'}`);
      await logHistory('deliveries', deliveryId, 'Delivery created', `From invoice ${dispatchInvoice.number}`);

      toast.success(`Delivery created for invoice ${dispatchInvoice.number}`);
      setDispatchInvoice(null);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to dispatch delivery');
    } finally {
      setDispatching(false);
    }
  };

  const acceptedQuotes = quotations.filter((q) => q.status === 'Accepted');

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
          <p className="text-sm text-muted-foreground">Auto-numbered invoices — Unpaid, Partial, Paid, Overdue. Sync unpaid past-due to Overdue.</p>
        </div>
        <Link href="/invoices/new">
          <Button className="gap-2">
            <FileText className="h-4 w-4" />
            Document Builder
          </Button>
        </Link>
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
          onAdd={() => router.push('/invoices/new')}
          extraActions={(inv) => (
            <div className="flex items-center gap-1.5 justify-end">
              {(inv as any).deliveryId ? (
                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800">
                  <Truck className="h-3 w-3 mr-1 inline" />
                  Dispatched
                </Badge>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1 text-xs font-medium text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
                  title="Create Delivery"
                  onClick={() => openDispatch(inv)}
                >
                  <Truck className="h-3.5 w-3.5" />
                  <span>Dispatch Delivery</span>
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="More actions">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem onClick={() => openPreview(inv)}>
                    <Eye className="h-4 w-4 mr-2 text-muted-foreground" />
                    <span>View details</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push(`/invoices/${inv.id}`)}>
                    <Pencil className="h-4 w-4 mr-2 text-muted-foreground" />
                    <span>Edit in Document Builder</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => previewPdf(inv)}>
                    <ExternalLink className="h-4 w-4 mr-2 text-muted-foreground" />
                    <span>Preview PDF</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => downloadPdf(inv)}>
                    <Download className="h-4 w-4 mr-2 text-muted-foreground" />
                    <span>Download PDF</span>
                  </DropdownMenuItem>
                  {!(inv as any).deliveryId && (
                    <DropdownMenuItem onClick={() => openDispatch(inv)}>
                      <Truck className="h-4 w-4 mr-2 text-blue-600" />
                      <span className="text-blue-600 font-medium">Dispatch Delivery</span>
                    </DropdownMenuItem>
                  )}
                  {(inv.status === 'Unpaid' || inv.status === 'Partial') && (
                    <DropdownMenuItem onClick={() => syncStatus(inv)}>
                      <RefreshCw className="h-4 w-4 mr-2 text-muted-foreground" />
                      <span>Sync Status</span>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => remove(inv)} className="text-destructive focus:text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    <span>Delete</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
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
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Due Date</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>Notes</Label>
                <Input value={invNotes} onChange={(e) => setInvNotes(e.target.value)} placeholder="Payment terms…" />
              </div>
            </div>
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

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {editing?.number}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Due Date</Label>
              <Input type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Notes</Label>
              <Input value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Payment terms…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={editSaving}>
              {editSaving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dispatch Delivery Modal */}
      <Dialog open={Boolean(dispatchInvoice)} onOpenChange={(o) => !o && setDispatchInvoice(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Dispatch Delivery · {dispatchInvoice?.number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Assign a field worker to deliver invoice <strong className="text-foreground">{dispatchInvoice?.number}</strong> for <strong className="text-foreground">{dispatchInvoice?.clientName || 'the client'}</strong>.
            </p>
            <div className="space-y-1.5">
              <Label>Field Worker</Label>
              <Select value={dispatchWorkerId || 'none'} onValueChange={(v) => setDispatchWorkerId(v === 'none' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select worker (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned (queue for open pickup)</SelectItem>
                  {workers.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name} {w.phone ? `(${w.phone})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDispatchInvoice(null)}>
              Cancel
            </Button>
            <Button onClick={submitDispatch} disabled={dispatching}>
              {dispatching ? 'Dispatching…' : 'Confirm Dispatch'}
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
                      <div><span className="text-muted-foreground">Date: </span>{preview.issueDate ?? preview.createdAt.slice(0, 10)}</div>
                      <div><span className="text-muted-foreground">Due: </span>{preview.dueDate || '—'}</div>
                      <div><span className="text-muted-foreground">Status: </span>{deriveInvoiceStatus(preview)}</div>
                      <div><span className="text-muted-foreground">Subtotal: </span>{fmtMoney(preview.subtotal, currency)}</div>
                      <div><span className="text-muted-foreground">Discount: </span>{fmtMoney(preview.discount, currency)}</div>
                      <div><span className="text-muted-foreground">Tax: </span>{fmtMoney(preview.tax, currency)}</div>
                      <div><span className="text-muted-foreground font-medium">Total: </span>{fmtMoney(preview.total, currency)}</div>
                      <div><span className="text-muted-foreground">Paid: </span>{fmtMoney(preview.amountPaid, currency)}</div>
                      <div><span className="text-muted-foreground font-medium">Outstanding: </span>{fmtMoney(invoiceOutstanding(preview), currency)}</div>
                      {preview.notes && <div className="sm:col-span-2"><span className="text-muted-foreground">Notes: </span>{preview.notes}</div>}
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
