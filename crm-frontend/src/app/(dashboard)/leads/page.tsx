'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  SlidersHorizontal,
  X,
  Eye,
  Pencil,
  Trash2,
  MoreHorizontal,
  Mail,
  Phone,
  Building2,
  Star,
  TrendingUp,
  MessageCircle,
  Wifi,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ResponsiveTable } from '@/components/ui/responsive-table';
import { DataPagination } from '@/components/ui/data-pagination';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { getLeads, deleteLead } from '@/lib/firebase/database';
import type { Lead } from '@/lib/db/types';
import { LeadDialog } from '@/components/dialogs/lead-dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { cn, formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';

const statusColors: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  contacted: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  qualified: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  proposal: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  negotiation: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  won: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  lost: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

const PAGE_SIZE = 25;

const stageTabs = [
  { value: 'all', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
] as const;

import { useAuth } from '@/lib/firebase/auth-context';
import { useWorkspace } from '@/lib/settings/workspace-context';
import { usePermissions } from '@/components/context/permissions-context';

export default function LeadsPage() {
  const { workspace, user } = useAuth();
  const { currency } = useWorkspace();
  const { hasPermission } = usePermissions();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [viewingLead, setViewingLead] = useState<Lead | null>(null);
  const [stageTab, setStageTab] = useState('all');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<{ open: boolean; id?: string; loading?: boolean }>({ open: false });
  const [page, setPage] = useState(1);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advFilters, setAdvFilters] = useState({
    company: '',
    source: 'all',
    stage: 'all',
    tags: '',
    wa: 'all',
  });

  async function load() {
    try {
      // Pass the logged-in user's workspace_id to securely filter leads
      const data = await getLeads(workspace?.id);
      setLeads(data);
    } catch (err: any) {
      console.error('Failed to load leads:', err);
      toast.error(`Failed to load leads: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (workspace?.id) {
      load();
    } else {
      setLoading(false);
    }
  }, [workspace?.id]);

  useEffect(() => { setPage(1); }, [search, stageTab, advFilters]);

  const kpis = useMemo(() => {
    const total = leads.length;
    const newThisWeek = leads.filter((l) => l.status === 'new').length;
    const highValueLeads = leads.filter((l) => (l.estimated_value || 0) >= 10000).length;
    const avgValue = total > 0 ? Math.round(leads.reduce((s, l) => s + (l.estimated_value || 0), 0) / total) : 0;
    return { total, newThisWeek, highValueLeads, avgValue };
  }, [leads]);

  const filtered = useMemo(() => {
    let list = [...leads];

    if (stageTab !== 'all') {
      list = list.filter((l) => l.status === stageTab);
    }

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.company?.toLowerCase().includes(q) ||
          l.email.toLowerCase().includes(q)
      );
    }

    if (advFilters.company) {
      const q = advFilters.company.toLowerCase();
      list = list.filter((l) => l.company?.toLowerCase().includes(q));
    }
    if (advFilters.source !== 'all') {
      list = list.filter((l) => l.source === advFilters.source);
    }
    if (advFilters.stage !== 'all') {
      list = list.filter((l) => l.status === advFilters.stage);
    }
    if (advFilters.tags) {
      const tagList = advFilters.tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
      list = list.filter((l) => tagList.some((t) => (l.tags || []).map((tg) => tg.toLowerCase()).includes(t)));
    }
    if (advFilters.wa === 'active') {
      list = list.filter((l) => l.phone);
    } else if (advFilters.wa === 'inactive') {
      list = list.filter((l) => !l.phone);
    }

    return list;
  }, [leads, stageTab, search, advFilters]);

  const paginatedData = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  function clearAdvanced() {
    setAdvFilters({ company: '', source: 'all', stage: 'all', tags: '', wa: 'all' });
  }

  function hasActiveFilters() {
    return advFilters.company || advFilters.source !== 'all' || advFilters.stage !== 'all' || advFilters.tags || advFilters.wa !== 'all';
  }

  async function handleDelete(lead: Lead) {
    setConfirmState({ open: true, id: lead.id });
  }

  async function onDeleteConfirm() {
    if (!confirmState.id) return;
    setDeleting(confirmState.id);
    setConfirmState((prev) => ({ ...prev, loading: true }));
    try {
      await deleteLead(confirmState.id);
      toast.success('Lead deleted');
      load();
      setConfirmState({ open: false, loading: false });
    } catch {
      toast.error('Failed to delete lead');
      setConfirmState({ open: false, loading: false });
    } finally {
      setDeleting(null);
    }
  }

  function openEdit(lead: Lead) {
    setEditingLead(lead);
    setDialogOpen(true);
  }

  function openCreate() {
    setEditingLead(null);
    setDialogOpen(true);
  }

  function openView(lead: Lead) {
    setViewingLead(lead);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading leads...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard
          title="Total Leads"
          value={kpis.total.toString()}
          change={`${leads.length > 0 ? '100' : '0'}% of pipeline`}
          trend="neutral"
          icon={Users}
          description="All-time leads"
        />
        <KpiCard
          title="New This Week"
          value={kpis.newThisWeek.toString()}
          change={kpis.newThisWeek > 0 ? `${Math.round((kpis.newThisWeek / Math.max(leads.length, 1)) * 100)}% of total` : 'No new leads'}
          trend={kpis.newThisWeek > 0 ? 'up' : 'neutral'}
          icon={UserPlus}
          description="Stage: New"
        />
        <KpiCard
          title="High Value Leads"
          value={kpis.highValueLeads.toString()}
          change={kpis.highValueLeads > 0 ? `${Math.round((kpis.highValueLeads / Math.max(leads.length, 1)) * 100)}% of total` : 'No high value leads'}
          trend={kpis.highValueLeads > 0 ? 'up' : 'neutral'}
          icon={Star}
          description="Value &ge; $10k"
        />
        <KpiCard
          title="Avg. Est. Value"
          value={formatCurrency(kpis.avgValue, currency)}
          change={kpis.avgValue >= 10000 ? 'High' : kpis.avgValue >= 1000 ? 'Moderate' : 'Low'}
          trend={kpis.avgValue >= 10000 ? 'up' : kpis.avgValue >= 1000 ? 'neutral' : 'down'}
          icon={TrendingUp}
          description="Across all leads"
        />
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Leads</h2>
          <p className="text-sm text-muted-foreground">Manage and track your sales leads</p>
        </div>
        <Button onClick={openCreate} className="w-full sm:w-auto">
          <UserPlus size={16} className="mr-2" />
          New Lead
        </Button>
      </div>

      {/* Stage Tabs & Search */}
      <div className="space-y-3 sm:space-y-4">
        <Tabs value={stageTab} onValueChange={setStageTab}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <TabsList className="w-full sm:w-auto overflow-x-auto">
              {stageTabs.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value} className="whitespace-nowrap">
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:flex-none sm:w-64">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search name or company..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button
                variant={hasActiveFilters() ? 'default' : 'outline'}
                size="icon"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="shrink-0"
              >
                <Filter size={16} />
              </Button>
            </div>
          </div>
        </Tabs>

        {/* Advanced Filters */}
        {showAdvanced && (
          <div className="rounded-lg border p-3 sm:p-4 space-y-3 sm:space-y-4 animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <SlidersHorizontal size={14} />
                Advanced Filters
              </div>
              {hasActiveFilters() && (
                <Button variant="ghost" size="sm" onClick={clearAdvanced} className="h-8 gap-1 text-xs">
                  <X size={12} />
                  Clear filters
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Company</label>
                <Input
                  placeholder="Filter by company..."
                  value={advFilters.company}
                  onChange={(e) => setAdvFilters((f) => ({ ...f, company: e.target.value }))}
                  className="h-9"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Source</label>
                <Select
                  value={advFilters.source}
                  onValueChange={(v) => setAdvFilters((f) => ({ ...f, source: v }))}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sources</SelectItem>
                    <SelectItem value="Website">Website</SelectItem>
                    <SelectItem value="Facebook">Facebook</SelectItem>
                    <SelectItem value="Instagram">Instagram</SelectItem>
                    <SelectItem value="LinkedIn">LinkedIn</SelectItem>
                    <SelectItem value="Referral">Referral</SelectItem>
                    <SelectItem value="Email">Email</SelectItem>
                    <SelectItem value="Cold Call">Cold Call</SelectItem>
                    <SelectItem value="Event">Event</SelectItem>
                    <SelectItem value="Google Ads">Google Ads</SelectItem>
                    <SelectItem value="Manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Stage</label>
                <Select
                  value={advFilters.stage}
                  onValueChange={(v) => setAdvFilters((f) => ({ ...f, stage: v }))}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Stages</SelectItem>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="contacted">Contacted</SelectItem>
                    <SelectItem value="qualified">Qualified</SelectItem>
                    <SelectItem value="proposal">Proposal</SelectItem>
                    <SelectItem value="negotiation">Negotiation</SelectItem>
                    <SelectItem value="won">Won</SelectItem>
                    <SelectItem value="lost">Lost</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Tags</label>
                <Input
                  placeholder="e.g. hot, vip..."
                  value={advFilters.tags}
                  onChange={(e) => setAdvFilters((f) => ({ ...f, tags: e.target.value }))}
                  className="h-9"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">WA Active</label>
                <Select
                  value={advFilters.wa}
                  onValueChange={(v) => setAdvFilters((f) => ({ ...f, wa: v }))}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      {filtered.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <ResponsiveTable
              data={paginatedData}
              keyExtractor={(lead) => lead.id}
              mobileCardTitle={(lead) => lead.name}
              columns={[
                {
                  key: 'name',
                  header: 'Name',
                  render: (lead) => (
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {lead.name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{lead.name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1 truncate"><Mail size={10} />{lead.email}</span>
                          {lead.phone && <span className="flex items-center gap-1"><Phone size={10} />{lead.phone}</span>}
                        </div>
                      </div>
                    </div>
                  ),
                },
                {
                  key: 'company',
                  header: 'Company',
                  hideOnMobile: true,
                  render: (lead) => (
                    <div className="flex items-center gap-1.5 text-sm">
                      <Building2 size={14} className="text-muted-foreground shrink-0" />
                      <span className="truncate">{lead.company || '—'}</span>
                    </div>
                  ),
                },
                {
                  key: 'tags',
                  header: 'Tags',
                  hideOnMobile: true,
                  render: (lead) => (
                    <div className="flex flex-wrap gap-1 max-w-[140px]">
                      {(lead.tags?.length ?? 0) > 0 ? (
                        lead.tags!.map((tag) => (
                          <Badge
                            key={tag}
                            variant="secondary"
                            className="text-[10px] px-1.5 py-0 font-medium rounded-full"
                          >
                            {tag}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  ),
                },
                {
                  key: 'priority',
                  header: 'Priority',
                  hideOnMobile: true,
                  render: (lead) => {
                    if (!lead.priority) return <span className="text-sm text-muted-foreground">—</span>;
                    return (
                      <Badge variant="secondary" className="text-xs font-medium">
                        {lead.priority}
                      </Badge>
                    );
                  },
                },
                {
                  key: 'status',
                  header: 'Stage',
                  render: (lead) => (
                    <Badge variant="secondary" className={cn('font-medium', statusColors[lead.status] || '')}>
                      {lead.status}
                    </Badge>
                  ),
                },
                {
                  key: 'source',
                  header: 'Source',
                  hideOnMobile: true,
                  render: (lead) => <span className="text-sm">{lead.source || '—'}</span>,
                },

                {
                  key: 'wa',
                  header: 'WA',
                  hideOnMobile: true,
                  render: (lead) => (
                    <div className="flex items-center justify-center">
                      <span className={cn('flex h-2 w-2 rounded-full', lead.phone ? 'bg-primary' : 'bg-muted-foreground/30')} />
                    </div>
                  ),
                },
                {
                  key: 'value',
                  header: 'Value',
                  render: (lead) => (
                    <span className="text-sm font-medium">{lead.estimated_value ? formatCurrency(lead.estimated_value, currency) : '—'}</span>
                  ),
                },
                {
                  key: 'actions',
                  header: '',
                  className: 'w-10',
                  render: (lead) => (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Lead actions">
                          <MoreHorizontal size={14} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openView(lead)}>
                          <Eye size={14} className="mr-2" /> View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEdit(lead)}>
                          <Pencil size={14} className="mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => handleDelete(lead)}
                          disabled={deleting === lead.id}
                        >
                          <Trash2 size={14} className="mr-2" /> {deleting === lead.id ? 'Deleting...' : 'Delete'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ),
                },
              ]}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {search || stageTab !== 'all' || hasActiveFilters() ? 'No leads match your filters' : 'No leads yet'}
            </p>
          </CardContent>
        </Card>
      )}

      {filtered.length > PAGE_SIZE && (
        <DataPagination
          page={page}
          totalItems={filtered.length}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      )}

      {/* Lead Create/Edit Dialog */}
      <LeadDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={load}
        lead={editingLead}
      />

      {/* Lead View Dialog */}
      <Dialog open={!!viewingLead} onOpenChange={(open) => { if (!open) setViewingLead(null); }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{viewingLead?.name}</DialogTitle>
            <DialogDescription>Lead details</DialogDescription>
          </DialogHeader>
          {viewingLead && (
      <div className="space-y-3 sm:space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Email</p>
                  <p className="text-sm flex items-center gap-1 mt-0.5"><Mail size={12} className="shrink-0" />{viewingLead.email}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Phone</p>
                  <p className="text-sm flex items-center gap-1 mt-0.5">{viewingLead.phone ? <><Phone size={12} className="shrink-0" />{viewingLead.phone}</> : '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Company</p>
                  <p className="text-sm flex items-center gap-1 mt-0.5">{viewingLead.company ? <><Building2 size={12} className="shrink-0" />{viewingLead.company}</> : '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Stage</p>
                  <Badge variant="secondary" className={cn('mt-0.5', statusColors[viewingLead.status] || '')}>
                    {viewingLead.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Source</p>
                  <p className="text-sm mt-0.5">{viewingLead.source || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Estimated Value</p>
                  <p className="text-sm font-medium mt-0.5">{viewingLead.estimated_value ? formatCurrency(viewingLead.estimated_value, currency) : '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Owner ID</p>
                  <p className="text-sm mt-0.5">{viewingLead.owner_id || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Priority</p>
                  <p className="text-sm mt-0.5">{viewingLead.priority || '—'}</p>
                </div>
                {viewingLead.tags && viewingLead.tags.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">Tags</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {viewingLead.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0 font-medium rounded-full">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {viewingLead.notes && (
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Notes</p>
                  <p className="text-sm mt-0.5 text-muted-foreground">{viewingLead.notes}</p>
                </div>
              )}
              <div className="grid grid-cols-1 gap-3 sm:gap-4">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Next Follow-up</p>
                  <p className="text-sm mt-0.5">{viewingLead.next_follow_up ? new Date(viewingLead.next_follow_up).toLocaleDateString() : '—'}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={confirmState.open}
        onOpenChange={(open) => setConfirmState({ open })}
        title="Delete Lead"
        description="Are you sure you want to delete this lead? This action cannot be undone."
        onConfirm={onDeleteConfirm}
        loading={confirmState.loading}
      />
    </div>
  );
}
