'use client';

/**
 * Org-native workspace API. Same export names as the original multi-workspace
 * module, backed by `/orgs/{orgId}` (users, meta, invites). Single-org model:
 * the workspace id IS the org id.
 */
import { ref, get, set, update, remove } from 'firebase/database';
import { database } from '@/lib/firebase/config';
import type { Workspace, WorkspaceMember, WorkspaceRole } from '@/lib/db/types';

export type OrgRole = 'admin' | 'member';

function toWorkspaceRole(role: string): WorkspaceRole {
  return role === 'admin' || role === 'owner' ? 'admin' : 'employee';
}

function nowIso(): string {
  return new Date().toISOString();
}

/** The org workspace record (synthesized; name overrides from meta). */
export async function getWorkspace(workspaceId: string): Promise<Workspace | null> {
  const meta = ((await get(ref(database, `orgs/${workspaceId}/meta`))).val() ?? {}) as Record<string, string>;
  const users = ((await get(ref(database, `orgs/${workspaceId}/users`))).val() ?? {}) as Record<string, { role?: string }>;
  const owner = Object.entries(users).find(([, u]) => u.role === 'admin')?.[0] ?? '';
  const now = nowIso();
  return {
    id: workspaceId,
    name: meta.name ?? workspaceId,
    slug: workspaceId,
    owner_id: owner,
    setup_completed: true,
    setup_step: 5,
    created_at: (meta.created_at as string) ?? now,
    updated_at: now,
  };
}

export async function updateWorkspace(workspaceId: string, updates: Record<string, unknown>): Promise<Workspace | null> {
  const allowed = ['name', 'slug'] as const;
  const patch: Record<string, unknown> = { updated_at: nowIso() };
  for (const k of allowed) {
    if (updates[k] !== undefined) patch[k] = updates[k];
  }
  await update(ref(database, `orgs/${workspaceId}/meta`), patch);
  return getWorkspace(workspaceId);
}

export async function deleteWorkspace(workspaceId: string): Promise<boolean> {
  await remove(ref(database, `orgs/${workspaceId}`));
  return true;
}

/** Upsert an org member. Signature matches the original positional API. */
export async function createWorkspaceMember(
  workspaceId: string,
  userId: string,
  role?: string,
  _invitedBy?: string,
): Promise<void> {
  const orgRole: OrgRole = role === 'admin' || role === 'owner' ? 'admin' : 'member';
  const existing = await get(ref(database, `orgs/${workspaceId}/users/${userId}`));
  if (existing.exists()) {
    await update(ref(database, `orgs/${workspaceId}/users/${userId}`), { role: orgRole });
    return;
  }
  await set(ref(database, `orgs/${workspaceId}/users/${userId}`), {
    id: userId,
    uid: userId,
    email: '',
    displayName: 'Member',
    photoURL: null,
    role: orgRole,
    createdAt: nowIso(),
  });
}

export async function getWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  const snap = await get(ref(database, `orgs/${workspaceId}/users`));
  if (!snap.exists()) return [];
  const users = snap.val() as Record<string, { email?: string; role?: string; createdAt?: string }>;
  const now = nowIso();
  return Object.entries(users).map(([uid, u]) => ({
    id: uid,
    workspace_id: workspaceId,
    user_id: uid,
    role: toWorkspaceRole(u.role ?? 'member'),
    joined_at: u.createdAt ?? now,
    created_at: u.createdAt ?? now,
    updated_at: now,
  }));
}

export async function getWorkspaceMembersWithDetails(
  workspaceId: string,
): Promise<Array<{ id: string; name: string; email: string; role: string }>> {
  const snap = await get(ref(database, `orgs/${workspaceId}/users`));
  if (!snap.exists()) return [];
  const users = snap.val() as Record<string, { email?: string; displayName?: string; role?: string }>;
  return Object.entries(users).map(([uid, u]) => ({
    id: uid,
    name: u.displayName ?? (u.email ?? 'Member').split('@')[0],
    email: u.email ?? '',
    role: u.role ?? 'member',
  }));
}

export async function getUserWorkspaceRole(
  userId: string,
  workspaceId?: string,
): Promise<{ workspace: Workspace; role: WorkspaceRole } | null> {
  const orgId = workspaceId ?? (await defaultOrg());
  if (!orgId) return null;
  const snap = await get(ref(database, `orgs/${orgId}/users/${userId}`));
  if (!snap.exists()) return null;
  const ws = await getWorkspace(orgId);
  if (!ws) return null;
  return { workspace: ws, role: toWorkspaceRole((snap.val() as { role?: string }).role ?? 'member') };
}

async function defaultOrg(): Promise<string | null> {
  const snap = await get(ref(database, 'orgs'));
  if (!snap.exists()) return null;
  return Object.keys(snap.val() as Record<string, unknown>)[0] ?? null;
}

/** Stubs kept for import compatibility (single-org app has one workspace). */
export async function createWorkspace(): Promise<Workspace | null> {
  return null;
}

export async function findWorkspaceByName(): Promise<Workspace | null> {
  return null;
}

export async function getUserWorkspace(userId: string): Promise<Workspace | null> {
  const orgs = await get(ref(database, 'orgs'));
  if (!orgs.exists()) return null;
  for (const orgId of Object.keys(orgs.val() as Record<string, unknown>)) {
    const member = await get(ref(database, `orgs/${orgId}/users/${userId}`));
    if (member.exists()) return getWorkspace(orgId);
  }
  return null;
}

export async function getUserWorkspaces(userId: string): Promise<Workspace[]> {
  const ws = await getUserWorkspace(userId);
  return ws ? [ws] : [];
}

export async function completeWorkspaceSetup(): Promise<boolean> {
  return true;
}

export async function ensureWorkspaceOwnerMember(): Promise<void> {
  // Org admins are recorded at creation time; nothing to backfill.
}

export async function isPlatformAdmin(): Promise<boolean> {
  return false;
}

export function generateWorkspaceSlug(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
}

export async function findCompanyById(): Promise<{ name: string; workspaceId: string } | null> {
  return null;
}

export async function findCompanyGlobalByName(): Promise<{ name: string; workspaceId: string } | null> {
  return null;
}
