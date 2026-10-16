'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, ExternalLink, Camera, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  DELIVERY_STATUSES,
  createItem,
  getCollection,
  getDeliveryProof,
  removeItem,
  subscribeDeliveries,
  updateItem,
  type Client,
  type Delivery,
  type DeliveryStatus,
  type Invoice,
  type Worker,
} from '@/lib/db';
import { EmptyState, LoadingState } from '@/components/ui/states';

const EMPTY = { clientId: '', invoiceId: '', workerId: '', status: 'Pending' as DeliveryStatus, mapsUrl: '' };

export default function DeliveriesPage() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  // Proof viewer: base64 loads ONLY when a thumbnail is clicked.
  const [proofOpen, setProofOpen] = useState(false);
  const [proofDelivery, setProofDelivery] = useState<Delivery | null>(null);
  const [proofSrc, setProofSrc] = useState<string | null>(null);
  const [proofLoading, setProofLoading] = useState(false);

  useEffect(() => {
    getCollection<Client>('clients').then(setClients).catch(() => undefined);
    getCollection<Invoice>('invoices').then(setInvoices).catch(() => undefined);
    getCollection<Worker>('workers').then(setWorkers).catch(() => undefined);
    return subscribeDeliveries(
      (list) => {
        setDeliveries(list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, []);

  if (loading) return <LoadingState label="Loading deliveries…" />;

  const startCreate = () => { setForm(EMPTY); setOpen(true); };

  const save = async () => {
    if (!form.clientId) {
      toast.error('Client is required');
      return;
    }
    if (form.mapsUrl && !/^https:\/\/www\.google\.com\/maps\?q=-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(form.mapsUrl)) {
      toast.error('Map URL must look like https://www.google.com/maps?q=lat,lng');
      return;
    }
    setSaving(true);
    try {
      const client = clients.find((c) => c.id === form.clientId);
      const worker = workers.find((w) => w.id === form.workerId);
      await createItem('deliveries', {
        clientId: form.clientId,
        clientName: client?.name,
        invoiceId: form.invoiceId || undefined,
        workerId: form.workerId || undefined,
        workerName: worker?.name,
        status: form.status,
        mapsUrl: form.mapsUrl || undefined,
      });
      toast.success('Delivery created');
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const advance = async (d: Delivery) => {
    const next: DeliveryStatus =
      d.status === 'Pending' ? 'Out for Delivery' : d.status === 'Out for Delivery' ? 'Delivered' : 'Pending';
    try {
      await updateItem('deliveries', d.id, { status: next });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Delete this delivery?')) return;
    try {
      await removeItem('deliveries', id);
      toast.success('Delivery deleted');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Delivery</h1>
          <p className="text-sm text-muted-foreground">
            {deliveries.filter((d) => d.status !== 'Delivered').length} open ·{' '}
            {deliveries.filter((d) => d.status === 'Delivered').length} delivered
          </p>
        </div>
        <Button onClick={startCreate}><Plus size={16} className="mr-2" />New delivery</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>All deliveries</CardTitle></CardHeader>
        <CardContent>
          {deliveries.length === 0 ? (
            <EmptyState title="No deliveries" description="Link a delivery to an order to track it." />
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <Table className="min-w-[820px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Worker</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Drop location</TableHead>
                    <TableHead>Proof</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveries.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.clientName || '—'}</TableCell>
                      <TableCell>{d.workerName || '—'}</TableCell>
                      <TableCell>
                        <button onClick={() => advance(d)} title="Click to advance status">
                          <Badge variant={d.status === 'Delivered' ? 'default' : 'secondary'}>{d.status}</Badge>
                        </button>
                      </TableCell>
                      <TableCell>
                        {d.mapsUrl ? (
                          <a
                            href={d.mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline text-sm"
                          >
                            View location <ExternalLink size={14} />
                          </a>
                        ) : '—'}
                      </TableCell>
                      <TableCell>
                        {d.proofAt ? (
                          <button
                            onClick={() => openProof(d)}
                            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                            title="Click to enlarge"
                          >
                            <Camera size={16} /> View proof
                          </button>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => remove(d.id)} aria-label="Delete delivery"><Trash2 size={16} /></Button>
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
            <DialogTitle>New delivery</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Client *</Label>
                <Select value={form.clientId || 'none'} onValueChange={(v) => setForm({ ...form, clientId: v === 'none' ? '' : v })}>
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
                <Label>Worker</Label>
                <Select value={form.workerId || 'none'} onValueChange={(v) => setForm({ ...form, workerId: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Select worker" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {workers.map((w) => (
                      <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Order (invoice)</Label>
                <Select value={form.invoiceId || 'none'} onValueChange={(v) => setForm({ ...form, invoiceId: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Select invoice" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No order link</SelectItem>
                    {invoices.map((i) => (
                      <SelectItem key={i.id} value={i.id}>{i.number} · {i.clientName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as DeliveryStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DELIVERY_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Drop Google Maps URL</Label>
              <Input placeholder="https://www.google.com/maps?q=lat,lng" value={form.mapsUrl} onChange={(e) => setForm({ ...form, mapsUrl: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
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
    </div>
  );
}
