'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  DollarSign, TrendingUp, Clock, AlertCircle, Search, LayoutList, LayoutGrid,
  Plus, MoreHorizontal, Building2, Pencil, Trash2, Eye, X,
  Calendar, User, Tag as TagIcon, Code2,
} from 'lucide-react';
import { getLeads, deleteLead, updateLead, getPipelines } from '@/lib/firebase/database';
import type { Lead, LeadStatus, Pipeline } from '@/lib/db/types';
import { LeadDialog } from '@/components/dialogs/lead-dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { toast } from 'sonner';
import { useAuth } from '@/lib/firebase/auth-context';
import { useWorkspace } from '@/lib/settings/workspace-context';
import { useFmt } from '@/lib/format';
import { backend } from '@/lib/backend-client';
import { DataPagination } from '@/components/ui/data-pagination';

const PAGE_SIZE = 25;

const pipelineStages: LeadStatus[] = ['new', 'contacted', 'qualified', "proposal", 'negotiation', 'won', 'lost'];

const stageLabels: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  won: 'Closed Won',
  lost: 'Closed Lost',
};

const stageColors: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  contacted: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  qualified: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  proposal: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  negotiation: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  won: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  lost: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

function daysBetween(dateStr: string): number {
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

export default function DealsPage() {
  const { workspace, user } = useAuth();
  const fmt = useFmt();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('kanban');
  const [activeStage, setActiveStage] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<{ open: boolean; id?: string; loading?: boolean }>({ open: false });
  const [page, setPage] = useState(1);
  const [expandedColumns, setExpandedColumns] = useState<Record<string, boolean>>({});
  const KANBAN_PAGE_SIZE = 25;

  const load = useCallback(async () => {
    if (!workspace?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [leadData, pipelineData] = await Promise.all([
        getLeads(workspace?.id),
        getPipelines(workspace?.id),
      ]);
      setLeads(leadData);
      setPipelines(pipelineData);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [workspace?.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => { setPage(1); setExpandedColumns({}); }, [search, selectedPipelineId, activeStage]);

  const selectedPipeline = useMemo(
    () => pipelines.find(p => p.id === selectedPipelineId),
    [pipelines, selectedPipelineId]
  );

  const filteredLeads = useMemo(() => {
    let result = [...leads];

    if (selectedPipelineId !== 'all' && selectedPipeline) {
      const stageNames = selectedPipeline.stages.map(s => s.name.toLowerCase());
      result = result.filter(l => stageNames.includes(l.status));
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(l =>
        l.name.toLowerCase().includes(q) ||
        (l.company && l.company.toLowerCase().includes(q)) ||
        (l.email && l.email.toLowerCase().includes(q)) ||
        (l.source && l.source.toLowerCase().includes(q))
      );
    }

    if (activeStage) {
      result = result.filter(l => l.status === activeStage);
    }

    return result;
  }, [leads, selectedPipelineId, selectedPipeline, search, activeStage]);

  const paginatedLeads = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredLeads.slice(start, start + PAGE_SIZE);
  }, [filteredLeads, page]);

  const openStatuses: LeadStatus[] = ['new', 'contacted', 'qualified', "proposal", 'negotiation'];

  const totalPipelineValue = useMemo(
    () => leads
      .filter(l => openStatuses.includes(l.status))
      .reduce((sum, l) => sum + (l.estimated_value || 0), 0),
    [leads]
  );

  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();

  const wonThisMonth = useMemo(
    () => leads
      .filter(l => {
        if (l.status !== 'won') return false;
        const d = new Date(l.updated_at || l.created_at);
        return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
      })
      .reduce((sum, l) => sum + (l.estimated_value || 0), 0),
    [leads]
  );

  const wonThisMonthCount = useMemo(
    () => leads.filter(l => {
      if (l.status !== 'won') return false;
      const d = new Date(l.updated_at || l.created_at);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    }).length,
    [leads]
  );

  const totalWon = useMemo(() => leads.filter(l => l.status === 'won').length, [leads]);
  const totalLost = useMemo(() => leads.filter(l => l.status === 'lost').length, [leads]);
  const winRate = totalWon + totalLost > 0
    ? Math.round((totalWon / (totalWon + totalLost)) * 100)
    : 0;

  const dealsNeedingFollowUp = useMemo(
    () => leads.filter(l =>
      openStatuses.includes(l.status) &&
      l.next_follow_up &&
      new Date(l.next_follow_up) <= now
    ).length,
    [leads]
  );

  const grouped: Record<string, Lead[]> = {};
  for (const stage of pipelineStages) {
    grouped[stage] = filteredLeads.filter((l) => l.status === stage);
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
      toast.success('Deal deleted');
      load();
      setConfirmState({ open: false, loading: false });
    } catch {
      toast.error('Failed to delete deal');
      setConfirmState({ open: false, loading: false });
    } finally {
      setDeleting(null);
    }
  }

  async function triggerWonAutomation(leadId: string) {
    if (!workspace?.id) return;
    try {
      await backend.leadWon(workspace.id, leadId);
      toast.success('Client and project created from won deal');
    } catch {
      toast.error('Saved, but client/project automation failed');
    }
  }

  async function handleStageChange(lead: Lead, newStage: LeadStatus) {
    try {
      await updateLead(lead.id, { status: newStage });
      toast.success(`Moved to ${stageLabels[newStage]}`);
      if (newStage === 'won' && lead.status !== 'won') await triggerWonAutomation(lead.id);
      load();
    } catch {
      toast.error('Failed to move deal');
    }
  }

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    
    const sourceStage = result.source.droppableId as LeadStatus;
    const destStage = result.destination.droppableId as LeadStatus;
    
    if (sourceStage === destStage) return;

    const draggedLeadId = result.draggableId;
    const lead = leads.find(l => l.id === draggedLeadId);
    if (!lead) return;

    // Optimistically update local state
    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: destStage } : l));

    try {
      await updateLead(lead.id, { status: destStage });
      toast.success(`Moved to ${stageLabels[destStage]}`);
      if (destStage === 'won' && lead.status !== 'won') await triggerWonAutomation(lead.id);
    } catch {
      toast.error('Failed to move deal');
      load(); // Revert on failure
    }
  };

  function openDetailDrawer(lead: Lead) {
    setSelectedLead(lead);
    setDrawerOpen(true);
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading deals...</p></div>;
  }

  const kpiCards = [
    {
      title: 'Total Pipeline Value',
      value: fmt.money(totalPipelineValue),
      change: 'Open deals total',
      trend: 'up' as const,
      icon: DollarSign,
    },
    {
      title: 'Won This Month',
      value: fmt.money(wonThisMonth),
      change: `${wonThisMonthCount} deals`,
      trend: 'up' as const,
      icon: TrendingUp,
    },
    {
      title: 'Win Rate',
      value: `${winRate}%`,
      change: `${totalWon} won / ${totalLost} lost`,
      trend: winRate >= 50 ? 'up' as const : 'down' as const,
      icon: Clock,
    },
    {
      title: 'Needs Follow-up',
      value: String(dealsNeedingFollowUp),
      change: 'Deals requiring action',
      trend: dealsNeedingFollowUp > 0 ? 'down' as const : 'neutral' as const,
      icon: AlertCircle,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Pipeline</h2>
          <p className="text-sm text-muted-foreground">Track deals across your sales pipelines</p>
        </div>
        <Button onClick={() => { setEditingLead(null); setDialogOpen(true); }} className="w-full sm:w-auto">
          <Plus size={16} className="mr-2" />
          Add Deal
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi) => (
          <KpiCard key={kpi.title} {...kpi} />
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Select value={selectedPipelineId} onValueChange={setSelectedPipelineId}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="All Pipelines" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Pipelines</SelectItem>
              {pipelines.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative flex-1 sm:flex-initial">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search deals..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-full sm:w-64"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-muted rounded-lg p-0.5">
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="rounded-md px-3"
            >
              <LayoutList size={16} className="mr-1" />
              List
            </Button>
            <Button
              variant={viewMode === 'kanban' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('kanban')}
              className="rounded-md px-3"
            >
              <LayoutGrid size={16} className="mr-1" />
              Kanban
            </Button>
          </div>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Badge
          variant={activeStage === null ? 'default' : 'outline'}
          className="cursor-pointer px-3 py-1.5"
          onClick={() => setActiveStage(null)}
        >
          All
        </Badge>
        {pipelineStages.map((stage) => {
          const count = leads.filter(l => l.status === stage).length;
          return (
            <Badge
              key={stage}
              variant={activeStage === stage ? 'default' : 'outline'}
              className="cursor-pointer px-3 py-1.5"
              onClick={() => setActiveStage(activeStage === stage ? null : stage)}
            >
              {stageLabels[stage]} ({count})
            </Badge>
          );
        })}
      </div>

      {viewMode === 'list' && (
        <div className="rounded-xl border bg-card overflow-x-auto">
          <Table className="min-w-[600px]">
            <TableHeader>
              <TableRow>
                <TableHead>Deal Name</TableHead>
                <TableHead className="hidden md:table-cell">Client</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead className="hidden lg:table-cell">Days in Stage</TableHead>
                <TableHead className="hidden md:table-cell">Follow-up</TableHead>
                <TableHead className="hidden lg:table-cell">Owner</TableHead>
                <TableHead className="hidden lg:table-cell">Source</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedLeads.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-12">
                    No deals found
                  </TableCell>
                </TableRow>
              )}
              {paginatedLeads.map((lead) => {
                const daysInStage = daysBetween(lead.updated_at || lead.created_at);
                const needsFollowUp = lead.next_follow_up && new Date(lead.next_follow_up) <= now;
                return (
                  <TableRow key={lead.id} className="cursor-pointer" onClick={() => openDetailDrawer(lead)}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${
                          (0 || 0) <= 30 ? 'bg-blue-500' :
                          (0 || 0) <= 60 ? 'bg-amber-500' :
                          'bg-emerald-500'
                        }`} />
                        {lead.name}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Building2 size={14} />
                        {lead.company || '—'}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono">{lead.estimated_value ? fmt.money(lead.estimated_value) : '—'}</TableCell>
                    <TableCell>
                      <Badge className={stageColors[lead.status]} variant="outline">
                        {stageLabels[lead.status]}
                      </Badge>
                    </TableCell>

                    <TableCell className="hidden lg:table-cell text-muted-foreground">{daysInStage}d</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {needsFollowUp ? (
                        <div className="flex items-center gap-1 text-amber-600">
                          <AlertCircle size={14} />
                          <span className="text-xs">Overdue</span>
                        </div>
                      ) : lead.next_follow_up ? (
                        <span className="text-xs text-muted-foreground">
                          {fmt.date(lead.next_follow_up)}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">—</TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {lead.source ? (
                        <span className="text-xs text-muted-foreground">{lead.source}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal size={14} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openDetailDrawer(lead); }}>
                            <Eye size={14} className="mr-2" /> View
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditingLead(lead); setDialogOpen(true); }}>
                            <Pencil size={14} className="mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-600" onClick={(e) => { e.stopPropagation(); handleDelete(lead); }} disabled={deleting === lead.id}>
                            <Trash2 size={14} className="mr-2" /> {deleting === lead.id ? 'Deleting...' : 'Delete'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {viewMode === 'kanban' && (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-4">
            {pipelineStages.map((stage) => {
              const allStageLeads = grouped[stage] || [];
              const isExpanded = expandedColumns[stage] || false;
              const visibleLeads = isExpanded ? allStageLeads : allStageLeads.slice(0, KANBAN_PAGE_SIZE);
              const hiddenCount = allStageLeads.length - visibleLeads.length;
              return (
                <div key={stage} className="flex-shrink-0 w-72 flex flex-col">
                  <div className="flex items-center justify-between mb-3 shrink-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold">{stageLabels[stage]}</h3>
                      <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                        {allStageLeads.length}
                      </span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditingLead(null); setDialogOpen(true); }}>
                      <Plus size={12} />
                    </Button>
                  </div>
                  <Droppable droppableId={stage}>
                    {(provided, snapshot) => (
                      <div 
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className={`space-y-3 flex-1 transition-colors rounded-xl min-h-[150px] p-1 -m-1 ${snapshot.isDraggingOver ? 'bg-muted/50' : ''}`}
                      >
                        {visibleLeads.map((lead, index) => (
                          <Draggable key={lead.id} draggableId={lead.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                style={{
                                  ...provided.draggableProps.style,
                                  opacity: snapshot.isDragging ? 0.9 : 1,
                                }}
                              >
                                <Card className={`transition-all cursor-grab active:cursor-grabbing ${snapshot.isDragging ? 'ring-2 ring-border scale-[1.02]' : ''}`} onClick={() => openDetailDrawer(lead)}>
                                  <CardContent className="p-3 sm:p-4">
                                    <div className="flex items-start justify-between mb-2">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <div className={`w-2 h-2 rounded-full shrink-0 ${
                                          (0 || 0) <= 30 ? 'bg-blue-500' :
                                          (0 || 0) <= 60 ? 'bg-amber-500' :
                                          'bg-emerald-500'
                                        }`} />
                                        <p className="text-sm font-medium truncate">{lead.name}</p>
                                      </div>
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" aria-label="Deal actions">
                                            <MoreHorizontal size={12} />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openDetailDrawer(lead); }}>
                                            <Eye size={14} className="mr-2" /> View
                                          </DropdownMenuItem>
                                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditingLead(lead); setDialogOpen(true); }}>
                                            <Pencil size={14} className="mr-2" /> Edit
                                          </DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem className="text-red-600" onClick={(e) => { e.stopPropagation(); handleDelete(lead); }} disabled={deleting === lead.id}>
                                            <Trash2 size={14} className="mr-2" /> {deleting === lead.id ? 'Deleting...' : 'Delete'}
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>
                                    <div className="space-y-1.5 text-xs text-muted-foreground">
                                      <div className="flex items-center gap-1">
                                        <Building2 size={12} />
                                        {lead.company || '—'}
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <DollarSign size={12} />
                                        {lead.estimated_value ? fmt.money(lead.estimated_value) : '—'}
                                      </div>
                                      {lead.source && (
                                        <div className="flex items-center gap-1">
                                          <Code2 size={12} />
                                          {lead.source}
                                        </div>
                                      )}
                                      <div className="flex items-center justify-between">
                                        <span className="flex items-center gap-1">
                                          <Clock size={12} />
                                          {daysBetween(lead.updated_at || lead.created_at)}d
                                        </span>
                                      </div>
                                    </div>
                                    <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                                      <Select
                                        value={lead.status}
                                        onValueChange={(v: LeadStatus) => handleStageChange(lead, v)}
                                      >
                                        <SelectTrigger className="h-7 text-xs">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {pipelineStages.map((s) => (
                                            <SelectItem key={s} value={s}>{stageLabels[s]}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </CardContent>
                                </Card>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                        {allStageLeads.length === 0 && (
                          <div className="border-2 border-dashed rounded-lg p-4 text-center mt-2">
                            <p className="text-xs text-muted-foreground">No deals</p>
                          </div>
                        )}
                        {hiddenCount > 0 && (
                          <button
                            onClick={() => setExpandedColumns(prev => ({ ...prev, [stage]: true }))}
                            className="w-full text-center text-xs text-muted-foreground hover:text-foreground py-2 rounded-lg hover:bg-muted/50 transition-colors"
                          >
                            Show {hiddenCount} more
                          </button>
                        )}
                        {isExpanded && allStageLeads.length > KANBAN_PAGE_SIZE && (
                          <button
                            onClick={() => setExpandedColumns(prev => ({ ...prev, [stage]: false }))}
                            className="w-full text-center text-xs text-muted-foreground hover:text-foreground py-2 rounded-lg hover:bg-muted/50 transition-colors"
                          >
                            Show less
                          </button>
                        )}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      )}

      {viewMode === 'list' && filteredLeads.length > PAGE_SIZE && (
        <DataPagination
          page={page}
          totalItems={filteredLeads.length}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      )}

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>{selectedLead?.name || 'Deal Details'}</SheetTitle>
            <SheetDescription>
              {selectedLead?.company && `${selectedLead.company} — `}
              {selectedLead?.email}
            </SheetDescription>
          </SheetHeader>
          {selectedLead && (
            <div className="space-y-6">
              <div className="rounded-xl border bg-card p-5">
                <p className="text-sm text-muted-foreground mb-1">Deal Value</p>
                <p className="text-2xl sm:text-3xl font-semibold">
                  {selectedLead.estimated_value ? fmt.money(selectedLead.estimated_value) : 'Not set'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  <Badge className={stageColors[selectedLead.status]} variant="outline">
                    {stageLabels[selectedLead.status]}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Source</p>
                  <p className="text-sm font-medium">{selectedLead.source || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Days in Stage</p>
                  <p className="text-sm font-medium">{daysBetween(selectedLead.updated_at || selectedLead.created_at)} days</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Created</p>
                  <p className="text-sm font-medium">{fmt.date(selectedLead.created_at)}</p>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-3">Contact Information</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <User size={14} className="text-muted-foreground shrink-0" />
                    <span>{selectedLead.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building2 size={14} className="text-muted-foreground shrink-0" />
                    <span>{selectedLead.company || '—'}</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-3">Follow-up</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-muted-foreground shrink-0" />
                    <span>
                      {selectedLead.next_follow_up
                        ? fmt.date(selectedLead.next_follow_up)
                        : 'No follow-up scheduled'}
                    </span>
                  </div>
                </div>
              </div>

              {selectedLead.notes && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Notes</h4>
                  <p className="text-sm text-muted-foreground">{selectedLead.notes}</p>
                </div>
              )}

              {selectedLead.tags && selectedLead.tags.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Tags</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedLead.tags.map((tag, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        <TagIcon size={10} className="mr-1" />
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2 border-t">
                <Button variant="outline" size="sm" onClick={() => { setEditingLead(selectedLead); setDialogOpen(true); setDrawerOpen(false); }}>
                  <Pencil size={14} className="mr-1" /> Edit
                </Button>
                <Button variant="outline" size="sm" className="text-red-600 hover:text-red-600" onClick={() => { handleDelete(selectedLead); setDrawerOpen(false); }}>
                  <Trash2 size={14} className="mr-1" /> Delete
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <LeadDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={load}
        lead={editingLead}
      />
      <ConfirmDialog
        open={confirmState.open}
        onOpenChange={(open) => setConfirmState({ open })}
        title="Delete Deal"
        description="Are you sure you want to delete this deal? This action cannot be undone."
        onConfirm={onDeleteConfirm}
        loading={confirmState.loading}
      />
    </div>
  );
}
