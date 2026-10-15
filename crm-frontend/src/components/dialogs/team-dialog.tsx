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
import { updateUser, deleteUser, createInvitation } from '@/lib/firebase/database';
import type { User, UserRole } from '@/lib/db/types';

interface TeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  user?: User | null;
  mode: 'edit' | 'invite';
}

export function TeamDialog({ open, onOpenChange, onSaved, user, mode }: TeamDialogProps) {
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('dev');
  const [editRole, setEditRole] = useState<UserRole>(user?.role || 'dev');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (mode === 'invite') {
        if (!inviteEmail.trim()) {
          toast.error('Email is required');
          setSaving(false);
          return;
        }
        await createInvitation({ email: inviteEmail, role: inviteRole, invited_by: user?.id || '' });
        toast.success('Invitation sent');
      } else if (user) {
        await updateUser(user.id, { role: editRole });
        toast.success('Member updated');
      }
      onSaved();
      onOpenChange(false);
    } catch {
      toast.error('Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!user || !confirm(`Remove ${user.full_name} from the team?`)) return;
    setSaving(true);
    try {
      await deleteUser(user.id);
      toast.success('Member removed');
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
          <DialogTitle>{mode === 'invite' ? 'Invite Member' : 'Edit Member'}</DialogTitle>
          <DialogDescription>
            {mode === 'invite' ? 'Send an invitation to join the workspace.' : `Update ${user?.full_name}'s role.`}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'invite' ? (
            <div className="space-y-4">
              <div>
                <Label htmlFor="email">Email Address</Label>
                <Input id="email" type="email" placeholder="colleague@company.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="role">Role</Label>
                <Select value={inviteRole} onValueChange={(v: UserRole) => setInviteRole(v)}>
                  <SelectTrigger id="role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="dev">Developer</SelectItem>
                    <SelectItem value="client">Client</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label>Name</Label>
                <p className="text-sm font-medium">{user?.full_name}</p>
              </div>
              <div>
                <Label>Email</Label>
                <p className="text-sm font-medium">{user?.email}</p>
              </div>
              <div>
                <Label htmlFor="role">Role</Label>
                <Select value={editRole} onValueChange={(v: UserRole) => setEditRole(v)}>
                  <SelectTrigger id="role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="dev">Developer</SelectItem>
                    <SelectItem value="client">Client</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter className={mode === 'edit' ? 'justify-between' : ''}>
            {mode === 'edit' && (
              <Button type="button" variant="destructive" onClick={handleDelete} disabled={saving}>
                Remove
              </Button>
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : mode === 'invite' ? 'Send Invite' : 'Save'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
