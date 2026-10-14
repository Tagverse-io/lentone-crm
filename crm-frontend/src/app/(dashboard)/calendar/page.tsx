"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useCollection } from "@/lib/use-collection";
import { eventsService, tasksService, projectsService, followUpsService, postsService } from "@/lib/services";
import { backend } from "@/lib/backend-client";
import { mergeCalendar, SOURCE_COLORS } from "@/lib/calendar";
import type { CalendarSource, CrmEvent } from "@/lib/types";
import { nowIso, formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";

const SOURCES: CalendarSource[] = ["crm", "task", "project", "followup", "social", "google"];

export default function CalendarPage(): JSX.Element {
  const { orgId } = useAuth();
  const events = useCollection(eventsService, orgId);
  const tasks = useCollection(tasksService, orgId);
  const projects = useCollection(projectsService, orgId);
  const followUps = useCollection(followUpsService, orgId);
  const posts = useCollection(postsService, orgId);
  const [disabled, setDisabled] = useState<Set<CalendarSource>>(new Set());
  const [google, setGoogle] = useState<{ id: string; title: string; start: string; end?: string }[]>([]);
  const [googleMsg, setGoogleMsg] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("");
  const [description, setDescription] = useState("");

  const loading = events.loading || tasks.loading || projects.loading || followUps.loading || posts.loading;
  const error = events.error ?? tasks.error ?? projects.error ?? followUps.error ?? posts.error;

  const merged = useMemo(
    () => mergeCalendar({ events: events.items, tasks: tasks.items, projects: projects.items, followUps: followUps.items, posts: posts.items, google }).filter((e) => !disabled.has(e.source)),
    [events.items, tasks.items, projects.items, followUps.items, posts.items, google, disabled],
  );

  const toggle = (s: CalendarSource): void => {
    setDisabled((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  const connectGoogle = async (): Promise<void> => {
    setGoogleMsg(null);
    try {
      const { url } = await backend.googleConnect();
      window.location.href = url;
    } catch (e) {
      setGoogleMsg(e instanceof Error ? e.message : "Google connect failed");
    }
  };

  const syncGoogle = async (): Promise<void> => {
    setGoogleMsg(null);
    try {
      const res = await backend.googleSync(orgId);
      const ev = await backend.googleEvents(orgId);
      setGoogle((ev.events as { id: string; title: string; start: string; end?: string }[]).map((g) => ({ id: g.id, title: g.title, start: g.start, end: g.end })));
      setGoogleMsg(`Synced ${res.imported} Google events.`);
    } catch (e) {
      setGoogleMsg(e instanceof Error ? e.message : "Google sync failed");
    }
  };

  const saveEvent = async (): Promise<void> => {
    if (!title.trim() || !start) return;
    const rec: Omit<CrmEvent, "id" | "createdAt"> = { title, start, description: description || undefined };
    await eventsService.create(orgId, { ...rec, createdAt: nowIso() });
    setOpen(false); setTitle(""); setStart(""); setDescription("");
  };

  if (loading) return <LoadingState label="Loading calendar…" />;
  if (error) return <ErrorState message={error} onRetry={() => { events.reload(); tasks.reload(); projects.reload(); followUps.reload(); posts.reload(); }} />;

  return (
    <div>
      <PageHeader
        title="Central Calendar"
        subtitle="CRM events, tasks, projects, follow-ups, social posts and Google Calendar — colour-coded."
        actions={<><Button variant="outline" onClick={connectGoogle}>Connect Google</Button><Button variant="outline" onClick={syncGoogle}>Sync Google</Button><Button onClick={() => setOpen(true)}>New event</Button></>}
      />
      {googleMsg ? <p className="mb-2 text-sm text-muted-foreground" role="status">{googleMsg}</p> : null}
      <div className="mb-4 flex flex-wrap gap-2">
        {SOURCES.map((s) => (
          <button
            key={s}
            onClick={() => toggle(s)}
            aria-pressed={!disabled.has(s)}
            className={`flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${disabled.has(s) ? "opacity-40" : ""}`}
          >
            <span className="inline-block h-3 w-3 rounded-full" style={{ background: SOURCE_COLORS[s] }} />
            {s}{disabled.has(s) ? " (hidden)" : ""}
          </button>
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle>{merged.length} upcoming items</CardTitle></CardHeader>
        <CardContent>
          {merged.length === 0 ? <EmptyState title="Nothing scheduled" hint="Add events, tasks with due dates, or connect Google." /> : (
            <ul className="divide-y">
              {merged.slice(0, 100).map((e) => (
                <li key={e.id} className="flex items-start gap-3 py-2 text-sm">
                  <span className="mt-1 inline-block h-3 w-3 shrink-0 rounded-full" style={{ background: e.color }} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{e.title}</p>
                    <p className="text-muted-foreground">{formatDateTime(e.start)}{e.end ? ` – ${formatDateTime(e.end)}` : ""}</p>
                    {e.description ? <p className="truncate text-muted-foreground">{e.description}</p> : null}
                  </div>
                  <Badge tone="muted">{e.source}</Badge>
                  {e.link ? <Link href={e.link} className="shrink-0 text-primary hover:underline">Open</Link> : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>New event</DialogTitle>
        <DialogDescription>CRM events auto-appear here.</DialogDescription>
        <div className="grid gap-3">
          <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
          <Field label="Start"><Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
          <Field label="Description"><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
          <Button onClick={saveEvent} disabled={!title.trim() || !start}>Save event</Button>
        </div>
      </Dialog>
    </div>
  );
}
