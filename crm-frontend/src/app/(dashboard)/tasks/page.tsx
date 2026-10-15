'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { 
  Search, Plus, LayoutGrid, LayoutList, Kanban, Table as TableIcon, Calendar as CalendarIcon,
  CheckCircle2, AlertCircle, X, ChevronDown, MoreHorizontal, MessageSquare, Paperclip,
  Trash2, Filter, Settings, Flag, Check, Pencil
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useAuth } from '@/lib/firebase/auth-context';
import { 
  Task, Assignee, SubTask, Comment, DealReference, Attachment, 
  TaskPriority, ViewType, TasksData,
  subscribeToTasksData, createTask, updateTask, deleteTask, saveTaskColumns 
} from '@/lib/db/tasks/api';
import { subscribeToProjectsData, createMember, Member } from '@/lib/db/projects/api';

export interface DashboardWidget {
  id: string;
  title: string;
  w: number; 
  h: number; 
  type: 'overview' | 'status-chart' | 'priority-chart' | 'team-activity';
}

const PriorityStyle = (priority: TaskPriority) => {
  switch (priority) {
    case 'Urgent': return 'text-rose-600 font-bold';
    case 'High': return 'text-amber-600 font-bold';
    case 'Medium': return 'text-blue-600 font-semibold';
    case 'Low': return 'text-slate-500 font-medium';
    default: return 'text-slate-500 font-medium';
  }
};

export default function TaskManagerPage() {
  const { workspace, user } = useAuth();
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);

  // State
  const [columns, setColumns] = useState<string[]>(['To Do', 'In Progress', 'Review', 'Done']);
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);

  useEffect(() => {
    if (!workspace?.id) return;
    const unsubscribeTasks = subscribeToTasksData(workspace?.id, (data) => {
      setTasks(data.tasks);
      setColumns(data.columns);
    });
    const unsubscribeProjects = subscribeToProjectsData(workspace?.id, (data) => {
      setMembers(data.members);
    });
    return () => {
      unsubscribeTasks();
      unsubscribeProjects();
    };
  }, [workspace?.id]);
  const [view, setView] = useState<ViewType>('Kanban');
  const [search, setSearch] = useState('');
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());

  // Modals
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);

  // Sync viewingTask with live updates
  useEffect(() => {
    if (viewingTask) {
      const updated = tasks.find(t => t.id === viewingTask.id);
      if (updated) setViewingTask(updated);
    }
  }, [tasks]);

  // Subtask UI state
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newSubtaskDueDate, setNewSubtaskDueDate] = useState('');
  const [newSubtaskDescription, setNewSubtaskDescription] = useState('');
  const [newSubtaskAssigneeIds, setNewSubtaskAssigneeIds] = useState<string[]>([]);
  const [expandedSubtasks, setExpandedSubtasks] = useState<Set<string>>(new Set());

  // New/Edit Task Form State
  const [formTitle, setFormTitle] = useState('');
  const [formStatus, setFormStatus] = useState('To Do');
  const [formPriority, setFormPriority] = useState<TaskPriority>('Medium');
  const [formDate, setFormDate] = useState('');
  const [formAssigneeIds, setFormAssigneeIds] = useState<string[]>([]);
  const [formDescription, setFormDescription] = useState('');
  const [formLabels, setFormLabels] = useState<string[]>([]);
  const [newMemberName, setNewMemberName] = useState('');

  // Filters & Sorting
  const [filterOwner, setFilterOwner] = useState('All');
  const [filterPriority, setFilterPriority] = useState('All');
  const [filterTag, setFilterTag] = useState('All');
  const [sortBy, setSortBy] = useState('None');

  // Calendar State
  const [calendarCurrentDate, setCalendarCurrentDate] = useState(new Date());

  // Helper: Extract assignees consistently
  const getTaskAssignees = (task: Task): Assignee[] => {
    if (task.assignees && task.assignees.length > 0) return task.assignees;
    if (task.assignee) return [task.assignee];
    return [];
  };

  // Helper: Available Labels
  const AVAILABLE_LABELS = [
    { name: 'Feature', color: 'bg-indigo-500' },
    { name: 'Bug', color: 'bg-blue-500' },
    { name: 'Design', color: 'bg-emerald-500' },
    { name: 'Urgent', color: 'bg-amber-500' },
    { name: 'Critical', color: 'bg-rose-500' },
    { name: 'Marketing', color: 'bg-pink-500' }
  ];

  // Derived filtered & sorted tasks
  const filteredTasks = useMemo(() => {
    let result = tasks.filter(t => {
      const matchesSearch = t.title.toLowerCase().includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase());
      const taskAssignees = getTaskAssignees(t);
      const matchesOwner = filterOwner === 'All' || taskAssignees.some(a => a.name === filterOwner);
      const matchesPriority = filterPriority === 'All' || t.priority === filterPriority;
      const matchesTag = filterTag === 'All' || (t.labels && t.labels.includes(filterTag));
      return matchesSearch && matchesOwner && matchesPriority && matchesTag;
    });

    if (sortBy === 'Due') {
      result = [...result].sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
    }

    return result;
  }, [tasks, search, filterOwner, filterPriority, filterTag, sortBy]);

  // Unique labels in system
  const allLabels = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach(t => t.labels?.forEach(l => set.add(l)));
    return Array.from(set);
  }, [tasks]);

  // Handlers
  const handleOpenEditTask = (task: Task) => {
    setEditingTask(task);
    setFormTitle(task.title);
    setFormStatus(task.status);
    setFormPriority(task.priority);
    setFormDate(task.dueDate || '');
    setFormAssigneeIds(getTaskAssignees(task).map(a => a.id));
    setFormDescription(task.description || '');
    setFormLabels(task.labels || []);
    setViewingTask(null);
    setIsNewTaskOpen(true);
  };

  const handleCloseTaskDialog = () => {
    setIsNewTaskOpen(false);
    setEditingTask(null);
    setFormTitle('');
    setFormStatus('To Do');
    setFormPriority('Medium');
    setFormDate('');
    setFormAssigneeIds([]);
    setFormDescription('');
    setFormLabels([]);
  };

  const handleSaveTask = async () => {
    if (!workspace?.id) return;
    if (!formTitle.trim()) return toast.error('Task title is required');
    
    const assignees = members
      .filter(m => formAssigneeIds.includes(m.id))
      .map(m => ({ ...m, email: '' }));
      
    if (assignees.length === 0 && members.length > 0) {
      assignees.push({ ...members[0], email: '' });
    }
    
    try {
      if (editingTask) {
        await updateTask(workspace.id, editingTask.id, {
          title: formTitle.trim(),
          description: formDescription,
          status: formStatus,
          assignees,
          priority: formPriority,
          dueDate: formDate || new Date().toISOString().split('T')[0],
          labels: formLabels,
        });
        toast.success('Task updated successfully');
      } else {
        const newTask = {
          title: formTitle.trim(),
          description: formDescription,
          status: formStatus,
          assignees,
          priority: formPriority,
          dueDate: formDate || new Date().toISOString().split('T')[0],
          subtasks: [],
          comments: [],
          labels: formLabels,
          dealReference: null,
          attachments: []
        };
        await createTask(workspace.id, newTask);
        toast.success('Task scheduled successfully');
      }
      handleCloseTaskDialog();
    } catch (e) {
      toast.error(editingTask ? 'Failed to update task' : 'Failed to create task');
    }
  };

  const handleSaveNewColumn = async () => {
    if (!workspace?.id) return;
    const trimmed = newColumnName.trim();
    if (trimmed && !columns.includes(trimmed)) {
      const nextCols = [...columns, trimmed];
      const success = await saveTaskColumns(workspace?.id, nextCols);
      if (!success) {
        toast.error('Failed to save column to backend');
      } else {
        toast.success('Column added successfully');
        setNewColumnName('');
        setIsAddingColumn(false);
      }
    } else if (trimmed) {
      toast.error('Invalid or duplicate column name');
    }
  };

  const handleDeleteColumn = async (colToDelete: string) => {
    if (!workspace?.id) return;
    const colTasks = tasks.filter(t => t.status === colToDelete);
    if (colTasks.length > 0) {
      if (!window.confirm(`There are ${colTasks.length} tasks in "${colToDelete}". Are you sure you want to delete this column?`)) return;
    }
    
    const nextCols = columns.filter(c => c !== colToDelete);
    const success = await saveTaskColumns(workspace?.id, nextCols);
    if (!success) {
      toast.error('Failed to delete column from backend');
    } else {
      toast.success(`Column "${colToDelete}" deleted`);
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!workspace?.id) return;
    const { source, destination, draggableId } = result;
    if (!destination || source.droppableId === destination.droppableId) return;
    
    try {
      await updateTask(workspace?.id, draggableId, { status: destination.droppableId });
    } catch (e) {
      toast.error('Failed to move task');
    }
  };

  const toggleTaskSelection = (id: string) => {
    const next = new Set(selectedTaskIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedTaskIds(next);
  };

  const handleDeleteSingleTask = async (taskId: string) => {
    if (!workspace?.id) return;
    try {
      await deleteTask(workspace?.id, taskId);
      toast.success('Task deleted successfully');
    } catch (e) {
      toast.error('Failed to delete task');
    }
  };

  const handleBulkDelete = async () => {
    if (!workspace?.id) return;
    try {
      const promises = Array.from(selectedTaskIds).map(id => deleteTask(workspace?.id!, id));
      await Promise.all(promises);
      setSelectedTaskIds(new Set());
      toast.success('Selected tasks deleted');
    } catch (e) {
      toast.error('Failed to delete tasks');
    }
  };

  const handleBulkStatusChange = async (newStatus: string) => {
    if (!workspace?.id) return;
    try {
      await Promise.all(
        Array.from(selectedTaskIds).map(id => updateTask(workspace?.id!, id, { status: newStatus }))
      );
      toast.success(`${selectedTaskIds.size} tasks moved to ${newStatus}`);
      setSelectedTaskIds(new Set());
    } catch (e) {
      toast.error('Failed to update tasks');
    }
  };

  const handleAddNewMember = async (e: React.MouseEvent, target: 'task' | 'subtask') => {
    e.preventDefault();
    e.stopPropagation();
    if (!workspace?.id) return;
    if (!newMemberName.trim()) return;
    
    const newMemb = {
      name: newMemberName,
      avatar: newMemberName.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() || 'U'
    };
    
    try {
      const newId = await createMember(workspace?.id, newMemb);
      if (newId) {
        if (target === 'task') {
          setFormAssigneeIds(prev => [...prev, newId]);
        } else {
          setNewSubtaskAssigneeIds(prev => [...prev, newId]);
        }
      }
      setNewMemberName('');
    } catch (err) {
      toast.error('Failed to add member');
    }
  };

  const handleAddSubtask = async () => {
    if (!workspace?.id || !viewingTask) return;
    if (!newSubtaskTitle.trim()) return;
    
    const assignees = members
      .filter(m => newSubtaskAssigneeIds.includes(m.id))
      .map(m => ({ ...m, email: '' }));

    const newSubtask = {
      id: `st${Date.now()}`,
      title: newSubtaskTitle.trim(),
      completed: false,
      dueDate: newSubtaskDueDate || undefined,
      description: newSubtaskDescription.trim() || undefined,
      assignees: assignees.length > 0 ? assignees : undefined
    };

    const nextSubtasks = [...(viewingTask.subtasks || []), newSubtask];
    
    try {
      await updateTask(workspace?.id, viewingTask.id, { subtasks: nextSubtasks });
      setIsAddingSubtask(false);
      setNewSubtaskTitle('');
      setNewSubtaskDueDate('');
      setNewSubtaskDescription('');
      setNewSubtaskAssigneeIds([]);
    } catch (e) {
      toast.error('Failed to add subtask');
    }
  };

  const toggleSubtaskExpansion = (id: string) => {
    setExpandedSubtasks(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSubtaskCompletion = async (subtaskId: string) => {
    if (!workspace?.id || !viewingTask) return;
    const nextSubtasks = (viewingTask.subtasks || []).map(s => 
      s.id === subtaskId ? { ...s, completed: !s.completed } : s
    );
    try {
      await updateTask(workspace?.id, viewingTask.id, { subtasks: nextSubtasks });
    } catch (e) {
      toast.error('Failed to update subtask');
    }
  };

  const updateTaskField = async (id: string, field: keyof Task, value: any) => {
    if (!workspace?.id) return;
    try {
      await updateTask(workspace?.id, id, { [field]: value });
    } catch (e) {
      toast.error('Failed to update task');
    }
  };

  const getCalendarDays = () => {
    const year = calendarCurrentDate.getFullYear();
    const month = calendarCurrentDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    
    return Array.from({ length: 35 }, (_, i) => {
      const date = new Date(year, month, i - firstDayOfMonth + 1);
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      return { 
        date, 
        dateStr,
        dayNum: date.getDate(),
        isCurrentMonth: date.getMonth() === month
      };
    });
  };

  if (!isMounted) return null;

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] min-h-0 space-y-4">
      
      {/* 2. Global Toolbar & Controls */}
      <div className="flex flex-col gap-4 shrink-0 bg-card p-4 rounded-xl border shadow-sm z-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          
          {/* View Switchers */}
          <Tabs value={view} onValueChange={(v) => setView(v as ViewType)}>
            <TabsList>
              <TabsTrigger value="Kanban" className="gap-1.5"><Kanban className="h-3 w-3" /> Kanban</TabsTrigger>
              <TabsTrigger value="Dashboard" className="gap-1.5"><LayoutGrid className="h-3 w-3" /> Dashboard</TabsTrigger>
              <TabsTrigger value="List" className="gap-1.5"><LayoutList className="h-3 w-3" /> List</TabsTrigger>
              <TabsTrigger value="Table" className="gap-1.5"><TableIcon className="h-3 w-3" /> Table</TabsTrigger>
              <TabsTrigger value="Calendar" className="gap-1.5"><CalendarIcon className="h-3 w-3" /> Calendar</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Top Right Actions */}
          <div className="flex items-center gap-3">
            <div className="relative w-64 hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search tasks..." 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
                className="pl-9 h-9 bg-background focus-visible:ring-primary text-sm" 
              />
            </div>
            <Button onClick={() => setIsNewTaskOpen(true)} className="h-9 bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-sm">
              <Plus className="w-4 h-4 mr-1.5" /> New Task
            </Button>
          </div>
        </div>

        {/* Filters Row */}
        {view !== 'Dashboard' && (
          <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-border/50">
            <div className="space-y-1">
              <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider">Owner</span>
              <Select value={filterOwner} onValueChange={setFilterOwner}>
                <SelectTrigger className="h-8 text-xs w-[140px] bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                <SelectItem value="All">All Members</SelectItem>
                {members.map(a => (
                  <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>
                ))}
              </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider">Priority</span>
              <Select value={filterPriority} onValueChange={setFilterPriority}>
                <SelectTrigger className="h-8 text-xs w-[140px] bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Priorities</SelectItem>
                  <SelectItem value="Urgent">Urgent</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider">Tag</span>
              <Select value={filterTag} onValueChange={setFilterTag}>
                <SelectTrigger className="h-8 text-xs w-[140px] bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Tags</SelectItem>
                  {allLabels.map(l => (
                    <SelectItem key={l} value={l}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider">Sort</span>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="h-8 text-xs w-[140px] bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="None">None</SelectItem>
                  <SelectItem value="Due">Due Date</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {/* 3. Bulk Actions Strip */}
      {selectedTaskIds.size > 0 && (view === 'List' || view === 'Table') && (
        <div className="shrink-0 bg-primary/5 border border-primary/20 shadow-sm rounded-lg p-3 flex items-center justify-between animate-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-primary animate-pulse" />
            <span className="text-sm font-bold text-foreground">{selectedTaskIds.size} tasks selected</span>
          </div>
          <div className="flex items-center gap-3">
            <Select onValueChange={handleBulkStatusChange}>
              <SelectTrigger className="h-8 text-xs w-[150px] bg-background border-border"><SelectValue placeholder="Move status to..." /></SelectTrigger>
              <SelectContent>
                {columns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" onClick={handleBulkDelete} className="h-8 text-rose-600 hover:bg-rose-100 hover:text-rose-700 font-bold">
              <Trash2 className="w-4 h-4 mr-2" /> Delete
            </Button>
            <div className="w-px h-4 bg-border" />
            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10" onClick={() => setSelectedTaskIds(new Set())}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* 4. Dynamic Views */}
      <div className="flex-1 min-h-0 overflow-hidden relative">
        
        {/* A. Kanban Board View */}
        {view === 'Kanban' && (
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="flex gap-4 h-full overflow-x-auto items-start pb-4">
              {columns.map((col, idx) => {
                const colTasks = filteredTasks.filter(t => t.status === col);
                const themeColors = [
                  { bg: 'bg-blue-500/10', text: 'text-blue-500', border: 'border-blue-500/30' },
                  { bg: 'bg-purple-500/10', text: 'text-purple-500', border: 'border-purple-500/30' },
                  { bg: 'bg-amber-500/10', text: 'text-amber-500', border: 'border-amber-500/30' },
                  { bg: 'bg-emerald-500/10', text: 'text-emerald-500', border: 'border-emerald-500/30' }
                ];
                const theme = themeColors[idx % themeColors.length];

                return (
                  <div key={col} className="flex-shrink-0 w-[340px] flex flex-col max-h-full">
                    <div className="flex items-center justify-between mb-4 px-1 shrink-0">
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${theme.bg} ${theme.text} ring-4 ring-background shadow-sm`} style={{ backgroundColor: 'currentColor' }} />
                        <h3 className="font-bold text-sm uppercase tracking-wider">{col}</h3>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-muted/80 ml-1">
                          {colTasks.length}
                        </Badge>
                      </div>
                      <Button variant="ghost" size="icon" className="w-6 h-6 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-full" onClick={() => handleDeleteColumn(col)}><X className="w-3 h-3" /></Button>
                    </div>
                    
                    <Droppable droppableId={col}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`flex-1 overflow-y-auto p-2 space-y-3 rounded-2xl transition-all duration-300 ${snapshot.isDraggingOver ? 'bg-primary/5 ring-1 ring-primary/20' : 'bg-muted/30 border border-border/50'}`}
                        >
                          {colTasks.map((task, index) => (
                            <Draggable key={task.id} draggableId={task.id} index={index}>
                              {(provided, snapshot) => {
                                const priorityColors = {
                                  Low: 'bg-blue-500',
                                  Medium: 'bg-amber-500',
                                  High: 'bg-rose-500',
                                  Urgent: 'bg-red-600 animate-pulse'
                                };
                                const pColor = priorityColors[task.priority as keyof typeof priorityColors] || 'bg-slate-500';
                                const taskAssignees = getTaskAssignees(task);

                                return (
                                  <Card
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    onClick={() => setViewingTask(task)}
                                    className={`cursor-pointer transition-all duration-200 bg-background group overflow-hidden relative
                                      ${snapshot.isDragging ? 'shadow-2xl rotate-3 ring-2 ring-primary/30' : 'shadow-sm hover:shadow-md hover:border-primary/40'}
                                    `}
                                  >
                                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${pColor} opacity-80 group-hover:opacity-100 transition-opacity`} />
                                    <CardContent className="p-4 pl-5 space-y-3 relative">
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="flex gap-1 flex-wrap items-center">
                                          {task.labels?.map(l => <Badge key={l} variant="outline" className="text-[9px] px-2 py-0 border-primary/20 text-primary bg-primary/5">{l}</Badge>)}
                                        </div>
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-6 w-6 -mr-1 -mt-1 text-muted-foreground hover:text-foreground opacity-60 group-hover:opacity-100 transition-opacity"
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              <MoreHorizontal className="w-4 h-4" />
                                            </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                            <DropdownMenuItem onClick={() => handleOpenEditTask(task)}>
                                              <Pencil className="w-3.5 h-3.5 mr-2" /> Edit Task
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                              className="text-destructive focus:text-destructive"
                                              onClick={() => setTaskToDelete(task)}
                                            >
                                              <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete Task
                                            </DropdownMenuItem>
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      </div>
                                      <h4 className="font-bold text-[15px] leading-snug text-foreground group-hover:text-primary transition-colors">{task.title}</h4>
                                      {task.description && (
                                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{task.description}</p>
                                      )}
                                      
                                      {((task.subtasks?.length || 0) > 0 || (task.comments?.length || 0) > 0 || (task.attachments?.length || 0) > 0) && (
                                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-medium pt-2">
                                          {(task.subtasks?.length || 0) > 0 && <span className={`flex items-center gap-1 ${task.subtasks!.filter(s=>s.completed).length === task.subtasks!.length ? 'text-emerald-600' : ''}`}><CheckCircle2 className="w-3.5 h-3.5" /> {task.subtasks!.filter(s=>s.completed).length}/{task.subtasks!.length}</span>}
                                          {(task.comments?.length || 0) > 0 && <span className="flex items-center gap-1"><MessageSquare className="w-3.5 h-3.5" /> {task.comments!.length}</span>}
                                          {(task.attachments?.length || 0) > 0 && <span className="flex items-center gap-1"><Paperclip className="w-3.5 h-3.5" /> {task.attachments!.length}</span>}
                                        </div>
                                      )}

                                      <div className="flex items-center justify-between pt-3 mt-3 border-t border-border/40">
                                        <div className="flex flex-col gap-0.5">
                                          <span className={`text-[10px] font-bold uppercase tracking-wider ${PriorityStyle(task.priority)}`}>{task.priority}</span>
                                          <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1"><CalendarIcon className="w-3 h-3"/>{task.dueDate}</span>
                                        </div>
                                        <div className="flex -space-x-2 overflow-hidden">
                                          {taskAssignees.slice(0, 3).map((a, i) => (
                                            <Avatar key={a.id || i} className="h-7 w-7 border-2 border-background shadow-sm ring-1 ring-border/50" title={a.name}>
                                              <AvatarFallback className="text-[9px] bg-primary/10 text-primary font-bold">{a.avatar}</AvatarFallback>
                                            </Avatar>
                                          ))}
                                          {taskAssignees.length > 3 && (
                                            <div className="h-7 w-7 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[9px] font-bold text-muted-foreground ring-1 ring-border/50">
                                              +{taskAssignees.length - 3}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </CardContent>
                                  </Card>
                                );
                              }}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                          <Button variant="ghost" className="w-full text-muted-foreground text-xs font-bold border border-dashed border-muted-foreground/30 hover:border-foreground/30 hover:bg-foreground/5 h-12 rounded-xl mt-2 transition-colors" onClick={() => setIsNewTaskOpen(true)}>
                            <Plus className="w-4 h-4 mr-2" /> Add Task
                          </Button>
                        </div>
                      )}
                    </Droppable>
                  </div>
                );
              })}
              {isAddingColumn ? (
                <div className="flex-shrink-0 w-[320px] bg-muted/10 border-2 rounded-xl border-primary/50 p-3 flex flex-col gap-2">
                  <Input
                    autoFocus
                    placeholder="Column title..."
                    value={newColumnName}
                    onChange={(e) => setNewColumnName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveNewColumn();
                      if (e.key === 'Escape') setIsAddingColumn(false);
                    }}
                    className="bg-background h-8 text-sm"
                  />
                  <div className="flex items-center gap-2">
                    <Button size="sm" className="h-7 text-xs px-3" onClick={handleSaveNewColumn}>Add</Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setIsAddingColumn(false)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div onClick={() => setIsAddingColumn(true)} className="flex-shrink-0 w-[320px] flex items-center justify-center bg-muted/10 border-2 border-dashed rounded-xl border-muted-foreground/20 hover:border-primary/50 hover:bg-muted/30 cursor-pointer transition-colors group">
                  <span className="text-sm font-bold text-muted-foreground group-hover:text-primary flex items-center"><Plus className="w-4 h-4 mr-2" /> Add Column</span>
                </div>
              )}
            </div>
          </DragDropContext>
        )}

        {/* B. Dashboard View */}
        {view === 'Dashboard' && (
          <div className="h-full overflow-y-auto space-y-4 p-1">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="border shadow-sm bg-gradient-to-br from-card to-muted/20"><CardContent className="p-5">
                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Total Tasks</p>
                <p className="text-3xl font-extrabold text-foreground mt-2">{tasks.length}</p>
              </CardContent></Card>
              
              <Card className="border shadow-sm bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 border-emerald-500/20"><CardContent className="p-5">
                <p className="text-xs text-emerald-600 font-bold uppercase tracking-wider">Completed</p>
                <p className="text-3xl font-extrabold text-emerald-700 dark:text-emerald-400 mt-2">{tasks.filter(t=>t.status==='Done').length}</p>
              </CardContent></Card>

              <Card className="border shadow-sm bg-gradient-to-br from-amber-500/5 to-amber-500/10 border-amber-500/20"><CardContent className="p-5">
                <p className="text-xs text-amber-600 font-bold uppercase tracking-wider">In Progress</p>
                <p className="text-3xl font-extrabold text-amber-700 dark:text-amber-400 mt-2">{tasks.filter(t=>t.status==='In Progress').length}</p>
              </CardContent></Card>

              <Card className="border shadow-sm bg-gradient-to-br from-rose-500/5 to-rose-500/10 border-rose-500/20"><CardContent className="p-5">
                <p className="text-xs text-rose-600 font-bold uppercase tracking-wider">Urgent Tasks</p>
                <p className="text-3xl font-extrabold text-rose-700 dark:text-rose-400 mt-2">{tasks.filter(t=>t.priority==='Urgent').length}</p>
              </CardContent></Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Dynamic Status Breakdown */}
              <Card className="border shadow-sm"><CardContent className="p-6">
                <h3 className="font-bold text-base text-foreground mb-4">Status Distribution</h3>
                <div className="space-y-4">
                  {columns.map(col => {
                    const count = tasks.filter(t => t.status === col).length;
                    const pct = tasks.length > 0 ? Math.round((count / tasks.length) * 100) : 0;
                    return (
                      <div key={col} className="space-y-1.5">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-foreground">{col}</span>
                          <span className="text-muted-foreground">{count} ({pct}%)</span>
                        </div>
                        <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent></Card>

              {/* Dynamic Priority Breakdown */}
              <Card className="border shadow-sm"><CardContent className="p-6">
                <h3 className="font-bold text-base text-foreground mb-4">Priority Breakdown</h3>
                <div className="space-y-4">
                  {(['Urgent', 'High', 'Medium', 'Low'] as TaskPriority[]).map(p => {
                    const count = tasks.filter(t => t.priority === p).length;
                    const pct = tasks.length > 0 ? Math.round((count / tasks.length) * 100) : 0;
                    const colors: Record<TaskPriority, string> = {
                      Urgent: 'bg-rose-600',
                      High: 'bg-amber-500',
                      Medium: 'bg-blue-500',
                      Low: 'bg-slate-400'
                    };
                    return (
                      <div key={p} className="space-y-1.5">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-foreground">{p}</span>
                          <span className="text-muted-foreground">{count} ({pct}%)</span>
                        </div>
                        <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full ${colors[p]} transition-all duration-500`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent></Card>
            </div>
          </div>
        )}

        {/* C. Compact List View */}
        {view === 'List' && (
          <div className="h-full overflow-y-auto space-y-2 pb-4 px-1">
            <div className="flex items-center gap-4 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <div className="w-6 text-center"><input type="checkbox" className="rounded" onChange={(e) => setSelectedTaskIds(e.target.checked ? new Set(filteredTasks.map(t=>t.id)) : new Set())} checked={selectedTaskIds.size === filteredTasks.length && filteredTasks.length > 0} /></div>
              <div className="flex-1">Task Details</div>
              <div className="w-32">Status</div>
              <div className="w-32">Priority</div>
              <div className="w-32">Due Date</div>
              <div className="w-32">Assignee</div>
              <div className="w-12 text-center">Action</div>
            </div>
            {filteredTasks.map(task => {
              const primaryAssignee = getTaskAssignees(task)[0];
              return (
                <div key={task.id} className={`flex items-center gap-4 p-3 rounded-xl border transition-all cursor-default ${selectedTaskIds.has(task.id) ? 'bg-primary/5 border-primary/30' : 'bg-card hover:border-primary/40 shadow-sm'}`}>
                  <div className="w-6 text-center"><input type="checkbox" className="rounded text-primary focus:ring-primary" checked={selectedTaskIds.has(task.id)} onChange={() => toggleTaskSelection(task.id)} /></div>
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setViewingTask(task)}>
                    <p className="font-bold text-sm text-foreground truncate">{task.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{task.description}</p>
                  </div>
                  <div className="w-32">
                    <Select value={task.status} onValueChange={(v) => updateTaskField(task.id, 'status', v)}>
                      <SelectTrigger className="h-8 text-xs bg-muted/50 border-0"><SelectValue /></SelectTrigger>
                      <SelectContent>{columns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="w-32">
                    <Select value={task.priority} onValueChange={(v) => updateTaskField(task.id, 'priority', v)}>
                      <SelectTrigger className="h-8 text-xs bg-muted/50 border-0"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="Urgent">Urgent</SelectItem><SelectItem value="High">High</SelectItem><SelectItem value="Medium">Medium</SelectItem><SelectItem value="Low">Low</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="w-32">
                    <input type="date" value={task.dueDate} onChange={(e) => updateTaskField(task.id, 'dueDate', e.target.value)} className="h-8 w-full text-xs rounded-md border-0 bg-muted/50 px-2 outline-none focus:ring-1 focus:ring-primary" />
                  </div>
                  <div className="w-32 flex items-center gap-2">
                    <Avatar className="h-6 w-6"><AvatarFallback className="text-[9px] bg-primary/10 text-primary">{primaryAssignee?.avatar || 'U'}</AvatarFallback></Avatar>
                    <span className="text-xs font-semibold truncate">{primaryAssignee?.name || 'Unassigned'}</span>
                  </div>
                  <div className="w-16 flex items-center justify-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" title="Edit Task" onClick={() => handleOpenEditTask(task)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-rose-600" title="Delete Task" onClick={() => handleDeleteSingleTask(task.id)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* D. Notion-Style Table View */}
        {view === 'Table' && (
          <div className="h-full overflow-y-auto">
            <Card className="border shadow-sm"><CardContent className="p-0">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/30 border-b text-xs uppercase tracking-wider text-muted-foreground sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 w-12 text-center"><input type="checkbox" className="rounded" onChange={(e) => setSelectedTaskIds(e.target.checked ? new Set(filteredTasks.map(t=>t.id)) : new Set())} /></th>
                    <th className="px-4 py-3 font-bold">Title / Core Goal Description</th>
                    <th className="px-4 py-3 font-bold w-40">Status</th>
                    <th className="px-4 py-3 font-bold w-36">Priority</th>
                    <th className="px-4 py-3 font-bold w-36">Due Date</th>
                    <th className="px-4 py-3 font-bold w-40">Lead Owner</th>
                    <th className="px-4 py-3 font-bold w-40">Deal Context</th>
                    <th className="px-4 py-3 font-bold w-20 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredTasks.map(task => {
                    const primaryAssignee = getTaskAssignees(task)[0];
                    return (
                      <tr key={task.id} className={`transition-colors ${selectedTaskIds.has(task.id) ? 'bg-primary/5' : 'hover:bg-muted/20 even:bg-muted/5'}`}>
                        <td className="px-4 py-3 text-center"><input type="checkbox" className="rounded text-primary focus:ring-primary" checked={selectedTaskIds.has(task.id)} onChange={() => toggleTaskSelection(task.id)} /></td>
                        <td className="px-4 py-3">
                          <p className="font-bold cursor-pointer hover:text-primary transition-colors" onClick={() => setViewingTask(task)}>{task.title}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-sm mt-0.5">{task.description}</p>
                        </td>
                        <td className="px-4 py-3">
                          <Select value={task.status} onValueChange={(v) => updateTaskField(task.id, 'status', v)}>
                            <SelectTrigger className="h-7 text-xs bg-transparent border-border/50 hover:bg-muted/50"><SelectValue /></SelectTrigger>
                            <SelectContent>{columns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                          </Select>
                        </td>
                        <td className="px-4 py-3">
                          <Select value={task.priority} onValueChange={(v) => updateTaskField(task.id, 'priority', v)}>
                            <SelectTrigger className="h-7 text-xs bg-transparent border-border/50 hover:bg-muted/50">
                              <span className={PriorityStyle(task.priority)}><SelectValue /></span>
                            </SelectTrigger>
                            <SelectContent><SelectItem value="Urgent">Urgent</SelectItem><SelectItem value="High">High</SelectItem><SelectItem value="Medium">Medium</SelectItem><SelectItem value="Low">Low</SelectItem></SelectContent>
                          </Select>
                        </td>
                        <td className="px-4 py-3">
                          <input type="date" value={task.dueDate} onChange={(e) => updateTaskField(task.id, 'dueDate', e.target.value)} className="h-7 w-full text-xs rounded-md border border-border/50 bg-transparent px-2 hover:bg-muted/50 focus:bg-background outline-none focus:ring-1" />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2"><Avatar className="h-5 w-5"><AvatarFallback className="text-[8px] bg-primary/10">{primaryAssignee?.avatar || 'U'}</AvatarFallback></Avatar><span className="text-xs font-semibold">{primaryAssignee?.name || 'Unassigned'}</span></div>
                        </td>
                        <td className="px-4 py-3">
                          {task.dealReference ? (
                            <div className="flex flex-col"><span className="text-xs font-bold text-blue-600 truncate">{task.dealReference.name}</span><span className="text-[10px] text-muted-foreground">{task.dealReference.value} &bull; {task.dealReference.stage}</span></div>
                          ) : <span className="text-xs text-muted-foreground italic">No context</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" title="Edit Task" onClick={() => handleOpenEditTask(task)}><Pencil className="w-3.5 h-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-rose-600" title="Delete Task" onClick={() => handleDeleteSingleTask(task.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent></Card>
          </div>
        )}

        {/* E. Calendar View */}
        {view === 'Calendar' && (
          <div className="h-full bg-card border shadow-sm rounded-xl overflow-hidden flex flex-col">
            <div className="p-3 bg-muted/40 border-b flex items-center justify-between">
              <h3 className="font-bold text-sm text-foreground">
                {calendarCurrentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
              </h3>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setCalendarCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}>
                  Previous
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setCalendarCurrentDate(new Date())}>
                  Today
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setCalendarCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}>
                  Next
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-7 border-b bg-muted/20 shrink-0">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="px-2 py-2 text-center text-xs font-bold uppercase tracking-wider text-muted-foreground">{day}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 flex-1 min-h-0 overflow-y-auto auto-rows-fr">
              {getCalendarDays().map((day, i) => {
                const dayTasks = filteredTasks.filter(t => t.dueDate === day.dateStr);
                const isToday = new Date().toISOString().split('T')[0] === day.dateStr;
                return (
                  <div key={i} className={`border-b border-r p-1.5 flex flex-col gap-1 transition-colors hover:bg-muted/10 cursor-pointer ${day.isCurrentMonth ? 'bg-background' : 'bg-muted/20'}`} onClick={() => setIsNewTaskOpen(true)}>
                    <div className="text-right mb-1">
                      <span className={`text-[10px] font-bold w-5 h-5 inline-flex items-center justify-center rounded-full ${isToday ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>{day.dayNum}</span>
                    </div>
                    {dayTasks.map(t => (
                      <div key={t.id} className="bg-primary/10 text-primary border border-primary/20 rounded px-1.5 py-1 text-[9px] font-bold truncate shadow-sm cursor-default" onClick={e=>{e.stopPropagation(); setViewingTask(t);}}>
                        {t.title}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>

      {/* 5. Modals */}
      
      {/* New / Edit Task Modal */}
      <Dialog open={isNewTaskOpen} onOpenChange={(open) => { if (!open) handleCloseTaskDialog(); }}>
        <DialogContent className="sm:max-w-[500px] p-8 bg-card border-0 shadow-2xl rounded-[1.5rem] gap-6" hideCloseIcon>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-bold text-foreground tracking-tight">
              {editingTask ? 'Edit Task' : 'Schedule New Task'}
            </DialogTitle>
            <button className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary hover:bg-primary/20 transition-colors" onClick={handleCloseTaskDialog}>
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <div className="space-y-5">
            <div className="space-y-2">
              <Label className="text-[11px] font-bold uppercase text-muted-foreground tracking-wider">Task Title</Label>
              <Input placeholder="e.g. Audit regional liabilities" className="h-11 bg-background border-border text-foreground placeholder:text-muted-foreground rounded-xl px-4 font-medium focus-visible:ring-primary" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase text-muted-foreground tracking-wider">Initial Status</Label>
                <Select value={formStatus} onValueChange={setFormStatus}>
                  <SelectTrigger className="h-11 bg-background border-border text-foreground rounded-xl px-4 font-medium focus:ring-primary"><SelectValue/></SelectTrigger>
                  <SelectContent><SelectItem value="To Do">To Do</SelectItem><SelectItem value="In Progress">In Progress</SelectItem><SelectItem value="Review">Review</SelectItem><SelectItem value="Done">Done</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase text-muted-foreground tracking-wider">Priority</Label>
                <Select value={formPriority} onValueChange={(v: TaskPriority) => setFormPriority(v)}>
                  <SelectTrigger className="h-11 bg-background border-border text-foreground rounded-xl px-4 font-medium focus:ring-primary"><SelectValue/></SelectTrigger>
                  <SelectContent><SelectItem value="Urgent">Urgent</SelectItem><SelectItem value="High">High</SelectItem><SelectItem value="Medium">Medium</SelectItem><SelectItem value="Low">Low</SelectItem></SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <Label className="text-[11px] font-bold uppercase text-muted-foreground tracking-wider block">Label Tags</Label>
              <div className="flex items-center gap-2 flex-wrap">
                {AVAILABLE_LABELS.map(lbl => {
                  const isSelected = formLabels.includes(lbl.name);
                  return (
                    <button
                      key={lbl.name}
                      type="button"
                      onClick={() => setFormLabels(prev => isSelected ? prev.filter(l => l !== lbl.name) : [...prev, lbl.name])}
                      className={`text-xs px-2.5 py-1 rounded-full font-bold transition-all border ${isSelected ? 'ring-2 ring-primary ring-offset-1 border-primary text-primary bg-primary/10' : 'border-border text-muted-foreground bg-muted/40 hover:bg-muted'}`}
                    >
                      {lbl.name}
                    </button>
                  );
                })}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase text-muted-foreground tracking-wider">Date</Label>
                <Input type="date" className="h-11 bg-background border-border text-foreground placeholder:text-muted-foreground rounded-xl px-4 font-medium focus-visible:ring-primary" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase text-muted-foreground tracking-wider">Assignees</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-between h-11 bg-background border-border text-foreground rounded-xl px-4 font-medium hover:bg-muted focus:ring-primary">
                      <div className="flex items-center gap-2 truncate">
                        {formAssigneeIds.length > 0 ? (
                          <div className="flex -space-x-2">
                            {members.filter(m => formAssigneeIds.includes(m.id)).slice(0, 3).map(m => (
                              <Avatar key={m.id} className="h-6 w-6 border-2 border-background">
                                <AvatarFallback className="text-[9px] bg-primary/10 text-primary font-bold">{m.avatar}</AvatarFallback>
                              </Avatar>
                            ))}
                            {formAssigneeIds.length > 3 && (
                              <div className="h-6 w-6 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[8px] font-bold">
                                +{formAssigneeIds.length - 3}
                              </div>
                            )}
                          </div>
                        ) : "Select Assignees"}
                        {formAssigneeIds.length > 0 && <span className="ml-2">{formAssigneeIds.length} Selected</span>}
                      </div>
                      <ChevronDown className="w-4 h-4 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64 p-2 rounded-xl shadow-xl border-border/50">
                    <div className="max-h-48 overflow-y-auto space-y-1 mb-2">
                      {members.map(member => (
                        <div 
                          key={member.id}
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                          onClick={() => setFormAssigneeIds(prev => prev.includes(member.id) ? prev.filter(id => id !== member.id) : [...prev, member.id])}
                        >
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-[9px] bg-primary/10 text-primary font-bold">{member.avatar}</AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium">{member.name}</span>
                          </div>
                          {formAssigneeIds.includes(member.id) && <Check className="w-4 h-4 text-primary" />}
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 p-1 border-t border-border/50 mt-1 pt-2">
                      <Input 
                        placeholder="New member name..." 
                        value={newMemberName}
                        onChange={e => setNewMemberName(e.target.value)}
                        onKeyDown={e => e.stopPropagation()}
                        className="h-8 text-xs bg-muted/50 border-0 focus-visible:ring-1"
                      />
                      <Button size="sm" onClick={(e) => handleAddNewMember(e, 'task')} className="h-8 shrink-0">Add</Button>
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label className="text-[11px] font-bold uppercase text-muted-foreground tracking-wider">Description</Label>
              <textarea placeholder="Provide more details..." className="w-full min-h-[80px] bg-background border border-border text-foreground placeholder:text-muted-foreground rounded-xl p-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary resize-none" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} />
            </div>
          </div>
          
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="outline" className="h-11 px-6 rounded-[2rem] border-border text-foreground font-bold hover:bg-muted hover:text-foreground" onClick={handleCloseTaskDialog}>Cancel</Button>
            <Button className="h-11 px-6 rounded-[2rem] bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-md" onClick={handleSaveTask}>
              {editingTask ? 'Save Changes' : 'Schedule Task'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Task Details Modal */}
      <Dialog open={!!viewingTask} onOpenChange={(open) => { if(!open) setViewingTask(null); }}>
        <DialogContent className="max-w-[90vw] md:max-w-[70vw] h-[85vh] p-0 bg-background shadow-2xl border-border/60 flex flex-col overflow-hidden rounded-2xl">
          {viewingTask && (
            <>
              <DialogHeader className="p-6 border-b shrink-0 flex flex-col items-start justify-center">
                <div className="space-y-2 w-full">
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      <Badge variant="secondary">{viewingTask.status}</Badge>
                      <Badge variant="secondary">{viewingTask.priority} Priority</Badge>
                    </div>
                    <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-semibold" onClick={() => handleOpenEditTask(viewingTask)}>
                      <Pencil className="w-3.5 h-3.5" /> Edit Task
                    </Button>
                  </div>
                  <DialogTitle className="text-lg font-semibold">{viewingTask.title}</DialogTitle>
                </div>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto p-6 flex flex-col md:flex-row gap-6">
                <div className="flex-1 space-y-10">
                  {viewingTask.description && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-2"><LayoutList className="h-4 w-4"/> Description</h4>
                      <div className="bg-muted rounded-md p-4 text-sm leading-relaxed">
                        {viewingTask.description}
                      </div>
                    </div>
                  )}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-2"><CheckCircle2 className="h-4 w-4"/> Subtasks</h4>
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setIsAddingSubtask(true)}>
                        <Plus className="h-3 w-3 mr-1"/> Add Subtask
                      </Button>
                    </div>
                    <div className="bg-card border rounded-lg overflow-hidden">
                      {(viewingTask.subtasks?.length || 0) === 0 && !isAddingSubtask ? (
                        <div className="p-8 flex flex-col items-center justify-center text-center">
                          <CheckCircle2 className="w-10 h-10 text-muted-foreground/30 mb-2" />
                          <p className="text-sm text-muted-foreground font-medium">Break this task down into smaller steps.</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-border/50">
                          {viewingTask.subtasks?.map(s => {
                            const isExpanded = expandedSubtasks.has(s.id);
                            return (
                              <div key={s.id} className="flex flex-col hover:bg-muted/30 transition-colors group">
                                <div className="p-4 flex items-center justify-between cursor-pointer" onClick={() => toggleSubtaskExpansion(s.id)}>
                                  <div className="flex items-center gap-4 flex-1">
                                    <input 
                                      type="checkbox" 
                                      checked={s.completed} 
                                      onChange={(e) => { e.stopPropagation(); toggleSubtaskCompletion(s.id); }}
                                      className="rounded border-muted-foreground/50 text-primary focus:ring-primary w-5 h-5 cursor-pointer shadow-sm" 
                                    />
                                    <div className="flex flex-col">
                                      <span className={`text-[15px] font-medium transition-all ${s.completed ? 'line-through text-muted-foreground opacity-70' : 'text-foreground'}`}>{s.title}</span>
                                      <div className="flex items-center gap-2 mt-1">
                                        {s.dueDate && !isExpanded && <span className="text-[10px] text-muted-foreground font-medium">{s.dueDate}</span>}
                                        {s.assignees && s.assignees.length > 0 && !isExpanded && (
                                          <div className="flex -space-x-1.5 overflow-hidden">
                                            {s.assignees.slice(0, 3).map((a, i) => (
                                              <Avatar key={a.id || i} className="h-4 w-4 border border-background" title={a.name}>
                                                <AvatarFallback className="text-[7px] bg-primary/10 text-primary font-bold">{a.avatar}</AvatarFallback>
                                              </Avatar>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <Button variant="ghost" size="icon" className="w-6 h-6 shrink-0 opacity-50 group-hover:opacity-100 transition-opacity">
                                    <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                  </Button>
                                </div>
                                {isExpanded && (
                                  <div className="px-12 pb-4 pt-1 space-y-3 animate-in slide-in-from-top-2">
                                    <div className="flex items-center gap-4 flex-wrap">
                                      {s.dueDate && (
                                        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground bg-muted w-fit px-2 py-1 rounded-md">
                                          <CalendarIcon className="h-3 w-3" /> Due: {s.dueDate}
                                        </div>
                                      )}
                                      {s.assignees && s.assignees.length > 0 && (
                                        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground bg-muted w-fit px-2 py-1 rounded-md">
                                          <div className="flex -space-x-1.5 overflow-hidden">
                                            {s.assignees.map((a, i) => (
                                              <Avatar key={a.id || i} className="h-4 w-4 border border-background" title={a.name}>
                                                <AvatarFallback className="text-[7px] bg-primary/10 text-primary font-bold">{a.avatar}</AvatarFallback>
                                              </Avatar>
                                            ))}
                                          </div>
                                          <span>{s.assignees.map(a => a.name).join(', ')}</span>
                                        </div>
                                      )}
                                    </div>
                                    {s.description && (
                                      <div className="text-sm text-muted-foreground leading-relaxed bg-muted p-3 rounded-md">
                                        {s.description}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {isAddingSubtask && (
                        <div className="p-4 flex flex-col gap-3 bg-muted border-t">
                          <div className="flex items-center gap-4">
                            <input type="checkbox" disabled className="rounded border-primary/30 w-5 h-5 bg-background shrink-0" />
                            <Input 
                              autoFocus 
                              value={newSubtaskTitle} 
                              onChange={e => setNewSubtaskTitle(e.target.value)} 
                              placeholder="What needs to be done?"
                              className="h-9 text-sm bg-background px-3 flex-1"
                              onKeyDown={e => {
                                if (e.key === 'Escape') { setIsAddingSubtask(false); setNewSubtaskTitle(''); setNewSubtaskDescription(''); setNewSubtaskDueDate(''); }
                              }}
                            />
                            <Input 
                              type="date"
                              value={newSubtaskDueDate}
                              onChange={e => setNewSubtaskDueDate(e.target.value)}
                              className="h-9 text-xs bg-background px-3 w-[140px] shrink-0"
                            />
                            
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="h-9 text-xs px-3 shrink-0">
                                  {newSubtaskAssigneeIds.length > 0 ? (
                                    <div className="flex -space-x-2 mr-2">
                                      {members.filter(m => newSubtaskAssigneeIds.includes(m.id)).slice(0, 3).map(m => (
                                        <Avatar key={m.id} className="h-5 w-5 border-2 border-background">
                                          <AvatarFallback className="text-[8px]">{m.avatar}</AvatarFallback>
                                        </Avatar>
                                      ))}
                                    </div>
                                  ) : "Assign"}
                                  {newSubtaskAssigneeIds.length > 0 ? `${newSubtaskAssigneeIds.length} Assigned` : "+ Assign"}
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-56 p-2">
                                <div className="space-y-1 mb-2">
                                  {members.map(member => (
                                    <div 
                                      key={member.id}
                                      className="flex items-center justify-between p-2 rounded-md hover:bg-muted cursor-pointer transition-colors"
                                      onClick={() => setNewSubtaskAssigneeIds(prev => prev.includes(member.id) ? prev.filter(id => id !== member.id) : [...prev, member.id])}
                                    >
                                      <div className="flex items-center gap-2">
                                        <Avatar className="h-6 w-6">
                                          <AvatarFallback className="text-[9px] bg-muted-foreground/10">{member.avatar}</AvatarFallback>
                                        </Avatar>
                                        <span className="text-sm font-medium">{member.name}</span>
                                      </div>
                                      {newSubtaskAssigneeIds.includes(member.id) && <Check className="h-4 w-4 text-muted-foreground" />}
                                    </div>
                                  ))}
                                </div>
                                <div className="flex items-center gap-2 p-1 border-t mt-1 pt-2">
                                  <Input 
                                    placeholder="New member..." 
                                    value={newMemberName}
                                    onChange={e => setNewMemberName(e.target.value)}
                                    onKeyDown={e => e.stopPropagation()}
                                    className="h-8 text-xs bg-muted border-0 focus-visible:ring-1"
                                  />
                                  <Button size="sm" onClick={(e) => handleAddNewMember(e, 'subtask')} className="h-8 shrink-0">Add</Button>
                                </div>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          <div className="pl-9 flex gap-3 items-end">
                            <textarea
                              value={newSubtaskDescription}
                              onChange={e => setNewSubtaskDescription(e.target.value)}
                              placeholder="Add more details or context..."
                              className="w-full min-h-[60px] text-sm bg-background border p-3 rounded-md resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                            />
                            <Button size="icon" onClick={handleAddSubtask} className="h-9 w-9 shrink-0">
                              <Check className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="w-full md:w-[320px] shrink-0 space-y-4">
                  <div className="bg-card border rounded-lg p-4 space-y-4">
                    <div className="space-y-2">
                      <span className="text-xs font-medium text-muted-foreground">Assignees</span>
                      <div className="flex flex-col gap-2 bg-muted p-3 rounded-md max-h-48 overflow-y-auto">
                        {(viewingTask.assignees || (viewingTask.assignee ? [viewingTask.assignee] : [])).map(assignee => (
                          <div key={assignee.id} className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs bg-muted-foreground/10">{assignee.avatar}</AvatarFallback>
                            </Avatar>
                            <div>
                              <span className="text-sm font-medium block leading-tight">{assignee.name}</span>
                              <span className="text-[11px] text-muted-foreground">Assignee</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2 pt-3 border-t">
                      <span className="text-xs font-medium text-muted-foreground">Due Date</span>
                      <div className="flex items-center gap-2 text-sm font-medium bg-muted p-3 rounded-md">
                        <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                        {viewingTask.dueDate}
                      </div>
                    </div>
                    {viewingTask.dealReference && (
                      <div className="space-y-2 pt-3 border-t">
                        <span className="text-xs font-medium text-muted-foreground">Linked Deal</span>
                        <div className="bg-muted rounded-md p-3 text-sm font-medium flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                          {viewingTask.dealReference.name}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Task Confirmation Dialog */}
      <ConfirmDialog
        open={!!taskToDelete}
        onOpenChange={(open) => { if (!open) setTaskToDelete(null); }}
        title="Delete Task"
        description="Are you sure you want to delete this task? This action cannot be undone."
        onConfirm={async () => {
          if (taskToDelete && workspace?.id) {
            try {
              await deleteTask(workspace.id, taskToDelete.id);
              if (viewingTask?.id === taskToDelete.id) {
                setViewingTask(null);
              }
              toast.success('Task deleted successfully');
            } catch (e) {
              toast.error('Failed to delete task');
            } finally {
              setTaskToDelete(null);
            }
          }
        }}
      />
    </div>
  );
}
