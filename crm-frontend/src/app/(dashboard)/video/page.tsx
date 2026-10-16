'use client';

import { useMemo, useState } from 'react';
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/firebase/auth-context';
import { useCollection } from '@/lib/use-collection';
import { videosService } from '@/lib/backend-crud';
import type { VideoProduction, VideoStage } from '@/lib/types';
import { nowIso } from '@/lib/utils';
import { EmptyState, LoadingState, ErrorState } from '@/components/ui/states';

const STAGES: VideoStage[] = ['idea', 'script', 'shoot', 'edit', 'review', 'published'];

export default function VideoPage() {
  const { workspace } = useAuth();
  const orgId = workspace?.id ?? null;
  const { items, loading, error, reload } = useCollection(videosService, orgId);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const byStage = useMemo(() => {
    const m = new Map<VideoStage, VideoProduction[]>();
    for (const s of STAGES) m.set(s, []);
    for (const v of items) m.get(v.stage)?.push(v);
    return m;
  }, [items]);

  if (!orgId) return <LoadingState label="Loading workspace…" />;
  if (loading) return <LoadingState label="Loading video pipeline…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const onDragEnd = async (result: DropResult) => {
    if (!orgId || !result.destination) return;
    const stage = result.destination.droppableId as VideoStage;
    const v = items.find((x) => x.id === result.draggableId);
    if (!v || v.stage === stage) return;
    try {
      await videosService.update(orgId, v.id, { stage });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Move failed');
    }
  };

  const save = async () => {
    if (!orgId || !title.trim()) {
      toast.error('Title is required');
      return;
    }
    setSaving(true);
    try {
      await videosService.create(orgId, { title, stage: 'idea', dueDate: dueDate || undefined, notes: notes || undefined, createdAt: nowIso() });
      toast.success('Video added');
      setOpen(false);
      setTitle(''); setDueDate(''); setNotes('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!orgId || !window.confirm('Delete this video?')) return;
    try {
      await videosService.remove(orgId, id);
      toast.success('Video deleted');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const changeStage = async (id: string, stage: VideoStage) => {
    if (!orgId) return;
    try {
      await videosService.update(orgId, id, { stage });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Move failed');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Video production</h1>
          <p className="text-sm text-muted-foreground">Idea → published Kanban.</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus size={16} className="mr-2" />New video</Button>
      </div>
      {items.length === 0 ? <EmptyState title="No videos yet" hint="Add your first production." /> : null}
      <div className="grid gap-3 md:hidden">
        {items.map((v) => (
          <div key={v.id} className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold">{v.title}</p>
              <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium capitalize">{v.stage}</span>
            </div>
            {v.dueDate ? <p className="mt-1 text-sm text-muted-foreground">due {v.dueDate}</p> : null}
            {v.notes ? <p className="mt-1 text-sm text-muted-foreground">{v.notes}</p> : null}
            <div className="mt-2 flex items-center justify-between gap-2">
              <Select value={v.stage} onValueChange={(s) => changeStage(v.id, s as VideoStage)}>
                <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STAGES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <button className="text-xs text-destructive hover:underline" onClick={() => remove(v.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="hidden md:grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
          {STAGES.map((stage) => (
            <Droppable droppableId={stage} key={stage}>
              {(provided, snapshot) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className={`min-h-40 rounded-lg border bg-card p-2 ${snapshot.isDraggingOver ? 'ring-2 ring-primary' : ''}`}>
                  <p className="mb-2 px-1 text-sm font-semibold capitalize">{stage} ({byStage.get(stage)?.length ?? 0})</p>
                  {(byStage.get(stage) ?? []).map((v, idx) => (
                    <Draggable draggableId={v.id} index={idx} key={v.id}>
                      {(p, s) => (
                        <div ref={p.innerRef} {...p.draggableProps} {...p.dragHandleProps} className={`mb-2 rounded-md border bg-background p-3 text-sm ${s.isDragging ? 'ring-2 ring-primary' : ''}`}>
                          <p className="font-medium">{v.title}</p>
                          {v.dueDate ? <p className="text-xs text-muted-foreground">due {v.dueDate}</p> : null}
                          <button className="mt-1 text-xs text-destructive hover:underline" onClick={() => remove(v.id)}>Delete</button>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          ))}
        </div>
      </DragDropContext>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New video</DialogTitle>
            <DialogDescription>Starts in the idea stage.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-2"><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
            <div className="space-y-2"><Label>Due date</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
            <div className="space-y-2"><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save video'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
