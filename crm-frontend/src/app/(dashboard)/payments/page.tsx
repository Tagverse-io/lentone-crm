"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useCollection } from "@/lib/use-collection";
import { paymentsService, invoicesService } from "@/lib/services";
import { backend } from "@/lib/backend-client";
import { nowIso, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/ui/card";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export default function PaymentsPage(): JSX.Element {
  const { orgId } = useAuth();
  const { items, loading, error, reload } = useCollection(paymentsService, orgId);
  const invoices = useCollection(invoicesService, orgId);
  const [open, setOpen] = useState(false);
  const [invoiceId, setInvoiceId] = useState("");
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState("bank_transfer");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async (): Promise<void> => {
    if (!invoiceId || amount <= 0) return;
    setSaving(true);
    try {
      const p = await paymentsService.create(orgId, { invoiceId, amount, method, reference: reference || undefined, notes: notes || undefined, date: nowIso().slice(0, 10), createdAt: nowIso() });
      // Event-driven automation: update invoice status + totals (idempotent).
      await backend.paymentReceived(orgId, p.id).catch(() => undefined);
      setOpen(false);
      setInvoiceId(""); setAmount(0); setMethod("bank_transfer"); setReference(""); setNotes("");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState label="Loading payments…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div>
      <PageHeader title="Payments" subtitle="Recording a payment updates the invoice automatically." actions={<Button onClick={() => setOpen(true)}>Record payment</Button>} />
      <Card><CardContent className="p-0">
        {items.length === 0 ? <EmptyState title="No payments yet" hint="Record a payment against an invoice." /> : (
          <Table>
            <THead><TH>Date</TH><TH>Amount</TH><TH>Method</TH><TH>Reference</TH></THead>
            <TBody>
              {items.map((p) => (
                <TR key={p.id}>
                  <TD>{p.date}</TD><TD className="font-medium">{formatCurrency(p.amount)}</TD><TD>{p.method}</TD><TD>{p.reference ?? "—"}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </CardContent></Card>
      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>Record payment</DialogTitle>
        <div className="grid gap-3">
          <Field label="Invoice">
            <Select value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)}>
              <option value="">Select invoice…</option>
              {invoices.items.map((i) => <option key={i.id} value={i.id}>{i.number} · {formatCurrency(i.amountDue)} due</option>)}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount"><Input type="number" min={0} value={amount} onChange={(e) => setAmount(Number(e.target.value))} /></Field>
            <Field label="Method">
              <Select value={method} onChange={(e) => setMethod(e.target.value)}>
                {["cash", "bank_transfer", "upi", "credit_card", "debit_card", "cheque", "other"].map((m) => <option key={m} value={m}>{m}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Reference"><Input value={reference} onChange={(e) => setReference(e.target.value)} /></Field>
          <Field label="Notes"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
          <Button onClick={save} disabled={saving || !invoiceId || amount <= 0}>{saving ? "Saving…" : "Save payment"}</Button>
        </div>
      </Dialog>
    </div>
  );
}
