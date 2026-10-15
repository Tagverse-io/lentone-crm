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
import { createFieldAgent, updateFieldAgent } from '@/lib/firebase/database';
import type { FieldAgent, AgentStatus } from '@/lib/db/types';

interface FieldAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  agent?: FieldAgent | null;
}

const defaultForm = {
  name: '',
  status: 'Active' as AgentStatus,
  location: '',
  battery: 100,
  route: '',
};

export function FieldAgentDialog({ open, onOpenChange, onSaved, agent }: FieldAgentDialogProps) {
  const [form, setForm] = useState({ ...defaultForm });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (agent) {
      setForm({
        name: agent.name,
        status: agent.status,
        location: agent.location,
        battery: agent.battery,
        route: agent.route,
      });
    } else {
      setForm({ ...defaultForm });
    }
  }, [agent]);

  function set<K extends keyof typeof defaultForm>(key: K, value: (typeof defaultForm)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Name is required');
      return;
    }
    setSaving(true);
    try {
      if (agent) {
        await updateFieldAgent(agent.id, form);
        toast.success('Agent updated');
      } else {
        await createFieldAgent({ ...form, lastCheckin: new Date().toISOString() });
        toast.success('Agent created');
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
          <DialogTitle>{agent ? 'Edit Agent' : 'Add Agent'}</DialogTitle>
          <DialogDescription>
            {agent ? 'Update the field agent details.' : 'Enter the field agent details.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Alex Turner" />
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={form.status} onValueChange={(v: AgentStatus) => set('status', v)}>
                <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="On Break">On Break</SelectItem>
                  <SelectItem value="Offline">Offline</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="battery">Battery (%)</Label>
              <Input id="battery" type="number" min={0} max={100} value={form.battery} onChange={(e) => set('battery', Number(e.target.value))} />
            </div>
            <div className="col-span-2">
              <Label htmlFor="location">Location</Label>
              <Input id="location" value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="Downtown Office" />
            </div>
            <div className="col-span-2">
              <Label htmlFor="route">Route</Label>
              <Input id="route" value={form.route} onChange={(e) => set('route', e.target.value)} placeholder="Route A - North District" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : agent ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
