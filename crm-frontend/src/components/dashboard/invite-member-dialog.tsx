'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/firebase/auth-context';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SimpleSelect } from '@/components/ui/searchable-select';
import { sendInvite } from '@/lib/workspace/invites';
import { toast } from 'sonner';
import { Users } from 'lucide-react';
import { TEAM_ROLES } from '@/lib/settings/constants';

export function InviteMemberDialog() {
  const { workspace, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [loading, setLoading] = useState(false);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace || !user || !email.trim()) return;

    setLoading(true);
    try {
      const { getWorkspaceInvites } = await import('@/lib/workspace/invites');
      const existingInvites = await getWorkspaceInvites(workspace.id);
      const emailLower = email.trim().toLowerCase();
      if (existingInvites.some(i => i.email.toLowerCase() === emailLower && i.status === 'pending')) {
        toast.error(`An invitation has already been sent to "${email.trim()}".`);
        setLoading(false);
        return;
      }

      await sendInvite(workspace.id, workspace.name, emailLower, role, user.id);
      toast.success('Invitation sent successfully!');
      setOpen(false);
      setEmail('');
      setRole('member');
    } catch (error) {
      toast.error('Failed to send invitation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Users size={14} className="mr-2" /> Invite Member</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleInvite}>
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Send an invitation email to a new team member. They will be prompted to accept the invite when they log in.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">Role</Label>
              <SimpleSelect
                value={role}
                onValueChange={setRole}
                options={TEAM_ROLES}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !email}>
              {loading ? 'Sending...' : 'Send Invitation'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
