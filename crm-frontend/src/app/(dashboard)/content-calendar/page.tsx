"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useCollection } from "@/lib/use-collection";
import { postsService } from "@/lib/services";
import { ErrorState, LoadingState, PageHeader } from "@/components/ui/card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

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

export default function ContentCalendarPage(): JSX.Element {
  const { orgId } = useAuth();
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

  if (loading) return <LoadingState label="Loading content calendar…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const title = new Date(year, month, 1).toLocaleString("en-US", { month: "long", year: "numeric" });

  return (
    <div>
      <PageHeader
        title="Content calendar"
        subtitle="Scheduled social posts by day."
        actions={<>
          <button className="rounded-md border px-3 py-1 text-sm" onClick={() => { const d = new Date(year, month - 1, 1); setYear(d.getFullYear()); setMonth(d.getMonth()); }}>‹ Prev</button>
          <button className="rounded-md border px-3 py-1 text-sm" onClick={() => { const d = new Date(year, month + 1, 1); setYear(d.getFullYear()); setMonth(d.getMonth()); }}>Next ›</button>
        </>}
      />
      <Card>
        <CardHeader><CardTitle>{title} — {items.filter((p) => p.scheduledAt).length} scheduled</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((d) => {
              const inMonth = d.getMonth() === month;
              const posts = byDay.get(d.toDateString()) ?? [];
              return (
                <div key={d.toISOString()} className={`min-h-20 rounded border p-1 text-xs ${inMonth ? "" : "opacity-40"}`}>
                  <p className="font-medium">{d.getDate()}</p>
                  {posts.map((p) => (
                    <Badge key={p.id} tone="info" className="mb-1 block truncate">{p.platform} · {formatDate(p.scheduledAt)}</Badge>
                  ))}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
