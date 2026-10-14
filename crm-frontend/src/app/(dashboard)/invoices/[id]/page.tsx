"use client";

import { use } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { brand } from "@/brand.config";
import { useAuth } from "@/lib/auth-context";
import { useCollection } from "@/lib/use-collection";
import { invoicesService } from "@/lib/services";
import { Button } from "@/components/ui/button";
import { Card, CardContent, ErrorState, LoadingState, PageHeader } from "@/components/ui/card";
import { Badge, stageTone } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }): JSX.Element {
  const { id } = use(params);
  const { orgId } = useAuth();
  const { items, loading, error, reload } = useCollection(invoicesService, orgId);
  const inv = items.find((i) => i.id === id);

  if (loading) return <LoadingState label="Loading invoice…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!inv) return <ErrorState message="Invoice not found." onRetry={reload} />;

  const downloadPdf = (): void => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(brand.appName, 14, 20);
    doc.setFontSize(11);
    doc.text(`Invoice ${inv.number}`, 14, 30);
    doc.text(`Client: ${inv.clientName ?? inv.clientId}`, 14, 37);
    doc.text(`Issue: ${inv.issueDate}   Due: ${inv.dueDate}`, 14, 44);
    autoTable(doc, {
      startY: 52,
      head: [["Description", "Qty", "Unit price", "Total"]],
      body: inv.items.map((it) => [it.description, String(it.quantity), String(it.unitPrice), String(it.quantity * it.unitPrice)]),
    });
    const y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
    doc.text(`Subtotal: ${inv.subtotal}`, 14, y);
    doc.text(`Tax: ${inv.taxAmount}`, 14, y + 7);
    doc.text(`Total: ${inv.total}`, 14, y + 14);
    doc.text(`Paid: ${inv.amountPaid}   Due: ${inv.amountDue}   Status: ${inv.status}`, 14, y + 21);
    doc.save(`${inv.number}.pdf`);
  };

  return (
    <div>
      <div className="no-print">
        <PageHeader
          title={`Invoice ${inv.number}`}
          subtitle={`${inv.clientName ?? inv.clientId} · issued ${formatDate(inv.issueDate)}`}
          actions={<><Button variant="outline" onClick={() => window.print()}>Print</Button><Button onClick={downloadPdf}>Download PDF</Button></>}
        />
      </div>
      <Card>
        <CardContent className="p-8">
          <div className="mb-6 flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold" style={{ color: "var(--brand-primary)" }}>{brand.appName}</h2>
              <p className="text-sm text-muted-foreground">{brand.supportEmail}</p>
            </div>
            <Badge tone={stageTone(inv.status)}>{inv.status}</Badge>
          </div>
          <div className="mb-4 grid grid-cols-2 gap-4 text-sm">
            <div><p className="text-muted-foreground">Bill to</p><p className="font-medium">{inv.clientName ?? inv.clientId}</p></div>
            <div className="text-right"><p>Issue: {formatDate(inv.issueDate)}</p><p>Due: {formatDate(inv.dueDate)}</p></div>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-muted-foreground"><th className="py-2">Description</th><th>Qty</th><th>Unit</th><th className="text-right">Total</th></tr></thead>
            <tbody>
              {inv.items.map((it, i) => (
                <tr key={i} className="border-b"><td className="py-2">{it.description}</td><td>{it.quantity}</td><td>{formatCurrency(it.unitPrice)}</td><td className="text-right">{formatCurrency(it.quantity * it.unitPrice)}</td></tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 text-right text-sm">
            <p>Subtotal: {formatCurrency(inv.subtotal)}</p>
            <p>Tax: {formatCurrency(inv.taxAmount)}</p>
            <p className="text-base font-bold">Total: {formatCurrency(inv.total)}</p>
            <p>Paid: {formatCurrency(inv.amountPaid)} · Due: {formatCurrency(inv.amountDue)}</p>
          </div>
          {inv.notes ? <p className="mt-4 text-sm text-muted-foreground">{inv.notes}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
