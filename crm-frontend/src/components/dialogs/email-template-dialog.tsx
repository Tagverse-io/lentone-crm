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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { createEmailTemplate, updateEmailTemplate } from '@/lib/firebase/database';
import type { EmailTemplate } from '@/lib/db/types';

interface EmailTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  item?: EmailTemplate | null;
}

const defaultForm = {
  name: '',
  subject: '',
  html_body: '',
  variables: '',
  created_by: '',
};

export function EmailTemplateDialog({ open, onOpenChange, onSaved, item }: EmailTemplateDialogProps) {
  const [form, setForm] = useState({ ...defaultForm });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setForm({
        name: item.name,
        subject: item.subject,
        html_body: item.html_body,
        variables: item.variables?.join(', ') || '',
        created_by: item.created_by,
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
    if (!form.name.trim() || !form.subject.trim() || !form.html_body.trim()) {
      toast.error('Name, subject, and HTML body are required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        subject: form.subject.trim(),
        html_body: form.html_body,
        variables: form.variables
          ? form.variables.split(',').map((v) => v.trim()).filter(Boolean)
          : [],
        created_by: form.created_by || 'admin',
      };

      if (item) {
        await updateEmailTemplate(item.id, payload);
        toast.success('Template updated');
      } else {
        await createEmailTemplate(payload);
        toast.success('Template created');
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
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>{item ? 'Edit Template' : 'New Template'}</DialogTitle>
          <DialogDescription>
            {item ? 'Update the email template.' : 'Create a new email template.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input id="name" value={form.name} onChange={(e) => handleChange('name', e.target.value)} placeholder="Welcome Email" />
            </div>
            <div>
              <Label htmlFor="subject">Subject *</Label>
              <Input id="subject" value={form.subject} onChange={(e) => handleChange('subject', e.target.value)} placeholder="Welcome aboard" />
            </div>
            <div>
              <Label htmlFor="html_body">HTML Body *</Label>
              <Textarea id="html_body" value={form.html_body} onChange={(e) => handleChange('html_body', e.target.value)} placeholder="<h1>Hello {{name}}!</h1>..." rows={8} className="font-mono text-xs" />
            </div>
            <div>
              <Label htmlFor="variables">Variables (comma-separated)</Label>
              <Input id="variables" value={form.variables} onChange={(e) => handleChange('variables', e.target.value)} placeholder="name, company, link" />
              <p className="text-xs text-muted-foreground mt-1">Use {'{{variable_name}}'} in the HTML body.</p>
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
