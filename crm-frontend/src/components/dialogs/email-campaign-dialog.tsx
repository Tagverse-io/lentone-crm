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
import { createEmailCampaign, updateEmailCampaign } from '@/lib/firebase/database';
import type { EmailCampaign, EmailTemplate, EmailCampaignStatus } from '@/lib/db/types';
import { useAuth } from '@/lib/firebase/auth-context';

interface EmailCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  item?: EmailCampaign | null;
  templates: EmailTemplate[];
}

const defaultForm = {
  name: '',
  subject: '',
  template_id: '',
  recipient_list: '',
  scheduled_at: '',
  status: 'draft' as EmailCampaignStatus,
  created_by: 'admin',
};

export function EmailCampaignDialog({ open, onOpenChange, onSaved, item, templates }: EmailCampaignDialogProps) {
  const { workspace, user } = useAuth();
  const [form, setForm] = useState({ ...defaultForm });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setForm({
        name: item.name,
        subject: item.subject,
        template_id: item.template_id || '',
        recipient_list: item.recipient_list ? item.recipient_list.join(', ') : '',
        scheduled_at: item.scheduled_at ? item.scheduled_at.split('T')[0] : '',
        status: item.status,
        created_by: item.created_by || 'admin',
      });
    } else {
      setForm({ ...defaultForm });
    }
  }, [item]);

  function handleChange(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.subject.trim() || !form.template_id) {
      toast.error('Name, subject, and template are required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        subject: form.subject.trim(),
        template_id: form.template_id,
        recipient_list: form.recipient_list
          ? form.recipient_list.split(',').map((v) => v.trim()).filter(Boolean)
          : [],
        scheduled_at: form.scheduled_at || undefined,
        sequence_step: item?.sequence_step || 1,
        status: form.status as EmailCampaignStatus,
        created_by: form.created_by || 'admin',
      };

      if (item) {
        await updateEmailCampaign(item.id, payload);
        toast.success('Campaign updated');
      } else {
        await createEmailCampaign({
          ...payload,
          workspace_id: workspace?.id || '',
        });
        toast.success('Campaign created');
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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{item ? 'Edit Campaign' : 'New Campaign'}</DialogTitle>
          <DialogDescription>
            {item ? 'Update the email campaign.' : 'Create a new email campaign.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input id="name" value={form.name} onChange={(e) => handleChange('name', e.target.value)} placeholder="Product Launch" />
            </div>
            <div>
              <Label htmlFor="subject">Subject *</Label>
              <Input id="subject" value={form.subject} onChange={(e) => handleChange('subject', e.target.value)} placeholder="Our new product is here!" />
            </div>
            <div>
              <Label htmlFor="template_id">Template *</Label>
              <Select value={form.template_id} onValueChange={(v) => handleChange('template_id', v)}>
                <SelectTrigger id="template_id"><SelectValue placeholder="Select a template" /></SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="recipient_list">Recipients (comma-separated emails)</Label>
              <Input id="recipient_list" value={form.recipient_list} onChange={(e) => handleChange('recipient_list', e.target.value)} placeholder="alice@example.com, bob@example.com" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="scheduled_at">Scheduled At</Label>
                <Input id="scheduled_at" type="datetime-local" value={form.scheduled_at} onChange={(e) => handleChange('scheduled_at', e.target.value)} />
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={form.status} onValueChange={(v: EmailCampaignStatus) => handleChange('status', v)}>
                  <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="scheduling">Scheduling</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
