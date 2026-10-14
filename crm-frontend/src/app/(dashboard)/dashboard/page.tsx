"use client";

import { useMemo } from "react";
import { Users, UserRound, Briefcase, Receipt, CheckSquare, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAuth } from "@/lib/auth-context";
import { useCollection } from "@/lib/use-collection";
import { clientsService, invoicesService, leadsService, projectsService, tasksService } from "@/lib/services";
import { ErrorState, LoadingState, PageHeader } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { Card, CardContent, CardHeader, CardTitle, EmptyState } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

export default function DashboardPage(): JSX.Element {
  const { orgId } = useAuth();
  const leads = useCollection(leadsService, orgId);
  const clients = useCollection(clientsService, orgId);
  const projects = useCollection(projectsService, orgId);
  const invoices = useCollection(invoicesService, orgId);
  const tasks = useCollection(tasksService, orgId);

  const loading = leads.loading || clients.loading || projects.loading || invoices.loading || tasks.loading;
  const error = leads.error ?? clients.error ?? projects.error ?? invoices.error ?? tasks.error;

  const revenue = useMemo(() => invoices.items.reduce((s, i) => s + (i.amountPaid ?? 0), 0), [invoices.items]);
  const openTasks = useMemo(() => tasks.items.filter((t) => t.status !== "done").length, [tasks.items]);
  const chart = useMemo(() => {
    const byStage: Record<string, number> = {};
    for (const l of leads.items) byStage[l.stage] = (byStage[l.stage] ?? 0) + 1;
    return Object.entries(byStage).map(([stage, count]) => ({ stage, count }));
  }, [leads.items]);

  if (loading) return <LoadingState label="Loading dashboard…" />;
  if (error) return <ErrorState message={error} onRetry={() => { leads.reload(); clients.reload(); projects.reload(); invoices.reload(); tasks.reload(); }} />;

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Revenue, pipeline, projects and tasks at a glance." />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard title="Revenue collected" value={formatCurrency(revenue)} hint={`${invoices.items.length} invoices`} icon={<TrendingUp className="h-5 w-5" />} />
        <KpiCard title="Leads" value={String(leads.items.length)} icon={<Users className="h-5 w-5" />} />
        <KpiCard title="Clients" value={String(clients.items.length)} icon={<UserRound className="h-5 w-5" />} />
        <KpiCard title="Projects" value={String(projects.items.length)} icon={<Briefcase className="h-5 w-5" />} />
        <KpiCard title="Open tasks" value={String(openTasks)} icon={<CheckSquare className="h-5 w-5" />} />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Leads by stage</CardTitle></CardHeader>
          <CardContent>
            {chart.length === 0 ? (
              <EmptyState title="No leads yet" hint="Add your first lead to see the pipeline chart." />
            ) : (
              <div className="h-64" role="img" aria-label="Leads by stage bar chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chart}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="stage" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="var(--brand-primary)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Overdue invoices</CardTitle></CardHeader>
          <CardContent>
            {invoices.items.filter((i) => i.status === "overdue").length === 0 ? (
              <EmptyState title="Nothing overdue" hint="Overdue invoices will appear here." />
            ) : (
              <ul className="divide-y text-sm">
                {invoices.items.filter((i) => i.status === "overdue").slice(0, 8).map((i) => (
                  <li key={i.id} className="flex justify-between py-2">
                    <span>{i.number} · {i.clientName ?? i.clientId}</span>
                    <span className="font-medium">{formatCurrency(i.amountDue)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
