'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { Plus, Pencil, Trash2, MapPin, ExternalLink, UserPlus, UserMinus } from 'lucide-react';
import { toast } from 'sonner';
import {
  FIELD_TASK_STATUSES,
  createItem,
  getCollection,
  removeItem,
  subscribeCollection,
  subscribeLatestLocations,
  subscribeLocationHistory,
  updateItem,
  type AttendanceRecord,
  type Client,
  type FieldTask,
  type FieldTaskStatus,
  type FieldTaskType,
  type LocationHistoryEntry,
  type Worker,
} from '@/lib/db';
import { EmptyState, LoadingState } from '@/components/ui/states';

const TASK_EMPTY = { workerId: '', clientId: '', type: 'visit' as FieldTaskType, dueDate: '', status: 'Assigned' as FieldTaskStatus, notes: '' };

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function FieldForcePage() {
  const [tasks, setTasks] = useState<FieldTask[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [latest, setLatest] = useState<{ workerId: string; mapsUrl: string; timestamp: string; workerName?: string }[]>([]);
  const [historyWorker, setHistoryWorker] = useState<string>('');
  const [history, setHistory] = useState<LocationHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [taskOpen, setTaskOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<FieldTask | null>(null);
  const [taskForm, setTaskForm] = useState(TASK_EMPTY);
  const [saving, setSaving] = useState(false);

  const [workerName, setWorkerName] = useState('');
  const [workerPhone, setWorkerPhone] = useState('');

  useEffect(() => {
    getCollection<Client>('clients').then(setClients).catch(() => undefined);
    const unsubs = [
      subscribeCollection<FieldTask>('tasks', (l) => setTasks(l.sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || '')))),
      subscribeCollection<Worker>('workers', setWorkers),
      subscribeLatestLocations(setLatest),
    ];
    setLoading(false);
    return () => unsubs.forEach((u) => u());
  }, []);

  // Flatten attendance: subscribe per worker so the table stays live.
  const [attRows, setAttRows] = useState<{ workerId: string; workerName: string; date: string; loginAt?: string; logoutAt?: string; hoursWorked?: number }[]>([]);
  useEffect(() => {
    if (workers.length === 0) return;
    const unsubs = workers.map((w) =>
      subscribeCollection<AttendanceRecord>(`attendance/${w.id}`, (rows) =>
        setAttRows((prev) => {
          const others = prev.filter((r) => r.workerId !== w.id);
          return [...others, ...rows.map((r) => ({ workerId: w.id, workerName: w.name, ...r }))];
        }),
      ),
    );
    return () => unsubs.forEach((u) => u());
  }, [workers]);

  useEffect(() => {
    if (!historyWorker) {
      setHistory([]);
      return;
    }
    return subscribeLocationHistory(historyWorker, (rows) =>
      setHistory(rows.sort((a, b) => b.timestamp.localeCompare(a.timestamp))),
    );
  }, [historyWorker]);

  const attSorted = useMemo(
    () => [...attRows].sort((a, b) => b.date.localeCompare(a.date) || a.workerName.localeCompare(b.workerName)),
    [attRows],
  );

  if (loading) return <LoadingState label="Loading field force…" />;

  // ----- tasks -----
  const startCreateTask = () => { setEditingTask(null); setTaskForm({ ...TASK_EMPTY, dueDate: todayStr() }); setTaskOpen(true); };
  const startEditTask = (t: FieldTask) => {
    setEditingTask(t);
    setTaskForm({ workerId: t.workerId, clientId: t.clientId, type: t.type, dueDate: t.dueDate, status: t.status, notes: t.notes ?? '' });
    setTaskOpen(true);
  };
  const saveTask = async () => {
    if (!taskForm.workerId || !taskForm.clientId || !taskForm.dueDate) {
      toast.error('Worker, client and due date are required');
      return;
    }
    setSaving(true);
    try {
      const worker = workers.find((w) => w.id === taskForm.workerId);
      const client = clients.find((c) => c.id === taskForm.clientId);
      const data = {
        workerId: taskForm.workerId,
        workerName: worker?.name,
        clientId: taskForm.clientId,
        clientName: client?.name,
        type: taskForm.type,
        dueDate: taskForm.dueDate,
        status: taskForm.status,
        notes: taskForm.notes || undefined,
      };
      if (editingTask) await updateItem('tasks', editingTask.id, data);
      else await createItem('tasks', data);
      toast.success(editingTask ? 'Task updated' : 'Task assigned');
      setTaskOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };
  const removeTask = async (id: string) => {
    if (!window.confirm('Delete this task?')) return;
    try {
      await removeItem('tasks', id);
      toast.success('Task deleted');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  };
  const cycleStatus = async (t: FieldTask) => {
    const next: FieldTaskStatus = t.status === 'Assigned' ? 'In Progress' : t.status === 'In Progress' ? 'Done' : 'Assigned';
    try {
      await updateItem('tasks', t.id, { status: next });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    }
  };

  // ----- workers -----
  const addWorker = async () => {
    if (!workerName.trim()) {
      toast.error('Worker name is required');
      return;
    }
    try {
      await createItem('workers', { name: workerName.trim(), phone: workerPhone || undefined, active: true });
      setWorkerName('');
      setWorkerPhone('');
      toast.success('Worker added');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Add failed');
    }
  };
  const removeWorker = async (id: string, name: string) => {
    if (!window.confirm(`Remove worker ${name}? Open tasks stay assigned by name.`)) return;
    try {
      await removeItem('workers', id);
      toast.success('Worker removed');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Field Force</h1>
        <p className="text-sm text-muted-foreground">Visits, samples, attendance and live GPS locations. Updates live.</p>
      </div>

      <Tabs defaultValue="tasks">
        <TabsList>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="locations">Locations</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Workers</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <Input placeholder="Worker name *" value={workerName} onChange={(e) => setWorkerName(e.target.value)} className="sm:max-w-56" />
                <Input placeholder="Phone" value={workerPhone} onChange={(e) => setWorkerPhone(e.target.value)} className="sm:max-w-48" />
                <Button onClick={addWorker}><UserPlus size={16} className="mr-2" />Add worker</Button>
              </div>
              {workers.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {workers.map((w) => (
                    <span key={w.id} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm">
                      {w.name}
                      <button onClick={() => removeWorker(w.id, w.name)} aria-label={`Remove ${w.name}`} className="text-muted-foreground hover:text-destructive">
                        <UserMinus size={14} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Task assignment</CardTitle>
              <Button onClick={startCreateTask}><Plus size={16} className="mr-2" />Assign task</Button>
            </CardHeader>
            <CardContent>
              {tasks.length === 0 ? (
                <EmptyState title="No tasks" description="Assign a client visit or sample drop to a worker." />
              ) : (
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <Table className="min-w-[760px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Worker</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Due</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tasks.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="font-medium">{t.workerName || t.workerId}</TableCell>
                          <TableCell>{t.clientName || t.clientId}</TableCell>
                          <TableCell><Badge variant="secondary">{t.type}</Badge></TableCell>
                          <TableCell>{t.dueDate}</TableCell>
                          <TableCell>
                            <button onClick={() => cycleStatus(t)} title="Click to advance status">
                              <Badge variant={t.status === 'Done' ? 'default' : 'outline'}>{t.status}</Badge>
                            </button>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => startEditTask(t)} aria-label="Edit task"><Pencil size={16} /></Button>
                              <Button variant="ghost" size="icon" onClick={() => removeTask(t.id)} aria-label="Delete task"><Trash2 size={16} /></Button>
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

        <TabsContent value="attendance" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Login / logout tracking</CardTitle></CardHeader>
            <CardContent>
              {attSorted.length === 0 ? (
                <EmptyState title="No attendance yet" description="Logins from the Expo app appear here automatically." />
              ) : (
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <Table className="min-w-[680px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Worker</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Login</TableHead>
                        <TableHead>Logout</TableHead>
                        <TableHead className="text-right">Hours worked</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attSorted.map((r) => (
                        <TableRow key={`${r.workerId}-${r.date}`}>
                          <TableCell className="font-medium">{r.workerName}</TableCell>
                          <TableCell>{r.date}</TableCell>
                          <TableCell>{r.loginAt ? new Date(r.loginAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}</TableCell>
                          <TableCell>{r.logoutAt ? new Date(r.logoutAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}</TableCell>
                          <TableCell className="text-right">{r.hoursWorked ?? '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="locations" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><MapPin size={18} />Live worker locations</CardTitle></CardHeader>
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
                          <TableCell className="font-medium">
                            {l.workerName || workers.find((w) => w.id === l.workerId)?.name || l.workerId}
                          </TableCell>
                          <TableCell>{new Date(l.timestamp).toLocaleString('en-IN')}</TableCell>
                          <TableCell className="text-right">
                            <a
                              href={l.mapsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-primary hover:underline text-sm font-medium"
                            >
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
            <CardHeader><CardTitle className="text-base">Location history</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-1.5 max-w-sm">
                <Label>Worker</Label>
                <Select value={historyWorker || 'none'} onValueChange={(v) => setHistoryWorker(v === 'none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Select worker" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select worker</SelectItem>
                    {workers.map((w) => (
                      <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {historyWorker && (
                history.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No history for this worker.</p>
                ) : (
                  <div className="overflow-x-auto -mx-4 sm:mx-0">
                    <Table className="min-w-[520px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Time</TableHead>
                          <TableHead className="text-right">Map</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {history.map((h) => (
                          <TableRow key={h.id}>
                            <TableCell>{new Date(h.timestamp).toLocaleString('en-IN')}</TableCell>
                            <TableCell className="text-right">
                              <a
                                href={h.mapsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-primary hover:underline text-sm font-medium"
                              >
                                View location <ExternalLink size={14} />
                              </a>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTask ? 'Edit task' : 'Assign task'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Worker *</Label>
                <Select value={taskForm.workerId || 'none'} onValueChange={(v) => setTaskForm({ ...taskForm, workerId: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Select worker" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select worker</SelectItem>
                    {workers.map((w) => (
                      <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Client *</Label>
                <Select value={taskForm.clientId || 'none'} onValueChange={(v) => setTaskForm({ ...taskForm, clientId: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select client</SelectItem>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1.5">
                <Label>Type</Label>
                <Select value={taskForm.type} onValueChange={(v) => setTaskForm({ ...taskForm, type: v as FieldTaskType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="visit">Visit</SelectItem>
                    <SelectItem value="sample">Sample</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Due date *</Label>
                <Input type="date" value={taskForm.dueDate} onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label>Status</Label>
                <Select value={taskForm.status} onValueChange={(v) => setTaskForm({ ...taskForm, status: v as FieldTaskStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FIELD_TASK_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Notes</Label>
              <Textarea value={taskForm.notes} onChange={(e) => setTaskForm({ ...taskForm, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTaskOpen(false)}>Cancel</Button>
            <Button onClick={saveTask} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
