'use client';

import useSWR from 'swr';
import { POLL_SLOW_MS } from '@/lib/realtime';
import { getHistory } from '@/lib/db';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function HistoryTimeline({ entity, id }: { entity: string; id: string }) {
  const { data, error, isLoading, mutate } = useSWR(`history:${entity}:${id}`, () => getHistory(entity, id), {
    refreshInterval: POLL_SLOW_MS,
    revalidateOnFocus: true,
    refreshWhenHidden: false,
    dedupingInterval: 5_000,
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">History</p>
        <Button variant="ghost" size="icon" onClick={() => mutate()} title="Refresh history" aria-label="Refresh history">
          <RefreshCw size={14} />
        </Button>
      </div>
      {error ? (
        <p className="text-sm text-destructive">{error.message}</p>
      ) : isLoading && !data ? (
        <p className="text-sm text-muted-foreground">Loading history…</p>
      ) : !data || data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No history yet.</p>
      ) : (
        <ol className="relative ml-1 space-y-3 border-l pl-4">
          {data.map((h) => (
            <li key={h.id} className="text-sm">
              <p className="font-medium">{h.action}</p>
              {h.detail && <p className="text-muted-foreground">{h.detail}</p>}
              <p className="text-xs text-muted-foreground">
                {new Date(h.at).toLocaleString('en-IN')}
                {h.by ? ` · ${h.by}` : ''}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
