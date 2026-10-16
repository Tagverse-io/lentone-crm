'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Pencil, Trash2, MapPin, ExternalLink, UserPlus, UserMinus, RefreshCw, Briefcase } from 'lucide-react';
import { toast } from 'sonner';
import {
  FIELD_TASK_STATUSES,
  FIELD_TASK_TYPES,
  assignWorkAtomic,
  collectionQuery,
  createItem,
  formatNumber,
  getCollection,
  isMapsUrl,
  listAttendance,
  listLatestLocations,
  listLocationHistory,
  logHistory,
  nameKeyOf,
  nextSequence,
  removeItem,
  updateItem,
  type AttendanceRecord,
  type Client,
  type FieldTask,
  type FieldTaskStatus,
  type FieldTaskType,
  type FetchRowsArgs,
  type LocationHistoryEntry,
  type OrderLineItem,
  type Product,
  type Worker,
} from '@/lib/db';
import { POLL_FAST_MS, useAppSettings, usePolling } from '@/lib/realtime';
import { DataTable } from '@/components/ui/data-table';
import { LineItemsEditor } from '@/components/line-items-editor';
import { EmptyState, LoadingState } from '@/components/ui/states';

const EMPTY_ITEM: OrderLineItem = { description: '', quantity: 1, unitPrice: 0 };

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

type AttRow = AttendanceRecord & { id: string; workerId: string; workerName: string };

export default function FieldForcePage() {
  const { data: settings } = useAppSettings();
  const currency = settings?.currency ?? '₹';
  const taxRate = settings?.taxRate ?? 18;

  const { data: workers = [], refresh: refreshWorkers } = usePolling<Worker[]>('workers', () => getCollection<Worker>('workers'), POLL_FAST_MS);
  const { data: clients = [] } = usePolling<Client[]>('clients', () => getCollection<Client>('clients'), POLL_FAST_MS);
  const { data: products = [] } = usePolling<Product[]>('products', () => getCollection<Product>('products'), POLL_FAST_MS);
  const { data: latest = [], refresh: refreshLatest } = usePolling('latest-locations', listLatestLocations, POLL_FAST_MS);

  const [taskKey, setTaskKey] = useState(0);
  const [attKey, setAttKey] = useState(0);
  const [taskOpen, setTaskOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<FieldTask | null>(null);
  const [taskStatus, setTaskStatus] = useState<FieldTaskStatus>('Assigned');
  const [taskNotes, setTaskNotes] = useState('');
  const [taskSched, setTaskSched] = useState('');
  const [savingTask, setSavingTask] = useState(false);

  // ---- Assign Work ----
  const [assignOpen, setAssignOpen] = useState(false);
  const [aWorker, setAWorker] = useState('');
  const [aClient, setAClient] = useState('');
  const [aType, setAType] = useState<FieldTaskType>('Visit');
  const [aDate, setADate] = useState(todayStr());
  const [aTime, setATime] = useState(settings?.defaultTaskSlot ?? '10:00');
  const [aMaps, setAMaps] = useState('');
  const [aSaveMap, setASaveMap] = useState(false);
  const [aItems, setAItems] = useState<OrderLineItem[]>([{ ...EMPTY_ITEM }]);
  const [aNotes, setANotes] = useState('');
  const [assigning, setAssigning] = useState(false);

  const [workerName, setWorkerName] = useState('');
  const [workerPhone, setWorkerPhone] = useState('');

  const [histWorker, setHistWorker] = useState('');

  const taskQuery = useMemo(() => collectionQuery<FieldTask>('tasks', 'createdAt', 'clientKey'), []);

  const attendanceQuery = useMemo(
    () =>
      async (args: FetchRowsArgs) => {
        const nameById = new Map(workers.map((w) => [w.id, w.name]));
        let out: AttRow[] = (await listAttendance(workers.map((w) => w.id))).map((r) => ({
          ...r,
          id: `${r.workerId}|${r.date}`,
          workerName: nameById.get(r.workerId) ?? r.workerId,
        }));
        if (args.search) {
          const q = args.search;
          out = out.filter(
            (r) => r.workerName.toLowerCase().includes(q) || r.date.includes(q),
          );
        }
        for (const [f, v] of args.filters) {
          if (f === 'workerId') out = out.filter((r) => r.workerId === v);
        }
        out.sort((a, b) => b.date.localeCompare(a.date) || a.workerName.localeCompare(b.workerName));
        const start = args.pageIndex * args.pageSize;
        return { rows: out.slice(start, start + args.pageSize), total: out.length, hasMore: start + args.pageSize < out.length, next: null };
      },
    [workers],
  );

  const historyQuery = useMemo(
    () =>
      async (args: FetchRowsArgs) => {
        if (!histWorker) return { rows: [], total: 0, hasMore: false, next: null };
        const all = (await listLocationHistory(histWorker)).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        const start = args.pageIndex * args.pageSize;
        return { rows: all.slice(start, start + args.pageSize), total: all.length, hasMore: start + args.pageSize < all.length, next: null };
      },
    [histWorker],
  );

  if (!settings) return <LoadingState label="Loading field force…" />;

  const selectedClient = clients.find((c) => c.id === aClient);
  const clientHasMap = Boolean(selectedClient?.mapsUrl);

  const onClientChange = (v: string) => {
    setAClient(v === 'none' ? '' : v);
    const c = clients.find((x) => x.id === v);
    setAMaps(c?.mapsUrl ?? '');
    setASaveMap(false);
  };

  const startEditTask = (t: FieldTask) => {
    setEditingTask(t);
    setTaskStatus(t.status);
    setTaskNotes(t.notes ?? '');
    setTaskSched(t.scheduledAt ? t.scheduledAt.slice(0, 16) : t.dueDate ? `${t.dueDate}T10:00` : '');
    setTaskOpen(true);
  };

  const saveTaskEdit = async () => {
    if (!editingTask) return;
    setSavingTask(true);
    try {
      await updateItem('tasks', editingTask.id, {
        status: taskStatus,
        notes: taskNotes || undefined,
        scheduledAt: taskSched ? new Date(taskSched).toISOString() : undefined,
        dueDate: taskSched ? taskSched.slice(0, 10) : editingTask.dueDate,
      });
      await logHistory('tasks', editingTask.id, 'Task updated', `Status ${taskStatus}`);
      toast.success('Task updated');
      setTaskOpen(false);
      setTaskKey((k) => k + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setSavingTask(false);
    }
  };

  const removeTask = async (t: FieldTask) => {
    if (!window.confirm('Delete this task?')) return;
    try {
      await removeItem('tasks', t.id);
      toast.success('Task deleted');
      setTaskKey((k) => k + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const resetAssign = () => {
    setAWorker('');
    setAClient('');
    setAType('Visit');
    setADate(todayStr());
    setATime(settings.defaultTaskSlot);
    setAMaps('');
    setASaveMap(false);
    setAItems([{ ...EMPTY_ITEM }]);
    setANotes('');
  };

  const doAssign = async () => {
    if (!aWorker || !aClient || !aDate || !aTime) {
      toast.error('Worker, client, date and time are required');
      return;
    }
    if (!selectedClient) {
      toast.error('Select a client');
      return;
    }
    const maps = aMaps.trim();
    if (!clientHasMap && !maps) {
      toast.error('This client has no map link — paste one (required)');
      return;
    }
    if (maps && !isMapsUrl(maps)) {
      toast.error('Map link must be a maps.google.com, google.com/maps or maps.app.goo.gl URL');
      return;
    }
    const sched = new Date(`${aDate}T${aTime}:00`).toISOString();
    if (Number.isNaN(Date.parse(sched))) {
      toast.error('Invalid date/time');
      return;
    }
    const worker = workers.find((w) => w.id === aWorker);
    const lines = aItems
      .filter((i) => i.productId || i.description.trim())
      .map((i) => ({ ...i, quantity: Number(i.quantity) || 0, unitPrice: Number(i.unitPrice) || 0 }));
    setAssigning(true);
    try {
      if (lines.length === 0) {
        // Visit/sample only: create the task alone.
        const id = await createItem('tasks', {
          workerId: aWorker,
          workerName: worker?.name,
          workerKey: worker ? nameKeyOf(worker.name) : undefined,
          clientId: aClient,
          clientName: selectedClient.name,
          clientKey: nameKeyOf(selectedClient.name),
          type: aType,
          dueDate: aDate,
          scheduledAt: sched,
          mapsUrl: maps || undefined,
          status: 'Assigned',
          notes: aNotes.trim() || undefined,
        });
        await logHistory('tasks', id, 'Task assigned', `${aType} for ${selectedClient.name} at ${sched}`);
        toast.success('Task assigned');
      } else {
        const [oSeq, iSeq] = await Promise.all([nextSequence('orders'), nextSequence('invoices')]);
        const orderNumber = formatNumber(settings.orderPrefix, oSeq);
        const invoiceNumber = formatNumber(settings.invoicePrefix, iSeq);
        const res = await assignWorkAtomic(
          {
            workerId: aWorker,
            workerName: worker?.name,
            clientId: aClient,
            clientName: selectedClient.name,
            type: aType,
            scheduledAt: sched,
            mapsUrl: maps || undefined,
            items: lines.map((l) => ({ productId: l.productId as string, quantity: l.quantity })),
            notes: aNotes.trim() || undefined,
            orderNumber,
            invoiceNumber,
          },
          taxRate,
        );
        toast.success(`Work assigned: order ${orderNumber}, invoice ${invoiceNumber}`);
        void res;
      }
      if (aSaveMap && maps && selectedClient.mapsUrl !== maps) {
        await updateItem('clients', aClient, { mapsUrl: maps });
        toast.success('Map link saved to client');
      }
      setAssignOpen(false);
      resetAssign();
      setTaskKey((k) => k + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Assign failed');
    } finally {
      setAssigning(false);
    }
  };

  const addWorker = async () => {
    if (!workerName.trim()) {
      toast.error('Worker name is required');
      return;
    }
    try {
      await createItem('workers', { name: workerName.trim(), nameKey: nameKeyOf(workerName), phone: workerPhone.trim() || undefined, active: true });
      setWorkerName('');
      setWorkerPhone('');
      toast.success('Worker added');
      refreshWorkers();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Add failed');
    }
  };
  const removeWorker = async (w: Worker) => {
    if (!window.confirm(`Remove worker ${w.name}? Open tasks stay assigned by name.`)) return;
    try {
      await removeItem('workers', w.id);
      toast.success('Worker removed');
      refreshWorkers();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Field Force</h1>
          <p className="text-sm text-muted-foreground">Visits, samples, deliveries, attendance and live GPS locations. Polls every 15s.</p>
        </div>
        <Button onClick={() => { resetAssign(); setAssignOpen(true); }}>
          <Briefcase size={16} className="mr-2" /> Assign Work
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Workers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input placeholder="Worker name *" value={workerName} onChange={(e) => setWorkerName(e.target.value)} className="sm:max-w-56" />
            <Input placeholder="Phone" value={workerPhone} onChange={(e) => setWorkerPhone(e.target.value)} className="sm:max-w-48" />
            <Button onClick={addWorker}>
              <UserPlus size={16} className="mr-2" /> Add worker
            </Button>
          </div>
          {workers.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {workers.map((w) => (
                <span key={w.id} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm">
                  {w.name}
                  <button onClick={() => removeWorker(w)} aria-label={`Remove ${w.name}`} className="text-muted-foreground hover:text-destructive">
                    <UserMinus size={14} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="tasks">
        <TabsList>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="locations">Locations</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="mt-4">
          <div key={taskKey}>
            <DataTable<FieldTask>
              title="Field tasks"
              queryKey="tasks"
              fetchRows={taskQuery}
              searchPlaceholder="Search client…"
              filters={[
                { field: 'status', label: 'Status', options: FIELD_TASK_STATUSES.map((s) => ({ value: s, label: s })) },
                { field: 'type', label: 'Type', options: FIELD_TASK_TYPES.map((t) => ({ value: t, label: t })) },
              ]}
              defaultPageSize={settings.defaultRowsPerPage}
              pollMs={POLL_FAST_MS}
              onEdit={startEditTask}
              onDelete={removeTask}
              emptyTitle="No tasks"
              emptyHint="Use Assign Work to create a visit, sample or delivery."
              columns={[
                { key: 'workerName', header: 'Worker', render: (t) => t.workerName || t.workerId },
                { key: 'clientName', header: 'Client', render: (t) => t.clientName || t.clientId },
                { key: 'type', header: 'Type', render: (t) => <Badge variant="secondary">{t.type}</Badge> },
                { key: 'scheduledAt', header: 'Scheduled', render: (t) => (t.scheduledAt ? new Date(t.scheduledAt).toLocaleString('en-IN') : t.dueDate || '—') },
                { key: 'status', header: 'Status', render: (t) => <Badge variant={t.status === 'Done' ? 'default' : 'outline'}>{t.status}</Badge> },
                {
                  key: 'mapsUrl',
                  header: 'Map',
                  render: (t) =>
                    t.mapsUrl ? (
                      <a href={t.mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline text-sm">
                        Open map <ExternalLink size={14} />
                      </a>
                    ) : (
                      '—'
                    ),
                },
              ]}
            />
          </div>
        </TabsContent>

        <TabsContent value="attendance" className="mt-4">
          <div key={attKey}>
            <DataTable<AttRow>
              title="Login / logout tracking"
              queryKey="attendance"
              fetchRows={attendanceQuery}
              searchPlaceholder="Search worker or date…"
              filters={[{ field: 'workerId', label: 'Worker', options: workers.map((w) => ({ value: w.id, label: w.name })) }]}
              defaultPageSize={settings.defaultRowsPerPage}
              pollMs={POLL_FAST_MS}
              legacyToggle={false}
              emptyTitle="No attendance yet"
              emptyHint="Logins from the Expo app appear here automatically."
              columns={[
                { key: 'workerName', header: 'Worker', render: (r) => r.workerName },
                { key: 'date', header: 'Date', render: (r) => r.date },
                { key: 'loginAt', header: 'Login', render: (r) => (r.loginAt ? new Date(r.loginAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—') },
                { key: 'logoutAt', header: 'Logout', render: (r) => (r.logoutAt ? new Date(r.logoutAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—') },
                { key: 'hoursWorked', header: 'Hours', className: 'text-right', render: (r) => r.hoursWorked ?? '—' },
              ]}
            />
          </div>
        </TabsContent>

        <TabsContent value="locations" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin size={18} /> Live worker locations
              </CardTitle>
              <Button variant="outline" size="icon" onClick={() => refreshLatest()} title="Refresh" aria-label="Refresh">
                <RefreshCw size={16} />
              </Button>
            </CardHeader>
            <CardContent>
              {latest.length === 0 ? (
                <EmptyState title="No locations yet" description="Background GPS updates from the Expo app appear here." />
              ) : (
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <Table className="min-w-[560px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Worker</TableHead>
                        <TableHead>Last update</TableHead>
                        <TableHead className="text-right">Map</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {latest.map((l) => (
                        <TableRow key={l.workerId}>
                          <TableCell className="font-medium">{l.workerName || workers.find((w) => w.id === l.workerId)?.name || l.workerId}</TableCell>
                          <TableCell>{new Date(l.timestamp).toLocaleString('en-IN')}</TableCell>
                          <TableCell className="text-right">
                            <a href={l.mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline text-sm font-medium">
                              View location <ExternalLink size={14} />
                            </a>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Location history</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-1.5 max-w-sm">
                <Label>Worker</Label>
                <Select value={histWorker || 'none'} onValueChange={(v) => setHistWorker(v === 'none' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select worker" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select worker</SelectItem>
                    {workers.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {histWorker ? (
                <DataTable<LocationHistoryEntry>
                  title="History"
                  queryKey={`loc-history:${histWorker}`}
                  fetchRows={historyQuery}
                  searchable={false}
                  defaultPageSize={settings.defaultRowsPerPage}
                  pollMs={POLL_FAST_MS}
                  legacyToggle={false}
                  emptyTitle="No history"
                  emptyHint="No GPS points recorded for this worker yet."
                  columns={[
                    { key: 'timestamp', header: 'Time', render: (h) => new Date(h.timestamp).toLocaleString('en-IN') },
                    {
                      key: 'mapsUrl',
                      header: 'Map',
                      className: 'text-right',
                      render: (h) => (
                        <a href={h.mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline text-sm font-medium">
                          View location <ExternalLink size={14} />
                        </a>
                      ),
                    },
                  ]}
                />
              ) : (
                <p className="text-sm text-muted-foreground">Select a worker to page through their GPS history.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit task */}
      <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit task</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Status</Label>
                <Select value={taskStatus} onValueChange={(v) => setTaskStatus(v as FieldTaskStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELD_TASK_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Scheduled at</Label>
                <Input type="datetime-local" value={taskSched} onChange={(e) => setTaskSched(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Notes</Label>
              <Textarea value={taskNotes} onChange={(e) => setTaskNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTaskOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveTaskEdit} disabled={savingTask}>
              {savingTask ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Work */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assign Work</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Worker *</Label>
                <Select value={aWorker || 'none'} onValueChange={(v) => setAWorker(v === 'none' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select worker" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select worker</SelectItem>
                    {workers.filter((w) => w.active).map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Client *</Label>
                <Select value={aClient || 'none'} onValueChange={onClientChange}>
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
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1.5">
                <Label>Task type</Label>
                <Select value={aType} onValueChange={(v) => setAType(v as FieldTaskType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELD_TASK_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Date *</Label>
                <Input type="date" value={aDate} min={todayStr()} onChange={(e) => setADate(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>Time *</Label>
                <Input type="time" value={aTime} onChange={(e) => setATime(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Google Maps link {!clientHasMap && '*'}</Label>
              <Input
                value={aMaps}
                onChange={(e) => setAMaps(e.target.value)}
                placeholder={clientHasMap ? 'Prefilled from client — edit or paste a new link' : 'Client has no link — paste one (required)'}
              />
              {aMaps.trim() && !isMapsUrl(aMaps.trim()) && (
                <p className="text-xs text-destructive">Must be a maps.google.com, google.com/maps or maps.app.goo.gl link.</p>
              )}
              {!clientHasMap && aClient && (
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={aSaveMap} onChange={(e) => setASaveMap(e.target.checked)} className="h-4 w-4 accent-primary" />
                  Save this link to the client
                </label>
              )}
            </div>
            <LineItemsEditor items={aItems} onChange={setAItems} products={products} currency={currency} />
            <p className="text-xs text-muted-foreground">
              With inventory lines: one atomic save creates the task, order, delivery (Pending) and invoice (Unpaid), deducts stock and writes history. Without lines: only the task is created. Stock shortages block the save.
            </p>
            <div className="grid gap-1.5">
              <Label>Notes</Label>
              <Textarea value={aNotes} onChange={(e) => setANotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>
              Cancel
            </Button>
            <Button onClick={doAssign} disabled={assigning}>
              {assigning ? 'Assigning…' : 'Assign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
