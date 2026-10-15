'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/firebase/auth-context';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { deleteWorkspace } from '@/lib/workspace/api';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function DeleteWorkspaceDialog() {
  const { workspace, user, refreshUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  if (!workspace || !user) return null;
  if (workspace.owner_id !== user.id) return null; // Only owner can delete

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmName !== workspace.name) return;

    setLoading(true);
    try {
      const success = await deleteWorkspace(workspace.id);
      if (success) {
        toast.success('Workspace deleted successfully');
        setOpen(false);
        await refreshUser();
        window.location.href = '/setup';
      } else {
        toast.error('Failed to delete workspace');
      }
    } catch (error) {
      toast.error('An error occurred while deleting');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive"><Trash2 size={16} className="mr-2" /> Delete Workspace</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleDelete}>
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete Workspace</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the <strong>{workspace.name}</strong> workspace, along with all associated leads, invoices, and settings.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="confirmName">Please type <strong>{workspace.name}</strong> to confirm.</Label>
              <Input
                id="confirmName"
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={loading || confirmName !== workspace.name}>
              {loading ? 'Deleting...' : 'I understand, delete this workspace'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
