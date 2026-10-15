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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { createContentItem, updateContentItem } from '@/lib/firebase/database';
import type { ContentItem, ContentStatus } from '@/lib/db/types';
import { useAuth } from '@/lib/firebase/auth-context';

interface ContentItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  item?: ContentItem | null;
}

const defaultForm = {
  title: '',
  type: 'Blog',
  author: '',
  status: 'Draft' as ContentStatus,
};

export function ContentItemDialog({ open, onOpenChange, onSaved, item }: ContentItemDialogProps) {
  const { workspace, user } = useAuth();
  const [form, setForm] = useState({ ...defaultForm });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setForm({
        title: item.title,
        type: item.type,
        author: item.author || '',
        status: item.status,
      });
    } else {
      setForm({ ...defaultForm });
    }
  }, [item]);

  function set<K extends keyof typeof defaultForm>(key: K, value: (typeof defaultForm)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.author.trim()) {
      toast.error('Title and author are required');
      return;
    }
    setSaving(true);
    try {
      if (item) {
        await updateContentItem(item.id, form);
        toast.success('Content updated');
      } else {
        await createContentItem({
          ...form,
          workspace_id: workspace?.id || '',
        });
        toast.success('Content created');
      }
      onSaved();
      onOpenChange(false);
    } catch {
      toast.error('Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>{item ? 'Edit Content' : 'New Content'}</DialogTitle>
          <DialogDescription>
            {item ? 'Update the content details.' : 'Enter the content details.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input id="title" value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Top 10 CRM Strategies" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="type">Type</Label>
                <Select value={form.type} onValueChange={(v) => set('type', v)}>
                  <SelectTrigger id="type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Blog">Blog</SelectItem>
                    <SelectItem value="Newsletter">Newsletter</SelectItem>
                    <SelectItem value="Case Study">Case Study</SelectItem>
                    <SelectItem value="Script">Script</SelectItem>
                    <SelectItem value="Social">Social</SelectItem>
                    <SelectItem value="Report">Report</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={form.status} onValueChange={(v: ContentStatus) => set('status', v)}>
                  <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Draft">Draft</SelectItem>
                    <SelectItem value="In Review">In Review</SelectItem>
                    <SelectItem value="Scheduled">Scheduled</SelectItem>
                    <SelectItem value="Published">Published</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="author">Author *</Label>
              <Input id="author" value={form.author} onChange={(e) => set('author', e.target.value)} placeholder="Alice" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : item ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
