"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useCollection } from "@/lib/use-collection";
import { invoicesService, clientsService } from "@/lib/services";
import type { InvoiceStatus, LineItem } from "@/lib/types";
import { nowIso, totals, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/ui/card";
import { Badge, stageTone } from "@/components/ui/badge";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { LineItemsEditor } from "@/components/ui/line-items";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export default function InvoicesPage(): JSX.Element {
  const { orgId } = useAuth();
  const { items, loading, error, reload } = useCollection(invoicesService, orgId);
  const clients = useCollection(clientsService, orgId);
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([{ description: "", quantity: 1, unitPrice: 0 }]);
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async (): Promise<void> => {
    if (!clientId || !dueDate) return;
    setSaving(true);
    try {
      const client = clients.items.find((c) => c.id === clientId);
      const t = totals(lineItems.filter((i) => i.description.trim()), 0);
      await invoicesService.create(orgId, {
        number: `INV-${Date.now().toString(36).toUpperCase()}`,
        clientId,
        clientName: client?.name ?? "",
        items: lineItems,
        subtotal: t.subtotal,
        taxAmount: t.taxAmount,
        total: t.total,
        amountPaid: 0,
        amountDue: t.total,
        status: "draft" as InvoiceStatus,
        issueDate: nowIso().slice(0, 10),
        dueDate,
        createdAt: nowIso(),
      });
      setOpen(false);
      setClientId(""); setLineItems([{ description: "", quantity: 1, unitPrice: 0 }]); setDueDate("");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState label="Loading invoices…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div>
      <PageHeader title="Invoices" subtitle="Print/PDF view per invoice." actions={<Button onClick={() => setOpen(true)}>New invoice</Button>} />
      <Card><CardContent className="p-0">
        {items.length === 0 ? <EmptyState title="No invoices" hint="Accepted quotations create invoices automatically." /> : (
          <Table>
            <THead><TH>Number</TH><TH>Client</TH><TH>Total</TH><TH>Due</TH><TH>Status</TH><TH><span className="sr-only">Actions</span></TH></THead>
            <TBody>
              {items.map((inv) => (
                <TR key={inv.id}>
                  <TD><Link className="font-medium text-primary hover:underline" href={`/invoices/${inv.id}`}>{inv.number}</Link></TD>
                  <TD>{inv.clientName ?? inv.clientId}</TD>
                  <TD>{formatCurrency(inv.total)}</TD>
                  <TD>{inv.amountDue} due · {inv.dueDate}</TD>
                  <TD><Badge tone={stageTone(inv.status)}>{inv.status}</Badge></TD>
                  <TD><Button size="sm" variant="ghost" onClick={() => invoicesService.remove(orgId, inv.id)}>Delete</Button></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </CardContent></Card>
      <Dialog open={open} onClose={() => setOpen(false)} wide>
        <DialogTitle>New invoice</DialogTitle>
        <div className="grid gap-3">
          <Field label="Client">
            <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">Select client…</option>
              {clients.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Items"><LineItemsEditor items={lineItems} onChange={setLineItems} /></Field>
          <Field label="Due date"><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
          <Button onClick={save} disabled={saving || !clientId || !dueDate}>{saving ? "Saving…" : "Save invoice"}</Button>
        </div>
      </Dialog>
    </div>
  );
}
