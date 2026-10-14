"use client";

import { useMemo } from "react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { useAuth } from "@/lib/auth-context";
import { useCollection } from "@/lib/use-collection";
import { leadsService } from "@/lib/services";
import { backend } from "@/lib/backend-client";
import type { Lead, LeadStage } from "@/lib/types";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

const STAGES: LeadStage[] = ["New", "Contacted", "Qualified", "Proposal", "Won", "Lost"];

export default function PipelinePage(): JSX.Element {
  const { orgId } = useAuth();
  const { items, loading, error, reload } = useCollection(leadsService, orgId);

  const byStage = useMemo(() => {
    const m = new Map<LeadStage, Lead[]>();
    for (const s of STAGES) m.set(s, []);
    for (const l of items) m.get(l.stage)?.push(l);
    return m;
  }, [items]);

  const onDragEnd = async (result: DropResult): Promise<void> => {
    if (!result.destination) return;
    const stage = result.destination.droppableId as LeadStage;
    const lead = items.find((l) => l.id === result.draggableId);
    if (!lead || lead.stage === stage) return;
    await leadsService.update(orgId, lead.id, { stage });
    if (stage === "Won") {
      await backend.leadWon(orgId, lead.id).catch(() => undefined);
    }
  };

  if (loading) return <LoadingState label="Loading pipeline…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div>
      <PageHeader title="Sales pipeline" subtitle="Drag cards between stages. Dropping on Won creates a client + project." />
      {items.length === 0 ? <EmptyState title="No leads yet" hint="Add leads from the Leads page first." /> : null}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
          {STAGES.map((stage) => (
            <Droppable droppableId={stage} key={stage}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`min-h-40 rounded-lg border bg-card p-2 ${snapshot.isDraggingOver ? "ring-2 ring-primary" : ""}`}
                  aria-label={`${stage} column`}
                >
                  <p className="mb-2 px-1 text-sm font-semibold">{stage} ({byStage.get(stage)?.length ?? 0})</p>
                  {(byStage.get(stage) ?? []).map((l, idx) => (
                    <Draggable draggableId={l.id} index={idx} key={l.id}>
                      {(p, s) => (
                        <div
                          ref={p.innerRef}
                          {...p.draggableProps}
                          {...p.dragHandleProps}
                          className={`mb-2 rounded-md border bg-background p-3 text-sm shadow-sm ${s.isDragging ? "ring-2 ring-primary" : ""}`}
                        >
                          <p className="font-medium">{l.name}</p>
                          <p className="text-xs text-muted-foreground">{l.company ?? l.email}</p>
                          <p className="mt-1 text-xs font-medium">{formatCurrency(l.value)}</p>
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
    </div>
  );
}
