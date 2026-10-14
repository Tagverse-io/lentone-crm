"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useCollection } from "@/lib/use-collection";
import { leadsService } from "@/lib/services";
import { backend } from "@/lib/backend-client";
import type { Lead, LeadStage } from "@/lib/types";
import { nowIso } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/ui/card";
import { Badge, stageTone } from "@/components/ui/badge";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

const STAGES: LeadStage[] = ["New", "Contacted", "Qualified", "Proposal", "Won", "Lost"];

const EMPTY: Omit<Lead, "id" | "createdAt" | "updatedAt"> = {
  name: "", email: "", phone: "", company: "", stage: "New", value: 0, source: "Manual", assignedTo: "", notes: "", nextFollowUp: "",
};

export default function LeadsPage(): JSX.Element {
  const { orgId } = useAuth();
  const { items, loading, error, reload } = useCollection(leadsService, orgId);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<string>("All");

  const startCreate = (): void => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const startEdit = (l: Lead): void => {
    setEditing(l);
    setForm({ name: l.name, email: l.email, phone: l.phone ?? "", company: l.company ?? "", stage: l.stage, value: l.value ?? 0, source: l.source ?? "Manual", assignedTo: l.assignedTo ?? "", notes: l.notes ?? "", nextFollowUp: l.nextFollowUp ?? "" });
    setOpen(true);
  };

  const save = async (): Promise<void> => {
    if (!form.name.trim() || !form.email.trim()) return;
    setSaving(true);
    try {
      const prevStage = editing?.stage;
      if (editing) {
        await leadsService.update(orgId, editing.id, { ...form });
        if (prevStage !== "Won" && form.stage === "Won") {
          // Event-driven automation: create client + project (idempotent on backend).
          await backend.leadWon(orgId, editing.id).catch(() => undefined);
        }
      } else {
        await leadsService.create(orgId, { ...form, createdAt: nowIso() });
      }
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const visible = filter === "All" ? items : items.filter((l) => l.stage === filter);

  if (loading) return <LoadingState label="Loading leads…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div>
      <PageHeader
        title="Leads"
        subtitle={`${items.length} leads in the pipeline.`}
        actions={<Button onClick={startCreate}>Add lead</Button>}
      />
      <div className="mb-4 flex gap-2 overflow-x-auto">
        {["All", ...STAGES].map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`rounded-full border px-3 py-1 text-sm ${filter === s ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}>
            {s}
          </button>
        ))}
      </div>
      <Card>
        <CardContent className="p-0">
          {visible.length === 0 ? (
            <EmptyState title="No leads found" hint="Add a lead or change the stage filter." />
          ) : (
            <Table>
              <THead><TH>Name</TH><TH>Company</TH><TH>Stage</TH><TH>Value</TH><TH>Follow-up</TH><TH><span className="sr-only">Actions</span></TH></THead>
              <TBody>
                {visible.map((l) => (
                  <TR key={l.id}>
                    <TD><p className="font-medium">{l.name}</p><p className="text-xs text-muted-foreground">{l.email}</p></TD>
                    <TD>{l.company ?? "—"}</TD>
                    <TD><Badge tone={stageTone(l.stage)}>{l.stage}</Badge></TD>
                    <TD>{l.value ?? 0}</TD>
                    <TD>{l.nextFollowUp ?? "—"}</TD>
                    <TD>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => startEdit(l)}>Edit</Button>
                        <Button size="sm" variant="ghost" onClick={() => leadsService.remove(orgId, l.id)}>Delete</Button>
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>{editing ? "Edit lead" : "Add lead"}</DialogTitle>
        <DialogDescription>Moving a lead to Won creates a client and project automatically.</DialogDescription>
        <div className="grid gap-3">
          <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
          <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label="Company"><Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Stage">
              <Select value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value as LeadStage })}>
                {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </Field>
            <Field label="Value"><Input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Source"><Input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} /></Field>
            <Field label="Assigned to (uid)"><Input value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })} /></Field>
          </div>
          <Field label="Next follow-up"><Input type="date" value={form.nextFollowUp} onChange={(e) => setForm({ ...form, nextFollowUp: e.target.value })} /></Field>
          <Field label="Notes"><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          <Button onClick={save} disabled={saving || !form.name.trim() || !form.email.trim()}>{saving ? "Saving…" : "Save lead"}</Button>
        </div>
      </Dialog>
    </div>
  );
}
