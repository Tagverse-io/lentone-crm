'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/firebase/auth-context';
import { useCollection } from '@/lib/use-collection';
import { postsService, socialAccountsService } from '@/lib/services';
import type { PostStatus, SocialPlatform } from '@/lib/types';
import { nowIso, formatDateTime } from '@/lib/utils';
import { EmptyState, LoadingState, ErrorState } from '@/components/ui/states';

const PLATFORMS: SocialPlatform[] = ['facebook', 'instagram', 'linkedin', 'x', 'youtube'];

export default function SocialPage() {
  const { workspace } = useAuth();
  const orgId = workspace?.id ?? null;
  const { items, loading, error, reload } = useCollection(postsService, orgId);
  const accounts = useCollection(socialAccountsService, orgId);
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<SocialPlatform | 'all'>('all');
  const [content, setContent] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [handle, setHandle] = useState('');
  const [saving, setSaving] = useState(false);

  if (!orgId) return <LoadingState label="Loading workspace…" />;
  if (loading) return <LoadingState label="Loading social…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const savePost = async () => {
    if (!orgId || !content.trim()) {
      toast.error('Content is required');
      return;
    }
    setSaving(true);
    try {
      await postsService.create(orgId, {
        platform, content, scheduledAt: scheduledAt || undefined,
        status: scheduledAt ? 'scheduled' : 'draft', createdAt: nowIso(),
      });
      toast.success('Post saved');
      setOpen(false);
      setContent(''); setScheduledAt(''); setPlatform('all');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const connectAccount = async () => {
    if (!orgId || !handle.trim()) return;
    try {
      await socialAccountsService.create(orgId, { platform: 'facebook', handle, connected: true, createdAt: nowIso() });
      toast.success('Account connected (stub — no live platform call)');
      setHandle('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Connect failed');
    }
  };

  const setStatus = async (id: string, status: PostStatus) => {
    if (!orgId) return;
    try {
      await postsService.update(orgId, id, { status });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    }
  };

  const remove = async (id: string) => {
    if (!orgId || !window.confirm('Delete this post?')) return;
    try {
      await postsService.remove(orgId, id);
      toast.success('Post deleted');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Social accounts & posts</h1>
          <p className="text-sm text-muted-foreground">STUB: providers are not live — posts are stored for the calendar feed.</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus size={16} className="mr-2" />New post</Button>
      </div>
      <Card>
        <CardHeader><CardTitle>Connected accounts ({accounts.items.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input placeholder="@handle" value={handle} onChange={(e) => setHandle(e.target.value)} aria-label="Account handle" />
            <Button variant="outline" onClick={connectAccount}>Connect (stub)</Button>
          </div>
          <ul className="mt-2 text-sm text-muted-foreground">
            {accounts.items.map((a) => <li key={a.id} className="py-1">{a.platform} · {a.handle}</li>)}
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Posts</CardTitle></CardHeader>
        <CardContent>
          {items.length === 0 ? <EmptyState title="No posts yet" hint="Schedule a post to see it on the calendars." /> : (
            <Table>
              <TableHeader><TableRow><TableHead>Content</TableHead><TableHead>Platform</TableHead><TableHead>Scheduled</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {items.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="max-w-xs truncate">{p.content}</TableCell>
                    <TableCell>{p.platform}</TableCell>
                    <TableCell>{p.scheduledAt ? formatDateTime(p.scheduledAt) : '—'}</TableCell>
                    <TableCell><Badge variant="secondary">{p.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {p.status !== 'published' ? <Button size="sm" variant="outline" onClick={() => setStatus(p.id, 'published')}>Publish</Button> : null}
                        <Button size="icon" variant="ghost" onClick={() => remove(p.id)} aria-label="Delete"><Trash2 size={14} /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New post</DialogTitle>
            <DialogDescription>Scheduled posts appear on the Central Calendar.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-2">
              <Label>Platform</Label>
              <Select value={platform} onValueChange={(v) => setPlatform(v as SocialPlatform | 'all')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {PLATFORMS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Content</Label><Textarea value={content} onChange={(e) => setContent(e.target.value)} /></div>
            <div className="space-y-2"><Label>Schedule at</Label><Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={savePost} disabled={saving}>{saving ? 'Saving…' : 'Save post'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
