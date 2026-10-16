'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/firebase/auth-context';
import { useCollection } from '@/lib/use-collection';
import { postsService } from '@/lib/backend-crud';
import { LoadingState, ErrorState } from '@/components/ui/states';

function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - ((first.getDay() + 7) % 7));
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

export default function ContentCalendarPage() {
  const { workspace } = useAuth();
  const orgId = workspace?.id ?? null;
  const { items, loading, error, reload } = useCollection(postsService, orgId);
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const days = useMemo(() => monthGrid(year, month), [year, month]);
  const byDay = useMemo(() => {
    const m = new Map<string, typeof items>();
    for (const p of items) {
      if (!p.scheduledAt) continue;
      const key = new Date(p.scheduledAt).toDateString();
      m.set(key, [...(m.get(key) ?? []), p]);
    }
    return m;
  }, [items]);

  if (!orgId) return <LoadingState label="Loading workspace…" />;
  if (loading) return <LoadingState label="Loading content calendar…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const title = new Date(year, month, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const shift = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Content calendar</h1>
          <p className="text-sm text-muted-foreground">Scheduled social posts by day.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => shift(-1)}>‹ Prev</Button>
          <Button variant="outline" onClick={() => shift(1)}>Next ›</Button>
        </div>
      </div>
      <Card>
        <CardHeader><CardTitle>{title} — {items.filter((p) => p.scheduledAt).length} scheduled</CardTitle></CardHeader>
        <CardContent>
          <div className="hidden md:block">
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d} className="py-1">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {days.map((d) => {
                const inMonth = d.getMonth() === month;
                const posts = byDay.get(d.toDateString()) ?? [];
                return (
                  <div key={d.toISOString()} className={`min-h-20 rounded border p-1 text-xs ${inMonth ? '' : 'opacity-40'}`}>
                    <p className="font-medium">{d.getDate()}</p>
                    {posts.map((p) => (
                      <Badge key={p.id} variant="secondary" className="mb-1 block truncate">{p.platform}</Badge>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="grid gap-3 md:hidden">
            {[...byDay.entries()]
              .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
              .map(([day, posts]) => (
                <div key={day} className="rounded-lg border bg-card p-4 shadow-sm">
                  <p className="font-semibold">{new Date(day).toDateString()}</p>
                  <div className="mt-2 space-y-2">
                    {posts.map((p) => (
                      <div key={p.id} className="flex items-center justify-between gap-2 text-sm">
                        <p className="min-w-0 truncate">{p.content}</p>
                        <Badge variant="secondary">{p.platform}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            {byDay.size === 0 ? <p className="text-sm text-muted-foreground">No scheduled posts this month.</p> : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
