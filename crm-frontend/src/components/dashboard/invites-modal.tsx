'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/firebase/auth-context';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { updateInviteStatus, acceptWorkspaceInvite } from '@/lib/workspace/invites';
import { createWorkspaceMember } from '@/lib/workspace/api';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export function InvitesModal() {
  const { user, pendingInvites, refreshUser, switchWorkspace, createInitialWorkspace } = useAuth();
  const [processing, setProcessing] = useState(false);
  const [hidden, setHidden] = useState(false);
  const router = useRouter();

  if (!pendingInvites || pendingInvites.length === 0 || !user || hidden) {
    return null;
  }

  const handleAccept = async (invite: any) => {
    setProcessing(true);
    try {
      await acceptWorkspaceInvite(invite, {
        id: user.id,
        email: user.email,
        full_name: user.full_name
      });
      toast.success('Invitation accepted! Switching workspace...');
      await refreshUser();
      await switchWorkspace(invite.workspace_id);
      // Redirect to dashboard since the user now has a workspace
      router.push('/dashboard');
    } catch (e) {
      toast.error('Failed to accept invitation');
    } finally {
      setProcessing(false);
    }
  };

  const handleDecline = async (inviteId: string) => {
    setProcessing(true);
    try {
      await updateInviteStatus(inviteId, 'declined');
      toast.success('Invitation declined');
      setHidden(true);
      await refreshUser();
    } catch (e) {
      toast.error('Failed to decline invitation');
    } finally {
      setProcessing(false);
    }
  };

  const handleSkipAndCreateWorkspace = async () => {
    setProcessing(true);
    try {
      // Decline all pending invites
      for (const invite of pendingInvites) {
        await updateInviteStatus(invite.id, 'declined');
      }
      toast.info('Invites declined. Setting up your own workspace...');
      await createInitialWorkspace();
      setHidden(true);
      // Setup page will now see workspace is loaded and render the wizard
      router.refresh();
    } catch (e) {
      toast.error('Something went wrong');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={true}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Workspace Invitations</DialogTitle>
          <DialogDescription>
            You have been invited to join the following workspaces. Accept an invite to get started, or skip to create your own workspace.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-3 py-4">
          {pendingInvites.map((invite) => (
            <div key={invite.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium text-sm">{invite.workspace_name}</p>
                <p className="text-xs text-muted-foreground">Invited as {invite.role}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={processing} onClick={() => handleDecline(invite.id)}>
                  Decline
                </Button>
                <Button size="sm" disabled={processing} onClick={() => handleAccept(invite)}>
                  {processing && <Loader2 size={14} className="mr-1 animate-spin" />}
                  Accept
                </Button>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="flex-col sm:flex-col gap-2">
          <div className="w-full border-t pt-3">
            <Button
              variant="ghost"
              className="w-full text-muted-foreground"
              disabled={processing}
              onClick={handleSkipAndCreateWorkspace}
            >
              Skip &amp; Create My Own Workspace
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
