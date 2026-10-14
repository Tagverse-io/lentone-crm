"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useCollection } from "@/lib/use-collection";
import { tasksService, projectsService } from "@/lib/services";
import type { TaskPriority, TaskStatus } from "@/lib/types";
import { nowIso, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/ui/card";
import { Badge, stageTone } from "@/components/ui/badge";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

const STATUSES: TaskStatus[] = ["todo", "in_progress", "done"];
const PRIORITIES: TaskPriority[] = ["low", "medium", "high", "urgent"];

export default function TasksPage(): JSX.Element {
  const { orgId } = useAuth();
  const { items, loading, error, reload } = useCollection(tasksService, orgId);
  const projects = useCollection(projectsService, orgId);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async (): Promise<void> => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await tasksService.create(orgId, {
        projectId: projectId || undefined, title, description: description || undefined,
        status, priority, dueDate: dueDate || undefined, assignedTo: assignedTo || undefined, createdAt: nowIso(),
      });
      setOpen(false);
      setTitle(""); setDescription(""); setProjectId(""); setStatus("todo"); setPriority("medium"); setDueDate(""); setAssignedTo("");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState label="Loading tasks…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div>
      <PageHeader title="Tasks" subtitle="Tasks with due dates appear on the Central Calendar." actions={<Button onClick={() => setOpen(true)}>New task</Button>} />
      <Card><CardContent className="p-0">
        {items.length === 0 ? <EmptyState title="No tasks yet" hint="Create a task to track work." /> : (
          <Table>
            <THead><TH>Title</TH><TH>Status</TH><TH>Priority</TH><TH>Due</TH><TH><span className="sr-only">Actions</span></TH></THead>
            <TBody>
              {items.map((t) => (
                <TR key={t.id}>
                  <TD><span className="font-medium">{t.title}</span><p className="text-xs text-muted-foreground">{t.description ?? ""}</p></TD>
                  <TD><Badge tone={stageTone(t.status)}>{t.status}</Badge></TD>
                  <TD><Badge tone={t.priority === "urgent" || t.priority === "high" ? "danger" : t.priority === "medium" ? "warning" : "muted"}>{t.priority}</Badge></TD>
                  <TD>{formatDate(t.dueDate)}</TD>
                  <TD>
                    <div className="flex flex-wrap gap-1">
                      {STATUSES.filter((s) => s !== t.status).map((s) => (
                        <Button key={s} size="sm" variant="outline" onClick={() => tasksService.update(orgId, t.id, { status: s })}>{s}</Button>
                      ))}
                      <Button size="sm" variant="ghost" onClick={() => tasksService.remove(orgId, t.id)}>Delete</Button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </CardContent></Card>
      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>New task</DialogTitle>
        <div className="grid gap-3">
          <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
          <Field label="Description"><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
          <Field label="Project">
            <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">— No project —</option>
              {projects.items.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <Select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </Field>
            <Field label="Priority">
              <Select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Due date"><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
            <Field label="Assigned to (uid)"><Input value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} /></Field>
          </div>
          <Button onClick={save} disabled={saving || !title.trim()}>{saving ? "Saving…" : "Save task"}</Button>
        </div>
      </Dialog>
    </div>
  );
}
