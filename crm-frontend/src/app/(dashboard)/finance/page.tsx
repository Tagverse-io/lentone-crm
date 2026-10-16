'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/firebase/auth-context';
import { useCollection } from '@/lib/use-collection';
import { expensesService } from '@/lib/backend-crud';
import { creditNotesService } from '@/lib/backend-crud';
import { backendFetch } from '@/lib/backend-client';
import { getInvoices } from '@/lib/firebase/database';
import { subscribeToPayments } from '@/lib/db/payments/api';
import type { Invoice, NormalizedPayment } from '@/lib/db/types';
import type { CreditNote } from '@/lib/types';
import { useWorkspace } from '@/lib/settings/workspace-context';
import { useFmt, getFinancialYearRange } from '@/lib/format';
import { usePermissions } from '@/components/context/permissions-context';
import { nowIso } from '@/lib/utils';
import { EmptyState, LoadingState, ErrorState } from '@/components/ui/states';

const FALLBACK_CATEGORIES = ['Rent', 'Salaries', 'Utilities', 'Marketing', 'Travel', 'Software', 'Tax', 'Other'];

const BUILD_ORDER = [
  'Expenses (this section)',
  'Receivables aging',
  'Credit notes',
  'Tax summary',
  'Collections + outstanding reports + CSV',
  'P&L (cash basis)',
];

export default function FinancePage() {
  const { workspace } = useAuth();
  const { settings } = useWorkspace();
  const { hasPermission } = usePermissions();
  const fmt = useFmt();
  const orgId = workspace?.id ?? null;
  const { items, loading, error, reload } = useCollection(expensesService, orgId);
  const { items: creditNotes, loading: cnLoading } = useCollection(creditNotesService, orgId);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<NormalizedPayment[]>([]);

  useEffect(() => {
    if (!orgId) return;
    getInvoices(orgId).then(setInvoices).catch(() => setInvoices([]));
    const unsub = subscribeToPayments(orgId, setPayments);
    return () => unsub();
  }, [orgId]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<{ id: string } | null>(null);
  const [form, setForm] = useState({ date: '', category: '', vendor: '', amount: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [cnOpen, setCnOpen] = useState(false);
  const [cnForm, setCnForm] = useState({ invoiceId: '', amount: '', reason: '' });
  const [cnSaving, setCnSaving] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const categories = settings?.general?.expense_categories?.length
    ? settings.general.expense_categories
    : FALLBACK_CATEGORIES;

  const canEdit = hasPermission('payments', 'edit');
  const canDelete = hasPermission('payments', 'delete');
  const total = items.reduce((s, e) => s + (e.amount || 0), 0);

  // Receivables aging on NET amount_due (after payments; credit-note netting plugs in at step 3).
  const aging = useMemo(() => {
    const buckets = { b30: 0, b60: 0, b90: 0, bOver: 0 };
    const byCustomer = new Map<string, number>();
    const rows: { id: string; customer: string; number: string; due: string; days: number; bucket: string; amount: number }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (const inv of invoices) {
      const net = Math.max(0, inv.amount_due ?? (inv.amount - (inv.amount_paid ?? 0)));
      if (net <= 0 || inv.status === 'paid' || inv.status === 'cancelled' || inv.status === 'credited') continue;
      const dueStr = inv.due_date || inv.issue_date || inv.created_at;
      const due = new Date(dueStr);
      const days = Number.isNaN(due.getTime()) ? 0 : Math.floor((today.getTime() - new Date(due.toDateString()).getTime()) / 86400000);
      const bucket = days <= 30 ? '0–30' : days <= 60 ? '31–60' : days <= 90 ? '61–90' : '90+';
      if (days <= 30) buckets.b30 += net; else if (days <= 60) buckets.b60 += net; else if (days <= 90) buckets.b90 += net; else buckets.bOver += net;
      const customer = inv.client_id || inv.client_company || inv.client_name || 'Unknown';
      byCustomer.set(customer, (byCustomer.get(customer) ?? 0) + net);
      rows.push({ id: inv.id, customer, number: inv.invoice_number, due: dueStr, days, bucket, amount: net });
    }
    rows.sort((a, b) => b.days - a.days);
    return { buckets, customers: [...byCustomer.entries()].sort((a, b) => b[1] - a[1]), rows, total: buckets.b30 + buckets.b60 + buckets.b90 + buckets.bOver };
  }, [invoices]);

  // Tax summary: invoices minus credit notes, counted when issued (applied
  // notes are the same record — never counted twice). FY window from Settings.
  const taxSummary = useMemo(() => {
    const fy = getFinancialYearRange(settings?.general?.financial_year ?? 'jan-dec');
    const inWindow = (iso?: string): boolean => {
      if (!iso) return false;
      const d = new Date(iso);
      return !Number.isNaN(d.getTime()) && d >= fy.start && d <= fy.end;
    };
    const round2 = (n: number): number => Math.round(n * 100) / 100;
    const split = (base: number, cgstP: number, sgstP: number, igstP: number, vatP: number, fallbackTax: number) => {
      const cgst = round2((base * cgstP) / 100);
      const sgst = round2((base * sgstP) / 100);
      const igst = round2((base * igstP) / 100);
      const vat = round2((base * vatP) / 100);
      const parts = cgst + sgst + igst + vat;
      const other = parts > 0 ? 0 : round2(fallbackTax);
      return { cgst, sgst, igst, vat: vat + other };
    };
    const inv = { cgst: 0, sgst: 0, igst: 0, vat: 0 };
    for (const i of invoices) {
      if (!inWindow(i.issue_date || i.created_at)) continue;
      const base = (i.subtotal ?? i.amount) - (i.discount_amount ?? 0);
      const p = split(base, i.cgst_percent ?? 0, i.sgst_percent ?? 0, i.igst_percent ?? 0, 0, i.tax_amount ?? i.tax ?? 0);
      inv.cgst = round2(inv.cgst + p.cgst); inv.sgst = round2(inv.sgst + p.sgst);
      inv.igst = round2(inv.igst + p.igst); inv.vat = round2(inv.vat + p.vat);
    }
    const cn = { cgst: 0, sgst: 0, igst: 0, vat: 0 };
    for (const c of creditNotes) {
      if (c.status === 'cancelled' || !inWindow(c.date || c.createdAt)) continue;
      const base = c.amount;
      const p = split(base, c.cgst ?? 0, c.sgst ?? 0, c.igst ?? 0, c.vat ?? 0, c.taxAmount);
      cn.cgst = round2(cn.cgst + p.cgst); cn.sgst = round2(cn.sgst + p.sgst);
      cn.igst = round2(cn.igst + p.igst); cn.vat = round2(cn.vat + p.vat);
    }
    const net = {
      cgst: round2(inv.cgst - cn.cgst), sgst: round2(inv.sgst - cn.sgst),
      igst: round2(inv.igst - cn.igst), vat: round2(inv.vat - cn.vat),
    };
    return { fyLabel: fy.label, inv, cn, net, total: round2(net.cgst + net.sgst + net.igst + net.vat) };
  }, [invoices, creditNotes, settings]);

  function downloadCsv(filename: string, rows: (string | number)[][]): void {
    const esc = (v: string | number): string => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const blob = new Blob([rows.map((r) => r.map(esc).join(',')).join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // Collections: completed INCOME payments in the FY window, by method.
  // Refunded/pending/failed payments never count as collections, and
  // operation bills (payment_type expense) are expenses, not collections.
  const collections = useMemo(() => {
    const fy = getFinancialYearRange(settings?.general?.financial_year ?? 'jan-dec');
    const byMethod = new Map<string, number>();
    let total = 0;
    const rows: { id: string; date: string; method: string; amount: number; invoice: string }[] = [];
    for (const p of payments) {
      if ((p.status ?? 'completed') !== 'completed') continue;
      if ((p.payment_type ?? 'income') !== 'income') continue;
      const d = new Date(p.date);
      if (Number.isNaN(d.getTime()) || d < fy.start || d > fy.end) continue;
      byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + p.amount);
      total = Math.round((total + p.amount) * 100) / 100;
      rows.push({ id: p.payment_id, date: p.date, method: p.method, amount: p.amount, invoice: p.invoice_id || 'unallocated' });
    }
    rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return { byMethod: [...byMethod.entries()], total, rows, fyLabel: fy.label };
  }, [payments, settings]);

  // P&L, cash basis: income = completed income payments (FY window);
  // expenses = Finance expenses + legacy operation bills (payment_type
  // expense, completed), each counted once — separate RTDB paths, no overlap.
  const pnl = useMemo(() => {
    const fy = getFinancialYearRange(settings?.general?.financial_year ?? 'jan-dec');
    const inWindow = (iso?: string): boolean => {
      if (!iso) return false;
      const d = new Date(iso);
      return !Number.isNaN(d.getTime()) && d >= fy.start && d <= fy.end;
    };
    const income = collections.total;
    let expenseTotal = 0;
    for (const e of items) {
      if (inWindow(e.date)) expenseTotal = Math.round((expenseTotal + e.amount) * 100) / 100;
    }
    let legacyBills = 0;
    for (const p of payments) {
      if (p.payment_type !== 'expense' || (p.status ?? 'completed') !== 'completed') continue;
      if (inWindow(p.date)) legacyBills = Math.round((legacyBills + p.amount) * 100) / 100;
    }
    const expenses = Math.round((expenseTotal + legacyBills) * 100) / 100;
    return { fyLabel: fy.label, income, expenseTotal, legacyBills, expenses, net: Math.round((income - expenses) * 100) / 100 };
  }, [collections, items, payments, settings]);

  const startCreate = () => {
    setEditing(null);
    setForm({ date: new Date().toISOString().split('T')[0], category: categories[0] ?? '', vendor: '', amount: '', notes: '' });
    setOpen(true);
  };
  const startEdit = (e: { id: string; date: string; category: string; vendor?: string; amount: number; notes?: string }) => {
    setEditing({ id: e.id });
    setForm({ date: e.date, category: e.category, vendor: e.vendor ?? '', amount: String(e.amount), notes: e.notes ?? '' });
    setOpen(true);
  };

  const save = async () => {
    if (!orgId || !form.date || !form.category || !form.amount) {
      toast.error('Date, category and amount are required');
      return;
    }
    const amount = parseFloat(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    setSaving(true);
    try {
      // No per-expense currency — the Settings currency always applies.
      const payload = { date: form.date, category: form.category, vendor: form.vendor || undefined, amount, notes: form.notes || undefined, createdAt: nowIso() };
      if (editing) {
        await expensesService.update(orgId, editing.id, payload);
        toast.success('Expense updated');
      } else {
        await expensesService.create(orgId, payload);
        toast.success('Expense recorded');
      }
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!orgId || !window.confirm('Delete this expense?')) return;
    try {
      await expensesService.remove(orgId, id);
      toast.success('Expense deleted');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const invoiceRemaining = (inv: Invoice): number =>
    Math.max(0, inv.amount_due ?? (inv.amount - (inv.amount_paid ?? 0)));

  const cnTax = {
    cgst: settings?.branding?.tax_cgst ?? 0,
    sgst: settings?.branding?.tax_sgst ?? 0,
    igst: settings?.branding?.tax_igst ?? 0,
    vat: settings?.branding?.tax_vat ?? 0,
  };
  const cnAmount = parseFloat(cnForm.amount) || 0;
  const cnTaxAmount = Math.round((cnAmount * (cnTax.cgst + cnTax.sgst + cnTax.igst + cnTax.vat)) / 100 * 100) / 100;
  const cnTotal = Math.round((cnAmount + cnTaxAmount) * 100) / 100;
  const cnInvoice = invoices.find((i) => i.id === cnForm.invoiceId);

  const saveCreditNote = async () => {
    if (!orgId || !cnForm.invoiceId || !cnAmount) {
      toast.error('Invoice and amount are required');
      return;
    }
    if (!(cnAmount > 0)) {
      toast.error('Enter a valid amount');
      return;
    }
    if (cnInvoice && cnTotal - invoiceRemaining(cnInvoice) > 1e-9) {
      toast.error('Credit exceeds the remaining invoice amount');
      return;
    }
    setCnSaving(true);
    try {
      // Number + issued status come from the backend (Settings prefix, atomic counter).
      await creditNotesService.create(orgId, {
        invoiceId: cnForm.invoiceId,
        invoiceNumber: cnInvoice?.invoice_number,
        clientId: cnInvoice?.client_id,
        amount: cnAmount,
        cgst: cnTax.cgst, sgst: cnTax.sgst, igst: cnTax.igst, vat: cnTax.vat,
        taxAmount: cnTaxAmount, total: cnTotal,
        reason: cnForm.reason || undefined,
        date: new Date().toISOString().split('T')[0],
        createdAt: nowIso(),
      });
      toast.success('Credit note issued');
      setCnOpen(false);
      setCnForm({ invoiceId: '', amount: '', reason: '' });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setCnSaving(false);
    }
  };

  const applyCreditNote = async (cn: CreditNote) => {
    if (!orgId || applyingId) return;
    setApplyingId(cn.id);
    try {
      await backendFetch(`/api/finance/credit-notes/apply`, {
        method: 'POST',
        body: JSON.stringify({ orgId, creditNoteId: cn.id }),
      });
      toast.success('Credit note applied');
      const data = await getInvoices(orgId);
      setInvoices(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Apply failed');
    } finally {
      setApplyingId(null);
    }
  };

  if (!orgId) return <LoadingState label="Loading workspace…" />;
  if (!hasPermission('payments', 'view')) return <ErrorState message="You don't have access to Finance." onRetry={reload} />;
  if (loading) return <LoadingState label="Loading finance…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Finance</h1>
          <p className="text-sm text-muted-foreground">Expenses, receivables, tax and reports — Settings currency applies throughout.</p>
        </div>
        {canEdit ? <Button onClick={startCreate}><Plus size={16} className="mr-2" />Add expense</Button> : null}
      </div>
      <Card>
        <CardHeader><CardTitle>Expenses — {fmt.money(total)} total</CardTitle></CardHeader>
        <CardContent>
          {items.length === 0 ? <EmptyState title="No expenses yet" hint="Record your first operating expense." /> : (
            <>
              <div className="overflow-x-auto hidden md:block">
                <Table>
                  <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Category</TableHead><TableHead>Vendor</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {items.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell>{fmt.date(e.date)}</TableCell>
                        <TableCell><Badge variant="secondary">{e.category}</Badge></TableCell>
                        <TableCell>{e.vendor ?? '—'}</TableCell>
                        <TableCell className="text-right font-medium">{fmt.money(e.amount)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {canEdit ? <Button size="icon" variant="ghost" onClick={() => startEdit(e)} aria-label="Edit"><Pencil size={14} /></Button> : null}
                            {canDelete ? <Button size="icon" variant="ghost" onClick={() => remove(e.id)} aria-label="Delete"><Trash2 size={14} /></Button> : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="grid gap-3 md:hidden">
                {items.map((e) => (
                  <div key={e.id} className="rounded-lg border bg-card p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <Badge variant="secondary">{e.category}</Badge>
                      <p className="font-semibold">{fmt.money(e.amount)}</p>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{fmt.date(e.date)}{e.vendor ? ` · ${e.vendor}` : ''}</p>
                    {e.notes ? <p className="mt-1 text-sm text-muted-foreground">{e.notes}</p> : null}
                    <div className="mt-2 flex gap-1">
                      {canEdit ? <Button size="sm" variant="outline" onClick={() => startEdit(e)}>Edit</Button> : null}
                      {canDelete ? <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(e.id)}>Delete</Button> : null}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Receivables aging — {fmt.money(aging.total)} outstanding (net)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {([['0–30', aging.buckets.b30], ['31–60', aging.buckets.b60], ['61–90', aging.buckets.b90], ['90+', aging.buckets.bOver]] as const).map(([label, value]) => (
              <div key={label} className="rounded-lg border bg-card p-4 shadow-sm">
                <p className="text-xs font-medium text-muted-foreground">{label} days</p>
                <p className="mt-1 text-xl font-bold">{fmt.money(value)}</p>
              </div>
            ))}
          </div>
          {aging.customers.length > 0 ? (
            <>
              <div className="overflow-x-auto hidden md:block">
                <Table>
                  <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead className="text-right">Outstanding</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {aging.customers.map(([customer, amount]) => (
                      <TableRow key={customer}>
                        <TableCell className="font-medium">{customer}</TableCell>
                        <TableCell className="text-right">{fmt.money(amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="grid gap-3 md:hidden">
                {aging.customers.map(([customer, amount]) => (
                  <div key={customer} className="flex items-center justify-between rounded-lg border bg-card p-4 shadow-sm">
                    <p className="font-medium">{customer}</p>
                    <p className="font-semibold">{fmt.money(amount)}</p>
                  </div>
                ))}
              </div>
            </>
          ) : <p className="text-sm text-muted-foreground">No outstanding receivables.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Credit notes</CardTitle>
            {canEdit ? <Button size="sm" onClick={() => { setCnForm({ invoiceId: '', amount: '', reason: '' }); setCnOpen(true); }}><Plus size={14} className="mr-1" />New credit note</Button> : null}
          </div>
        </CardHeader>
        <CardContent>
          {cnLoading ? <p className="text-sm text-muted-foreground">Loading…</p>
            : creditNotes.length === 0 ? <p className="text-sm text-muted-foreground">No credit notes yet.</p> : (
              <>
                <div className="overflow-x-auto hidden md:block">
                  <Table>
                    <TableHeader><TableRow><TableHead>Number</TableHead><TableHead>Invoice</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {creditNotes.map((cn) => (
                        <TableRow key={cn.id}>
                          <TableCell className="font-mono text-xs">{cn.number}</TableCell>
                          <TableCell>{cn.invoiceNumber ?? cn.invoiceId}</TableCell>
                          <TableCell className="text-right font-medium">{fmt.money(cn.total)}</TableCell>
                          <TableCell><Badge variant="secondary">{cn.status}</Badge></TableCell>
                          <TableCell className="text-right">
                            {cn.status === 'issued' && canEdit ? (
                              <Button size="sm" variant="outline" disabled={applyingId === cn.id} onClick={() => applyCreditNote(cn)}>
                                {applyingId === cn.id ? 'Applying…' : 'Apply'}
                              </Button>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="grid gap-3 md:hidden">
                  {creditNotes.map((cn) => (
                    <div key={cn.id} className="rounded-lg border bg-card p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-mono text-xs">{cn.number}</p>
                        <Badge variant="secondary">{cn.status}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{cn.invoiceNumber ?? cn.invoiceId}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <p className="font-semibold">{fmt.money(cn.total)}</p>
                        {cn.status === 'issued' && canEdit ? (
                          <Button size="sm" variant="outline" disabled={applyingId === cn.id} onClick={() => applyCreditNote(cn)}>
                            {applyingId === cn.id ? 'Applying…' : 'Apply'}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Tax summary — {taxSummary.fyLabel} (invoices minus credit notes, net {fmt.money(taxSummary.total)})</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {([['CGST', taxSummary.net.cgst], ['SGST', taxSummary.net.sgst], ['IGST', taxSummary.net.igst], ['VAT', taxSummary.net.vat]] as const).map(([label, value]) => (
              <div key={label} className="rounded-lg border bg-card p-4 shadow-sm">
                <p className="text-xs font-medium text-muted-foreground">{label}</p>
                <p className="mt-1 text-xl font-bold">{fmt.money(value)}</p>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto hidden md:block">
            <Table>
              <TableHeader><TableRow><TableHead>Leg</TableHead><TableHead className="text-right">CGST</TableHead><TableHead className="text-right">SGST</TableHead><TableHead className="text-right">IGST</TableHead><TableHead className="text-right">VAT</TableHead></TableRow></TableHeader>
              <TableBody>
                <TableRow><TableCell>Invoices</TableCell><TableCell className="text-right">{fmt.money(taxSummary.inv.cgst)}</TableCell><TableCell className="text-right">{fmt.money(taxSummary.inv.sgst)}</TableCell><TableCell className="text-right">{fmt.money(taxSummary.inv.igst)}</TableCell><TableCell className="text-right">{fmt.money(taxSummary.inv.vat)}</TableCell></TableRow>
                <TableRow><TableCell>Less: credit notes (issued)</TableCell><TableCell className="text-right">−{fmt.money(taxSummary.cn.cgst)}</TableCell><TableCell className="text-right">−{fmt.money(taxSummary.cn.sgst)}</TableCell><TableCell className="text-right">−{fmt.money(taxSummary.cn.igst)}</TableCell><TableCell className="text-right">−{fmt.money(taxSummary.cn.vat)}</TableCell></TableRow>
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground">Credit notes count when issued; applying them never counts again.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Reports — {collections.fyLabel}</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm" variant="outline"
                onClick={() => downloadCsv(`collections-${new Date().toISOString().split('T')[0]}.csv`,
                  [['payment_id', 'date', 'method', 'invoice', 'amount'],
                    ...collections.rows.map((r) => [r.id, r.date, r.method, r.invoice, r.amount])])}
              >
                Collections CSV
              </Button>
              <Button
                size="sm" variant="outline"
                onClick={() => downloadCsv(`outstanding-${new Date().toISOString().split('T')[0]}.csv`,
                  [['invoice', 'customer', 'due', 'days_overdue', 'bucket', 'amount_due'],
                    ...aging.rows.map((r) => [r.number, r.customer, r.due, r.days, r.bucket, r.amount])])}
              >
                Outstanding CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium">Collections — {fmt.money(collections.total)} (refunds excluded)</p>
            {collections.byMethod.length === 0 ? <p className="mt-1 text-sm text-muted-foreground">No completed payments in this financial year.</p> : (
              <div className="mt-2 grid grid-cols-2 gap-3 lg:grid-cols-4">
                {collections.byMethod.map(([method, amount]) => (
                  <div key={method} className="rounded-lg border bg-card p-3 shadow-sm">
                    <p className="text-xs font-medium capitalize text-muted-foreground">{method.replace('_', ' ')}</p>
                    <p className="mt-1 font-bold">{fmt.money(amount)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <p className="text-sm font-medium">Outstanding — {fmt.money(aging.total)} across {aging.rows.length} invoices</p>
            {aging.rows.length === 0 ? <p className="mt-1 text-sm text-muted-foreground">Nothing outstanding.</p> : (
              <div className="mt-2 overflow-x-auto hidden md:block">
                <Table>
                  <TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Customer</TableHead><TableHead>Due</TableHead><TableHead>Days</TableHead><TableHead>Bucket</TableHead><TableHead className="text-right">Due</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {aging.rows.slice(0, 50).map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs">{r.number}</TableCell>
                        <TableCell>{r.customer}</TableCell>
                        <TableCell>{fmt.date(r.due)}</TableCell>
                        <TableCell>{r.days}</TableCell>
                        <TableCell><Badge variant="secondary">{r.bucket}</Badge></TableCell>
                        <TableCell className="text-right font-medium">{fmt.money(r.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {aging.rows.length > 0 ? (
              <div className="mt-2 grid gap-3 md:hidden">
                {aging.rows.slice(0, 20).map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-lg border bg-card p-4 shadow-sm">
                    <div className="min-w-0">
                      <p className="font-mono text-xs">{r.number}</p>
                      <p className="truncate text-sm text-muted-foreground">{r.customer} · {r.bucket}</p>
                    </div>
                    <p className="font-semibold">{fmt.money(r.amount)}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>P&amp;L, cash basis — {pnl.fyLabel} (net {fmt.money(pnl.net)})</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-lg border bg-card p-4 shadow-sm">
              <p className="text-xs font-medium text-muted-foreground">Income (collections)</p>
              <p className="mt-1 text-xl font-bold text-emerald-600">{fmt.money(pnl.income)}</p>
            </div>
            <div className="rounded-lg border bg-card p-4 shadow-sm">
              <p className="text-xs font-medium text-muted-foreground">Expenses (Finance)</p>
              <p className="mt-1 text-xl font-bold text-rose-600">{fmt.money(pnl.expenseTotal)}</p>
            </div>
            <div className="rounded-lg border bg-card p-4 shadow-sm">
              <p className="text-xs font-medium text-muted-foreground">Legacy operation bills</p>
              <p className="mt-1 text-xl font-bold text-rose-600">{fmt.money(pnl.legacyBills)}</p>
            </div>
            <div className="rounded-lg border bg-card p-4 shadow-sm">
              <p className="text-xs font-medium text-muted-foreground">Net</p>
              <p className="mt-1 text-xl font-bold">{fmt.money(pnl.net)}</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Cash basis: income when collected, expenses when recorded. Legacy bills counted once only.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Build order</CardTitle></CardHeader>
        <CardContent>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            {BUILD_ORDER.map((s) => (
              <li key={s} className="font-medium text-foreground">{s} — done</li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit expense' : 'Add expense'}</DialogTitle>
            <DialogDescription>Amounts use the Settings currency ({settings?.general?.default_currency ?? 'USD'}).</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
              <div className="space-y-2"><Label>Amount ({fmt.fs.symbol})</Label><Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Vendor (optional)</Label><Input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} /></div>
            <div className="space-y-2"><Label>Notes (optional)</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save expense'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cnOpen} onOpenChange={setCnOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New credit note</DialogTitle>
            <DialogDescription>Number comes from the Settings prefix (atomic counter). Tax defaults come from Settings.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-2">
              <Label>Invoice (with remaining due)</Label>
              <Select value={cnForm.invoiceId} onValueChange={(v) => setCnForm({ ...cnForm, invoiceId: v })}>
                <SelectTrigger><SelectValue placeholder="Select invoice" /></SelectTrigger>
                <SelectContent>
                  {invoices.filter((i) => invoiceRemaining(i) > 0).map((i) => (
                    <SelectItem key={i.id} value={i.id}>{i.invoice_number} — {fmt.money(invoiceRemaining(i))} due</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Amount ({fmt.fs.symbol})</Label><Input type="number" min="0" step="0.01" value={cnForm.amount} onChange={(e) => setCnForm({ ...cnForm, amount: e.target.value })} /></div>
            <div className="space-y-2"><Label>Reason (optional)</Label><Textarea value={cnForm.reason} onChange={(e) => setCnForm({ ...cnForm, reason: e.target.value })} /></div>
            <p className="text-sm text-muted-foreground">Tax (Settings): CGST {cnTax.cgst}% · SGST {cnTax.sgst}% · IGST {cnTax.igst}% · VAT {cnTax.vat}% → total {fmt.money(cnTotal)}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCnOpen(false)}>Cancel</Button>
            <Button onClick={saveCreditNote} disabled={cnSaving}>{cnSaving ? 'Issuing…' : 'Issue credit note'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
