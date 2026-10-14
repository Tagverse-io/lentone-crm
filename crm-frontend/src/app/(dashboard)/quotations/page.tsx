"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useCollection } from "@/lib/use-collection";
import { quotationsService, clientsService } from "@/lib/services";
import { backend } from "@/lib/backend-client";
import type { LineItem, Quotation, QuotationStatus } from "@/lib/types";
import { nowIso, totals, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/ui/card";
import { Badge, stageTone } from "@/components/ui/badge";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { LineItemsEditor } from "@/components/ui/line-items";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

const STATUSES: QuotationStatus[] = ["draft", "sent", "accepted", "rejected", "expired"];

export default function QuotationsPage(): JSX.Element {
  const { orgId } = useAuth();
  const { items, loading, error, reload } = useCollection(quotationsService, orgId);
  const clients = useCollection(clientsService, orgId);
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([{ description: "", quantity: 1, unitPrice: 0 }]);
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async (): Promise<void> => {
    if (!clientId) return;
    setSaving(true);
    try {
      const client = clients.items.find((c) => c.id === clientId);
      const t = totals(lineItems.filter((i) => i.description.trim()), 0);
      await quotationsService.create(orgId, {
        number: `Q-${Date.now().toString(36).toUpperCase()}`,
        clientId,
        clientName: client?.name ?? "",
        items: lineItems,
        subtotal: t.subtotal,
        taxAmount: t.taxAmount,
        total: t.total,
        status: "draft",
        validUntil,
        notes: notes || undefined,
        createdAt: nowIso(),
      });
      setOpen(false);
      setClientId(""); setLineItems([{ description: "", quantity: 1, unitPrice: 0 }]); setValidUntil(""); setNotes("");
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (q: Quotation, status: QuotationStatus): Promise<void> => {
    await quotationsService.update(orgId, q.id, { status });
    if (status === "accepted") {
      await backend.quotationAccepted(orgId, q.id).catch(() => undefined);
    }
  };

  if (loading) return <LoadingState label="Loading quotations…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div>
      <PageHeader title="Quotations" subtitle="Accepting a quotation creates an invoice automatically." actions={<Button onClick={() => setOpen(true)}>New quotation</Button>} />
      <Card><CardContent className="p-0">
        {items.length === 0 ? <EmptyState title="No quotations" hint="Create your first quotation." /> : (
          <Table>
            <THead><TH>Number</TH><TH>Client</TH><TH>Total</TH><TH>Status</TH><TH><span className="sr-only">Actions</span></TH></THead>
            <TBody>
              {items.map((q) => (
                <TR key={q.id}>
                  <TD className="font-medium">{q.number}</TD>
                  <TD>{q.clientName ?? q.clientId}</TD>
                  <TD>{formatCurrency(q.total)}</TD>
                  <TD><Badge tone={stageTone(q.status)}>{q.status}</Badge></TD>
                  <TD>
                    <div className="flex flex-wrap gap-1">
                      {STATUSES.filter((s) => s !== q.status).map((s) => (
                        <Button key={s} size="sm" variant="outline" onClick={() => setStatus(q, s)}>{s}</Button>
                      ))}
                      <Button size="sm" variant="ghost" onClick={() => quotationsService.remove(orgId, q.id)}>Delete</Button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </CardContent></Card>
      <Dialog open={open} onClose={() => setOpen(false)} wide>
        <DialogTitle>New quotation</DialogTitle>
        <DialogDescription>Items, totals and validity.</DialogDescription>
        <div className="grid gap-3">
          <Field label="Client">
            <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">Select client…</option>
              {clients.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Items"><LineItemsEditor items={lineItems} onChange={setLineItems} /></Field>
          <Field label="Valid until"><Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} /></Field>
          <Field label="Notes"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
          <Button onClick={save} disabled={saving || !clientId}>{saving ? "Saving…" : "Save quotation"}</Button>
        </div>
      </Dialog>
    </div>
  );
}
