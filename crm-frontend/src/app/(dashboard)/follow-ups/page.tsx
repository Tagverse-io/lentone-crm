"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useCollection } from "@/lib/use-collection";
import { followUpsService } from "@/lib/services";
import type { FollowUp } from "@/lib/types";
import { nowIso, formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

const EMPTY = { title: "", notes: "", dueAt: "", assignedTo: "" };

export default function FollowUpsPage(): JSX.Element {
  const { orgId } = useAuth();
  const { items, loading, error, reload } = useCollection(followUpsService, orgId);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const save = async (): Promise<void> => {
    if (!form.title.trim() || !form.dueAt) return;
    setSaving(true);
    try {
      await followUpsService.create(orgId, { ...form, done: false, createdAt: nowIso() });
      setOpen(false);
      setForm(EMPTY);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState label="Loading follow-ups…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div>
      <PageHeader title="Follow-ups" subtitle="Due today and overdue items feed the daily digest." actions={<Button onClick={() => setOpen(true)}>Add follow-up</Button>} />
      <Card><CardContent className="p-0">
        {items.length === 0 ? <EmptyState title="No follow-ups" hint="Schedule a follow-up for a lead or client." /> : (
          <Table>
            <THead><TH>Title</TH><TH>Due</TH><TH>Status</TH><TH><span className="sr-only">Actions</span></TH></THead>
            <TBody>
              {items.map((f: FollowUp) => (
                <TR key={f.id}>
                  <TD><span className="font-medium">{f.title}</span><p className="text-xs text-muted-foreground">{f.notes ?? ""}</p></TD>
                  <TD>{formatDateTime(f.dueAt)}</TD>
                  <TD><Badge tone={f.done ? "success" : new Date(f.dueAt) < new Date() ? "danger" : "warning"}>{f.done ? "Done" : new Date(f.dueAt) < new Date() ? "Overdue" : "Pending"}</Badge></TD>
                  <TD><div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => followUpsService.update(orgId, f.id, { done: !f.done })}>{f.done ? "Reopen" : "Done"}</Button>
                    <Button size="sm" variant="ghost" onClick={() => followUpsService.remove(orgId, f.id)}>Delete</Button>
                  </div></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </CardContent></Card>
      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>Add follow-up</DialogTitle>
        <div className="grid gap-3">
          <Field label="Title"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <Field label="Due at"><Input type="datetime-local" value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} /></Field>
          <Field label="Assigned to (uid)"><Input value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })} /></Field>
          <Field label="Notes"><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          <Button onClick={save} disabled={saving || !form.title.trim() || !form.dueAt}>{saving ? "Saving…" : "Save follow-up"}</Button>
        </div>
      </Dialog>
    </div>
  );
}
