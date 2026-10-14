"use client";

import { useMemo, useState } from "react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { useAuth } from "@/lib/auth-context";
import { useCollection } from "@/lib/use-collection";
import { videosService } from "@/lib/services";
import type { VideoProduction, VideoStage } from "@/lib/types";
import { nowIso, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/ui/card";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";

const STAGES: VideoStage[] = ["idea", "script", "shoot", "edit", "review", "published"];

export default function VideoPage(): JSX.Element {
  const { orgId } = useAuth();
  const { items, loading, error, reload } = useCollection(videosService, orgId);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const byStage = useMemo(() => {
    const m = new Map<VideoStage, VideoProduction[]>();
    for (const s of STAGES) m.set(s, []);
    for (const v of items) m.get(v.stage)?.push(v);
    return m;
  }, [items]);

  const onDragEnd = async (result: DropResult): Promise<void> => {
    if (!result.destination) return;
    const stage = result.destination.droppableId as VideoStage;
    const v = items.find((x) => x.id === result.draggableId);
    if (!v || v.stage === stage) return;
    await videosService.update(orgId, v.id, { stage });
  };

  const save = async (): Promise<void> => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await videosService.create(orgId, { title, stage: "idea", dueDate: dueDate || undefined, notes: notes || undefined, createdAt: nowIso() });
      setOpen(false); setTitle(""); setDueDate(""); setNotes("");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState label="Loading video pipeline…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div>
      <PageHeader title="Video production" subtitle="Idea → published Kanban." actions={<Button onClick={() => setOpen(true)}>New video</Button>} />
      {items.length === 0 ? <EmptyState title="No videos yet" hint="Add your first production." /> : null}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
          {STAGES.map((stage) => (
            <Droppable droppableId={stage} key={stage}>
              {(provided, snapshot) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className={`min-h-40 rounded-lg border bg-card p-2 ${snapshot.isDraggingOver ? "ring-2 ring-primary" : ""}`} aria-label={`${stage} column`}>
                  <p className="mb-2 px-1 text-sm font-semibold capitalize">{stage} ({byStage.get(stage)?.length ?? 0})</p>
                  {(byStage.get(stage) ?? []).map((v, idx) => (
                    <Draggable draggableId={v.id} index={idx} key={v.id}>
                      {(p, s) => (
                        <div ref={p.innerRef} {...p.draggableProps} {...p.dragHandleProps} className={`mb-2 rounded-md border bg-background p-3 text-sm ${s.isDragging ? "ring-2 ring-primary" : ""}`}>
                          <p className="font-medium">{v.title}</p>
                          <p className="text-xs text-muted-foreground">due {formatDate(v.dueDate)}</p>
                          <button className="mt-1 text-xs text-destructive hover:underline" onClick={() => videosService.remove(orgId, v.id)}>Delete</button>
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
      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>New video</DialogTitle>
        <div className="grid gap-3">
          <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
          <Field label="Due date"><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
          <Field label="Notes"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
          <Button onClick={save} disabled={saving || !title.trim()}>{saving ? "Saving…" : "Save video"}</Button>
        </div>
      </Dialog>
    </div>
  );
}
