'use client';

import type { ReactNode } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { CollapsibleCard } from '@/components/ui/collapsible-card';
import { HistoryTimeline } from '@/components/history-timeline';
import { splitLegacy } from '@/lib/db';

export interface PreviewSection {
  id: string;
  title: ReactNode;
  content: ReactNode;
  defaultOpen?: boolean;
}

interface RecordPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  page: string;
  sections: PreviewSection[];
  /** { entity, id } enables the history timeline. */
  history?: { entity: string; id: string };
  /** Legacy rows rendered in a collapsed "Previous records" section. */
  previous?: { rows: { id: string; legacy?: boolean }[]; render: (rows: { id: string }[]) => ReactNode };
}

function toLegacy<T extends { id: string; legacy?: boolean }>(rows: T[]): T[] {
  return splitLegacy(rows).previous as T[];
}

/** Collapsible detail/preview panel with history timeline + collapsed previous records. */
export function RecordPreview({ open, onOpenChange, title, page, sections, history, previous }: RecordPreviewProps) {
  const prevRows = previous ? toLegacy(previous.rows as { id: string; legacy?: boolean }[]) : [];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {sections.map((s) => (
            <CollapsibleCard key={s.id} page={`${page}-preview`} panelId={s.id} title={s.title} defaultOpen={s.defaultOpen ?? true}>
              {s.content}
            </CollapsibleCard>
          ))}
          {history && (
            <CollapsibleCard page={`${page}-preview`} panelId="history" title="History timeline" defaultOpen>
              <HistoryTimeline entity={history.entity} id={history.id} />
            </CollapsibleCard>
          )}
          {previous && prevRows.length > 0 && (
            <CollapsibleCard
              page={`${page}-preview`}
              panelId="previous"
              title={
                <span className="flex items-center gap-2">
                  Previous records
                  <Badge variant="secondary">{prevRows.length}</Badge>
                </span>
              }
              defaultOpen={false}
            >
              {previous.render(prevRows)}
            </CollapsibleCard>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
