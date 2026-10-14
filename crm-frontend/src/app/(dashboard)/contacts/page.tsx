"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useCollection } from "@/lib/use-collection";
import { contactsService, clientsService } from "@/lib/services";
import type { Contact } from "@/lib/types";
import { nowIso } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/ui/card";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

const EMPTY = { clientId: "", name: "", email: "", phone: "", designation: "", notes: "" };

export default function ContactsPage(): JSX.Element {
  const { orgId } = useAuth();
  const { items, loading, error, reload } = useCollection(contactsService, orgId);
  const clients = useCollection(clientsService, orgId);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const startCreate = (): void => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const startEdit = (c: Contact): void => {
    setEditing(c);
    setForm({ clientId: c.clientId ?? "", name: c.name, email: c.email, phone: c.phone ?? "", designation: c.designation ?? "", notes: c.notes ?? "" });
    setOpen(true);
  };
  const save = async (): Promise<void> => {
    if (!form.name.trim() || !form.email.trim()) return;
    setSaving(true);
    try {
      if (editing) await contactsService.update(orgId, editing.id, { ...form, clientId: form.clientId || undefined });
      else await contactsService.create(orgId, { ...form, clientId: form.clientId || undefined, isPrimary: false, createdAt: nowIso() });
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState label="Loading contacts…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div>
      <PageHeader title="Contacts" subtitle={`${items.length} contacts.`} actions={<Button onClick={startCreate}>Add contact</Button>} />
      <Card><CardContent className="p-0">
        {items.length === 0 ? <EmptyState title="No contacts yet" hint="Contacts belong to clients." /> : (
          <Table>
            <THead><TH>Name</TH><TH>Email</TH><TH>Designation</TH><TH>Phone</TH><TH><span className="sr-only">Actions</span></TH></THead>
            <TBody>
              {items.map((c) => (
                <TR key={c.id}>
                  <TD><span className="font-medium">{c.name}</span></TD>
                  <TD>{c.email}</TD><TD>{c.designation ?? "—"}</TD><TD>{c.phone ?? "—"}</TD>
                  <TD><div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => startEdit(c)}>Edit</Button>
                    <Button size="sm" variant="ghost" onClick={() => contactsService.remove(orgId, c.id)}>Delete</Button>
                  </div></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </CardContent></Card>
      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>{editing ? "Edit contact" : "Add contact"}</DialogTitle>
        <div className="grid gap-3">
          <Field label="Client">
            <Select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
              <option value="">— No client —</option>
              {clients.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label="Designation"><Input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} /></Field>
          </div>
          <Field label="Notes"><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          <Button onClick={save} disabled={saving || !form.name.trim() || !form.email.trim()}>{saving ? "Saving…" : "Save contact"}</Button>
        </div>
      </Dialog>
    </div>
  );
}
