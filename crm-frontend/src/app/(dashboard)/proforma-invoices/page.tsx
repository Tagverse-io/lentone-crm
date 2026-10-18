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
import { Download, ExternalLink, Eye, FileCheck, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  PROFORMA_STATUSES,
  collectionQuery,
  convertProformaToOrderAndInvoiceAtomic,
  createItem,
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
  type ProformaInvoice,
  type Quotation,
} from '@/lib/db';
import { POLL_FAST_MS, useAppSettings } from '@/lib/realtime';
import { DataTable } from '@/components/ui/data-table';
import { RecordPreview } from '@/components/record-preview';
import { generateProformaInvoicePdf, downloadPdf as savePdf, openPdfPreview } from '@/lib/pdf-engine/generator';

export default function ProformaInvoicesPage() {
  const { data: settings } = useAppSettings();
  const currency = settings?.currency ?? '₹';

  const [clients, setClients] = useState<Client[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [open, setOpen] = useState(false);
  const [quotationId, setQuotationId] = useState('');
  const [validUntil, setValidUntil] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState<string | null>(null);

  const [preview, setPreview] = useState<ProformaInvoice | null>(null);

  const fetchRows = useMemo(() => collectionQuery<ProformaInvoice>('proformaInvoices', 'createdAt', 'numberKey'), []);

  const startCreate = () => {
    getCollection<Client>('clients').then(setClients).catch(() => undefined);
    getCollection<Quotation>('quotations').then(setQuotations).catch(() => undefined);
    setQuotationId('');
    setOpen(true);
  };

  const save = async () => {
    if (!quotationId) {
      toast.error('Select a quotation to generate a Proforma Invoice');
      return;
    }
    const q = quotations.find((x) => x.id === quotationId);
    if (!q) {
      toast.error('Quotation not found');
      return;
    }
    setSaving(true);
    try {
      const seq = await nextSequence('proformaInvoices');
      const piNumber = formatNumber(settings?.proformaPrefix ?? 'PI', seq);
      const client = clients.find((c) => c.id === q.clientId);
      const qRaw = q as any;
      const id = await createItem('proformaInvoices', {
        number: piNumber,
        numberKey: piNumber.toLowerCase(),
        clientId: q.clientId,
        clientName: client?.name ?? q.clientName,
        clientKey: client ? nameKeyOf(client.name) : q.clientKey,
        client_name: qRaw.client_name ?? qRaw.contact_person ?? client?.contactPerson,
        client_company: qRaw.client_company ?? client?.name ?? q.clientName,
        client_address: qRaw.client_address ?? qRaw.clientAddress ?? client?.address,
        client_email: qRaw.client_email ?? qRaw.clientEmail ?? client?.email,
        client_phone: qRaw.client_phone ?? qRaw.clientPhone ?? client?.phone,
        client_gstin: qRaw.client_gstin ?? qRaw.clientGstin ?? client?.gstin,
        clientCompany: qRaw.client_company ?? client?.name ?? q.clientName,
        clientAddress: qRaw.client_address ?? qRaw.clientAddress ?? client?.address,
        clientEmail: qRaw.client_email ?? qRaw.clientEmail ?? client?.email,
        clientPhone: qRaw.client_phone ?? qRaw.clientPhone ?? client?.phone,
        clientGstin: qRaw.client_gstin ?? qRaw.clientGstin ?? client?.gstin,
        cgst_percent: qRaw.cgst_percent,
        sgst_percent: qRaw.sgst_percent,
        igst_percent: qRaw.igst_percent,
        tax_amount: qRaw.tax_amount ?? q.tax,
        discount_amount: qRaw.discount_amount ?? q.discount,
        discount_percent: qRaw.discount_percent,
        quotationId: q.id,
        quotationNumber: q.number,
        items: q.items,
        subtotal: q.subtotal,
        tax: q.tax,
        discount: q.discount,
        total: q.total,
        status: 'Accepted',
        issueDate: new Date().toISOString().slice(0, 10),
        validUntil: validUntil || undefined,
        notes: notes || q.notes || undefined,
      });

      await updateItem('quotations', q.id, {
        proformaInvoiceId: id,
        status: 'Accepted',
      });

      await logHistory('proformaInvoices', id, 'Proforma invoice created', `From quotation ${q.number}`);
      await logHistory('quotations', q.id, 'Proforma invoice created', piNumber);

      toast.success(`Created proforma invoice ${piNumber}`);
      setOpen(false);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (pi: ProformaInvoice) => {
    if (!window.confirm(`Delete proforma invoice ${pi.number}?`)) return;
    try {
      await removeItem('proformaInvoices', pi.id);
      await logHistory('proformaInvoices', pi.id, 'Deleted');
      toast.success('Proforma invoice deleted');
      setRefreshKey((k) => k + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const convertToOrderAndInvoice = async (pi: ProformaInvoice) => {
    if (!window.confirm(`Convert proforma invoice ${pi.number} to a confirmed Order and final Invoice? Stock will be deducted.`)) {
      return;
    }
    setConverting(pi.id);
    try {
      const [oSeq, iSeq] = await Promise.all([nextSequence('orders'), nextSequence('invoices')]);
      const orderNumber = formatNumber(settings?.orderPrefix ?? 'ORD', oSeq);
      const invoiceNumber = formatNumber(settings?.invoicePrefix ?? 'INV', iSeq);
      const billTo = await billToFor(pi);
      const enrichedPi = {
        ...pi,
        client_name: billTo.name || (pi as any).client_name,
        client_company: billTo.company || (pi as any).client_company || pi.clientName,
        client_address: billTo.address || (pi as any).client_address,
        client_email: billTo.email || (pi as any).client_email,
        client_phone: billTo.phone || (pi as any).client_phone,
        client_gstin: billTo.gstin || (pi as any).client_gstin,
        clientName: billTo.company || pi.clientName,
      };
      await convertProformaToOrderAndInvoiceAtomic(enrichedPi as ProformaInvoice, { orderNumber, invoiceNumber });
      toast.success(`Converted: order ${orderNumber}, invoice ${invoiceNumber}`);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Conversion failed');
    } finally {
      setConverting(null);
    }
  };

  const billToFor = async (pi: ProformaInvoice) => {
    const raw = pi as any;
    const c = clients.find((x) => 
      (x.id && x.id === pi.clientId) || 
      (x.name && (x.name.toLowerCase() === (pi.clientName || '').toLowerCase() || x.name.toLowerCase() === (raw.client_company || '').toLowerCase()))
    ) ?? (pi.clientId ? await getItem<Client>('clients', pi.clientId).catch(() => null) : null);

    return {
      name: raw.client_name || raw.contact_person || raw.contactPerson || c?.contactPerson || c?.name || pi.clientName || '',
      company: raw.client_company || raw.clientCompany || c?.name || pi.clientName || '',
      address: raw.client_address || raw.clientAddress || raw.address || c?.address || '',
      email: raw.client_email || raw.clientEmail || raw.email || c?.email || '',
      phone: raw.client_phone || raw.clientPhone || raw.phone || c?.phone || '',
      gstin: raw.client_gstin || raw.clientGstin || raw.gstin || c?.gstin || '',
    };
  };

  const downloadPdf = async (pi: ProformaInvoice) => {
    const id = toast.loading('Generating PDF…');
    try {
      const billTo = await billToFor(pi);
      const raw = pi as any;
      const proformaPayload = {
        ...pi,
        number: pi.number,
        issue_date: pi.issueDate ?? pi.createdAt?.slice(0, 10),
        valid_until: pi.validUntil,
        client_name: billTo.name || raw.client_name || pi.clientName,
        clientName: billTo.name || raw.client_name || pi.clientName,
        client_company: billTo.company || raw.client_company || pi.clientName,
        clientCompany: billTo.company || raw.client_company || pi.clientName,
        client_address: billTo.address || raw.client_address || raw.clientAddress || '',
        clientAddress: billTo.address || raw.client_address || raw.clientAddress || '',
        client_email: billTo.email || raw.client_email || raw.clientEmail || '',
        clientEmail: billTo.email || raw.client_email || raw.clientEmail || '',
        client_phone: billTo.phone || raw.client_phone || raw.clientPhone || '',
        clientPhone: billTo.phone || raw.client_phone || raw.clientPhone || '',
        client_gstin: billTo.gstin || raw.client_gstin || raw.clientGstin || '',
        clientGstin: billTo.gstin || raw.client_gstin || raw.clientGstin || '',
        amount: pi.total,
        total: pi.total,
        items: (pi.items ?? []).map((it: any) => ({
          name: it.name || it.description || '',
          description: it.description || '',
          quantity: Number(it.quantity) || 1,
          unit: it.unit || 'pcs',
          unit_price: Number(it.unitPrice ?? it.unit_price) || 0,
          unitPrice: Number(it.unitPrice ?? it.unit_price) || 0,
          total: Number(it.total) || (Number(it.quantity) || 1) * (Number(it.unitPrice ?? it.unit_price) || 0),
        })),
        notes: pi.notes,
      };
      const doc = await generateProformaInvoicePdf('', proformaPayload, billTo as any);
      await savePdf(doc, `Proforma-${pi.number || pi.id}.pdf`);
      toast.success('Proforma downloaded', { id });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'PDF generation failed', { id });
    }
  };

  const previewPdf = async (pi: ProformaInvoice) => {
    const id = toast.loading('Generating preview…');
    try {
      const billTo = await billToFor(pi);
      const raw = pi as any;
      const proformaPayload = {
        ...pi,
        number: pi.number,
        issue_date: pi.issueDate ?? pi.createdAt?.slice(0, 10),
        valid_until: pi.validUntil,
        client_name: billTo.name || raw.client_name || pi.clientName,
        clientName: billTo.name || raw.client_name || pi.clientName,
        client_company: billTo.company || raw.client_company || pi.clientName,
        clientCompany: billTo.company || raw.client_company || pi.clientName,
        client_address: billTo.address || raw.client_address || raw.clientAddress || '',
        clientAddress: billTo.address || raw.client_address || raw.clientAddress || '',
        client_email: billTo.email || raw.client_email || raw.clientEmail || '',
        clientEmail: billTo.email || raw.client_email || raw.clientEmail || '',
        client_phone: billTo.phone || raw.client_phone || raw.clientPhone || '',
        clientPhone: billTo.phone || raw.client_phone || raw.clientPhone || '',
        client_gstin: billTo.gstin || raw.client_gstin || raw.clientGstin || '',
        clientGstin: billTo.gstin || raw.client_gstin || raw.clientGstin || '',
        amount: pi.total,
        total: pi.total,
        items: (pi.items ?? []).map((it: any) => ({
          name: it.name || it.description || '',
          description: it.description || '',
          quantity: Number(it.quantity) || 1,
          unit: it.unit || 'pcs',
          unit_price: Number(it.unitPrice ?? it.unit_price) || 0,
          unitPrice: Number(it.unitPrice ?? it.unit_price) || 0,
          total: Number(it.total) || (Number(it.quantity) || 1) * (Number(it.unitPrice ?? it.unit_price) || 0),
        })),
        notes: pi.notes,
      };
      const doc = await generateProformaInvoicePdf('', proformaPayload, billTo as any);
      const url = await openPdfPreview(doc);
      window.open(url, '_blank');
      toast.dismiss(id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'PDF preview failed', { id });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Proforma Invoices</h1>
          <p className="text-sm text-muted-foreground">
            Manage pre-shipment invoices, quotations in progress, and conversion to confirmed orders.
          </p>
        </div>
        <Button onClick={startCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          <span>New proforma invoice</span>
        </Button>
      </div>

      <div key={refreshKey}>
        <DataTable<ProformaInvoice>
          title="All proforma invoices"
          queryKey="proformaInvoices"
          fetchRows={fetchRows}
          searchPlaceholder="Search number…"
          filters={[{ field: 'status', label: 'Status', options: PROFORMA_STATUSES.map((s) => ({ value: s, label: s })) }]}
          defaultPageSize={settings?.defaultRowsPerPage ?? 25}
          pollMs={POLL_FAST_MS}
          addLabel="New proforma invoice"
          onAdd={startCreate}
          extraActions={(pi: ProformaInvoice) => (
            <div className="flex items-center gap-1.5 justify-end">
              {pi.status !== 'Invoiced' && !pi.orderId && !pi.invoiceId && (
                <Button
                  size="sm"
                  className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm"
                  onClick={() => convertToOrderAndInvoice(pi)}
                  disabled={converting === pi.id}
                >
                  <FileCheck className="h-3.5 w-3.5" />
                  <span>Convert</span>
                </Button>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 p-0" aria-label="More actions">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem onClick={() => setPreview(pi)}>
                    <Eye className="h-4 w-4 mr-2 text-muted-foreground" />
                    <span>View details</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => previewPdf(pi)}>
                    <ExternalLink className="h-4 w-4 mr-2 text-muted-foreground" />
                    <span>Preview PDF</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => downloadPdf(pi)}>
                    <Download className="h-4 w-4 mr-2 text-muted-foreground" />
                    <span>Download PDF</span>
                  </DropdownMenuItem>
                  {pi.status !== 'Invoiced' && !pi.orderId && !pi.invoiceId && (
                    <DropdownMenuItem
                      onClick={() => convertToOrderAndInvoice(pi)}
                      disabled={converting === pi.id}
                    >
                      <FileCheck className="h-4 w-4 mr-2 text-emerald-600" />
                      <span className="text-emerald-600 font-medium">Convert to Order & Invoice</span>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => remove(pi)} className="text-destructive focus:text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    <span>Delete</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
          emptyTitle="No proforma invoices"
          emptyHint="Generate a proforma invoice from an accepted quotation."
          columns={[
            {
              key: 'number',
              header: 'Number',
              render: (pi: ProformaInvoice) => <span className="font-medium text-foreground">{pi.number}</span>,
            },
            {
              key: 'clientName',
              header: 'Client',
              render: (pi: ProformaInvoice) => pi.clientName || '—',
            },
            {
              key: 'quotationNumber',
              header: 'Quotation',
              render: (pi: ProformaInvoice) => pi.quotationNumber || '—',
            },
            {
              key: 'total',
              header: 'Total',
              className: 'text-right',
              render: (pi: ProformaInvoice) => fmtMoney(pi.total, currency),
            },
            {
              key: 'status',
              header: 'Status',
              render: (pi: ProformaInvoice) => {
                const variant =
                  pi.status === 'Invoiced'
                    ? 'default'
                    : pi.status === 'Accepted'
                    ? 'secondary'
                    : 'outline';
                return <Badge variant={variant}>{pi.status}</Badge>;
              },
            },
          ]}
        />
      </div>

      {/* Create Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New proforma invoice</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>Source quotation *</Label>
              <Select value={quotationId} onValueChange={setQuotationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a quotation" />
                </SelectTrigger>
                <SelectContent>
                  {quotations.map((q) => (
                    <SelectItem key={q.id} value={q.id}>
                      {q.number} · {q.clientName ?? 'Unnamed'} · {fmtMoney(q.total, currency)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Valid until</Label>
              <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Notes (optional)</Label>
              <Input
                placeholder="Payment terms, delivery estimates..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? 'Creating...' : 'Create proforma invoice'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Preview Modal */}
      {preview && (
        <RecordPreview
          open={!!preview}
          onOpenChange={(v) => !v && setPreview(null)}
          title={`Proforma Invoice ${preview.number}`}
          page="proforma-invoices"
          history={{ entity: 'proformaInvoices', id: preview.id }}
          sections={[
            {
              id: 'info',
              title: `Proforma Details · ${preview.status}`,
              content: (
                <div className="grid sm:grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">Client: </span>{preview.clientName || '—'}</div>
                  <div><span className="text-muted-foreground">Source Quote: </span>{preview.quotationNumber || '—'}</div>
                  <div><span className="text-muted-foreground">Date: </span>{preview.issueDate ?? preview.createdAt.slice(0, 10)}</div>
                  <div><span className="text-muted-foreground">Valid Until: </span>{preview.validUntil || '—'}</div>
                  <div><span className="text-muted-foreground">Status: </span>{preview.status}</div>
                  <div><span className="text-muted-foreground">Subtotal: </span>{fmtMoney(preview.subtotal, currency)}</div>
                  <div><span className="text-muted-foreground">Discount: </span>{fmtMoney(preview.discount, currency)}</div>
                  <div><span className="text-muted-foreground">Tax: </span>{fmtMoney(preview.tax, currency)}</div>
                  <div><span className="text-muted-foreground font-medium">Total: </span>{fmtMoney(preview.total, currency)}</div>
                  {preview.notes && (
                    <div className="sm:col-span-2"><span className="text-muted-foreground">Notes: </span>{preview.notes}</div>
                  )}
                  <div className="sm:col-span-2">
                    <span className="text-muted-foreground">Items: </span>
                    {preview.items.map((i: any) => `${i.name || i.description || 'Item'} ×${i.quantity}`).join('; ')}
                  </div>
                </div>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
