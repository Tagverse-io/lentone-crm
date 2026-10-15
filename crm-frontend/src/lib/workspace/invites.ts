'use client';

/** Org-native invites, stored at `/orgs/{orgId}/invites`. Same API as original. */
import { ref, get, set, update, remove, push } from 'firebase/database';
import { database } from '@/lib/firebase/config';

export interface Invite {
  id: string;
  workspace_id: string;
  workspace_name: string;
  email: string;
  role: string;
  status: 'pending' | 'accepted' | 'declined';
  invited_by?: string;
  created_at: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

export async function sendInvite(
  workspaceId: string,
  _workspaceName: string,
  email: string,
  role: string,
  invitedBy: string,
): Promise<Invite> {
  const newRef = push(ref(database, `orgs/${workspaceId}/invites`));
  const invite: Invite = {
    id: newRef.key as string,
    workspace_id: workspaceId,
    workspace_name: _workspaceName || workspaceId,
    email: email.trim().toLowerCase(),
    role,
    status: 'pending',
    invited_by: invitedBy,
    created_at: nowIso(),
  };
  await set(newRef, invite);
  return invite;
}

async function allInvites(): Promise<Array<Invite & { orgId: string }>> {
  const orgs = await get(ref(database, 'orgs'));
  if (!orgs.exists()) return [];
  const out: Array<Invite & { orgId: string }> = [];
  for (const orgId of Object.keys(orgs.val() as Record<string, unknown>)) {
    const snap = await get(ref(database, `orgs/${orgId}/invites`));
    if (!snap.exists()) continue;
    const invs = snap.val() as Record<string, Invite>;
    for (const [id, inv] of Object.entries(invs)) out.push({ ...inv, id, orgId });
  }
  return out;
}

export async function getPendingInvitesByEmail(email: string): Promise<Invite[]> {
  const all = await allInvites();
  return all.filter((inv) => inv.email.toLowerCase() === email.trim().toLowerCase() && inv.status === 'pending');
}

export async function getWorkspaceInvites(workspaceId: string): Promise<Invite[]> {
  const snap = await get(ref(database, `orgs/${workspaceId}/invites`));
  if (!snap.exists()) return [];
  const invs = snap.val() as Record<string, Invite>;
  return Object.entries(invs).map(([id, inv]) => ({ ...inv, id }));
}

export async function updateInviteStatus(inviteId: string, status: 'accepted' | 'declined'): Promise<void> {
  const all = await allInvites();
  const found = all.find((inv) => inv.id === inviteId);
  if (!found) return;
  await update(ref(database, `orgs/${found.orgId}/invites/${inviteId}`), { status });
}

export async function acceptWorkspaceInvite(
  invite: Invite,
  user: { id: string; email?: string; full_name?: string },
): Promise<void> {
  await updateInviteStatus(invite.id, 'accepted');
  const { createWorkspaceMember } = await import('@/lib/workspace/api');
  await createWorkspaceMember(invite.workspace_id, user.id, invite.role, invite.invited_by);
}

export async function deleteInvite(inviteId: string): Promise<void> {
  const all = await allInvites();
  const found = all.find((inv) => inv.id === inviteId);
  if (!found) return;
  await remove(ref(database, `orgs/${found.orgId}/invites/${inviteId}`));
}
