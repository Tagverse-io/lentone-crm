'use client';

import { Button } from '@/components/ui/button';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { CircleDollarSign, Wallet, AlertTriangle, Receipt, RefreshCw } from 'lucide-react';
import {
  deriveInvoiceStatus,
  fmtMoney,
  getCollection,
  invoiceOutstanding,
  type Invoice,
  type Payment,
} from '@/lib/db';
import { POLL_SLOW_MS, useAppSettings, usePolling } from '@/lib/realtime';
import { MonthlyFinanceChart, type MonthlyPoint } from '@/components/ui/chart';
import { LoadingState } from '@/components/ui/states';

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function monthLabel(k: string): string {
  const [y, m] = k.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en-IN', { month: 'short' });
}

export default function FinancePage() {
  const { data: settings } = useAppSettings();
  const currency = settings?.currency ?? '₹';
  const { data: invoices = [], isLoading: l1, refresh: r1 } = usePolling<Invoice[]>('invoices', () => getCollection<Invoice>('invoices'), POLL_SLOW_MS);
  const { data: payments = [], isLoading: l2, refresh: r2 } = usePolling<Payment[]>('payments', () => getCollection<Payment>('payments'), POLL_SLOW_MS);

  if (l1 || l2 || !settings) return <LoadingState label="Loading finance…" />;

  const revenue = invoices.reduce((s, i) => s + (i.total || 0), 0);
  const collected = invoices.reduce((s, i) => s + (Number(i.amountPaid) || 0), 0);
  const outstanding = invoices.reduce((s, i) => s + invoiceOutstanding(i), 0);
  const overdueList = invoices.filter((i) => deriveInvoiceStatus(i) === 'Overdue');
  const overdueAmt = overdueList.reduce((s, i) => s + invoiceOutstanding(i), 0);

  const months: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(monthKey(d));
  }
  const byMonth = new Map<string, MonthlyPoint>(months.map((m) => [m, { month: monthLabel(m), invoiced: 0, collected: 0, outstanding: 0 }]));
  for (const i of invoices) {
    const k = (i.createdAt || '').slice(0, 7);
    const row = byMonth.get(k);
    if (row) row.invoiced += i.total || 0;
  }
  for (const p of payments) {
    const k = (p.date || '').slice(0, 7);
    const row = byMonth.get(k);
    if (row) row.collected += p.amount || 0;
  }
  for (const row of byMonth.values()) {
    row.outstanding = Math.max(0, Math.round((row.invoiced - row.collected) * 100) / 100);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Finance</h2>
          <p className="text-sm text-muted-foreground">Revenue, collections and overdue. Polls every 60s.</p>
        </div>
        <Button variant="outline" size="icon" onClick={() => { r1(); r2(); }} title="Refresh" aria-label="Refresh">
          <RefreshCw size={16} />
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard title="Revenue" value={fmtMoney(revenue, currency)} change={`${invoices.length} invoices`} trend="up" icon={CircleDollarSign} description="invoiced total" />
        <KpiCard title="Collected" value={fmtMoney(collected, currency)} change={`${payments.length} payments`} trend="up" icon={Wallet} description="received" />
        <KpiCard title="Outstanding" value={fmtMoney(outstanding, currency)} change="to collect" trend={outstanding > 0 ? 'down' : 'neutral'} icon={Receipt} description="unpaid balance" />
        <KpiCard title="Overdue" value={fmtMoney(overdueAmt, currency)} change={`${overdueList.length} invoices`} trend={overdueList.length > 0 ? 'down' : 'neutral'} icon={AlertTriangle} description="past due date" />
      </div>

      <MonthlyFinanceChart data={months.map((m) => byMonth.get(m)!)} title="Last 6 months" description="Invoiced vs collected vs outstanding per month." />
    </div>
  );
}
