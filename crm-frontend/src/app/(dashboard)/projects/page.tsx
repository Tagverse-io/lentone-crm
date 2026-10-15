'use client';

import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import {
  Search, Plus, X, UploadCloud, FileText, Mail, FileIcon, MessageSquare,
  CheckCircle2, AlertCircle, Cloud, MoreHorizontal, Calendar, FolderOpen,
  Check, Pencil, Trash2, ChevronDown, Eye, Lock, Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

import { useAuth } from '@/lib/firebase/auth-context';
import {
  ProjectStatus, TaskStatus, TaskPriority, NoteVisibility,
  Project, Member, Task, Note, ProjectsData,
  subscribeToProjectsData, createProject, updateProject, deleteProject,
  createTask, updateTask, deleteTask,
  createMember, updateMember, deleteMember,
  createNote, updateNote, deleteNote
} from '@/lib/db/projects/api';

const COLUMNS: ProjectStatus[] = ['Kick-off', 'Planning', 'Implementation', 'Review', 'Closing'];

// --- Helpers ---
const CircularProgress = ({ progress, color }: { progress: number, color: string }) => {
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;
  return (
    <div className="relative w-8 h-8 flex items-center justify-center shrink-0">
      <svg className="w-8 h-8 -rotate-90">
        <circle className="text-muted/30" strokeWidth="3" stroke="currentColor" fill="transparent" r={radius} cx="16" cy="16" />
        <circle strokeWidth="3" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" stroke={color} fill="transparent" r={radius} cx="16" cy="16" />
      </svg>
      <span className="absolute text-[8px] font-medium">{progress}%</span>
    </div>
  );
};

export default function ProjectsPage() {
  const { workspace, user } = useAuth();
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);

  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);

  const [search, setSearch] = useState('');

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  // Edit Project Modal State
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#6366f1');
  const [editBudget, setEditBudget] = useState('10000');
  const [editEndDate, setEditEndDate] = useState('');
  const [editMembers, setEditMembers] = useState<string[]>([]);

  // Delete Confirmation State
  const [deleteConfirmState, setDeleteConfirmState] = useState<{ open: boolean; project?: Project | null }>({ open: false });

  useEffect(() => {
    if (!workspace?.id) return;
    const unsubscribe = subscribeToProjectsData(workspace?.id, (data: ProjectsData) => {
      setProjects(data.projects);
      setMembers(data.members);
      setTasks(data.tasks);
      setNotes(data.notes);

      // Update selected project if it exists so overlay stays current
      if (selectedProject) {
        setSelectedProject(prev => data.projects.find(p => p.id === prev?.id) || null);
      }
    });
    return () => unsubscribe();
  }, [workspace?.id, selectedProject?.id]);

  // Overlay Tabs
  const [activeTab, setActiveTab] = useState<'Plan' | 'Files' | 'Notes' | 'Emails' | 'Documents'>('Plan');

  // Create Form State
  const [formName, setFormName] = useState('');
  const [formColor, setFormColor] = useState('#6366f1');
  const [formBudget, setFormBudget] = useState('10000');
  const [formMembers, setFormMembers] = useState<string[]>([]);
  const [newMemberName, setNewMemberName] = useState('');
  const [formStartDate, setFormStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [formEndDate, setFormEndDate] = useState('');

  // Inline Task Form State (Multi-Assignee Support)
  const [addingTaskPhase, setAddingTaskPhase] = useState<ProjectStatus | null>(null);
  const [taskFormTitle, setTaskFormTitle] = useState('');
  const [taskFormOwners, setTaskFormOwners] = useState<string[]>([]);
  const [taskFormDue, setTaskFormDue] = useState('');
  const [taskFormPriority, setTaskFormPriority] = useState<TaskPriority>('Normal');
  const [taskFormDescription, setTaskFormDescription] = useState('');

  // Notes Form State
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [noteFormTitle, setNoteFormTitle] = useState('');
  const [noteFormDescription, setNoteFormDescription] = useState('');
  const [noteFormVisibility, setNoteFormVisibility] = useState<NoteVisibility>('everyone');
  const [noteFormVisibleTo, setNoteFormVisibleTo] = useState<string[]>([]);
  const [notesFilter, setNotesFilter] = useState<'all' | 'only-me' | 'everyone' | 'specific'>('all');
  const [expandAllNotes, setExpandAllNotes] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [viewingNote, setViewingNote] = useState<Note | null>(null);

  // Derived
  const filteredProjects = projects.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  // Handlers
  const onDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId) return;

    if (!workspace?.id) return;
    try {
      await updateProject(workspace?.id, draggableId, { status: destination.droppableId as ProjectStatus });
      toast.success(`Moved to ${destination.droppableId}`);
    } catch (e) {
      toast.error('Failed to move project');
    }
  };

  const handleCreateProject = async () => {
    if (!workspace?.id) return;
    if (!formName.trim()) return toast.error('Project name is required');

    const newProject = {
      name: formName,
      status: 'Kick-off' as ProjectStatus,
      color: formColor,
      members: formMembers,
      linkedDeal: null,
      emoji: '📁',
      startDate: formStartDate,
      endDate: formEndDate,
      budget: { est: Number(formBudget) || 0, actual: 0 },
      progress: 0
    };

    try {
      await createProject(workspace?.id, newProject);
      setIsCreateOpen(false);
      toast.success('Project created successfully');

      // Reset
      setFormName('');
      setFormColor('#6366f1');
      setFormBudget('10000');
      setFormMembers([]);
      setFormStartDate(new Date().toISOString().split('T')[0]);
      setFormEndDate('');
    } catch (e) {
      toast.error('Failed to create project');
    }
  };

  const handleOpenEditProject = (project: Project, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setEditingProject(project);
    setEditName(project.name);
    setEditColor(project.color || '#6366f1');
    setEditBudget(String(project.budget?.est || 10000));
    setEditEndDate(project.endDate || '');
    setEditMembers(project.members || []);
    setIsEditOpen(true);
  };

  const handleSaveEditedProject = async () => {
    if (!workspace?.id || !editingProject) return;
    if (!editName.trim()) return toast.error('Project name is required');

    try {
      await updateProject(workspace.id, editingProject.id, {
        name: editName,
        color: editColor,
        budget: { ...editingProject.budget, est: Number(editBudget) || 0 },
        endDate: editEndDate,
        members: editMembers,
      });
      setIsEditOpen(false);
      toast.success('Project updated successfully');
    } catch (e) {
      toast.error('Failed to update project');
    }
  };

  const handleConfirmDeleteProject = async () => {
    if (!workspace?.id || !deleteConfirmState.project) return;
    try {
      await deleteProject(workspace.id, deleteConfirmState.project.id);
      if (selectedProject?.id === deleteConfirmState.project.id) {
        setSelectedProject(null);
      }
      toast.success('Project deleted successfully');
    } catch (e) {
      toast.error('Failed to delete project');
    } finally {
      setDeleteConfirmState({ open: false, project: null });
    }
  };

  const handleAddNewMember = async (e: React.MouseEvent) => {
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
      if (newId) setFormMembers(prev => [...prev, newId]);
      setNewMemberName('');
    } catch (err) {
      toast.error('Failed to add member');
    }
  };

  const handleCreateTask = async (phase: ProjectStatus) => {
    if (!workspace?.id) return;
    if (!taskFormTitle.trim()) return toast.error('Task title is required');
    if (taskFormOwners.length === 0) return toast.error('At least one assignee is required');

    const newTask = {
      title: taskFormTitle,
      projectId: selectedProject!.id,
      owner: taskFormOwners[0] || '',
      assigneeIds: taskFormOwners,
      owners: taskFormOwners,
      status: 'To Do' as TaskStatus,
      priority: taskFormPriority,
      due: taskFormDue || 'No due date',
      phase,
      description: taskFormDescription
    };

    try {
      await createTask(workspace?.id, newTask);
      setAddingTaskPhase(null);
      setTaskFormTitle('');
      setTaskFormOwners([]);
      setTaskFormDue('');
      setTaskFormPriority('Normal');
      setTaskFormDescription('');
      toast.success('Task created successfully');
    } catch (e) {
      toast.error('Failed to create task');
    }
  };

  const handleToggleTaskStatus = async (task: Task) => {
    if (!workspace?.id) return;
    const newStatus = task.status === 'Done' ? 'To Do' : 'Done';
    try {
      await updateTask(workspace.id, task.id, { status: newStatus });
    } catch (e) {
      toast.error('Failed to update task status');
    }
  };

  const toggleFormMember = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setFormMembers(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);
  };

  const toggleEditMember = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditMembers(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);
  };

  if (!isMounted) return null;

  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-100px)]">

      {/* 2. Global Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Project Management</h2>
          <p className="text-sm text-muted-foreground mt-1">Manage projects across different phases</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-background focus-visible:ring-1"
            />
          </div>
          <Button variant="outline" onClick={() => setIsCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Project
          </Button>
        </div>
      </div>

      {/* 3. Project Board (Kanban View) */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-5 overflow-x-auto h-full pb-4 items-start">
            {COLUMNS.map(col => {
              const colProjects = filteredProjects.filter(p => p.status === col);

              return (
                <div key={col} className="flex-shrink-0 w-[300px] flex flex-col max-h-full rounded-xl border bg-muted/20 pb-2">
                  <div className="flex items-center justify-between gap-2 mb-3 px-3 py-2.5 shrink-0 border-b bg-card rounded-t-xl">
                    <h3 className="font-semibold text-sm tracking-wide text-foreground">{col}</h3>
                    <Badge variant="secondary" className="bg-muted text-muted-foreground px-1.5 py-0 text-xs">
                      {colProjects.length}
                    </Badge>
                  </div>

                  <Droppable droppableId={col}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`flex-1 overflow-y-auto space-y-3 min-h-[150px] transition-colors rounded-lg px-2 ${snapshot.isDraggingOver ? 'bg-muted/50 ring-1 ring-border' : ''}`}
                      >
                        {colProjects.map((project, index) => (
                          <Draggable key={project.id} draggableId={project.id} index={index}>
                            {(provided, snapshot) => (
                              <Card
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                onClick={() => setSelectedProject(project)}
                                className={`cursor-pointer transition-all border bg-background group
                                  ${snapshot.isDragging ? 'ring-2 ring-primary/20 rotate-2' : 'hover:border-primary/30'}
                                `}
                                style={{ ...provided.draggableProps.style }}
                              >
                                <CardContent className="p-4 space-y-4">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex gap-2.5 items-center min-w-0">
                                      <span className="text-2xl leading-none">{project.emoji}</span>
                                      <h4 className="font-medium text-sm leading-tight text-foreground line-clamp-2">{project.name}</h4>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <CircularProgress progress={project.progress} color={project.color} />
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-muted-foreground hover:text-foreground opacity-70 group-hover:opacity-100 transition-opacity"
                                            onClick={(e) => { e.stopPropagation(); }}
                                          >
                                            <MoreHorizontal className="w-4 h-4" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                          <DropdownMenuItem onClick={(e) => handleOpenEditProject(project, e)}>
                                            <Pencil className="w-3.5 h-3.5 mr-2" /> Edit
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            className="text-destructive focus:text-destructive"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setDeleteConfirmState({ open: true, project });
                                            }}
                                          >
                                            <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/50">
                                    <span className="font-medium">{project.endDate ? `Due ${new Date(project.endDate).toLocaleDateString()}` : 'No due date'}</span>

                                    <div className="flex -space-x-2">
                                      {(project.members || []).map(mid => {
                                        const mem = members.find(m => m.id === mid);
                                        if (!mem) return null;
                                        return (
                                          <Avatar key={mid} className="h-6 w-6 border-2 border-background" title={mem.name}>
                                            <AvatarFallback className="text-[9px] bg-muted-foreground/10">{mem.avatar}</AvatarFallback>
                                          </Avatar>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      </div>

      {/* 4. Create Project Modal */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Project Name</Label>
              <Input placeholder="E.g. Q4 Website Redesign" value={formName} onChange={e => setFormName(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Color Theme</Label>
                <div className="flex items-center gap-3">
                  <Input type="color" value={formColor} onChange={e => setFormColor(e.target.value)} className="w-12 h-10 p-1 cursor-pointer" />
                  <span className="text-sm font-mono text-muted-foreground uppercase">{formColor}</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Est Budget ($)</Label>
                <Input type="number" value={formBudget} onChange={e => setFormBudget(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Start Date</Label>
                <Input type="date" value={formStartDate} onChange={e => setFormStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Due Date</Label>
                <Input type="date" value={formEndDate} onChange={e => setFormEndDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Assign Members</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-muted-foreground font-normal">
                    {formMembers.length > 0 ? `${formMembers.length} member(s) selected` : 'Select members...'}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[450px] p-0" onClick={e => e.stopPropagation()}>
                  <div className="max-h-[200px] overflow-y-auto p-1">
                    {members.map(m => (
                      <div
                        key={m.id}
                        onClick={(e) => toggleFormMember(m.id, e)}
                        className="flex items-center justify-between px-3 py-2 hover:bg-muted rounded-md cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6"><AvatarFallback className="text-[10px] bg-muted-foreground/10">{m.avatar}</AvatarFallback></Avatar>
                          <span className="text-sm">{m.name}</span>
                        </div>
                        {formMembers.includes(m.id) && <Check className="w-4 h-4 text-primary" />}
                      </div>
                    ))}
                  </div>
                  <div className="p-2 border-t flex gap-2">
                    <Input
                      placeholder="New member name..."
                      value={newMemberName}
                      onChange={e => setNewMemberName(e.target.value)}
                      className="h-8 text-xs"
                      onClick={e => e.stopPropagation()}
                    />
                    <Button size="sm" onClick={handleAddNewMember} className="h-8 text-xs">Add</Button>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateProject}>Create Project</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 5. Edit Project Modal */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Project Name</Label>
              <Input placeholder="E.g. Q4 Website Redesign" value={editName} onChange={e => setEditName(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Color Theme</Label>
                <div className="flex items-center gap-3">
                  <Input type="color" value={editColor} onChange={e => setEditColor(e.target.value)} className="w-12 h-10 p-1 cursor-pointer" />
                  <span className="text-sm font-mono text-muted-foreground uppercase">{editColor}</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Est Budget ($)</Label>
                <Input type="number" value={editBudget} onChange={e => setEditBudget(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Due Date</Label>
              <Input type="date" value={editEndDate} onChange={e => setEditEndDate(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Assign Members</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-muted-foreground font-normal">
                    {editMembers.length > 0 ? `${editMembers.length} member(s) selected` : 'Select members...'}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[450px] p-0" onClick={e => e.stopPropagation()}>
                  <div className="max-h-[200px] overflow-y-auto p-1">
                    {members.map(m => (
                      <div
                        key={m.id}
                        onClick={(e) => toggleEditMember(m.id, e)}
                        className="flex items-center justify-between px-3 py-2 hover:bg-muted rounded-md cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6"><AvatarFallback className="text-[10px] bg-muted-foreground/10">{m.avatar}</AvatarFallback></Avatar>
                          <span className="text-sm">{m.name}</span>
                        </div>
                        {editMembers.includes(m.id) && <Check className="w-4 h-4 text-primary" />}
                      </div>
                    ))}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveEditedProject}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 6. Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirmState.open}
        onOpenChange={(open) => setDeleteConfirmState({ open, project: open ? deleteConfirmState.project : null })}
        title="Delete Project"
        description="Are you sure you want to delete this project? This action cannot be undone."
        onConfirm={handleConfirmDeleteProject}
      />

      {/* 7. Detailed Project Overlay Modal */}
      <Dialog open={!!selectedProject} onOpenChange={(open) => { if (!open) setSelectedProject(null); }}>
        <DialogContent className="max-w-[90vw] h-[90vh] p-0 overflow-hidden flex">
          {selectedProject && (
            <>
              {/* A. Left Sidebar */}
              <div className="w-[320px] shrink-0 border-r bg-muted/10 flex flex-col">
                <div className="p-6 pb-0 flex items-start justify-between">
                  <div className="space-y-1">
                    <span className="text-4xl">{selectedProject.emoji}</span>
                    <h2 className="text-lg font-semibold leading-tight mt-2">{selectedProject.name}</h2>
                    <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{selectedProject.status}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => setSelectedProject(null)}>
                    <X size={18} />
                  </Button>
                </div>

                <div className="p-6 space-y-8 overflow-y-auto flex-1">
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={(e) => handleOpenEditProject(selectedProject, e)}>
                      <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1 text-xs text-destructive hover:bg-destructive/10" onClick={() => setDeleteConfirmState({ open: true, project: selectedProject })}>
                      <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete
                    </Button>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm font-medium">
                      <span>Progress</span>
                      <span style={{ color: selectedProject.color }}>{selectedProject.progress}%</span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div className="h-full transition-all" style={{ width: `${selectedProject.progress}%`, backgroundColor: selectedProject.color }} />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-xs font-medium text-muted-foreground border-b pb-2">Dates</h4>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Start Date</span>
                      <span className="font-semibold">{selectedProject.startDate}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Due Date</span>
                      <span className="font-semibold">{selectedProject.endDate || 'Not set'}</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-xs font-medium text-muted-foreground border-b pb-2">Team</h4>
                    <div className="flex flex-wrap gap-2">
                      {(selectedProject.members || []).map(mid => {
                        const mem = members.find(m => m.id === mid);
                        if (!mem) return null;
                        return (
                          <Badge key={mid} variant="secondary" className="pl-1 pr-2 py-1 gap-1.5">
                            <Avatar className="h-4 w-4"><AvatarFallback className="text-[7px] bg-muted-foreground/10">{mem.avatar}</AvatarFallback></Avatar>
                            <span className="font-medium text-xs">{mem.name}</span>
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* B. Right Panel (Tabs Area) */}
              <div className="flex-1 flex flex-col min-w-0 bg-background">
                <div className="flex px-6 border-b shrink-0 pt-4 gap-6 overflow-x-auto">
                  {(['Plan', 'Files', 'Notes', 'Emails', 'Documents'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`pb-3 text-sm transition-colors whitespace-nowrap ${activeTab === tab ? 'font-medium text-foreground border-b-[3px] border-primary' : 'font-medium text-muted-foreground hover:text-foreground'}`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-muted/5">

                  {/* PLAN TAB */}
                  {activeTab === 'Plan' && (
                    <div className="space-y-8">
                      {COLUMNS.map(phase => {
                        const phaseTasks = tasks.filter(t => t.projectId === selectedProject.id && t.phase === phase);
                        return (
                          <div key={phase} className="space-y-3">
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-medium">{phase}</h3>
                              <Badge variant="secondary" className="text-xs px-1.5 py-0">{phaseTasks.length}</Badge>
                            </div>

                            <div className="bg-card border rounded-lg overflow-hidden">
                              <table className="w-full text-sm text-left">
                                <tbody className="divide-y divide-border">
                                  {phaseTasks.map(task => {
                                    const taskAssigneeIds = task.assigneeIds && task.assigneeIds.length > 0
                                      ? task.assigneeIds
                                      : task.owner
                                      ? [task.owner]
                                      : [];
                                    const taskAssignees = taskAssigneeIds.map(id => members.find(m => m.id === id)).filter(Boolean) as Member[];
                                    return (
                                      <tr key={task.id} className="hover:bg-muted/30 transition-colors">
                                        <td className="w-12 px-4 py-3 text-center">
                                          <input type="checkbox" checked={task.status === 'Done'} onChange={() => handleToggleTaskStatus(task)} className="w-4 h-4 rounded border-muted-foreground text-primary focus:ring-primary cursor-pointer" />
                                        </td>
                                        <td className={`px-4 py-3 ${task.status === 'Done' ? 'text-muted-foreground' : 'text-foreground'}`}>
                                          <span className={`font-medium ${task.status === 'Done' ? 'line-through' : ''}`}>{task.title}</span>
                                          {task.description && (
                                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{task.description}</p>
                                          )}
                                        </td>
                                        <td className="px-4 py-3 w-48">
                                          {taskAssignees.length > 0 ? (
                                            <div className="flex items-center gap-2">
                                              <div className="flex -space-x-1.5 overflow-hidden">
                                                {taskAssignees.slice(0, 3).map((a, i) => (
                                                  <Avatar key={a.id || i} className="h-5 w-5 border border-background shadow-xs" title={a.name}>
                                                    <AvatarFallback className="text-[7px] bg-muted-foreground/10">{a.avatar}</AvatarFallback>
                                                  </Avatar>
                                                ))}
                                              </div>
                                              <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                                                {taskAssignees.map(a => a.name).join(', ')}
                                              </span>
                                            </div>
                                          ) : (
                                            <span className="text-xs text-muted-foreground">—</span>
                                          )}
                                        </td>
                                        <td className="px-4 py-3 w-32 text-xs text-muted-foreground">{task.due}</td>
                                        <td className="px-4 py-3 w-28">
                                          <Badge variant="outline" className={`text-[10px] ${task.priority === 'Urgent' ? 'bg-red-50 text-red-600 border-red-200' : task.priority === 'High' ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-muted text-muted-foreground'}`}>
                                            {task.priority}
                                          </Badge>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                              <div className="p-2 bg-muted/20 border-t">
                                {addingTaskPhase === phase ? (
                                  <div className="space-y-2 bg-background p-2 rounded border">
                                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                                    <Input placeholder="Task subject" value={taskFormTitle} onChange={e => setTaskFormTitle(e.target.value)} className="h-8 text-xs flex-1 min-w-[150px]" autoFocus />
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="outline" size="sm" className="h-8 text-xs min-w-[130px] justify-between">
                                          <span className="truncate">
                                            {taskFormOwners.length === 0
                                              ? 'Assignees'
                                              : taskFormOwners.length === 1
                                              ? members.find(m => m.id === taskFormOwners[0])?.name || '1 assigned'
                                              : `${taskFormOwners.length} assignees`}
                                          </span>
                                          <ChevronDown className="w-3 h-3 ml-1 opacity-50 shrink-0" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent className="w-56 p-2 space-y-1" align="start">
                                        {(selectedProject.members || []).map(mid => {
                                          const m = members.find(mem => mem.id === mid);
                                          if (!m) return null;
                                          const isSelected = taskFormOwners.includes(m.id);
                                          return (
                                            <div
                                              key={m.id}
                                              className="flex items-center justify-between p-1.5 rounded hover:bg-muted/50 cursor-pointer text-xs"
                                              onClick={() => {
                                                setTaskFormOwners(prev =>
                                                  prev.includes(m.id) ? prev.filter(id => id !== m.id) : [...prev, m.id]
                                                );
                                              }}
                                            >
                                              <div className="flex items-center gap-2">
                                                <Avatar className="h-5 w-5"><AvatarFallback className="text-[8px] bg-muted-foreground/10">{m.avatar}</AvatarFallback></Avatar>
                                                <span>{m.name}</span>
                                              </div>
                                              {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
                                            </div>
                                          );
                                        })}
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                    <Input type="date" value={taskFormDue} onChange={e => setTaskFormDue(e.target.value)} className="h-8 text-xs w-[130px]" />
                                    <Select value={taskFormPriority} onValueChange={(v: TaskPriority) => setTaskFormPriority(v)}>
                                      <SelectTrigger className="h-8 text-xs w-[100px]"><SelectValue placeholder="Priority" /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="Normal">Normal</SelectItem>
                                        <SelectItem value="High">High</SelectItem>
                                        <SelectItem value="Urgent">Urgent</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <Button size="sm" onClick={() => handleCreateTask(phase)} className="h-8 text-xs">Add</Button>
                                    <Button size="sm" variant="ghost" onClick={() => setAddingTaskPhase(null)} className="h-8 text-xs">Cancel</Button>
                                  </div>
                                    <Input placeholder="Description (optional)" value={taskFormDescription} onChange={e => setTaskFormDescription(e.target.value)} className="h-8 text-xs w-full" />
                                  </div>
                                ) : (
                                  <Button variant="ghost" size="sm" onClick={() => setAddingTaskPhase(phase)} className="w-full justify-start text-muted-foreground hover:text-foreground h-8 text-xs">
                                    <Plus className="w-3 h-3 mr-2" /> + Task / Activity / Milestone
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* FILES TAB */}
                  {activeTab === 'Files' && (
                    <div className="space-y-6 h-full flex flex-col">
                      <div className="border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center gap-3 bg-muted/5 hover:bg-muted/10 transition-colors cursor-pointer shrink-0">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                          <UploadCloud className="w-6 h-6" />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-medium">Click to upload or drag & drop files</p>
                          <p className="text-xs text-muted-foreground mt-0.5">PDF, DOCX, PNG, JPG up to 50MB</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between border-b pb-4 shrink-0">
                        <div className="flex gap-2">
                          <Badge variant="secondary" className="bg-muted text-foreground hover:bg-muted/80 cursor-pointer">All Files</Badge>
                          <Badge variant="outline" className="cursor-pointer">Images</Badge>
                          <Badge variant="outline" className="cursor-pointer">Documents</Badge>
                        </div>
                      </div>
                      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground opacity-50">
                        <FolderOpen className="w-16 h-16 mb-4" />
                        <p className="font-medium">No files uploaded yet</p>
                      </div>
                    </div>
                  )}

                  {/* NOTES TAB */}
                  {activeTab === 'Notes' && (() => {
                    const currentUserId = user?.id || '';
                    const projectNotes = notes
                      .filter(n => n.projectId === selectedProject.id)
                      .filter(n => {
                        // Visibility filtering: show only notes the current user is allowed to see
                        if (n.visibility === 'only-me' && n.createdBy !== currentUserId) return false;
                        if (n.visibility === 'specific') {
                          if (n.createdBy !== currentUserId && !(n.visibleTo || []).includes(currentUserId)) return false;
                        }
                        return true;
                      })
                      .filter(n => {
                        if (notesFilter === 'all') return true;
                        return n.visibility === notesFilter;
                      })
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

                    const handleCreateNote = async () => {
                      if (!workspace?.id || !selectedProject) return;
                      if (!noteFormTitle.trim()) return toast.error('Note title is required');
                      const note = {
                        projectId: selectedProject.id,
                        title: noteFormTitle,
                        description: noteFormDescription,
                        visibility: noteFormVisibility,
                        visibleTo: noteFormVisibility === 'specific' ? noteFormVisibleTo : [],
                        createdBy: currentUserId,
                        createdByName: user?.full_name || user?.email || 'Unknown',
                        createdAt: new Date().toISOString(),
                      };
                      try {
                        await createNote(workspace.id, note);
                        setIsAddingNote(false);
                        setNoteFormTitle('');
                        setNoteFormDescription('');
                        setNoteFormVisibility('everyone');
                        setNoteFormVisibleTo([]);
                        toast.success('Note added');
                      } catch {
                        toast.error('Failed to add note');
                      }
                    };

                    const handleSaveEditNote = async () => {
                      if (!workspace?.id || !editingNote) return;
                      if (!noteFormTitle.trim()) return toast.error('Note title is required');
                      try {
                        await updateNote(workspace.id, editingNote.id, {
                          title: noteFormTitle,
                          description: noteFormDescription,
                          visibility: noteFormVisibility,
                          visibleTo: noteFormVisibility === 'specific' ? noteFormVisibleTo : [],
                          updatedAt: new Date().toISOString(),
                        });
                        setEditingNote(null);
                        setIsAddingNote(false);
                        setNoteFormTitle('');
                        setNoteFormDescription('');
                        setNoteFormVisibility('everyone');
                        setNoteFormVisibleTo([]);
                        toast.success('Note updated');
                      } catch {
                        toast.error('Failed to update note');
                      }
                    };

                    const handleDeleteNote = async (noteId: string) => {
                      if (!workspace?.id) return;
                      try {
                        await deleteNote(workspace.id, noteId);
                        toast.success('Note deleted');
                      } catch {
                        toast.error('Failed to delete note');
                      }
                    };

                    const openEditNote = (note: Note) => {
                      setEditingNote(note);
                      setNoteFormTitle(note.title);
                      setNoteFormDescription(note.description);
                      setNoteFormVisibility(note.visibility);
                      setNoteFormVisibleTo(note.visibleTo || []);
                      setIsAddingNote(true);
                    };

                    const visibilityLabel = (v: NoteVisibility) => {
                      if (v === 'only-me') return 'Only Me';
                      if (v === 'everyone') return 'Everyone';
                      return 'Specific Members';
                    };
                    const visibilityIcon = (v: NoteVisibility) => {
                      if (v === 'only-me') return <Lock className="w-3 h-3" />;
                      if (v === 'everyone') return <Eye className="w-3 h-3" />;
                      return <Users className="w-3 h-3" />;
                    };

                    return (
                    <div className="space-y-5 h-full flex flex-col">
                      {/* Add / Edit Note Form */}
                      {isAddingNote ? (
                        <div className="bg-background border rounded-lg p-4 space-y-3 shrink-0">
                          <Input
                            placeholder="Note title"
                            value={noteFormTitle}
                            onChange={e => setNoteFormTitle(e.target.value)}
                            className="text-sm font-medium"
                            autoFocus
                          />
                          <textarea
                            placeholder="Write your note description here..."
                            value={noteFormDescription}
                            onChange={e => setNoteFormDescription(e.target.value)}
                            rows={3}
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                          />
                          <div className="space-y-2">
                            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Visibility</Label>
                            <div className="flex gap-2">
                              {(['only-me', 'everyone', 'specific'] as NoteVisibility[]).map(v => (
                                <Button
                                  key={v}
                                  type="button"
                                  variant={noteFormVisibility === v ? 'default' : 'outline'}
                                  size="sm"
                                  className="text-xs gap-1.5"
                                  onClick={() => setNoteFormVisibility(v)}
                                >
                                  {visibilityIcon(v)}
                                  {visibilityLabel(v)}
                                </Button>
                              ))}
                            </div>
                          </div>

                          {noteFormVisibility === 'specific' && (
                            <div className="space-y-2">
                              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Select Members</Label>
                              <div className="flex flex-wrap gap-2 p-2 border rounded-md bg-muted/5 max-h-[140px] overflow-y-auto">
                                {(selectedProject.members || []).map(mid => {
                                  const mem = members.find(m => m.id === mid);
                                  if (!mem) return null;
                                  const isSelected = noteFormVisibleTo.includes(mid);
                                  return (
                                    <Badge
                                      key={mid}
                                      variant={isSelected ? 'default' : 'outline'}
                                      className="cursor-pointer gap-1.5 pl-1 pr-2 py-1 transition-colors"
                                      onClick={() => setNoteFormVisibleTo(prev => isSelected ? prev.filter(id => id !== mid) : [...prev, mid])}
                                    >
                                      <Avatar className="h-4 w-4"><AvatarFallback className="text-[7px] bg-muted-foreground/10">{mem.avatar}</AvatarFallback></Avatar>
                                      {mem.name}
                                      {isSelected && <Check className="w-3 h-3 ml-0.5" />}
                                    </Badge>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          <div className="flex items-center gap-2 pt-1">
                            <Button size="sm" className="text-xs" onClick={editingNote ? handleSaveEditNote : handleCreateNote}>
                              {editingNote ? 'Save Changes' : 'Add Note'}
                            </Button>
                            <Button size="sm" variant="ghost" className="text-xs" onClick={() => {
                              setIsAddingNote(false);
                              setEditingNote(null);
                              setNoteFormTitle('');
                              setNoteFormDescription('');
                              setNoteFormVisibility('everyone');
                              setNoteFormVisibleTo([]);
                            }}>Cancel</Button>
                          </div>
                        </div>
                      ) : (
                        <div
                          onClick={() => setIsAddingNote(true)}
                          className="bg-background border rounded-md p-3 text-sm text-muted-foreground cursor-pointer hover:border-primary/50 transition-colors shrink-0 flex items-center gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          Click here to add a note...
                        </div>
                      )}

                      {/* Filter Tabs */}
                      <div className="flex items-center justify-between border-b pb-3 shrink-0">
                        <div className="flex gap-2">
                          {([['all', 'All Notes'], ['everyone', 'Shared'], ['only-me', 'Private'], ['specific', 'Specific']] as const).map(([key, label]) => (
                            <Badge
                              key={key}
                              variant={notesFilter === key ? 'secondary' : 'outline'}
                              className={`cursor-pointer transition-colors ${notesFilter === key ? 'bg-muted text-foreground hover:bg-muted/80' : ''}`}
                              onClick={() => setNotesFilter(key)}
                            >
                              {label}
                            </Badge>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                          Expand all <Switch checked={expandAllNotes} onCheckedChange={setExpandAllNotes} />
                        </div>
                      </div>

                      {/* Notes List */}
                      {projectNotes.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground opacity-50">
                          <MessageSquare className="w-16 h-16 mb-4" />
                          <p className="font-medium">No notes added yet</p>
                        </div>
                      ) : (
                        <div className="flex-1 overflow-y-auto space-y-3">
                          {projectNotes.map(note => {
                            const isOwner = note.createdBy === currentUserId;
                            return (
                              <div key={note.id} className="bg-background border rounded-lg overflow-hidden group cursor-pointer hover:border-primary/30 transition-colors" onClick={() => setViewingNote(note)}>
                                <div className="p-4">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <h4 className="font-medium text-sm truncate">{note.title}</h4>
                                        <Badge variant="outline" className="text-[10px] gap-1 shrink-0 font-normal">
                                          {visibilityIcon(note.visibility)}
                                          {visibilityLabel(note.visibility)}
                                        </Badge>
                                      </div>
                                      {(expandAllNotes || note.description) && (
                                        <p className={`text-sm text-muted-foreground whitespace-pre-wrap ${expandAllNotes ? '' : 'line-clamp-2'}`}>
                                          {note.description || <span className="italic">No description</span>}
                                        </p>
                                      )}
                                    </div>
                                    {isOwner && (
                                      <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={(e) => { e.stopPropagation(); openEditNote(note); }}>
                                          <Pencil className="w-3.5 h-3.5" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteNote(note.id); }}>
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 mt-3 pt-2 border-t border-border/50 text-xs text-muted-foreground">
                                    <span className="font-medium">{note.createdByName}</span>
                                    <span>·</span>
                                    <span>{new Date(note.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                    {note.updatedAt && <span className="italic">(edited)</span>}
                                    {note.visibility === 'specific' && note.visibleTo && note.visibleTo.length > 0 && (
                                      <>
                                        <span>·</span>
                                        <span className="flex items-center gap-1">
                                          <Users className="w-3 h-3" />
                                          {note.visibleTo.map(mid => members.find(m => m.id === mid)?.name).filter(Boolean).join(', ')}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Note Detail Popup */}
                      <Dialog open={!!viewingNote} onOpenChange={(open) => { if (!open) setViewingNote(null); }}>
                        <DialogContent className="sm:max-w-[600px]">
                          {viewingNote && (() => {
                            const noteOwner = viewingNote.createdBy === currentUserId;
                            return (
                              <>
                                <DialogHeader>
                                  <div className="flex items-center gap-2">
                                    <DialogTitle className="text-lg">{viewingNote.title}</DialogTitle>
                                    <Badge variant="outline" className="text-[10px] gap-1 font-normal shrink-0">
                                      {visibilityIcon(viewingNote.visibility)}
                                      {visibilityLabel(viewingNote.visibility)}
                                    </Badge>
                                  </div>
                                </DialogHeader>
                                <div className="space-y-5 py-2">
                                  {/* Description */}
                                  <div className="space-y-1.5">
                                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Description</Label>
                                    <div className="bg-muted/20 border rounded-md p-3 text-sm whitespace-pre-wrap min-h-[60px]">
                                      {viewingNote.description || <span className="text-muted-foreground italic">No description provided</span>}
                                    </div>
                                  </div>

                                  {/* Visible To (for specific visibility) */}
                                  {viewingNote.visibility === 'specific' && viewingNote.visibleTo && viewingNote.visibleTo.length > 0 && (
                                    <div className="space-y-1.5">
                                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Visible To</Label>
                                      <div className="flex flex-wrap gap-2">
                                        {viewingNote.visibleTo.map(mid => {
                                          const mem = members.find(m => m.id === mid);
                                          if (!mem) return null;
                                          return (
                                            <Badge key={mid} variant="secondary" className="pl-1 pr-2 py-1 gap-1.5">
                                              <Avatar className="h-4 w-4"><AvatarFallback className="text-[7px] bg-muted-foreground/10">{mem.avatar}</AvatarFallback></Avatar>
                                              <span className="text-xs font-medium">{mem.name}</span>
                                            </Badge>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}

                                  {/* Meta Info */}
                                  <div className="border-t pt-4 space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                      <span className="text-muted-foreground">Created by</span>
                                      <span className="font-medium">{viewingNote.createdByName}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                      <span className="text-muted-foreground">Created at</span>
                                      <span className="font-medium">{new Date(viewingNote.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    {viewingNote.updatedAt && (
                                      <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">Last edited</span>
                                        <span className="font-medium">{new Date(viewingNote.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <DialogFooter>
                                  {noteOwner && (
                                    <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => { setViewingNote(null); openEditNote(viewingNote); }}>
                                      <Pencil className="w-3.5 h-3.5" /> Edit Note
                                    </Button>
                                  )}
                                  <Button variant="ghost" size="sm" className="text-xs" onClick={() => setViewingNote(null)}>Close</Button>
                                </DialogFooter>
                              </>
                            );
                          })()}
                        </DialogContent>
                      </Dialog>
                    </div>
                  );})()}

                  {/* EMAILS TAB */}
                  {activeTab === 'Emails' && (
                    <div className="space-y-6 h-full flex flex-col">
                      <div className="bg-background border rounded-md p-3 text-sm text-muted-foreground cursor-text hover:border-primary/50 transition-colors shrink-0">
                        Click here to add an email...
                      </div>
                      <div className="flex items-center justify-between border-b pb-4 shrink-0">
                        <div className="flex gap-2">
                          <Badge variant="secondary" className="bg-muted text-foreground hover:bg-muted/80 cursor-pointer">All</Badge>
                          <Badge variant="outline" className="cursor-pointer">Deal emails</Badge>
                          <Badge variant="outline" className="cursor-pointer">Project emails</Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                          Expand all items <Switch />
                        </div>
                      </div>
                      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground opacity-50">
                        <Mail className="w-16 h-16 mb-4" />
                        <p className="font-medium">No emails linked yet</p>
                      </div>
                    </div>
                  )}

                  {/* DOCUMENTS TAB */}
                  {activeTab === 'Documents' && (
                    <div className="space-y-6 h-full flex flex-col">
                      <div className="flex items-center justify-between border-b pb-4 shrink-0">
                        <div className="flex gap-6 text-sm font-medium text-muted-foreground">
                          <span className="text-foreground border-b-2 border-primary pb-4 -mb-[18px]">Documents</span>
                          <span>Templates</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" className="h-8 text-xs font-medium">❓ Learn more</Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                        </div>
                      </div>
                      <div className="flex gap-3 shrink-0">
                        <Button variant="outline"><span className="mr-2">🖥️</span> Upload from device</Button>
                        <Button variant="outline"><span className="mr-2">☁️</span> Connect cloud storage</Button>
                      </div>
                      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground opacity-50">
                        <p className="text-xs font-medium text-muted-foreground mb-4">Documents Created</p>
                        <FileText className="w-12 h-12 mb-3" />
                        <p className="font-medium text-sm">No documents created yet</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
