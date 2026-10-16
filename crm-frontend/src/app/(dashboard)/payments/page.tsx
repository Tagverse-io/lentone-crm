'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  PAYMENT_MODES,
  collectionQuery,
  fmtMoney,
  getCollection,
  invoiceOutstanding,
  recordPaymentAtomic,
  type Invoice,
  type Payment,
  type PaymentMode,
} from '@/lib/db';
import { POLL_FAST_MS, useAppSettings } from '@/lib/realtime';
import { DataTable } from '@/components/ui/data-table';
import { RecordPreview } from '@/components/record-preview';

export default function PaymentsPage() {
  const { data: settings } = useAppSettings();
  const currency = settings?.currency ?? '₹';

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [open, setOpen] = useState(false);
  const [invoiceId, setInvoiceId] = useState('');
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState<PaymentMode>('UPI');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState('');
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<Payment | null>(null);

  const fetchRows = useMemo(() => collectionQuery<Payment>('payments', 'createdAt', 'invoiceKey'), []);

  const openInvoices = invoices.filter((i) => i.status === 'Unpaid' || i.status === 'Partial' || i.status === 'Overdue');

  const startCreate = () => {
    getCollection<Invoice>('invoices').then(setInvoices).catch(() => undefined);
    setInvoiceId('');
    setAmount('');
    setMode('UPI');
    setDate(new Date().toISOString().slice(0, 10));
    setReference('');
    setOpen(true);
  };

  const save = async () => {
    const inv = invoices.find((i) => i.id === invoiceId);
    if (!inv) {
      toast.error('Select an invoice');
      return;
    }
    const amt = Number(amount);
    if (!amount.trim() || !Number.isFinite(amt) || amt <= 0) {
      toast.error('Enter a positive amount');
      return;
    }
    setSaving(true);
    try {
      await recordPaymentAtomic({ invoiceId: inv.id, amount: amt, mode, date, reference: reference.trim() || undefined });
      toast.success(`Payment recorded — invoice ${inv.number} updated automatically`);
      setOpen(false);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Payment failed');
    } finally {
      setSaving(false);
    }
  };

  const selected = invoices.find((i) => i.id === invoiceId);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Payments</h1>
        <p className="text-sm text-muted-foreground">Record a payment — the invoice status updates automatically (Unpaid → Partial → Paid).</p>
      </div>

      <div key={refreshKey}>
        <DataTable<Payment>
          title="All payments"
          queryKey="payments"
          fetchRows={fetchRows}
          searchPlaceholder="Search invoice number…"
          filters={[{ field: 'mode', label: 'Mode', options: PAYMENT_MODES.map((m) => ({ value: m, label: m })) }]}
          defaultPageSize={settings?.defaultRowsPerPage ?? 25}
          pollMs={POLL_FAST_MS}
          addLabel="Record payment"
          onAdd={startCreate}
          onPreview={setPreview}
          emptyTitle="No payments"
          emptyHint="Record your first payment against an invoice."
          columns={[
            { key: 'date', header: 'Date', render: (p) => p.date },
            { key: 'invoiceNumber', header: 'Invoice', render: (p) => <span className="font-medium">{p.invoiceNumber || p.invoiceId.slice(-6)}</span> },
            { key: 'clientName', header: 'Client', render: (p) => p.clientName || '—' },
            { key: 'amount', header: 'Amount', className: 'text-right', render: (p) => fmtMoney(p.amount, currency) },
            { key: 'mode', header: 'Mode', render: (p) => <Badge variant="secondary">{p.mode}</Badge> },
            { key: 'reference', header: 'Reference', render: (p) => p.reference || '—' },
          ]}
        />
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record payment</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Invoice (unpaid / partial / overdue) *</Label>
              <Select value={invoiceId || 'none'} onValueChange={(v) => {
                setInvoiceId(v === 'none' ? '' : v);
                const inv = invoices.find((i) => i.id === v);
                if (inv) setAmount(String(invoiceOutstanding(inv)));
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select invoice" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select invoice</SelectItem>
                  {openInvoices.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.number} · {i.clientName} · due {fmtMoney(invoiceOutstanding(i), currency)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selected && (
                <p className="text-xs text-muted-foreground">
                  Outstanding: {fmtMoney(invoiceOutstanding(selected), currency)} of {fmtMoney(selected.total, currency)}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Amount (₹) *</Label>
                <Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>Mode</Label>
                <Select value={mode} onValueChange={(v) => setMode(v as PaymentMode)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_MODES.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Date</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>Reference</Label>
                <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UTR / cheque no." />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Record'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RecordPreview
        open={Boolean(preview)}
        onOpenChange={(o) => !o && setPreview(null)}
        title={preview ? `Payment · ${fmtMoney(preview.amount, currency)}` : 'Payment'}
        page="payments"
        sections={
          preview
            ? [
                {
                  id: 'info',
                  title: 'Payment info',
                  content: (
                    <div className="grid sm:grid-cols-2 gap-2 text-sm">
                      <div><span className="text-muted-foreground">Invoice: </span>{preview.invoiceNumber || '—'}</div>
                      <div><span className="text-muted-foreground">Client: </span>{preview.clientName || '—'}</div>
                      <div><span className="text-muted-foreground">Amount: </span>{fmtMoney(preview.amount, currency)}</div>
                      <div><span className="text-muted-foreground">Mode: </span>{preview.mode}</div>
                      <div><span className="text-muted-foreground">Date: </span>{preview.date}</div>
                      <div><span className="text-muted-foreground">Reference: </span>{preview.reference || '—'}</div>
                    </div>
                  ),
                },
              ]
            : []
        }
        history={preview ? { entity: 'payments', id: preview.id } : undefined}
      />
    </div>
  );
}
