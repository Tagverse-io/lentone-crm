'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/firebase/auth-context';
import { useCollection } from '@/lib/use-collection';
import { clientsService } from '@/lib/backend-crud';
import type { Client } from '@/lib/types';
import { nowIso } from '@/lib/utils';
import { EmptyState, LoadingState, ErrorState } from '@/components/ui/states';

const EMPTY = { name: '', email: '', phone: '', company: '', address: '', source: '' };

export default function ClientsPage() {
  const { workspace } = useAuth();
  const orgId = workspace?.id ?? null;
  const { items, loading, error, reload } = useCollection(clientsService, orgId);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  if (!orgId) return <LoadingState label="Loading workspace…" />;
  if (loading) return <LoadingState label="Loading clients…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const startCreate = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const startEdit = (c: Client) => {
    setEditing(c);
    setForm({ name: c.name, email: c.email, phone: c.phone ?? '', company: c.company ?? '', address: c.address ?? '', source: c.source ?? '' });
    setOpen(true);
  };

  const save = async () => {
    if (!orgId || !form.name.trim() || !form.email.trim()) {
      toast.error('Name and email are required');
      return;
    }
    setSaving(true);
    try {
      if (editing) await clientsService.update(orgId, editing.id, { ...form });
      else await clientsService.create(orgId, { ...form, createdAt: nowIso() });
      toast.success(editing ? 'Client updated' : 'Client added');
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!orgId || !window.confirm('Delete this client?')) return;
    try {
      await clientsService.remove(orgId, id);
      toast.success('Client deleted');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
          <p className="text-sm text-muted-foreground">{items.length} clients · won leads create clients automatically</p>
        </div>
        <Button onClick={startCreate}><Plus size={16} className="mr-2" />Add client</Button>
      </div>
      <Card>
        <CardHeader><CardTitle>All clients</CardTitle></CardHeader>
        <CardContent>
          {items.length === 0 ? <EmptyState title="No clients yet" hint="Won leads create clients automatically." /> : (
            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Company</TableHead><TableHead>Phone</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {items.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.email}</TableCell>
                    <TableCell>{c.company ?? '—'}</TableCell>
                    <TableCell>{c.phone ?? '—'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => startEdit(c)} aria-label="Edit"><Pencil size={14} /></Button>
                        <Button size="icon" variant="ghost" onClick={() => remove(c.id)} aria-label="Delete"><Trash2 size={14} /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit client' : 'Add client'}</DialogTitle>
            <DialogDescription>Client details used across quotes, invoices and projects.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div className="space-y-2"><Label>Company</Label><Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>Address</Label><Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save client'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
