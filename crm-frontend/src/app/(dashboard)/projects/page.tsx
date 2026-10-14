"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useCollection } from "@/lib/use-collection";
import { projectsService, clientsService } from "@/lib/services";
import type { Project, ProjectStatus } from "@/lib/types";
import { nowIso, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/ui/card";
import { Badge, stageTone } from "@/components/ui/badge";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";

const STATUSES: ProjectStatus[] = ["not_started", "in_progress", "on_hold", "completed", "cancelled"];

export default function ProjectsPage(): JSX.Element {
  const { orgId } = useAuth();
  const { items, loading, error, reload } = useCollection(projectsService, orgId);
  const clients = useCollection(clientsService, orgId);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [clientId, setClientId] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("not_started");
  const [progress, setProgress] = useState(0);
  const [deadline, setDeadline] = useState("");
  const [saving, setSaving] = useState(false);

  const startCreate = (): void => {
    setEditing(null); setTitle(""); setDescription(""); setClientId(""); setStatus("not_started"); setProgress(0); setDeadline(""); setOpen(true);
  };
  const startEdit = (p: Project): void => {
    setEditing(p); setTitle(p.title); setDescription(p.description ?? ""); setClientId(p.clientId ?? ""); setStatus(p.status); setProgress(p.progress); setDeadline(p.deadline ?? ""); setOpen(true);
  };
  const save = async (): Promise<void> => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const client = clients.items.find((c) => c.id === clientId);
      const payload = { title, description: description || undefined, clientId: clientId || undefined, clientName: client?.name, status, progress, deadline: deadline || undefined };
      if (editing) await projectsService.update(orgId, editing.id, payload);
      else await projectsService.create(orgId, { ...payload, createdAt: nowIso() });
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState label="Loading projects…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div>
      <PageHeader title="Projects" subtitle={`${items.length} projects.`} actions={<Button onClick={startCreate}>New project</Button>} />
      {items.length === 0 ? <EmptyState title="No projects yet" hint="Won leads create projects automatically." /> : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((p) => (
            <Card key={p.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold">{p.title}</p>
                  <Badge tone={stageTone(p.status)}>{p.status}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{p.clientName ?? "No client"} · due {formatDate(p.deadline)}</p>
                <div className="mt-3 h-2 rounded bg-muted" role="progressbar" aria-valuenow={p.progress} aria-valuemin={0} aria-valuemax={100} aria-label={`${p.title} progress`}>
                  <div className="h-2 rounded" style={{ width: `${p.progress}%`, background: "var(--brand-primary)" }} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{p.progress}% complete</p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => startEdit(p)}>Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => projectsService.remove(orgId, p.id)}>Delete</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>{editing ? "Edit project" : "New project"}</DialogTitle>
        <div className="grid gap-3">
          <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
          <Field label="Description"><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
          <Field label="Client">
            <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">— No client —</option>
              {clients.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <Select value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </Field>
            <Field label={`Progress (${progress}%)`}><Input type="range" min={0} max={100} value={progress} onChange={(e) => setProgress(Number(e.target.value))} /></Field>
          </div>
          <Field label="Deadline"><Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></Field>
          <Button onClick={save} disabled={saving || !title.trim()}>{saving ? "Saving…" : "Save project"}</Button>
        </div>
      </Dialog>
    </div>
  );
}
