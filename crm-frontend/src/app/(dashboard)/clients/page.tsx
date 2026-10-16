'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import {
  CLIENT_CATEGORIES,
  collectionQuery,
  createItem,
  isMapsUrl,
  nameKeyOf,
  removeItem,
  updateItem,
  type Client,
  type CustomValue,
} from '@/lib/db';
import { useAppSettings } from '@/lib/realtime';
import { DataTable } from '@/components/ui/data-table';
import { CustomFieldsForm, customColumns } from '@/components/custom-fields';

const EMPTY = {
  name: '',
  category: 'Hotel',
  contactPerson: '',
  phone: '',
  email: '',
  address: '',
  gstin: '',
  mapsUrl: '',
  notes: '',
};

export default function ClientsPage() {
  const { data: settings } = useAppSettings();
  const categories = settings?.clientCategories?.length ? settings.clientCategories : [...CLIENT_CATEGORIES];
  const customDefs = settings?.customFields?.clients ?? [];
  const defaultPageSize = settings?.defaultRowsPerPage ?? 25;

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [custom, setCustom] = useState<Record<string, CustomValue>>({});
  const [saving, setSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchRows = useMemo(() => collectionQuery<Client>('clients', 'createdAt', 'nameKey'), []);

  const startCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setCustom({});
    setOpen(true);
  };
  const startEdit = (c: Client) => {
    setEditing(c);
    setForm({
      name: c.name,
      category: c.category,
      contactPerson: c.contactPerson ?? '',
      phone: c.phone ?? '',
      email: c.email ?? '',
      address: c.address ?? '',
      gstin: c.gstin ?? '',
      mapsUrl: c.mapsUrl ?? '',
      notes: c.notes ?? '',
    });
    setCustom(c.custom ?? {});
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error('Client name is required');
      return;
    }
    if (form.mapsUrl.trim() && !isMapsUrl(form.mapsUrl.trim())) {
      toast.error('Google Maps link must be a maps.google.com, google.com/maps or maps.app.goo.gl URL');
      return;
    }
    setSaving(true);
    try {
      const data = {
        name: form.name.trim(),
        nameKey: nameKeyOf(form.name),
        category: form.category,
        contactPerson: form.contactPerson.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
        gstin: form.gstin.trim() || undefined,
        mapsUrl: form.mapsUrl.trim() || undefined,
        notes: form.notes.trim() || undefined,
        custom: Object.keys(custom).length > 0 ? custom : undefined,
      };
      if (editing) await updateItem('clients', editing.id, data);
      else await createItem('clients', data);
      toast.success(editing ? 'Client updated' : 'Client added');
      setOpen(false);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c: Client) => {
    if (!window.confirm(`Delete client ${c.name}?`)) return;
    try {
      await removeItem('clients', c.id);
      toast.success('Client deleted');
      setRefreshKey((k) => k + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
        <p className="text-sm text-muted-foreground">FMCG client directory — hotels, restaurants, bakeries and more.</p>
      </div>

      <div key={refreshKey}>
        <DataTable<Client>
          title="Client directory"
          queryKey="clients"
          fetchRows={fetchRows}
          searchPlaceholder="Search name…"
          filters={[{ field: 'category', label: 'Category', options: categories.map((c) => ({ value: c, label: c })) }]}
          defaultPageSize={defaultPageSize}
          addLabel="Add client"
          onAdd={startCreate}
          onEdit={startEdit}
          onDelete={remove}
          emptyTitle="No clients found"
          emptyHint="Add your first FMCG client to get started."
          columns={[
            {
              key: 'name',
              header: 'Name',
              render: (c) => (
                <Link href={`/clients/${c.id}`} className="font-medium text-primary hover:underline">
                  {c.name || '(blank name — edit to fix)'}
                </Link>
              ),
            },
            { key: 'category', header: 'Category', render: (c) => <Badge variant="secondary">{c.category || '—'}</Badge> },
            { key: 'contactPerson', header: 'Contact', render: (c) => c.contactPerson || '—' },
            { key: 'phone', header: 'Phone', render: (c) => c.phone || '—' },
            {
              key: 'mapsUrl',
              header: 'Map',
              render: (c) =>
                c.mapsUrl ? (
                  <a href={c.mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline text-sm">
                    Open map <ExternalLink size={14} />
                  </a>
                ) : (
                  '—'
                ),
            },
            ...customColumns<Client>(customDefs),
          ]}
        />
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit client' : 'Add client'}</DialogTitle>
            <DialogDescription>Contact, address, GSTIN and the Google Maps link used by Assign Work.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Contact person</Label>
                <Input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label>Email</Label>
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Address</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>GSTIN</Label>
                <Input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} placeholder="32ABCDE1234F1Z5" />
              </div>
              <div className="grid gap-1.5">
                <Label>Google Maps link</Label>
                <Input
                  value={form.mapsUrl}
                  onChange={(e) => setForm({ ...form, mapsUrl: e.target.value })}
                  placeholder="https://www.google.com/maps?q=lat,lng"
                />
              </div>
            </div>
            {form.mapsUrl.trim() && !isMapsUrl(form.mapsUrl.trim()) && (
              <p className="text-xs text-destructive">Must be a maps.google.com, google.com/maps or maps.app.goo.gl link.</p>
            )}
            <div className="grid gap-1.5">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
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
    </div>
  );
}
