'use client';

import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CircleDollarSign, FileText, Receipt, Truck, CheckSquare, RefreshCw } from 'lucide-react';
import {
  fmtMoney,
  getCollection,
  type Delivery,
  type FieldTask,
  type Invoice,
  type Lead,
  type Order,
  type Quotation,
  type Worker,
} from '@/lib/db';
import { POLL_FAST_MS, useAppSettings, usePolling } from '@/lib/realtime';
import { EmptyState, LoadingState } from '@/components/ui/states';

export default function DashboardPage() {
  const { data: settings } = useAppSettings();
  const currency = settings?.currency ?? '₹';

  const { data: tasks = [], isLoading: l1, refresh: r1 } = usePolling<FieldTask[]>('tasks', () => getCollection<FieldTask>('tasks'), POLL_FAST_MS);
  const { data: deliveries = [], isLoading: l2, refresh: r2 } = usePolling<Delivery[]>('deliveries', () => getCollection<Delivery>('deliveries'), POLL_FAST_MS);
  const { data: quotations = [], isLoading: l3, refresh: r3 } = usePolling<Quotation[]>('quotations', () => getCollection<Quotation>('quotations'), POLL_FAST_MS);
  const { data: invoices = [], isLoading: l4, refresh: r4 } = usePolling<Invoice[]>('invoices', () => getCollection<Invoice>('invoices'), POLL_FAST_MS);
  const { data: workers = [], isLoading: l5, refresh: r5 } = usePolling<Worker[]>('workers', () => getCollection<Worker>('workers'), POLL_FAST_MS);
  const { data: leads = [], isLoading: l6, refresh: r6 } = usePolling<Lead[]>('leads', () => getCollection<Lead>('leads'), POLL_FAST_MS);
  const { data: orders = [], isLoading: l7, refresh: r7 } = usePolling<Order[]>('orders', () => getCollection<Order>('orders'), POLL_FAST_MS);

  const loading = l1 || l2 || l3 || l4 || l5 || l6 || l7 || !settings;
  const refreshAll = () => {
    r1(); r2(); r3(); r4(); r5(); r6(); r7();
  };

  const monthStart = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  }, []);

  if (loading) return <LoadingState label="Loading dashboard…" />;

  const revenueMonth = invoices
    .filter((i) => (i.status === 'Paid' || (i.status === 'Partial' && (i.amountPaid || 0) > 0)) && i.createdAt.slice(0, 10) >= monthStart)
    .reduce((s, i) => s + (i.amountPaid || 0), 0);
  const quotationsSent = quotations.filter((q) => q.status === 'Sent' || q.status === 'Accepted').length;
  const invoicesPaid = invoices.filter((i) => i.status === 'Paid').length;
  const invoicesUnpaid = invoices.filter((i) => i.status !== 'Paid').length;
  const deliveriesPending = deliveries.filter((d) => d.status === 'Pending' || d.status === 'Out for Delivery').length;
  const deliveriesDone = deliveries.filter((d) => d.status === 'Delivered').length;
  const tasksDone = tasks.filter((t) => t.status === 'Done').length;

  const perWorker = workers.map((w) => {
    const wt = tasks.filter((t) => t.workerId === w.id);
    const wd = deliveries.filter((d) => d.workerId === w.id);
    return {
      worker: w,
      tasksDone: wt.filter((t) => t.status === 'Done').length,
      visits: wt.filter((t) => t.type === 'Visit' && t.status === 'Done').length,
      samples: wt.filter((t) => t.type === 'Sample' && t.status === 'Done').length,
      deliveries: wd.filter((d) => d.status === 'Delivered').length,
      open: wt.filter((t) => t.status !== 'Done').length,
    };
  });
  const maxDone = Math.max(1, ...perWorker.map((p) => p.tasksDone + p.deliveries));

  const openLeads = leads.filter((l) => l.stage !== 'Won' && l.stage !== 'Lost').length;
  const openOrders = orders.filter((o) => o.status === 'Draft' || o.status === 'Confirmed').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-sm text-muted-foreground">Team performance, sales and delivery at a glance. Polls every 15s.</p>
        </div>
        <Button variant="outline" size="icon" onClick={refreshAll} title="Refresh" aria-label="Refresh">
          <RefreshCw size={16} />
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <KpiCard title="Collected this month" value={fmtMoney(revenueMonth, currency)} change={`${invoicesPaid} paid`} trend="up" icon={CircleDollarSign} description="payments received" />
        <KpiCard title="Quotations sent" value={String(quotationsSent)} change={`${quotations.length} total`} trend="up" icon={FileText} description="sent + accepted" />
        <KpiCard title="Invoices open" value={String(invoicesUnpaid)} change={`${openOrders} open orders`} trend={invoicesUnpaid > 0 ? 'down' : 'neutral'} icon={Receipt} description="need collection" />
        <KpiCard title="Deliveries pending" value={String(deliveriesPending)} change={`${deliveriesDone} done`} trend="neutral" icon={Truck} description="in progress" />
        <KpiCard title="Tasks done" value={String(tasksDone)} change={`${openLeads} open leads`} trend="up" icon={CheckSquare} description="field visits" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Team performance</CardTitle>
        </CardHeader>
        <CardContent>
          {perWorker.length === 0 ? (
            <EmptyState title="No workers yet" description="Add workers on the Field Force page to track performance." />
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <Table className="min-w-[640px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Worker</TableHead>
                    <TableHead className="text-right">Tasks done</TableHead>
                    <TableHead className="text-right">Visits</TableHead>
                    <TableHead className="text-right">Samples</TableHead>
                    <TableHead className="text-right">Deliveries</TableHead>
                    <TableHead className="text-right">Open</TableHead>
                    <TableHead className="w-40">Output</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {perWorker.map((p) => (
                    <TableRow key={p.worker.id}>
                      <TableCell className="font-medium">{p.worker.name}</TableCell>
                      <TableCell className="text-right">{p.tasksDone}</TableCell>
                      <TableCell className="text-right">{p.visits}</TableCell>
                      <TableCell className="text-right">{p.samples}</TableCell>
                      <TableCell className="text-right">{p.deliveries}</TableCell>
                      <TableCell className="text-right">{p.open}</TableCell>
                      <TableCell>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${((p.tasksDone + p.deliveries) / maxDone) * 100}%` }}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base sm:text-lg">Sales summary</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Collected this month</span><span className="font-semibold">{fmtMoney(revenueMonth, currency)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Quotations sent</span><span className="font-semibold">{quotationsSent}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Invoices paid</span><span className="font-semibold">{invoicesPaid}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Open orders</span><span className="font-semibold">{openOrders}</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base sm:text-lg">Delivery summary</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Pending</span><span className="font-semibold">{deliveries.filter((d) => d.status === 'Pending').length}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Out for delivery</span><span className="font-semibold">{deliveries.filter((d) => d.status === 'Out for Delivery').length}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Delivered</span><span className="font-semibold">{deliveriesDone}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">With photo proof</span><span className="font-semibold">{deliveries.filter((d) => d.proofAt).length}</span></div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
