'use client';

import { useState } from 'react';
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
import { createAiConversation, updateAiConversation } from '@/lib/firebase/database';
import { useAuth } from '@/lib/firebase/auth-context';
import type { AiConversation } from '@/lib/db/types';

interface AiConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  conversation?: AiConversation | null;
}

const defaultForm = {
  title: '',
  assistant: 'tara',
};

export function AiConversationDialog({ open, onOpenChange, onSaved, conversation }: AiConversationDialogProps) {
  const [form, setForm] = useState(() => conversation
    ? {
        title: conversation.title,
        assistant: conversation.assistant,
      }
    : { ...defaultForm }
  );
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof defaultForm>(key: K, value: (typeof defaultForm)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const { workspace, user } = useAuth();
  const workspaceId = workspace?.id || '';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error('Title is required');
      return;
    }
    if (!workspaceId) {
      toast.error('No active workspace');
      return;
    }
    setSaving(true);
    try {
      if (conversation) {
        await updateAiConversation(workspaceId, conversation.id, form);
        toast.success('Conversation updated');
      } else {
        await createAiConversation(workspaceId, { ...form, created_by: user?.id || '', messages: [] });
        toast.success('Conversation created');
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
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{conversation ? 'Edit Conversation' : 'New Conversation'}</DialogTitle>
          <DialogDescription>
            {conversation ? 'Update the conversation details.' : 'Start a new AI conversation.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input id="title" value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Pipeline analysis" />
            </div>
            <div>
              <Label htmlFor="assistant">Assistant</Label>
              <Select value={form.assistant} onValueChange={(v) => set('assistant', v)}>
                <SelectTrigger id="assistant"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tara">Tara - Sales</SelectItem>
                  <SelectItem value="rio">Rio - Analytics</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : conversation ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
