'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowDownUp } from 'lucide-react';
import { toast } from 'sonner';
import {
  collectionQuery,
  createItem,
  fmtMoney,
  getCollection,
  logHistory,
  nameKeyOf,
  removeItem,
  updateItem,
  type CustomValue,
  type Product,
  type StockMovement,
} from '@/lib/db';
import { POLL_FAST_MS, useAppSettings } from '@/lib/realtime';
import { DataTable } from '@/components/ui/data-table';
import { CustomFieldsForm, customColumns } from '@/components/custom-fields';
import { RecordPreview } from '@/components/record-preview';

const EMPTY = { name: '', sku: '', category: 'Staples', unit: 'packet', stock: '0', price: '0', lowThreshold: '' };

const UNITS = ['piece', 'packet', 'bag', 'can', 'box', 'bottle', 'kg', 'L'];
const PRODUCT_CATEGORIES = ['Staples', 'Spices', 'Beverages', 'Dairy', 'Snacks', 'Samples', 'Cleaning', 'Packaging', 'Frozen', 'Other'];

export default function InventoryPage() {
  const { data: settings } = useAppSettings();
  const currency = settings?.currency ?? '₹';
  const defaultLow = settings?.lowStockThreshold ?? 10;
  const customDefs = settings?.customFields?.products ?? [];

  const [refreshKey, setRefreshKey] = useState(0);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [custom, setCustom] = useState<Record<string, CustomValue>>({});
  const [saving, setSaving] = useState(false);

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  const [movesOpen, setMovesOpen] = useState(false);
  const [movesProduct, setMovesProduct] = useState<Product | null>(null);
  const [moves, setMoves] = useState<StockMovement[]>([]);
  const [movesLoading, setMovesLoading] = useState(false);

  const [preview, setPreview] = useState<Product | null>(null);

  const fetchRows = useMemo(() => collectionQuery<Product>('products', 'createdAt', 'nameKey'), []);

  const startCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY, lowThreshold: String(defaultLow) });
    setCustom({});
    setOpen(true);
  };
  const startEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name,
      sku: p.sku,
      category: p.category,
      unit: p.unit,
      stock: String(p.stock ?? 0),
      price: String(p.price ?? 0),
      lowThreshold: String(p.lowThreshold ?? defaultLow),
    });
    setCustom(p.custom ?? {});
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.sku.trim()) {
      toast.error('Name and SKU are required');
      return;
    }
    setSaving(true);
    try {
      const data = {
        name: form.name.trim(),
        nameKey: nameKeyOf(form.name),
        sku: form.sku.trim().toUpperCase(),
        category: form.category,
        unit: form.unit,
        stock: Math.max(0, Number(form.stock) || 0),
        price: Math.max(0, Number(form.price) || 0),
        lowThreshold: Math.max(0, Number(form.lowThreshold) || 0),
        custom: Object.keys(custom).length > 0 ? custom : undefined,
      };
      if (editing) {
        await updateItem('products', editing.id, data);
        await logHistory('products', editing.id, 'Product updated');
      } else {
        const id = await createItem('products', data);
        await logHistory('products', id, 'Product created', `Opening stock ${data.stock} ${data.unit}`);
      }
      toast.success(editing ? 'Product updated' : 'Product added');
      setOpen(false);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p: Product) => {
    if (!window.confirm(`Delete product ${p.name}?`)) return;
    try {
      await removeItem('products', p.id);
      toast.success('Product deleted');
      setRefreshKey((k) => k + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const openAdjust = (p: Product) => {
    setAdjustProduct(p);
    setDelta('');
    setReason('');
    setAdjustOpen(true);
  };

  const doAdjust = async () => {
    if (!adjustProduct) return;
    const d = Number(delta);
    if (!delta.trim() || !Number.isFinite(d) || d === 0) {
      toast.error('Enter a non-zero quantity (negative = stock out)');
      return;
    }
    if (!reason.trim()) {
      toast.error('A reason is required for every stock adjustment');
      return;
    }
    if (adjustProduct.stock + d < 0) {
      toast.error(`Not enough stock (have ${adjustProduct.stock} ${adjustProduct.unit})`);
      return;
    }
    setAdjusting(true);
    try {
      const now = new Date().toISOString();
      await updateItem('products', adjustProduct.id, { stock: adjustProduct.stock + d });
      const mvId = await createItem('stockMovements', {
        productId: adjustProduct.id,
        productName: adjustProduct.name,
        delta: d,
        reason: reason.trim(),
        refType: 'adjustment',
        createdAt: now,
      });
      void mvId;
      await logHistory('products', adjustProduct.id, `Stock ${d > 0 ? '+' : ''}${d}`, reason.trim());
      toast.success('Stock adjusted');
      setAdjustOpen(false);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Adjustment failed');
    } finally {
      setAdjusting(false);
    }
  };

  const openMoves = async (p: Product) => {
    setMovesProduct(p);
    setMovesOpen(true);
    setMovesLoading(true);
    try {
      const all = await getCollection<StockMovement>('stockMovements');
      setMoves(all.filter((m) => m.productId === p.id).sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')));
    } finally {
      setMovesLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
        <p className="text-sm text-muted-foreground">Products, stock levels and movement history. Polls every 15s.</p>
      </div>

      <div key={refreshKey}>
        <DataTable<Product>
          title="Products"
          queryKey="products"
          fetchRows={fetchRows}
          searchPlaceholder="Search product…"
          filters={[{ field: 'category', label: 'Category', options: PRODUCT_CATEGORIES.map((c) => ({ value: c, label: c })) }]}
          defaultPageSize={settings?.defaultRowsPerPage ?? 25}
          pollMs={POLL_FAST_MS}
          addLabel="Add product"
          onAdd={startCreate}
          onEdit={startEdit}
          onDelete={remove}
          onPreview={setPreview}
          extraActions={(p) => (
            <>
              <Button variant="ghost" size="icon" title="Adjust stock" aria-label="Adjust stock" onClick={() => openAdjust(p)}>
                <ArrowDownUp size={16} />
              </Button>
            </>
          )}
          emptyTitle="No products"
          emptyHint="Add your first inventory product."
          columns={[
            { key: 'name', header: 'Product', render: (p) => p.name || '(blank — edit to fix)' },
            { key: 'sku', header: 'SKU', render: (p) => p.sku || '—' },
            { key: 'category', header: 'Category', render: (p) => <Badge variant="secondary">{p.category || '—'}</Badge> },
            {
              key: 'stock',
              header: 'Stock',
              render: (p) => (
                <span className="inline-flex items-center gap-2">
                  {p.stock} {p.unit}
                  {p.stock <= (p.lowThreshold ?? defaultLow) && <Badge variant="destructive">Low</Badge>}
                </span>
              ),
            },
            { key: 'price', header: 'Price', className: 'text-right', render: (p) => fmtMoney(p.price, currency) },
            ...customColumns<Product>(customDefs),
          ]}
        />
      </div>

      {/* Add / edit */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit product' : 'Add product'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>SKU *</Label>
                <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="RICE-25" />
              </div>
              <div className="grid gap-1.5">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUCT_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1.5">
                <Label>Unit</Label>
                <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Stock</Label>
                <Input type="number" min={0} value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label>Price (₹)</Label>
                <Input type="number" min={0} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Low-stock threshold</Label>
              <Input type="number" min={0} value={form.lowThreshold} onChange={(e) => setForm({ ...form, lowThreshold: e.target.value })} />
            </div>
            <CustomFieldsForm defs={customDefs} values={custom} onChange={setCustom} />
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

      {/* Stock adjustment */}
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust stock {adjustProduct ? `· ${adjustProduct.name}` : ''}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <p className="text-sm text-muted-foreground">
              Current: {adjustProduct?.stock ?? 0} {adjustProduct?.unit}. Use a negative number for stock-out.
            </p>
            <div className="grid gap-1.5">
              <Label>Quantity (+/−) *</Label>
              <Input type="number" value={delta} onChange={(e) => setDelta(e.target.value)} placeholder="-5" />
            </div>
            <div className="grid gap-1.5">
              <Label>Reason *</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Damaged, recount, sample…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustOpen(false)}>
              Cancel
            </Button>
            <Button onClick={doAdjust} disabled={adjusting}>
              {adjusting ? 'Saving…' : 'Apply'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Movement history */}
      <Dialog open={movesOpen} onOpenChange={setMovesOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Stock movements {movesProduct ? `· ${movesProduct.name}` : ''}</DialogTitle>
          </DialogHeader>
          {movesLoading ? (
            <p className="text-sm text-muted-foreground text-center py-6">Loading…</p>
          ) : moves.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No movements recorded.</p>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <table className="w-full text-sm min-w-[520px]">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">When</th>
                    <th className="pb-2 font-medium text-right">Delta</th>
                    <th className="pb-2 font-medium">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {moves.map((m) => (
                    <tr key={m.id} className="border-b last:border-0">
                      <td className="py-2">{new Date(m.createdAt).toLocaleString('en-IN')}</td>
                      <td className={`py-2 text-right font-medium ${m.delta < 0 ? 'text-destructive' : 'text-green-600'}`}>
                        {m.delta > 0 ? `+${m.delta}` : m.delta}
                      </td>
                      <td className="py-2">{m.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Preview */}
      <RecordPreview
        open={Boolean(preview)}
        onOpenChange={(o) => !o && setPreview(null)}
        title={preview ? `Product · ${preview.name}` : 'Product'}
        page="inventory"
        sections={
          preview
            ? [
                {
                  id: 'info',
                  title: 'Product info',
                  content: (
                    <div className="grid sm:grid-cols-2 gap-2 text-sm">
                      <div><span className="text-muted-foreground">SKU: </span>{preview.sku}</div>
                      <div><span className="text-muted-foreground">Category: </span>{preview.category}</div>
                      <div><span className="text-muted-foreground">Stock: </span>{preview.stock} {preview.unit} {preview.stock <= (preview.lowThreshold ?? defaultLow) && <Badge variant="destructive">Low</Badge>}</div>
                      <div><span className="text-muted-foreground">Price: </span>{fmtMoney(preview.price, currency)}</div>
                    </div>
                  ),
                },
                {
                  id: 'movements',
                  title: 'Stock movements',
                  content: (
                    <Button variant="outline" size="sm" onClick={() => { setPreview(null); openMoves(preview); }}>
                      View movement history
                    </Button>
                  ),
                },
              ]
            : []
        }
        history={preview ? { entity: 'products', id: preview.id } : undefined}
        previous={preview ? { rows: [], render: () => null } : undefined}
      />
    </div>
  );
}
