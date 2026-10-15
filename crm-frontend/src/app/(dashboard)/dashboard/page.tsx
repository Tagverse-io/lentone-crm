'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { Users, DollarSign, Receipt, Mail, TrendingUp, Zap, CheckCircle, Clock, Activity, Target, Plus, Calendar, FileText, CheckCircle2, ShieldAlert, X, Filter, Building2, Bell, Presentation, PhoneCall, Search, ArrowRight, CheckSquare, PlusCircle, RefreshCw, CircleDollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getLeads, getInvoices, getActivityLogs, getAutomationRules, getEmailCampaigns, getTasks } from '@/lib/firebase/database';
import { useAuth } from '@/lib/firebase/auth-context';
import { useWorkspace } from '@/lib/settings/workspace-context';
import type { Lead, Invoice, ActivityLog, AutomationRule, EmailCampaign, TaskItem } from '@/lib/db/types';
import { formatCurrency } from '@/lib/utils';

const statusColors: Record<string, string> = {
  new: 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
  contacted: 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400',
  qualified: 'bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-400',
  proposal: 'bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400',
  negotiation: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400',
  won: 'bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400',
  lost: 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400',
};

const priorityColors: Record<string, string> = {
  high: 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400',
  medium: 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400',
  low: 'bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400',
};

export default function DashboardPage() {
  const router = useRouter();
  const { workspace, user } = useAuth();
  const { currency } = useWorkspace();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [automationRules, setAutomationRules] = useState<AutomationRule[]>([]);
  const [emailCampaigns, setEmailCampaigns] = useState<EmailCampaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!workspace?.id) {
        setLoading(false);
        return;
      }
      try {
        const [leadData, invoiceData, activityData, ruleData, emailData, tasksData] = await Promise.all([
          getLeads(workspace?.id),
          getInvoices(workspace?.id),
          getActivityLogs(workspace?.id, 10),
          getAutomationRules(workspace?.id),
          getEmailCampaigns(workspace?.id),
          getTasks(workspace?.id),
        ]);
        setLeads(leadData);
        setInvoices(invoiceData);
        setActivityLogs(activityData);
        setTasks(tasksData);
        setAutomationRules(ruleData);
        setEmailCampaigns(emailData);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [workspace?.id]);

  const totalLeads = leads.length;
  const activeDeals = leads.filter((l) => l.status !== 'won' && l.status !== 'lost').length;

  const now = Date.now();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const monthlyRevenue = invoices
    .filter((i) => i.status === 'paid' && i.created_at >= monthStart)
    .reduce((sum, i) => sum + (i.amount || 0), 0);

  const invoicesOverdue = invoices.filter((i) => i.status === 'overdue').length;

  const totalEmailsSent = emailCampaigns.reduce((sum, c) => sum + (c.stats?.sent || 0), 0);
  const totalEmailsClicked = emailCampaigns.reduce((sum, c) => sum + (c.stats?.clicked || 0), 0);
  const emailClicked = totalEmailsSent > 0 ? Math.round((totalEmailsClicked / totalEmailsSent) * 1000) / 10 : 0;

  const pipelineStages = [
    { name: 'New', leads: leads.filter((l) => l.status === 'new'), color: 'bg-blue-500' },
    { name: 'Contacted', leads: leads.filter((l) => l.status === 'contacted'), color: 'bg-amber-500' },
    { name: 'Qualified', leads: leads.filter((l) => l.status === 'qualified'), color: 'bg-violet-500' },
    { name: 'Proposal', leads: leads.filter((l) => l.status === "proposal"), color: 'bg-purple-500' },
    { name: 'Negotiation', leads: leads.filter((l) => l.status === 'negotiation'), color: 'bg-emerald-500' },
    { name: 'Won', leads: leads.filter((l) => l.status === 'won'), color: 'bg-green-500' },
  ];

  const funnelStages = [
    { name: 'Lead', count: leads.filter((l) => l.status === 'new').length },
    { name: 'Contacted', count: leads.filter((l) => l.status === 'contacted').length },
    { name: 'Qualified', count: leads.filter((l) => l.status === 'qualified').length },
    { name: 'Proposal', count: leads.filter((l) => l.status === "proposal").length },
    { name: 'Negotiation', count: leads.filter((l) => l.status === 'negotiation').length },
    { name: 'Won', count: leads.filter((l) => l.status === 'won').length },
  ];
  const maxFunnelCount = Math.max(...funnelStages.map((s) => s.count), 1);
  const overallConversion = totalLeads > 0 ? ((leads.filter((l) => l.status === 'won').length / totalLeads) * 100).toFixed(1) : '0.0';

  const recentLeads = leads.slice(0, 5);

  const urgentTasks = tasks
    .filter((t) => {
      const status = (t.status || '').toLowerCase();
      const isNotDone = status !== 'done' && status !== 'completed';
      const hasDueDate = Boolean(t.due_date || (t as any).dueDate);
      return hasDueDate && isNotDone;
    })
    .sort((a, b) => {
      const dateA = new Date(a.due_date || (a as any).dueDate || '').getTime() || 0;
      const dateB = new Date(b.due_date || (b as any).dueDate || '').getTime() || 0;
      return dateA - dateB;
    })
    .slice(0, 5);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-sm text-muted-foreground">Here&apos;s what&apos;s happening today.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <KpiCard title="Total Leads" value={String(totalLeads)} change={`${totalLeads} total`} trend="up" icon={Users} description="all time" />
        <KpiCard title="Active Deals" value={String(activeDeals)} change={`${activeDeals} in pipeline`} trend="up" icon={DollarSign} description="in progress" />
        <KpiCard title="Monthly Revenue" value={formatCurrency(monthlyRevenue, currency)} change={`${invoices.filter((i) => i.status === 'paid' && i.created_at >= monthStart).length} paid`} trend={monthlyRevenue > 0 ? 'up' : 'neutral'} icon={TrendingUp} description="this month" />
        <KpiCard title="Invoices Overdue" value={String(invoicesOverdue)} change={`${invoicesOverdue} unpaid`} trend={invoicesOverdue > 0 ? 'down' : 'neutral'} icon={Receipt} description="need attention" />
        <KpiCard title="Email Clicked" value={`${emailClicked}%`} change="engagement" trend="up" icon={Mail} description="click rate" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Deal Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2 sm:gap-3">
              {pipelineStages.map((stage) => (
                <div key={stage.name} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${stage.color}`} />
                    <span className="text-xs font-medium text-muted-foreground">{stage.name}</span>
                  </div>
                  <div className="space-y-1">
                    {stage.leads.slice(0, 3).map((lead) => (
                      <div key={lead.id} className="p-2 rounded-lg border bg-card hover:shadow-sm transition-shadow cursor-pointer" onClick={() => router.push('/pipeline')}>
                        <p className="text-xs font-medium truncate">{lead.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{lead.company || '—'}</p>
                        <p className="text-[10px] font-medium mt-1">{lead.estimated_value ? formatCurrency(lead.estimated_value, currency) : '—'}</p>
                      </div>
                    ))}
                    {stage.leads.length > 3 && (
                      <p className="text-[10px] text-muted-foreground text-center">+{stage.leads.length - 3} more</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Conversion Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {funnelStages.map((stage, index) => (
                <div key={stage.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{stage.name}</span>
                    <span className="font-medium">{stage.count}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${(stage.count / maxFunnelCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Conversion Rate</span>
                <span className="text-sm font-bold text-primary">{overallConversion}%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Recent Leads</CardTitle>
          </CardHeader>
          <CardContent>
            {recentLeads.length > 0 ? (
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <table className="w-full text-sm min-w-[600px]">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 font-medium">Name</th>
                      <th className="pb-2 font-medium hidden sm:table-cell">Company</th>
                      <th className="pb-2 font-medium hidden md:table-cell">Source</th>
                      <th className="pb-2 font-medium">Stage</th>
                      <th className="pb-2 font-medium hidden lg:table-cell">Score</th>
                      <th className="pb-2 font-medium hidden lg:table-cell">Owner</th>
                      <th className="pb-2 font-medium">Arrived</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentLeads.map((lead) => (
                      <tr key={lead.id} className="border-b last:border-0 hover:bg-muted/30 cursor-pointer" onClick={() => router.push('/leads')}>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7">
                              <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                                {(lead.name || 'Unknown').split(' ').map((n) => n[0] || '').join('')}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{lead.name}</span>
                          </div>
                        </td>
                        <td className="py-3 text-muted-foreground hidden sm:table-cell">{lead.company || '—'}</td>
                        <td className="py-3 text-muted-foreground hidden md:table-cell">{lead.source || '—'}</td>
                        <td className="py-3">
                          <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${statusColors[lead.status] || ''}`}>
                            {(lead.status || 'new').charAt(0).toUpperCase() + (lead.status || 'new').slice(1)}
                          </Badge>
                        </td>
                        <td className="py-3 hidden lg:table-cell">
                          <div className="flex items-center gap-1">
                            <div className="w-8 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full" style={{ width: `${0 || 0}%` }} />
                            </div>
                            <span className="text-xs text-muted-foreground">{0 || 0}</span>
                          </div>
                        </td>
                        <td className="py-3 text-muted-foreground hidden lg:table-cell">—</td>
                        <td className="py-3 text-muted-foreground text-xs">{new Date(lead.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No leads yet</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Activity Feed</CardTitle>
          </CardHeader>
          <CardContent>
            {activityLogs.length > 0 ? (
              <div className="space-y-4">
                {activityLogs
                  .filter((log) => {
                    if (!log.description || log.description.includes('undefined')) return false;
                    const entityType = (log.entity_type || '').toLowerCase();
                    const action = (log.action || '').toLowerCase();
                    if (entityType === 'invoice' || entityType === 'payment' || action.includes('invoice') || action.includes('payment')) {
                      return false;
                    }
                    return true;
                  })
                  .slice(0, 8)
                  .map((log) => {
                    const getLink = (type?: string) => {
                      switch ((type || '').toLowerCase()) {
                        case 'lead': return '/leads';
                        case 'deal':
                        case 'pipeline': return '/pipeline';
                        case 'project': return '/projects';
                        case 'contact': return '/contacts';
                        case 'quote':
                        case 'quotation': return '/quotes';
                        case 'task': return '/tasks';
                        case 'meeting':
                        case 'call':
                        case 'deadline':
                        case 'followup':
                        case 'activity': return '/activity';
                        default: return '/activity';
                      }
                    };
                    const linkHref = getLink(log.entity_type);
                    return (
                      <div key={log.id} className="pb-3 border-b last:border-0 last:pb-0">
                        <Link href={linkHref} className="flex items-start gap-3 hover:opacity-80 transition-opacity">
                          <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm">{log.description}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-muted-foreground">{log.user_name}</span>
                              <span className="text-xs text-muted-foreground">·</span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(log.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </Link>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No recent activity</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Urgent Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          {urgentTasks.length > 0 ? (
            <div className="space-y-3">
              {urgentTasks.map((task) => {
                const dueDateStr = task.due_date || (task as any).dueDate;
                const dueDate = dueDateStr ? new Date(dueDateStr) : null;
                const isOverdue = dueDate && dueDate < new Date();
                const rawPriority = (task.priority || '').toLowerCase();
                const priority = ['high', 'urgent'].includes(rawPriority)
                  ? 'high'
                  : rawPriority === 'low'
                  ? 'low'
                  : 'medium';
                return (
                  <div key={task.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => router.push('/tasks')}>
                    <div className="flex items-center gap-3">
                      <div className={`flex items-center justify-center w-5 h-5 rounded-full border-2 ${isOverdue ? 'border-red-400' : 'border-muted-foreground/30'}`} />
                      <span className="text-sm">{task.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${priorityColors[priority] || priorityColors.medium}`}>
                        {priority.charAt(0).toUpperCase() + priority.slice(1)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{dueDate?.toLocaleDateString() || '—'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No urgent tasks</p>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Automation Hub</h3>
        </div>
        {automationRules.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {automationRules.map((rule) => (
              <Card key={rule.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <Activity className="h-4 w-4 text-muted-foreground shrink-0" />
                      <p className="text-sm font-medium truncate">{rule.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{(rule.execution_count || 0).toLocaleString()} runs</span>
                    </div>
                    {rule.last_executed_at && (
                      <span>Last: {new Date(rule.last_executed_at).toLocaleDateString()}</span>
                    )}
                  </div>
                  <div className={`flex items-center gap-1.5 text-xs ${rule.enabled ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                    {rule.enabled ? (
                      <CheckCircle className="h-3.5 w-3.5" />
                    ) : (
                      <Clock className="h-3.5 w-3.5" />
                    )}
                    <span className="font-medium">{rule.enabled ? 'Active' : 'Paused'}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">No automation rules configured</p>
        )}
      </div>
    </div>
  );
}
