'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Download, Eye, FileCheck, FileText, Plus } from 'lucide-react';
import { toast } from 'sonner';
import {
  QUOTATION_STATUSES,
  calcTotals,
  collectionQuery,
  convertQuotationAtomic,
  createItem,
  filterEqual,
  fmtMoney,
  formatNumber,
  getCollection,
  getItem,
  logHistory,
  nameKeyOf,
  nextSequence,
  removeItem,
  splitLegacy,
  updateItem,
  type Client,
  type OrderLineItem,
  type Product,
  type Quotation,
  type QuotationStatus,
} from '@/lib/db';
import { POLL_FAST_MS, useAppSettings } from '@/lib/realtime';
import { DataTable } from '@/components/ui/data-table';
import { LineItemsEditor } from '@/components/line-items-editor';
import { RecordPreview } from '@/components/record-preview';
import { generateQuotationPdf, downloadPdf as savePdf, openPdfPreview } from '@/lib/pdf-engine/generator';

const EMPTY_ITEM: OrderLineItem = { description: '', quantity: 1, unitPrice: 0 };

export default function QuotesPage() {
  const router = useRouter();
  const { data: settings } = useAppSettings();
  const currency = settings?.currency ?? '₹';
  const taxRate = settings?.taxRate ?? 18;

  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Quotation | null>(null);
  const [clientId, setClientId] = useState('');
  const [items, setItems] = useState<OrderLineItem[]>([{ ...EMPTY_ITEM }]);
  const [discount, setDiscount] = useState('0');
  const [status, setStatus] = useState<QuotationStatus>('Draft');
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [validUntil, setValidUntil] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState<string | null>(null);
  const [preview, setPreview] = useState<Quotation | null>(null);
  const [prevRows, setPrevRows] = useState<Quotation[]>([]);

  const fetchRows = useMemo(() => collectionQuery<Quotation>('quotations', 'createdAt', 'numberKey'), []);

  const totals = calcTotals(items.filter((i) => i.description.trim() || i.productId), taxRate, Number(discount) || 0);

  const loadClients = () => {
    getCollection<Client>('clients').then(setClients).catch(() => undefined);
    getCollection<Product>('products').then(setProducts).catch(() => undefined);
  };

  const todayStr = () => new Date().toISOString().slice(0, 10);
  const plus30 = () => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  };

  const startCreate = () => {
    loadClients();
    setEditing(null);
    setClientId('');
    setItems([{ ...EMPTY_ITEM }]);
    setDiscount('0');
    setStatus('Draft');
    setIssueDate(todayStr());
    setValidUntil(plus30());
    setNotes('');
    setOpen(true);
  };
  const startEdit = (q: Quotation) => {
    loadClients();
    setEditing(q);
    setClientId(q.clientId);
    setItems(q.items.length > 0 ? q.items.map((i) => ({ ...i })) : [{ ...EMPTY_ITEM }]);
    setDiscount(String(q.discount ?? 0));
    setStatus(q.status);
    setIssueDate(q.issueDate ?? q.createdAt.slice(0, 10));
    setValidUntil(q.validUntil ?? plus30());
    setNotes(q.notes ?? '');
    setOpen(true);
  };

  const save = async () => {
    if (!clientId) {
      toast.error('Client is required');
      return;
    }
    const cleanItems = items.filter((i) => i.description.trim() || i.productId);
    if (cleanItems.length === 0) {
      toast.error('Add at least one line item');
      return;
    }
    setSaving(true);
    try {
      const client = clients.find((c) => c.id === clientId);
      const t = calcTotals(cleanItems, taxRate, Number(discount) || 0);
      const data = {
        clientId,
        clientName: client?.name,
        clientKey: client ? nameKeyOf(client.name) : undefined,
        items: cleanItems,
        subtotal: t.subtotal,
        tax: t.tax,
        discount: t.discount,
        total: t.total,
        status,
        issueDate: issueDate || undefined,
        validUntil: validUntil || undefined,
        notes: notes.trim() || undefined,
      };
      if (editing) {
        await updateItem('quotations', editing.id, data);
        await logHistory('quotations', editing.id, 'Quotation updated', `${editing.number} · ${status}`);
        toast.success('Quotation updated');
      } else {
        const seq = await nextSequence('quotations');
        const number = formatNumber(settings?.quotationPrefix ?? 'Q', seq);
        const id = await createItem('quotations', { number, numberKey: number.toLowerCase(), ...data });
        await logHistory('quotations', id, 'Quotation created', `${number} · ${status}`);
        toast.success(`Quotation ${number} created`);
      }
      setOpen(false);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (q: Quotation) => {
    if (!window.confirm(`Delete quotation ${q.number}?`)) return;
    try {
      await removeItem('quotations', q.id);
      toast.success('Quotation deleted');
      setRefreshKey((k) => k + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const convert = async (q: Quotation) => {
    if (q.status !== 'Accepted') {
      toast.error('Only accepted quotations can be converted');
      return;
    }
    if (!window.confirm(`Convert ${q.number} to an order + invoice? Stock will be deducted.`)) return;
    setConverting(q.id);
    try {
      const [oSeq, iSeq] = await Promise.all([nextSequence('orders'), nextSequence('invoices')]);
      const orderNumber = formatNumber(settings?.orderPrefix ?? 'ORD', oSeq);
      const invoiceNumber = formatNumber(settings?.invoicePrefix ?? 'INV', iSeq);
      await convertQuotationAtomic(q, { orderNumber, invoiceNumber });
      toast.success(`Converted: order ${orderNumber}, invoice ${invoiceNumber}`);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Conversion failed');
    } finally {
      setConverting(null);
    }
  };

  const billToFor = async (q: Quotation) => {
    const c = clients.find((x) => x.id === q.clientId) ?? (await getItem<Client>('clients', q.clientId).catch(() => null));
    return {
      name: q.clientName || c?.name,
      address: c?.address,
      email: c?.email,
      phone: c?.phone,
    };
  };

  const downloadPdf = async (q: Quotation) => {
    const id = toast.loading('Generating PDF…');
    try {
      const billTo = await billToFor(q);
      const quotePayload = {
        ...q,
        number: q.number,
        quotation_number: q.number,
        client_name: billTo?.name || q.clientName,
        clientName: billTo?.name || q.clientName,
        client_company: billTo?.name || q.clientName,
        clientCompany: billTo?.name || q.clientName,
        client_address: billTo?.address,
        clientAddress: billTo?.address,
        client_email: billTo?.email,
        clientEmail: billTo?.email,
        client_phone: billTo?.phone,
        clientPhone: billTo?.phone,
        amount: q.total,
        total: q.total,
        issue_date: q.issueDate ?? q.createdAt?.slice(0, 10),
        valid_until: q.validUntil,
        items: (q.items ?? []).map((it) => ({
          name: it.description || '',
          description: '',
          quantity: Number(it.quantity) || 1,
          unit_price: Number(it.unitPrice) || 0,
          unitPrice: Number(it.unitPrice) || 0,
          total: (Number(it.quantity) || 1) * (Number(it.unitPrice) || 0),
        })),
        notes: q.notes,
      };
      const pdf = await generateQuotationPdf('', quotePayload, null);
      await savePdf(pdf, `Quotation-${q.number}.pdf`);
      toast.success('Quote downloaded', { id });
    } catch (e) {
      toast.error('Failed to generate PDF', { id });
    }
  };

  const previewPdf = async (q: Quotation) => {
    const id = toast.loading('Generating preview…');
    try {
      const billTo = await billToFor(q);
      const quotePayload = {
        ...q,
        number: q.number,
        quotation_number: q.number,
        client_name: billTo?.name || q.clientName,
        clientName: billTo?.name || q.clientName,
        client_company: billTo?.name || q.clientName,
        clientCompany: billTo?.name || q.clientName,
        client_address: billTo?.address,
        clientAddress: billTo?.address,
        client_email: billTo?.email,
        clientEmail: billTo?.email,
        client_phone: billTo?.phone,
        clientPhone: billTo?.phone,
        amount: q.total,
        total: q.total,
        issue_date: q.issueDate ?? q.createdAt?.slice(0, 10),
        valid_until: q.validUntil,
        items: (q.items ?? []).map((it) => ({
          name: it.description || '',
          description: '',
          quantity: Number(it.quantity) || 1,
          unit_price: Number(it.unitPrice) || 0,
          unitPrice: Number(it.unitPrice) || 0,
          total: (Number(it.quantity) || 1) * (Number(it.unitPrice) || 0),
        })),
        notes: q.notes,
      };
      const pdf = await generateQuotationPdf('', quotePayload, null);
      const url = await openPdfPreview(pdf);
      window.open(url, '_blank');
      toast.dismiss(id);
    } catch (e) {
      toast.error('Failed to generate preview', { id });
    }
  };

  const openPreview = async (q: Quotation) => {
    setPreview(q);
    try {
      const all = await filterEqual<Quotation>('quotations', 'clientId', q.clientId);
      setPrevRows(splitLegacy(all.filter((x) => x.id !== q.id)).previous);
    } catch {
      setPrevRows([]);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Quotations</h1>
          <p className="text-sm text-muted-foreground">Line items from inventory, tax, discount — convert accepted quotes to order + invoice.</p>
        </div>
        <Link href="/quotes/new">
          <Button className="gap-2">
            <FileText className="h-4 w-4" />
            Document Builder
          </Button>
        </Link>
      </div>

      <div key={refreshKey}>
        <DataTable<Quotation>
          title="All quotations"
          queryKey="quotations"
          fetchRows={fetchRows}
          searchPlaceholder="Search number…"
          filters={[{ field: 'status', label: 'Status', options: QUOTATION_STATUSES.map((s) => ({ value: s, label: s })) }]}
          defaultPageSize={settings?.defaultRowsPerPage ?? 25}
          pollMs={POLL_FAST_MS}
          addLabel="New quotation"
          onAdd={() => router.push('/quotes/new')}
          onEdit={(q) => router.push(`/quotes/${q.id}`)}
          onDelete={remove}
          onPreview={openPreview}
          extraActions={(q) => (
            <>
              <Link href={`/quotes/${q.id}`} title="Edit in Document Builder">
                <Button variant="ghost" size="icon" aria-label="Open Document Builder">
                  <FileText size={16} />
                </Button>
              </Link>
              <Button variant="ghost" size="icon" title="Preview PDF" aria-label="Preview PDF" onClick={() => previewPdf(q)}>
                <Eye size={16} />
              </Button>
              <Button variant="ghost" size="icon" title="Download PDF" aria-label="Download PDF" onClick={() => downloadPdf(q)}>
                <Download size={16} />
              </Button>
              {q.status === 'Accepted' && (
                <Button variant="ghost" size="icon" title="Convert to order and invoice" aria-label="Convert" onClick={() => convert(q)} disabled={converting === q.id}>
                  <FileCheck size={16} />
                </Button>
              )}
            </>
          )}
          emptyTitle="No quotations"
          emptyHint="Create your first quotation with line items."
          columns={[
            { key: 'number', header: 'Number', render: (q) => <span className="font-medium">{q.number}</span> },
            { key: 'clientName', header: 'Client', render: (q) => q.clientName || '—' },
            { key: 'total', header: 'Total', className: 'text-right', render: (q) => fmtMoney(q.total, currency) },
            { key: 'status', header: 'Status', render: (q) => <Badge variant={q.status === 'Accepted' ? 'default' : 'secondary'}>{q.status}</Badge> },
          ]}
        />
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.number}` : 'New quotation'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Client *</Label>
                <Select value={clientId || 'none'} onValueChange={(v) => setClientId(v === 'none' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select client</SelectItem>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as QuotationStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {QUOTATION_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Date *</Label>
                <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>Valid Until</Label>
                <Input type="date" value={validUntil} min={issueDate} onChange={(e) => setValidUntil(e.target.value)} />
              </div>
            </div>
            {clientId && (() => {
              const c = clients.find((x) => x.id === clientId);
              if (!c) return null;
              return (
                <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-0.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bill to</p>
                  <p className="font-medium">{c.name}</p>
                  {c.address && <p className="text-muted-foreground">{c.address}</p>}
                  {c.email && <p className="text-muted-foreground">Email: {c.email}</p>}
                  {c.phone && <p className="text-muted-foreground">{c.phone}</p>}
                </div>
              );
            })()}
            <LineItemsEditor items={items} onChange={setItems} products={products} currency={currency} showStock={false} />
            <div className="grid gap-1.5">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Payment terms, delivery notes…" />
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="grid gap-1.5">
                <Label>Discount (₹)</Label>
                <Input type="number" min={0} value={discount} onChange={(e) => setDiscount(e.target.value)} />
              </div>
              <div className="pt-6 text-muted-foreground">Tax {taxRate}%: {fmtMoney(totals.tax, currency)}</div>
              <div className="pt-6 font-semibold text-right">Total: {fmtMoney(totals.total, currency)}</div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RecordPreview
        open={Boolean(preview)}
        onOpenChange={(o) => !o && setPreview(null)}
        title={preview ? `Quotation · ${preview.number}` : 'Quotation'}
        page="quotations"
        sections={
          preview
            ? [
                {
                  id: 'info',
                  title: `Quotation info · ${preview.status}`,
                  content: (
                    <div className="grid sm:grid-cols-2 gap-2 text-sm">
                      <div><span className="text-muted-foreground">Client: </span>{preview.clientName || '—'}</div>
                      <div><span className="text-muted-foreground">Date: </span>{preview.issueDate ?? preview.createdAt.slice(0, 10)}</div>
                      <div><span className="text-muted-foreground">Valid Until: </span>{preview.validUntil || '—'}</div>
                      <div><span className="text-muted-foreground">Status: </span>{preview.status}</div>
                      <div><span className="text-muted-foreground">Subtotal: </span>{fmtMoney(preview.subtotal, currency)}</div>
                      <div><span className="text-muted-foreground">Discount: </span>{fmtMoney(preview.discount, currency)}</div>
                      <div><span className="text-muted-foreground">Tax: </span>{fmtMoney(preview.tax, currency)}</div>
                      <div><span className="text-muted-foreground font-medium">Total: </span>{fmtMoney(preview.total, currency)}</div>
                      <div className="sm:col-span-2">
                        <span className="text-muted-foreground">Items: </span>
                        {preview.items.map((i) => `${i.description} ×${i.quantity}`).join('; ')}
                      </div>
                      <div><span className="text-muted-foreground">Order: </span>{preview.orderId ? preview.orderId.slice(-6) : '—'}</div>
                      <div><span className="text-muted-foreground">Invoice: </span>{preview.invoiceId ? preview.invoiceId.slice(-6) : '—'}</div>
                      {preview.notes && <div className="sm:col-span-2"><span className="text-muted-foreground">Notes: </span>{preview.notes}</div>}
                    </div>
                  ),
                },
              ]
            : []
        }
        history={preview ? { entity: 'quotations', id: preview.id } : undefined}
        previous={
          preview
            ? {
                rows: prevRows,
                render: (rows) => (
                  <ul className="text-sm space-y-1">
                    {(rows as Quotation[]).map((q) => (
                      <li key={q.id}>{q.number} · {q.status} · {fmtMoney(q.total, currency)}</li>
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
