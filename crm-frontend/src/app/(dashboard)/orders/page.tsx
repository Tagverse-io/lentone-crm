'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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
import { ExternalLink, Eye, MoreHorizontal, Pencil, Trash2, Truck } from 'lucide-react';
import { toast } from 'sonner';
import {
  ORDER_STATUSES,
  calcTotals,
  collectionQuery,
  createItem,
  filterEqual,
  fmtMoney,
  formatNumber,
  getCollection,
  logHistory,
  nameKeyOf,
  nextSequence,
  removeItem,
  splitLegacy,
  updateItem,
  type Client,
  type Order,
  type OrderLineItem,
  type OrderStatus,
  type Product,
  type Worker,
} from '@/lib/db';
import { POLL_FAST_MS, useAppSettings } from '@/lib/realtime';
import { DataTable } from '@/components/ui/data-table';
import { LineItemsEditor } from '@/components/line-items-editor';
import { RecordPreview } from '@/components/record-preview';

const EMPTY_ITEM: OrderLineItem = { description: '', quantity: 1, unitPrice: 0 };

export default function OrdersPage() {
  const { data: settings } = useAppSettings();
  const currency = settings?.currency ?? '₹';
  const taxRate = settings?.taxRate ?? 18;

  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Order | null>(null);
  const [clientId, setClientId] = useState('');
  const [items, setItems] = useState<OrderLineItem[]>([{ ...EMPTY_ITEM }]);
  const [discount, setDiscount] = useState('0');
  const [status, setStatus] = useState<OrderStatus>('Draft');
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<Order | null>(null);
  const [prevRows, setPrevRows] = useState<Order[]>([]);

  // Dispatch Delivery modal state
  const [dispatchOrder, setDispatchOrder] = useState<Order | null>(null);
  const [dispatchWorkerId, setDispatchWorkerId] = useState('');
  const [dispatching, setDispatching] = useState(false);

  const fetchRows = useMemo(() => collectionQuery<Order>('orders', 'createdAt', 'numberKey'), []);

  const loadRefs = async () => {
    const [cs, ps, ws] = await Promise.all([
      getCollection<Client>('clients'),
      getCollection<Product>('products'),
      getCollection<Worker>('workers'),
    ]);
    setClients(cs);
    setProducts(ps);
    setWorkers(ws);
  };

  const startCreate = () => {
    loadRefs().catch(() => undefined);
    setEditing(null);
    setClientId('');
    setItems([{ ...EMPTY_ITEM }]);
    setDiscount('0');
    setStatus('Draft');
    setOpen(true);
  };
  const startEdit = (o: Order) => {
    loadRefs().catch(() => undefined);
    setEditing(o);
    setClientId(o.clientId);
    setItems(o.items.length > 0 ? o.items.map((i) => ({ ...i })) : [{ ...EMPTY_ITEM }]);
    setDiscount(String(o.discount ?? 0));
    setStatus(o.status);
    setOpen(true);
  };

  const totals = calcTotals(items.filter((i) => i.description.trim()), taxRate, Number(discount) || 0);

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
      };
      if (editing) {
        await updateItem('orders', editing.id, data);
        await logHistory('orders', editing.id, 'Order updated', `Total ${t.total}`);
        toast.success('Order updated');
      } else {
        const seq = await nextSequence('orders');
        const number = formatNumber(settings?.orderPrefix ?? 'ORD', seq);
        const id = await createItem('orders', { number, numberKey: number.toLowerCase(), ...data });
        await logHistory('orders', id, 'Order created', `${number} · total ${t.total}`);
        toast.success(`Order ${number} created`);
      }
      setOpen(false);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (o: Order) => {
    if (!window.confirm(`Delete order ${o.number}?`)) return;
    try {
      await removeItem('orders', o.id);
      toast.success('Order deleted');
      setRefreshKey((k) => k + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const openPreview = async (o: Order) => {
    setPreview(o);
    try {
      const all = await filterEqual<Order>('orders', 'clientId', o.clientId);
      setPrevRows(splitLegacy(all.filter((x) => x.id !== o.id)).previous);
    } catch {
      setPrevRows([]);
    }
  };

  const openDispatch = (o: Order) => {
    loadRefs().catch(() => undefined);
    setDispatchOrder(o);
    setDispatchWorkerId('');
  };

  const submitDispatch = async () => {
    if (!dispatchOrder) return;
    setDispatching(true);
    try {
      const client = clients.find((c) => c.id === dispatchOrder.clientId);
      const worker = workers.find((w) => w.id === dispatchWorkerId);
      const deliveryId = await createItem('deliveries', {
        clientId: dispatchOrder.clientId,
        clientName: dispatchOrder.clientName || client?.name,
        clientKey: dispatchOrder.clientName ? nameKeyOf(dispatchOrder.clientName) : undefined,
        orderId: dispatchOrder.id,
        invoiceId: dispatchOrder.invoiceId || undefined,
        workerId: dispatchWorkerId || undefined,
        workerName: worker?.name,
        status: 'Pending',
        mapsUrl: dispatchOrder.mapsUrl || client?.mapsUrl || undefined,
      });
      await updateItem('orders', dispatchOrder.id, { deliveryId });
      await logHistory('orders', dispatchOrder.id, 'Delivery created', `Assigned to ${worker?.name || 'Unassigned'}`);
      await logHistory('deliveries', deliveryId, 'Delivery created', `From order ${dispatchOrder.number}`);
      toast.success(`Delivery created for order ${dispatchOrder.number}`);
      setDispatchOrder(null);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to dispatch delivery');
    } finally {
      setDispatching(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
        <p className="text-sm text-muted-foreground">Client orders with inventory line items. Polls every 15s.</p>
      </div>

      <div key={refreshKey}>
        <DataTable<Order>
          title="All orders"
          queryKey="orders"
          fetchRows={fetchRows}
          searchPlaceholder="Search order number…"
          filters={[{ field: 'status', label: 'Status', options: ORDER_STATUSES.map((s) => ({ value: s, label: s })) }]}
          defaultPageSize={settings?.defaultRowsPerPage ?? 25}
          pollMs={POLL_FAST_MS}
          addLabel="New order"
          onAdd={startCreate}
          extraActions={(o) => (
            <div className="flex items-center gap-1.5 justify-end">
              {o.deliveryId ? (
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
                  onClick={() => openDispatch(o)}
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
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => openPreview(o)}>
                    <Eye className="h-4 w-4 mr-2 text-muted-foreground" />
                    <span>View details</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => startEdit(o)}>
                    <Pencil className="h-4 w-4 mr-2 text-muted-foreground" />
                    <span>Edit order</span>
                  </DropdownMenuItem>
                  {!o.deliveryId && (
                    <DropdownMenuItem onClick={() => openDispatch(o)}>
                      <Truck className="h-4 w-4 mr-2 text-blue-600" />
                      <span className="text-blue-600 font-medium">Dispatch Delivery</span>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => remove(o)} className="text-destructive focus:text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    <span>Delete</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
          emptyTitle="No orders"
          emptyHint="Create an order, or use Assign Work on the Field Force page."
          columns={[
            { key: 'number', header: 'Number', render: (o) => <span className="font-medium">{o.number}</span> },
            { key: 'clientName', header: 'Client', render: (o) => o.clientName || '—' },
            { key: 'total', header: 'Total', className: 'text-right', render: (o) => fmtMoney(o.total, currency) },
            { key: 'status', header: 'Status', render: (o) => <Badge variant={o.status === 'Delivered' ? 'default' : 'secondary'}>{o.status}</Badge> },
          ]}
        />
      </div>

      {/* Dispatch Delivery Modal */}
      <Dialog open={Boolean(dispatchOrder)} onOpenChange={(o) => !o && setDispatchOrder(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Dispatch Delivery · {dispatchOrder?.number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Assign a field worker to deliver order <strong className="text-foreground">{dispatchOrder?.number}</strong> for <strong className="text-foreground">{dispatchOrder?.clientName || 'the client'}</strong>.
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
            <Button variant="outline" onClick={() => setDispatchOrder(null)}>
              Cancel
            </Button>
            <Button onClick={submitDispatch} disabled={dispatching}>
              {dispatching ? 'Dispatching…' : 'Confirm Dispatch'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.number}` : 'New order'}</DialogTitle>
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
                <Select value={status} onValueChange={(v) => setStatus(v as OrderStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ORDER_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <LineItemsEditor items={items} onChange={setItems} products={products} currency={currency} showStock={false} />
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
        title={preview ? `Order · ${preview.number}` : 'Order'}
        page="orders"
        sections={
          preview
            ? [
                {
                  id: 'info',
                  title: `Order info · ${preview.status}`,
                  content: (
                    <div className="grid sm:grid-cols-2 gap-2 text-sm">
                      <div><span className="text-muted-foreground">Client: </span>{preview.clientName || '—'}</div>
                      <div><span className="text-muted-foreground">Created: </span>{preview.createdAt.slice(0, 10)}</div>
                      <div><span className="text-muted-foreground">Subtotal: </span>{fmtMoney(preview.subtotal, currency)}</div>
                      <div><span className="text-muted-foreground">Discount: </span>{fmtMoney(preview.discount, currency)}</div>
                      <div><span className="text-muted-foreground">Tax: </span>{fmtMoney(preview.tax, currency)}</div>
                      <div><span className="text-muted-foreground font-medium">Total: </span>{fmtMoney(preview.total, currency)}</div>
                      {preview.mapsUrl && (
                        <div className="sm:col-span-2">
                          <a href={preview.mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                            Open map <ExternalLink size={14} />
                          </a>
                        </div>
                      )}
                      <div className="sm:col-span-2">
                        <span className="text-muted-foreground">Items: </span>
                        {preview.items.map((i) => `${i.description} ×${i.quantity}`).join('; ')}
                      </div>
                      <div><span className="text-muted-foreground">Invoice: </span>{preview.invoiceId ? preview.invoiceId.slice(-6) : '—'}</div>
                      <div><span className="text-muted-foreground">Delivery: </span>{preview.deliveryId ? preview.deliveryId.slice(-6) : '—'}</div>
                    </div>
                  ),
                },
              ]
            : []
        }
        history={preview ? { entity: 'orders', id: preview.id } : undefined}
        previous={
          preview
            ? {
                rows: prevRows,
                render: (rows) => (
                  <ul className="text-sm space-y-1">
                    {(rows as Order[]).map((o) => (
                      <li key={o.id}>{o.number} · {o.status} · {fmtMoney(o.total, currency)}</li>
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
