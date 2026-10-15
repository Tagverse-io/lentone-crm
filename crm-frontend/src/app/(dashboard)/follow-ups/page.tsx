'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/firebase/auth-context';
import { useCollection } from '@/lib/use-collection';
import { followUpsService } from '@/lib/backend-crud';
import { nowIso } from '@/lib/utils';
import { useFmt } from '@/lib/format';
import { EmptyState, LoadingState, ErrorState } from '@/components/ui/states';

const EMPTY = { title: '', notes: '', dueAt: '', assignedTo: '' };

export default function FollowUpsPage() {
  const { workspace } = useAuth();
  const fmt = useFmt();
  const orgId = workspace?.id ?? null;
  const { items, loading, error, reload } = useCollection(followUpsService, orgId);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  if (!orgId) return <LoadingState label="Loading workspace…" />;
  if (loading) return <LoadingState label="Loading follow-ups…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const save = async () => {
    if (!orgId || !form.title.trim() || !form.dueAt) {
      toast.error('Title and due date are required');
      return;
    }
    setSaving(true);
    try {
      await followUpsService.create(orgId, { ...form, done: false, createdAt: nowIso() });
      toast.success('Follow-up scheduled');
      setOpen(false);
      setForm(EMPTY);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (id: string, done: boolean) => {
    if (!orgId) return;
    try {
      await followUpsService.update(orgId, id, { done: !done });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    }
  };

  const remove = async (id: string) => {
    if (!orgId || !window.confirm('Delete this follow-up?')) return;
    try {
      await followUpsService.remove(orgId, id);
      toast.success('Follow-up deleted');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Follow-ups</h1>
          <p className="text-sm text-muted-foreground">Due and overdue items feed the daily digest email.</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus size={16} className="mr-2" />Add follow-up</Button>
      </div>
      <Card>
        <CardHeader><CardTitle>Scheduled</CardTitle></CardHeader>
        <CardContent>
          {items.length === 0 ? <EmptyState title="No follow-ups" hint="Schedule a follow-up for a lead or client." /> : (
            <Table>
              <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Due</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {items.map((f) => {
                  const overdue = !f.done && new Date(f.dueAt) < new Date();
                  return (
                    <TableRow key={f.id}>
                      <TableCell><p className="font-medium">{f.title}</p><p className="text-xs text-muted-foreground">{f.notes ?? ''}</p></TableCell>
                      <TableCell>{fmt.date(f.dueAt)}</TableCell>
                      <TableCell>
                        <Badge variant={f.done ? 'default' : overdue ? 'destructive' : 'secondary'}>
                          {f.done ? 'Done' : overdue ? 'Overdue' : 'Pending'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => toggle(f.id, f.done)} aria-label="Toggle done"><CheckCircle2 size={14} /></Button>
                          <Button size="icon" variant="ghost" onClick={() => remove(f.id)} aria-label="Delete"><Trash2 size={14} /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add follow-up</DialogTitle>
            <DialogDescription>Follow-ups appear on the Central Calendar and in the digest.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-2"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="space-y-2"><Label>Due at</Label><Input type="datetime-local" value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} /></div>
            <div className="space-y-2"><Label>Assigned to (uid)</Label><Input value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })} /></div>
            <div className="space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save follow-up'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
