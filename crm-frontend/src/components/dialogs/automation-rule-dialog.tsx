// @ts-nocheck
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
import { createAutomationRule, updateAutomationRule } from '@/lib/firebase/database';
import type { AutomationRule } from '@/lib/db/types';
import { useAuth } from '@/lib/firebase/auth-context';

interface AutomationRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  rule?: AutomationRule | null;
}

const defaultForm = {
  name: '',
  trigger: '',
  actions: [''] as string[],
  enabled: true,
  status: 'Active',
};

export function AutomationRuleDialog({ open, onOpenChange, onSaved, rule }: AutomationRuleDialogProps) {
  const { workspace, user } = useAuth();
  const [form, setForm] = useState({ ...defaultForm });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (rule) {
      setForm({
        name: rule.name || '',
        trigger: rule.trigger || '',
        actions: rule.actions ? rule.actions.map(a => a.type) : [rule.action || ''],
        enabled: rule.enabled ?? true,
        status: rule.status || 'Active',
      });
    } else {
      setForm({ ...defaultForm });
    }
  }, [rule]);

  function set<K extends keyof typeof defaultForm>(key: K, value: (typeof defaultForm)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.trigger.trim()) {
      toast.error('Name and trigger are required');
      return;
    }
    setSaving(true);
    try {
      if (rule) {
        await updateAutomationRule(rule.id, form as unknown as Partial<AutomationRule>);
        toast.success('Rule updated');
      } else {
        await createAutomationRule({
          ...form,
          workspace_id: '',
          workspace_id: workspace?.id || '',
          description: '',
          trigger_config: {},
          conditions: [],
          actions: form.actions.map(a => ({ type: a, config: {} }))
        } as unknown as Omit<AutomationRule, 'id' | 'rule_id' | 'created_at' | 'updated_at'>);
        toast.success('Rule created');
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
          <DialogTitle>{rule ? 'Edit Automation Rule' : 'Add Automation Rule'}</DialogTitle>
          <DialogDescription>
            {rule ? 'Update the rule details.' : 'Enter the rule details.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input id="name" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Lead Scoring & Routing" />
            </div>
            <div>
              <Label htmlFor="trigger">Trigger *</Label>
              <Input id="trigger" value={form.trigger} onChange={(e) => set('trigger', e.target.value)} placeholder="Lead Created" />
            </div>
            <div>
              <Label htmlFor="action">Action *</Label>
              <Input id="action" value={form.actions[0] || ''} onChange={(e) => set('actions', [e.target.value])} placeholder="Send Slack notification" />
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={form.status} onValueChange={(v) => set('status', v)}>
                <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Paused">Paused</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : rule ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
