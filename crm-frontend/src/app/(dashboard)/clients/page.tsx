"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useCollection } from "@/lib/use-collection";
import { clientsService } from "@/lib/services";
import type { Client } from "@/lib/types";
import { nowIso } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/ui/card";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

const EMPTY = { name: "", email: "", phone: "", company: "", address: "", source: "" };

export default function ClientsPage(): JSX.Element {
  const { orgId } = useAuth();
  const { items, loading, error, reload } = useCollection(clientsService, orgId);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const startCreate = (): void => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const startEdit = (c: Client): void => {
    setEditing(c);
    setForm({ name: c.name, email: c.email, phone: c.phone ?? "", company: c.company ?? "", address: c.address ?? "", source: c.source ?? "" });
    setOpen(true);
  };
  const save = async (): Promise<void> => {
    if (!form.name.trim() || !form.email.trim()) return;
    setSaving(true);
    try {
      if (editing) await clientsService.update(orgId, editing.id, { ...form });
      else await clientsService.create(orgId, { ...form, createdAt: nowIso() });
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState label="Loading clients…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div>
      <PageHeader title="Clients" subtitle={`${items.length} clients.`} actions={<Button onClick={startCreate}>Add client</Button>} />
      <Card><CardContent className="p-0">
        {items.length === 0 ? <EmptyState title="No clients yet" hint="Won leads create clients automatically." /> : (
          <Table>
            <THead><TH>Name</TH><TH>Email</TH><TH>Company</TH><TH>Phone</TH><TH><span className="sr-only">Actions</span></TH></THead>
            <TBody>
              {items.map((c) => (
                <TR key={c.id}>
                  <TD><span className="font-medium">{c.name}</span></TD>
                  <TD>{c.email}</TD><TD>{c.company ?? "—"}</TD><TD>{c.phone ?? "—"}</TD>
                  <TD><div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => startEdit(c)}>Edit</Button>
                    <Button size="sm" variant="ghost" onClick={() => clientsService.remove(orgId, c.id)}>Delete</Button>
                  </div></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </CardContent></Card>
      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>{editing ? "Edit client" : "Add client"}</DialogTitle>
        <div className="grid gap-3">
          <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label="Company"><Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></Field>
          </div>
          <Field label="Address"><Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
          <Button onClick={save} disabled={saving || !form.name.trim() || !form.email.trim()}>{saving ? "Saving…" : "Save client"}</Button>
        </div>
      </Dialog>
    </div>
  );
}
