'use client';

import { useEffect, useMemo, useState } from 'react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import {
  LEAD_STAGES,
  collectionQuery,
  createItem,
  fetchPage,
  fmtMoney,
  getCollection,
  logHistory,
  nameKeyOf,
  removeItem,
  updateItem,
  type Client,
  type CustomValue,
  type Lead,
  type LeadStage,
} from '@/lib/db';
import { POLL_FAST_MS, useAppSettings } from '@/lib/realtime';
import { DataTable } from '@/components/ui/data-table';
import { CustomFieldsForm, customColumns } from '@/components/custom-fields';
import { LoadingState } from '@/components/ui/states';
import { useSWRConfig } from 'swr';

const EMPTY = { contactName: '', email: '', phone: '', clientId: '', value: '', notes: '', stage: 'New' as LeadStage };

const STAGE_COLORS: Record<LeadStage, string> = {
  New: 'bg-blue-500',
  Contacted: 'bg-amber-500',
  Qualified: 'bg-violet-500',
  Proposal: 'bg-purple-500',
  Negotiation: 'bg-emerald-500',
  Won: 'bg-green-600',
  Lost: 'bg-red-500',
};

export default function LeadsPage() {
  const { data: settings } = useAppSettings();
  const currency = settings?.currency ?? '₹';
  const customDefs = settings?.customFields?.leads ?? [];
  const { mutate: mutateAll } = useSWRConfig();

  const [board, setBoard] = useState<Lead[]>([]);
  const [boardLoading, setBoardLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [custom, setCustom] = useState<Record<string, CustomValue>>({});
  const [saving, setSaving] = useState(false);
  const [listKey, setListKey] = useState(0);

  const fetchBoard = async () => {
    setBoardLoading(true);
    try {
      const page = await fetchPage<Lead>('leads', 'createdAt', 200);
      setBoard(page.rows.filter((l) => !l.legacy));
      const cs = await getCollection<Client>('clients');
      setClients(cs);
    } finally {
      setBoardLoading(false);
    }
  };

  useEffect(() => {
    fetchBoard().catch(() => setBoardLoading(false));
    const t = setInterval(() => fetchBoard().catch(() => undefined), POLL_FAST_MS);
    const onVis = () => {
      if (document.visibilityState === 'visible') fetchBoard().catch(() => undefined);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  const visible = useMemo(
    () => (clientFilter === 'all' ? board : board.filter((l) => l.clientId === clientFilter)),
    [board, clientFilter],
  );

  const listQuery = useMemo(() => collectionQuery<Lead>('leads', 'createdAt', 'nameKey'), []);

  const startCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setCustom({});
    setOpen(true);
  };
  const startEdit = (l: Lead) => {
    setEditing(l);
    setForm({
      contactName: l.contactName,
      email: l.email ?? '',
      phone: l.phone ?? '',
      clientId: l.clientId ?? '',
      value: l.value ? String(l.value) : '',
      notes: l.notes ?? '',
      stage: l.stage,
    });
    setCustom(l.custom ?? {});
    setOpen(true);
  };

  const save = async () => {
    if (!form.contactName.trim()) {
      toast.error('Contact name is required');
      return;
    }
    setSaving(true);
    try {
      const client = clients.find((c) => c.id === form.clientId);
      const data = {
        contactName: form.contactName.trim(),
        nameKey: nameKeyOf(form.contactName),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        clientId: form.clientId || undefined,
        clientName: client?.name,
        value: form.value ? Number(form.value) : undefined,
        notes: form.notes.trim() || undefined,
        stage: form.stage,
        custom: Object.keys(custom).length > 0 ? custom : undefined,
      };
      if (editing) {
        await updateItem('leads', editing.id, data);
        await logHistory('leads', editing.id, 'Lead updated');
      } else {
        const id = await createItem('leads', data);
        await logHistory('leads', id, 'Lead created', `Stage ${data.stage}`);
      }
      toast.success(editing ? 'Lead updated' : 'Lead added');
      setOpen(false);
      setListKey((k) => k + 1);
      fetchBoard().catch(() => undefined);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (l: Lead) => {
    if (!window.confirm(`Delete lead ${l.contactName}?`)) return;
    try {
      await removeItem('leads', l.id);
      toast.success('Lead deleted');
      setListKey((k) => k + 1);
      fetchBoard().catch(() => undefined);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const onDragEnd = async (result: DropResult) => {
    const { destination, draggableId } = result;
    if (!destination) return;
    const stage = destination.droppableId as LeadStage;
    const lead = board.find((l) => l.id === draggableId);
    if (!lead || lead.stage === stage) return;
    setBoard((prev) => prev.map((l) => (l.id === lead.id ? { ...l, stage } : l)));
    try {
      await updateItem('leads', lead.id, { stage });
      await logHistory('leads', lead.id, `Stage → ${stage}`, `was ${lead.stage}`);
      mutateAll((k) => typeof k === 'string' && k.startsWith('"leads"'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Move failed');
      fetchBoard().catch(() => undefined);
    }
  };

  if (boardLoading) return <LoadingState label="Loading leads…" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lead Management</h1>
          <p className="text-sm text-muted-foreground">Sales pipeline per client — drag cards between stages.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => fetchBoard().catch(() => undefined)} title="Refresh" aria-label="Refresh">
            <RefreshCw size={16} />
          </Button>
          <Button onClick={startCreate}>
            <Plus size={16} className="mr-2" />
            Add lead
          </Button>
        </div>
      </div>

      <Tabs defaultValue="board">
        <TabsList>
          <TabsTrigger value="board">Pipeline board</TabsTrigger>
          <TabsTrigger value="list">Lead list</TabsTrigger>
        </TabsList>

        <TabsContent value="board" className="mt-4 space-y-4">
          <Card>
            <CardContent className="pt-4">
              <div className="grid gap-1.5 max-w-sm">
                <Label>Filter pipeline by client</Label>
                <Select value={clientFilter} onValueChange={setClientFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All clients" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All clients</SelectItem>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {visible.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No leads yet — add one to start the pipeline.
              </CardContent>
            </Card>
          ) : (
            <DragDropContext onDragEnd={onDragEnd}>
              <div className="grid grid-flow-col auto-cols-[240px] gap-3 overflow-x-auto pb-2">
                {LEAD_STAGES.map((stage) => {
                  const cards = visible.filter((l) => l.stage === stage);
                  return (
                    <Droppable droppableId={stage} key={stage}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`rounded-lg border bg-muted/40 p-2 space-y-2 min-h-40 ${snapshot.isDraggingOver ? 'ring-2 ring-primary/40' : ''}`}
                        >
                          <div className="flex items-center gap-2 px-1">
                            <span className={`w-2 h-2 rounded-full ${STAGE_COLORS[stage]}`} />
                            <span className="text-xs font-semibold uppercase tracking-wide">{stage}</span>
                            <span className="ml-auto text-xs text-muted-foreground">{cards.length}</span>
                          </div>
                          {cards.map((l, idx) => (
                            <Draggable draggableId={l.id} index={idx} key={l.id}>
                              {(p, s) => (
                                <div
                                  ref={p.innerRef}
                                  {...p.draggableProps}
                                  {...p.dragHandleProps}
                                  className={`rounded-lg border bg-card p-2.5 shadow-sm ${s.isDragging ? 'rotate-1 shadow-md' : ''}`}
                                >
                                  <p className="text-sm font-medium truncate">{l.contactName || '(blank — edit to fix)'}</p>
                                  <p className="text-xs text-muted-foreground truncate">{l.clientName || '—'}</p>
                                  <div className="flex items-center justify-between mt-1.5">
                                    <span className="text-xs font-semibold">{l.value ? fmtMoney(l.value, currency) : '—'}</span>
                                    <span className="text-[11px] text-muted-foreground">{l.phone || ''}</span>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  );
                })}
              </div>
            </DragDropContext>
          )}
        </TabsContent>

        <TabsContent value="list" className="mt-4">
          <div key={listKey}>
            <DataTable<Lead>
              title="All leads"
              queryKey="leads"
              fetchRows={listQuery}
              searchPlaceholder="Search contact…"
              filters={[{ field: 'stage', label: 'Stage', options: LEAD_STAGES.map((s) => ({ value: s, label: s })) }]}
              defaultPageSize={settings?.defaultRowsPerPage ?? 25}
              pollMs={POLL_FAST_MS}
              onEdit={startEdit}
              onDelete={remove}
              emptyTitle="No leads"
              emptyHint="Add a lead to start the pipeline."
              columns={[
                { key: 'contactName', header: 'Contact', render: (l) => l.contactName || '(blank — edit to fix)' },
                { key: 'clientName', header: 'Client', render: (l) => l.clientName || '—' },
                { key: 'phone', header: 'Phone', render: (l) => l.phone || '—' },
                { key: 'stage', header: 'Stage', render: (l) => <Badge variant="secondary">{l.stage}</Badge> },
                { key: 'value', header: 'Value', className: 'text-right', render: (l) => (l.value ? fmtMoney(l.value, currency) : '—') },
                ...customColumns<Lead>(customDefs),
              ]}
            />
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit lead' : 'Add lead'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Contact name *</Label>
              <Input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Email</Label>
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Client</Label>
                <Select value={form.clientId || 'none'} onValueChange={(v) => setForm({ ...form, clientId: v === 'none' ? '' : v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No client</SelectItem>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Stage</Label>
                <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v as LeadStage })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_STAGES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Value (₹)</Label>
              <Input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
            </div>
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
