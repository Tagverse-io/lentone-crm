'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { createSocialPost, updateSocialPost } from '@/lib/firebase/database';
import type { SocialPost, SocialPlatform } from '@/lib/db/types';
import { useAuth } from '@/lib/firebase/auth-context';

interface SocialPostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  post?: SocialPost | null;
}

const defaultForm = {
  platform: 'facebook' as SocialPlatform,
  content: '',
  media_url: '',
  scheduled_at: '',
  status: 'scheduled' as SocialPost['status'],
  created_by: 'admin',
};

export function SocialPostDialog({ open, onOpenChange, onSaved, post }: SocialPostDialogProps) {
  const { workspace, user } = useAuth();
  const [form, setForm] = useState({ ...defaultForm });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (post) {
      setForm({
        platform: post.platform,
        content: post.content,
        media_url: post.media_url || '',
        scheduled_at: post.scheduled_at || '',
        status: post.status,
        created_by: post.created_by || '',
      });
    } else {
      setForm({ ...defaultForm });
    }
  }, [post]);

  function set<K extends keyof typeof defaultForm>(key: K, value: (typeof defaultForm)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.content.trim()) {
      toast.error('Content is required');
      return;
    }
    if (!form.scheduled_at) {
      toast.error('Scheduled date is required');
      return;
    }
    setSaving(true);
    try {
      if (post) {
        await updateSocialPost(post.id, form);
        toast.success('Post updated successfully');
      } else {
        await createSocialPost({
          ...form,
          workspace_id: workspace?.id || '',
        });
        toast.success('Post created successfully');
      }
      onSaved();
      onOpenChange(false);
    } catch {
      toast.error('Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setForm(post ? {
      platform: post.platform,
      content: post.content,
      media_url: post.media_url || '',
      scheduled_at: post.scheduled_at || '',
      status: post.status,
      created_by: post.created_by || '',
    } : { ...defaultForm });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{post ? 'Edit Post' : 'New Post'}</DialogTitle>
          <DialogDescription>
            {post ? 'Update the post details below.' : 'Enter the post details below.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <Label htmlFor="platform">Platform *</Label>
              <Select value={form.platform} onValueChange={(v: SocialPlatform) => set('platform', v)}>
                <SelectTrigger id="platform">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="facebook">Facebook</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                  <SelectItem value="twitter">Twitter</SelectItem>
                  <SelectItem value="youtube">YouTube</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <Label htmlFor="status">Status</Label>
              <Select value={form.status} onValueChange={(v: SocialPost['status']) => set('status', v)}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="publishing">Publishing</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label htmlFor="content">Content *</Label>
              <Textarea id="content" value={form.content} onChange={(e) => set('content', e.target.value)} placeholder="Write your post content..." rows={4} />
            </div>
            <div className="col-span-2">
              <Label htmlFor="media_url">Media URL</Label>
              <Input id="media_url" value={form.media_url} onChange={(e) => set('media_url', e.target.value)} placeholder="https://example.com/image.jpg" />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <Label htmlFor="scheduled_at">Scheduled Date *</Label>
              <Input id="scheduled_at" type="datetime-local" value={form.scheduled_at} onChange={(e) => set('scheduled_at', e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : post ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
