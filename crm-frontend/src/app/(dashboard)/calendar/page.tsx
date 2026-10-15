'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Clock, X, Users, Link as LinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { useAuth } from '@/lib/firebase/auth-context';
import { backend } from '@/lib/backend-client';
import { subscribeToCalendarEvents, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, CalendarEvent as DBCalendarEvent } from '@/lib/db/calendar/api';
import { Member, Project, subscribeToProjectsData, createMember } from '@/lib/db/projects/api';
import { toast } from 'sonner';

export type CalendarEvent = DBCalendarEvent;

const EVENT_COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

export default function CalendarAgendaPage() {
  const { workspace, user } = useAuth();
  const [view, setView] = useState<'Month'>('Month');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  React.useEffect(() => {
    if (!workspace?.id) return;
    const unsubEvents = subscribeToCalendarEvents(workspace?.id, setEvents);
    const unsubMembers = subscribeToProjectsData(workspace?.id, (data) => {
      setMembers(data.members || []);
      setProjects(data.projects || []);
    });
    return () => { unsubEvents(); unsubMembers(); };
  }, [user]);

  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const [currentMonth, setCurrentMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [viewingEvent, setViewingEvent] = useState<CalendarEvent | null>(null);
  const [reschedulingEvent, setReschedulingEvent] = useState<CalendarEvent | null>(null);
  const [rescheduleTitle, setRescheduleTitle] = useState('');
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('09:00');
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);

  const [formTitle, setFormTitle] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formTime, setFormTime] = useState('09:00');
  const [formColor, setFormColor] = useState(EVENT_COLORS[0]);
  const [formAttendees, setFormAttendees] = useState<string[]>([]);
  const [formProject, setFormProject] = useState('');
  const [attendeesPopoverOpen, setAttendeesPopoverOpen] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [googleMsg, setGoogleMsg] = useState<string | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    const status = searchParams.get('google');
    if (status === 'connected=1' || status === 'connected') {
      toast.success('Google Calendar connected');
      setGoogleMsg('Google connected — hit Sync Google to import events.');
    } else if (status && status.startsWith('error')) {
      toast.error('Google connection failed');
    }
  }, [searchParams]);

  const handleAddMember = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!newMemberName.trim() || !workspace?.id) return;
    try {
      const newId = await createMember(workspace?.id, { name: newMemberName.trim(), role: 'Member', email: '', avatar: '', projectIds: [] });
      if (newId) { setFormAttendees(prev => [...prev, newId]); setNewMemberName(''); }
    } catch(err) { console.error('Failed to create member:', err); }
  };

  const handleCreateEvent = async () => {
    if (!workspace?.id || !formTitle.trim()) return;
    const newEvent: Omit<CalendarEvent, 'id'> = {
      title: formTitle, date: formDate || todayStr, time: formTime, color: formColor,
      attendees: formAttendees.length > 0 ? formAttendees : (members.length > 0 ? [members[0].id] : []),
      linkedRecord: formProject ? { type: 'project', id: formProject } : null
    };
    try {
      await createCalendarEvent(workspace?.id, newEvent);
      toast.success('Event scheduled successfully');
      setIsScheduleOpen(false);
      setFormTitle(''); setFormDate(''); setFormTime('09:00'); setFormColor(EVENT_COLORS[0]); setFormAttendees([]); setFormProject('');
    } catch (e) { console.error("Failed to create event", e); toast.error('Failed to create event'); }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!workspace?.id || !eventId) return;
    try {
      await deleteCalendarEvent(workspace.id, eventId);
      toast.success('Event deleted');
      setViewingEvent(null);
    } catch (e) {
      console.error('Failed to delete event', e);
      toast.error('Failed to delete event');
    }
  };

  const handleOpenReschedule = (event: CalendarEvent) => {
    setRescheduleTitle(event.title);
    setRescheduleDate(event.date);
    setRescheduleTime(event.time || '09:00');
    setReschedulingEvent(event);
    setViewingEvent(null);
  };

  const handleSaveReschedule = async () => {
    if (!workspace?.id || !reschedulingEvent || !rescheduleDate) return;
    try {
      await updateCalendarEvent(workspace.id, reschedulingEvent.id, {
        title: rescheduleTitle.trim() || reschedulingEvent.title,
        date: rescheduleDate,
        time: rescheduleTime,
      });
      toast.success('Event rescheduled');
      setReschedulingEvent(null);
    } catch (e) {
      console.error('Failed to reschedule event', e);
      toast.error('Failed to reschedule event');
    }
  };

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();
  const daysInCurrentMonth = getDaysInMonth(currentMonth.getFullYear(), currentMonth.getMonth());
  const firstDayOffset = getFirstDayOfMonth(currentMonth.getFullYear(), currentMonth.getMonth());
  const adjustedOffset = firstDayOffset === 0 ? 6 : firstDayOffset - 1;

  const calendarCells = useMemo(() => {
    const cells = [];
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    for (let i = 0; i < adjustedOffset; i++) cells.push({ empty: true, date: null, dateStr: '' });
    for (let i = 1; i <= daysInCurrentMonth; i++) {
      const d = new Date(year, month, i);
      const mStr = String(month + 1).padStart(2, '0');
      const dStr = String(i).padStart(2, '0');
      cells.push({ empty: false, date: d, dateStr: `${year}-${mStr}-${dStr}`, isWeekend: d.getDay() === 0 || d.getDay() === 6 });
    }
    const remaining = 42 - cells.length;
    for (let i = 0; i < remaining; i++) cells.push({ empty: true, date: null, dateStr: '' });
    return cells;
  }, [currentMonth, adjustedOffset, daysInCurrentMonth]);

  const selectedDayEvents = events.filter(e => e.date === selectedDate).sort((a,b) => a.time.localeCompare(b.time));
  const upcoming7DaysEvents = useMemo(() => {
    const start = new Date(selectedDate);
    const end = new Date(start); end.setDate(end.getDate() + 7);
    return events.filter(e => { const d = new Date(e.date); return d >= start && d <= end; }).sort((a, b) => a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date));
  }, [selectedDate, events]);

  const handlePrevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const handleNextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  const handleToday = () => {
    const today = new Date();
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    const tStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    setSelectedDate(tStr);
  };
  const getMonthName = (date: Date) => date.toLocaleString('default', { month: 'long', year: 'numeric' });

  const handleGoogleConnect = async () => {
    setGoogleMsg(null);
    setGoogleBusy(true);
    try {
      const { url } = await backend.googleConnect();
      window.location.href = url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Google connect failed');
      setGoogleBusy(false);
    }
  };

  const handleGoogleSync = async () => {
    if (!workspace?.id) return;
    setGoogleMsg(null);
    setGoogleBusy(true);
    try {
      const res = await backend.googleSync(workspace.id);
      setGoogleMsg(`Synced ${res.imported} Google events into the calendar.`);
      toast.success('Google Calendar synced');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Google sync failed';
      setGoogleMsg(msg);
      toast.error(msg);
    } finally {
      setGoogleBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Calendar</h2>
          <p className="text-sm text-muted-foreground">Track schedules, meetings, and milestone due dates</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={handleGoogleConnect} disabled={googleBusy} className="w-full sm:w-auto">
            Connect Google
          </Button>
          <Button variant="outline" onClick={handleGoogleSync} disabled={googleBusy} className="w-full sm:w-auto">
            {googleBusy ? 'Syncing…' : 'Sync Google'}
          </Button>
          <Button onClick={() => setIsScheduleOpen(true)} className="w-full sm:w-auto">
            <Plus size={16} className="mr-2" /> Schedule Event
          </Button>
        </div>
      </div>
      {googleMsg ? <p className="text-sm text-muted-foreground" role="status">{googleMsg}</p> : null}

      {/* Calendar Grid + Agenda */}
      <div className="flex flex-col xl:flex-row gap-6">
        {/* Calendar Grid */}
        <div className="flex-1 min-w-0">
          <Card>
            <CardHeader className="p-4 border-b flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <CalendarIcon className="h-5 w-5 text-muted-foreground" />
                <h3 className="text-sm font-semibold">{getMonthName(currentMonth)}</h3>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={handlePrevMonth}><ChevronLeft className="h-4 w-4" /></Button>
                <Button variant="outline" size="sm" className="h-8" onClick={handleToday}>Today</Button>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleNextMonth}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid grid-cols-7 border-b">
                {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((day, i) => (
                  <div key={day} className={`px-2 py-2 text-center text-[10px] font-medium uppercase tracking-wider ${i >= 5 ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {calendarCells.map((cell, idx) => {
                  if (cell.empty) return <div key={idx} className="border-b border-r min-h-[100px]" />;
                  const isSelected = selectedDate === cell.dateStr;
                  const cellEvents = events.filter(e => e.date === cell.dateStr);
                  const displayItems = cellEvents.slice(0, 3);
                  const hasMore = cellEvents.length > 3;

                  return (
                    <div key={idx} className={`border-b border-r p-1.5 flex flex-col cursor-pointer min-h-[100px] transition-colors
                        ${isSelected ? 'bg-muted/50' : 'hover:bg-muted/30'}`}
                      onClick={() => setSelectedDate(cell.dateStr)}>
                      <div className="text-right mb-1">
                        <span className={`text-[11px] font-medium w-6 h-6 inline-flex items-center justify-center rounded-full ${
                          cell.dateStr === todayStr && !isSelected ? 'bg-foreground text-background font-bold' :
                          isSelected ? 'bg-foreground text-background' :
                          cell.isWeekend ? 'text-muted-foreground' : 'text-muted-foreground'
                        }`}>
                          {cell.date?.getDate()}
                        </span>
                      </div>
                      <div className="flex-1 flex flex-col gap-1 overflow-hidden">
                        {displayItems.map((item) => (
                          <div key={`e-${item.id}`}
                            className="flex items-center gap-1 px-1 py-0.5 rounded text-[9px] font-medium truncate"
                            style={{ backgroundColor: `${(item as CalendarEvent).color}15` }}
                            onClick={(e) => { e.stopPropagation(); setViewingEvent(item as CalendarEvent); }}>
                            <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: (item as CalendarEvent).color }} />
                            <span className="text-muted-foreground shrink-0">{(item as CalendarEvent).time}</span>
                            <span className="truncate">{(item as CalendarEvent).title}</span>
                          </div>
                        ))}
                        {hasMore && <div className="text-[9px] text-muted-foreground text-center mt-auto">{cellEvents.length - 3} more</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Agenda Panel */}
        <div className="w-full xl:w-80 shrink-0 space-y-4">
          <Card>
            <CardHeader className="p-4 border-b">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider">Selected Day</CardTitle>
              <p className="text-xs text-muted-foreground">{new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}</p>
            </CardHeader>
            <CardContent className="p-0 divide-y">
              {selectedDayEvents.length === 0 && (
                <div className="p-6 text-center text-xs text-muted-foreground">No events scheduled.</div>
              )}
              {selectedDayEvents.map(e => (
                <div key={e.id} className="p-3 hover:bg-muted/30 transition-colors cursor-pointer" style={{ borderLeft: `3px solid ${e.color}` }} onClick={() => setViewingEvent(e)}>
                  <span className="text-sm font-medium">{e.title}</span>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1"><Clock className="h-3 w-3" /> {e.time}</div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 border-b">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider">Upcoming 7 Days</CardTitle>
            </CardHeader>
            <CardContent className="p-0 divide-y">
              {upcoming7DaysEvents.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">No upcoming events.</div>
              ) : (
                upcoming7DaysEvents.map(e => (
                  <div key={`${e.id}-up`} className="p-3 flex items-center gap-3 hover:bg-muted/30 cursor-pointer" onClick={() => setViewingEvent(e)}>
                    <div className="w-1 h-8 rounded-full shrink-0" style={{ backgroundColor: e.color }} />
                    <div className="flex flex-col flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">{new Date(e.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                      <p className="text-sm font-medium truncate">{e.title}</p>
                      <p className="text-[10px] text-muted-foreground">{e.time}</p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Event Detail Modal */}
      <Dialog open={!!viewingEvent} onOpenChange={(open) => { if (!open) setViewingEvent(null); }}>
        <DialogContent className="sm:max-w-[425px]" hideCloseIcon>
          {viewingEvent && (
            <>
              <div className="h-1 w-full rounded-t-lg" style={{ backgroundColor: viewingEvent.color }} />
              <DialogHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">Event</Badge>
                  {viewingEvent.linkedRecord && <Badge variant="outline" className="text-[10px] gap-1"><LinkIcon className="h-3 w-3" /> Project Link</Badge>}
                </div>
                <DialogTitle>{viewingEvent.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="flex items-center gap-3 text-sm">
                  <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  <span>{new Date(viewingEvent.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>{viewingEvent.time}</span>
                </div>
                {viewingEvent.attendees.length > 0 && (
                  <div className="pt-3 border-t space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Attendees ({viewingEvent.attendees.length})</p>
                    <div className="space-y-2">
                      {viewingEvent.attendees.map(aId => {
                        const m = members.find(x => x.id === aId);
                        if (!m) return null;
                        return (
                          <div key={aId} className="flex items-center gap-2">
                            <Avatar className="h-6 w-6"><AvatarFallback className="text-[10px]">{m.avatar || m.name.substring(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                            <div><span className="text-sm font-medium">{m.name}</span><span className="text-xs text-muted-foreground ml-2">{m.role}</span></div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between pt-3 border-t">
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDeleteEvent(viewingEvent.id)}>Delete</Button>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setViewingEvent(null)}>Close</Button>
                  <Button size="sm" onClick={() => handleOpenReschedule(viewingEvent)}>Reschedule</Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Reschedule Event Modal */}
      <Dialog open={!!reschedulingEvent} onOpenChange={(open) => { if (!open) setReschedulingEvent(null); }}>
        <DialogContent className="sm:max-w-[425px]" hideCloseIcon>
          <DialogHeader>
            <DialogTitle>Reschedule Event</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Event Title</label>
              <Input value={rescheduleTitle} onChange={(e) => setRescheduleTitle(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Date</label>
                <Input type="date" value={rescheduleDate} onChange={(e) => setRescheduleDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Time</label>
                <Input type="time" value={rescheduleTime} onChange={(e) => setRescheduleTime(e.target.value)} />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-3 border-t">
            <Button variant="ghost" size="sm" onClick={() => setReschedulingEvent(null)}>Cancel</Button>
            <Button size="sm" onClick={handleSaveReschedule}>Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Schedule Event Modal */}
      <Dialog open={isScheduleOpen} onOpenChange={setIsScheduleOpen}>
        <DialogContent className="sm:max-w-[500px]" hideCloseIcon>
          <DialogHeader>
            <DialogTitle>Schedule Event</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Event Title</label>
              <Input placeholder="e.g. Design Sync" value={formTitle} onChange={e=>setFormTitle(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Date</label>
                <Input type="date" value={formDate} onChange={e=>setFormDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Time</label>
                <Input type="time" value={formTime} onChange={e=>setFormTime(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Link to Project (Optional)</label>
              <Input list="project-suggestions" placeholder="Type or select a project..." value={formProject} onChange={e => setFormProject(e.target.value)} />
              <datalist id="project-suggestions">
                {Array.from(new Set([...projects.map(p => p.name), ...events.map(e => e.linkedRecord?.id).filter(Boolean) as string[]])).map(projName => (
                  <option key={projName} value={projName} />
                ))}
              </datalist>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Event Color</label>
              <div className="flex items-center gap-3">
                {EVENT_COLORS.map(c => (
                  <div key={c}
                    className={`w-6 h-6 rounded-full cursor-pointer ring-2 ring-offset-2 dark:ring-offset-background transition-all ${formColor === c ? 'ring-foreground' : 'ring-transparent hover:ring-muted-foreground/50'}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setFormColor(c)} />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Attendees</label>
              <Popover open={attendeesPopoverOpen} onOpenChange={setAttendeesPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    {formAttendees.length > 0 ? `${formAttendees.length} selected` : 'Select attendees...'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-2" align="start">
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {members.map(m => {
                      const isSelected = formAttendees.includes(m.id);
                      return (
                        <div key={m.id}
                          className="flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer transition-colors"
                          onClick={() => setFormAttendees(prev => isSelected ? prev.filter(id => id !== m.id) : [...prev, m.id])}>
                          <Avatar className="h-5 w-5"><AvatarFallback className="text-[9px]">{m.avatar || m.name.substring(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                          <span className="text-sm">{m.name}</span>
                        </div>
                      );
                    })}
                    {members.length === 0 && <div className="text-xs text-muted-foreground p-2 text-center">No members found.</div>}
                  </div>
                  <div className="pt-2 mt-1 border-t flex items-center gap-2">
                    <Input placeholder="New member name..." className="h-8 text-xs" value={newMemberName} onChange={e => setNewMemberName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddMember(e as any); } }} />
                    <Button size="sm" variant="secondary" className="h-8 text-xs shrink-0" onClick={handleAddMember}>Add</Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-3 border-t">
            <Button variant="ghost" size="sm" onClick={() => setIsScheduleOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreateEvent}>Schedule Event</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
