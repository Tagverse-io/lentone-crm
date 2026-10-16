'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Camera, CheckCircle, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  DELIVERY_STATUSES,
  collectionQuery,
  completeDeliveryCascade,
  createItem,
  filterEqual,
  fmtMoney,
  getCollection,
  getDeliveryProof,
  isMapsUrl,
  logHistory,
  nameKeyOf,
  removeItem,
  splitLegacy,
  updateItem,
  type Client,
  type Delivery,
  type DeliveryStatus,
  type Invoice,
  type Order,
  type Worker,
} from '@/lib/db';
import { POLL_FAST_MS, useAppSettings } from '@/lib/realtime';
import { DataTable } from '@/components/ui/data-table';
import { RecordPreview } from '@/components/record-preview';

const EMPTY = { clientId: '', invoiceId: '', orderId: '', workerId: '', status: 'Pending' as DeliveryStatus, mapsUrl: '' };

export default function DeliveriesPage() {
  const { data: settings } = useAppSettings();
  const currency = settings?.currency ?? '₹';

  const [clients, setClients] = useState<Client[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState<string | null>(null);

  const [proofOpen, setProofOpen] = useState(false);
  const [proofDelivery, setProofDelivery] = useState<Delivery | null>(null);
  const [proofSrc, setProofSrc] = useState<string | null>(null);
  const [proofLoading, setProofLoading] = useState(false);

  const [preview, setPreview] = useState<Delivery | null>(null);
  const [prevRows, setPrevRows] = useState<Delivery[]>([]);

  const fetchRows = useMemo(() => collectionQuery<Delivery>('deliveries', 'createdAt', 'clientKey'), []);

  const loadRefs = () => {
    getCollection<Client>('clients').then(setClients).catch(() => undefined);
    getCollection<Invoice>('invoices').then(setInvoices).catch(() => undefined);
    getCollection<Order>('orders').then(setOrders).catch(() => undefined);
    getCollection<Worker>('workers').then(setWorkers).catch(() => undefined);
  };

  const startCreate = () => {
    loadRefs();
    setForm(EMPTY);
    setOpen(true);
  };

  const save = async () => {
    if (!form.clientId) {
      toast.error('Client is required');
      return;
    }
    if (form.mapsUrl.trim() && !isMapsUrl(form.mapsUrl.trim())) {
      toast.error('Map URL must be a Google Maps link (maps.google.com, google.com/maps or maps.app.goo.gl)');
      return;
    }
    setSaving(true);
    try {
      const client = clients.find((c) => c.id === form.clientId);
      const worker = workers.find((w) => w.id === form.workerId);
      const inv = invoices.find((i) => i.id === form.invoiceId);
      const ord = orders.find((o) => o.id === form.orderId);
      const id = await createItem('deliveries', {
        clientId: form.clientId,
        clientName: client?.name,
        clientKey: client ? nameKeyOf(client.name) : undefined,
        invoiceId: form.invoiceId || inv?.id || undefined,
        orderId: form.orderId || ord?.id || undefined,
        workerId: form.workerId || undefined,
        workerName: worker?.name,
        status: form.status,
        mapsUrl: form.mapsUrl.trim() || undefined,
      });
      await logHistory('deliveries', id, 'Delivery created', `Status ${form.status}`);
      toast.success('Delivery created');
      setOpen(false);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (d: Delivery) => {
    if (!window.confirm('Delete this delivery?')) return;
    try {
      await removeItem('deliveries', d.id);
      toast.success('Delivery deleted');
      setRefreshKey((k) => k + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  /** Delivered → task Done + order Delivered + history (same cascade as the Expo webhook). */
  const markDelivered = async (d: Delivery) => {
    if (d.status === 'Delivered') {
      toast.success('Already delivered');
      return;
    }
    if (!window.confirm(`Mark delivery for ${d.clientName || 'client'} as Delivered? Linked task and order update too.`)) return;
    setCompleting(d.id);
    try {
      await completeDeliveryCascade(d.id);
      toast.success('Delivered — task and order updated');
      setRefreshKey((k) => k + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setCompleting(null);
    }
  };

  const advance = async (d: Delivery) => {
    if (d.status === 'Out for Delivery') {
      await markDelivered(d);
      return;
    }
    const next: DeliveryStatus = d.status === 'Pending' ? 'Out for Delivery' : 'Pending';
    try {
      await updateItem('deliveries', d.id, { status: next });
      await logHistory('deliveries', d.id, `Status → ${next}`);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    }
  };

  const openProof = async (d: Delivery) => {
    setProofDelivery(d);
    setProofSrc(null);
    setProofOpen(true);
    setProofLoading(true);
    try {
      const b64 = await getDeliveryProof(d.id);
      if (!b64) {
        toast.error('No photo proof for this delivery yet');
        setProofOpen(false);
        return;
      }
      setProofSrc(`data:image/jpeg;base64,${b64}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not load proof');
      setProofOpen(false);
    } finally {
      setProofLoading(false);
    }
  };

  const openPreview = async (d: Delivery) => {
    setPreview(d);
    try {
      const all = await filterEqual<Delivery>('deliveries', 'clientId', d.clientId);
      setPrevRows(splitLegacy(all.filter((x) => x.id !== d.id)).previous);
    } catch {
      setPrevRows([]);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Delivery</h1>
        <p className="text-sm text-muted-foreground">Click a status badge to advance it. Delivering completes the linked task and order. Polls every 15s.</p>
      </div>

      <div key={refreshKey}>
        <DataTable<Delivery>
          title="All deliveries"
          queryKey="deliveries"
          fetchRows={fetchRows}
          searchPlaceholder="Search client…"
          filters={[{ field: 'status', label: 'Status', options: DELIVERY_STATUSES.map((s) => ({ value: s, label: s })) }]}
          defaultPageSize={settings?.defaultRowsPerPage ?? 25}
          pollMs={POLL_FAST_MS}
          addLabel="New delivery"
          onAdd={startCreate}
          onDelete={remove}
          onPreview={openPreview}
          extraActions={(d) => (
            d.status !== 'Delivered' ? (
              <Button variant="ghost" size="icon" title="Mark delivered (updates task + order)" aria-label="Mark delivered" onClick={() => markDelivered(d)} disabled={completing === d.id}>
                <CheckCircle size={16} />
              </Button>
            ) : null
          )}
          emptyTitle="No deliveries"
          emptyHint="Link a delivery to an order to track it."
          columns={[
            { key: 'clientName', header: 'Client', render: (d) => <span className="font-medium">{d.clientName || '(blank — edit via order)'}</span> },
            { key: 'workerName', header: 'Worker', render: (d) => d.workerName || '—' },
            {
              key: 'status',
              header: 'Status',
              render: (d) => (
                <button onClick={() => advance(d)} title="Click to advance status">
                  <Badge variant={d.status === 'Delivered' ? 'default' : 'secondary'}>{d.status}</Badge>
                </button>
              ),
            },
            {
              key: 'mapsUrl',
              header: 'Drop location',
              render: (d) =>
                d.mapsUrl ? (
                  <a href={d.mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline text-sm">
                    View location <ExternalLink size={14} />
                  </a>
                ) : (
                  '—'
                ),
            },
            {
              key: 'proofAt',
              header: 'Proof',
              render: (d) =>
                d.proofAt ? (
                  <button onClick={() => openProof(d)} className="inline-flex items-center gap-1 text-sm text-primary hover:underline" title="Click to enlarge">
                    <Camera size={16} /> View proof
                  </button>
                ) : (
                  '—'
                ),
            },
          ]}
        />
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New delivery</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Client *</Label>
                <Select value={form.clientId || 'none'} onValueChange={(v) => setForm({ ...form, clientId: v === 'none' ? '' : v })}>
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
                <Label>Worker</Label>
                <Select value={form.workerId || 'none'} onValueChange={(v) => setForm({ ...form, workerId: v === 'none' ? '' : v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select worker" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {workers.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Order</Label>
                <Select value={form.orderId || 'none'} onValueChange={(v) => setForm({ ...form, orderId: v === 'none' ? '' : v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select order" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No order link</SelectItem>
                    {orders.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.number} · {o.clientName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Invoice</Label>
                <Select value={form.invoiceId || 'none'} onValueChange={(v) => setForm({ ...form, invoiceId: v === 'none' ? '' : v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select invoice" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No invoice link</SelectItem>
                    {invoices.map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.number} · {fmtMoney(i.total, currency)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as DeliveryStatus })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DELIVERY_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Drop Google Maps URL</Label>
                <Input value={form.mapsUrl} onChange={(e) => setForm({ ...form, mapsUrl: e.target.value })} placeholder="https://www.google.com/maps?q=lat,lng" />
              </div>
            </div>
            {form.mapsUrl.trim() && !isMapsUrl(form.mapsUrl.trim()) && (
              <p className="text-xs text-destructive">Must be a maps.google.com, google.com/maps or maps.app.goo.gl link.</p>
            )}
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

      <Dialog open={proofOpen} onOpenChange={setProofOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Proof of delivery {proofDelivery ? `· ${proofDelivery.clientName}` : ''}</DialogTitle>
          </DialogHeader>
          {proofLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : proofSrc ? (
            <div className="relative w-full aspect-[4/3]">
              <Image src={proofSrc} alt="Proof of delivery" fill className="object-contain rounded-lg" unoptimized />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No photo available.</p>
          )}
        </DialogContent>
      </Dialog>

      <RecordPreview
        open={Boolean(preview)}
        onOpenChange={(o) => !o && setPreview(null)}
        title={preview ? `Delivery · ${preview.clientName}` : 'Delivery'}
        page="deliveries"
        sections={
          preview
            ? [
                {
                  id: 'info',
                  title: `Delivery info · ${preview.status}`,
                  content: (
                    <div className="grid sm:grid-cols-2 gap-2 text-sm">
                      <div><span className="text-muted-foreground">Client: </span>{preview.clientName || '—'}</div>
                      <div><span className="text-muted-foreground">Worker: </span>{preview.workerName || '—'}</div>
                      <div><span className="text-muted-foreground">Task: </span>{preview.taskId ? preview.taskId.slice(-6) : '—'}</div>
                      <div><span className="text-muted-foreground">Order: </span>{preview.orderId ? preview.orderId.slice(-6) : '—'}</div>
                      <div><span className="text-muted-foreground">Invoice: </span>{preview.invoiceId ? preview.invoiceId.slice(-6) : '—'}</div>
                      <div><span className="text-muted-foreground">Proof at: </span>{preview.proofAt ? new Date(preview.proofAt).toLocaleString('en-IN') : '—'}</div>
                      {preview.mapsUrl && (
                        <div className="sm:col-span-2">
                          <a href={preview.mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                            Open map <ExternalLink size={14} />
                          </a>
                        </div>
                      )}
                      {preview.proofAt && (
                        <div className="sm:col-span-2">
                          <Button variant="outline" size="sm" onClick={() => { setPreview(null); openProof(preview); }}>
                            <Camera size={16} className="mr-2" /> View photo proof
                          </Button>
                        </div>
                      )}
                    </div>
                  ),
                },
              ]
            : []
        }
        history={preview ? { entity: 'deliveries', id: preview.id } : undefined}
        previous={
          preview
            ? {
                rows: prevRows,
                render: (rows) => (
                  <ul className="text-sm space-y-1">
                    {(rows as Delivery[]).map((d) => (
                      <li key={d.id}>{d.status} · {d.workerName || '—'}</li>
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
