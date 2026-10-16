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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  LEAD_STAGES,
  createItem,
  getCollection,
  removeItem,
  subscribeLeads,
  updateItem,
  type Client,
  type Lead,
  type LeadStage,
} from '@/lib/db';
import { EmptyState, LoadingState } from '@/components/ui/states';

const EMPTY = { contactName: '', phone: '', clientId: '', value: '', notes: '', stage: 'New' as LeadStage };

const STAGE_COLORS: Record<LeadStage, string> = {
  New: 'bg-blue-500',
  Contacted: 'bg-amber-500',
  Qualified: 'bg-violet-500',
  Proposal: 'bg-purple-500',
  Negotiation: 'bg-emerald-500',
  Won: 'bg-green-600',
  Lost: 'bg-red-500',
};

function money(n?: number): string {
  if (!n) return '—';
  return `₹${n.toLocaleString('en-IN')}`;
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getCollection<Client>('clients').then(setClients).catch(() => undefined);
    const unsub = subscribeLeads(
      (list) => {
        setLeads(list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, []);

  const visible = useMemo(
    () => (clientFilter === 'all' ? leads : leads.filter((l) => l.clientId === clientFilter)),
    [leads, clientFilter],
  );

  if (loading) return <LoadingState label="Loading leads…" />;

  const startCreate = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const startEdit = (l: Lead) => {
    setEditing(l);
    setForm({
      contactName: l.contactName,
      phone: l.phone ?? '',
      clientId: l.clientId ?? '',
      value: l.value ? String(l.value) : '',
      notes: l.notes ?? '',
      stage: l.stage,
    });
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
        phone: form.phone || undefined,
        clientId: form.clientId || undefined,
        clientName: client?.name,
        value: form.value ? Number(form.value) : undefined,
        notes: form.notes || undefined,
        stage: form.stage,
      };
      if (editing) await updateItem('leads', editing.id, data);
      else await createItem('leads', data);
      toast.success(editing ? 'Lead updated' : 'Lead added');
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Delete this lead?')) return;
    try {
      await removeItem('leads', id);
      toast.success('Lead deleted');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const onDragEnd = async (result: DropResult) => {
    const { destination, draggableId } = result;
    if (!destination) return;
    const stage = destination.droppableId as LeadStage;
    const lead = leads.find((l) => l.id === draggableId);
    if (!lead || lead.stage === stage) return;
    try {
      await updateItem('leads', lead.id, { stage });
      toast.success(`Moved to ${stage}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Move failed');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lead Management</h1>
          <p className="text-sm text-muted-foreground">Sales pipeline per client — drag cards between stages.</p>
        </div>
        <Button onClick={startCreate}><Plus size={16} className="mr-2" />Add lead</Button>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="grid gap-1.5 max-w-sm">
            <Label>Filter pipeline by client</Label>
            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger><SelectValue placeholder="All clients" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All clients</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="board">
        <TabsList>
          <TabsTrigger value="board">Pipeline board</TabsTrigger>
          <TabsTrigger value="list">Lead list</TabsTrigger>
        </TabsList>

        <TabsContent value="board" className="mt-4">
          {visible.length === 0 ? (
            <EmptyState title="No leads" description="Add a lead to start the pipeline." />
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
                                  <p className="text-sm font-medium truncate">{l.contactName}</p>
                                  <p className="text-xs text-muted-foreground truncate">{l.clientName || '—'}</p>
                                  <div className="flex items-center justify-between mt-1.5">
                                    <span className="text-xs font-semibold">{money(l.value)}</span>
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
          <Card>
            <CardHeader><CardTitle>All leads</CardTitle></CardHeader>
            <CardContent>
              {visible.length === 0 ? (
                <EmptyState title="No leads" description="Add a lead to start the pipeline." />
              ) : (
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <Table className="min-w-[720px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Contact</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Stage</TableHead>
                        <TableHead className="text-right">Value</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visible.map((l) => (
                        <TableRow key={l.id}>
                          <TableCell>
                            <div className="font-medium">{l.contactName}</div>
                            <div className="text-xs text-muted-foreground">{l.phone || '—'}</div>
                          </TableCell>
                          <TableCell>{l.clientName || '—'}</TableCell>
                          <TableCell><Badge variant="secondary">{l.stage}</Badge></TableCell>
                          <TableCell className="text-right">{money(l.value)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => startEdit(l)} aria-label="Edit lead"><Pencil size={16} /></Button>
                              <Button variant="ghost" size="icon" onClick={() => remove(l.id)} aria-label="Delete lead"><Trash2 size={16} /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
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
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label>Value (₹)</Label>
                <Input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Client</Label>
                <Select value={form.clientId || 'none'} onValueChange={(v) => setForm({ ...form, clientId: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No client</SelectItem>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Stage</Label>
                <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v as LeadStage })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LEAD_STAGES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
