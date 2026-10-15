'use client';

/**
 * Auth provider with the SAME public API as the original workspace-based
 * implementation, but backed by a single org (`NEXT_PUBLIC_DEFAULT_ORG_ID`).
 * Supports Google sign-in plus Firebase email/password. No invites UI flow
 * changes needed: pending email invites are honoured automatically on sign-up.
 */
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  User as FirebaseUser,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile,
} from 'firebase/auth';
import { ref, set, get, child, update } from 'firebase/database';
import { auth, database } from './config';
import { brand } from '@/brand.config';
import { getEnv } from '@/lib/env';
import type { User, Workspace, WorkspaceRole } from '@/lib/db/types';

const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  workspace: Workspace | null;
  workspaceRole: string | null;
  workspaceLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null; hasInvites?: boolean }>;
  createInitialWorkspace: () => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null; success: boolean }>;
  refreshUser: () => Promise<void>;
  refreshWorkspace: () => Promise<void>;
  availableWorkspaces: Workspace[];
  pendingInvites: PendingInvite[];
  switchWorkspace: (workspaceId: string) => Promise<void>;
}

export interface PendingInvite {
  id: string;
  workspace_id?: string;
  workspace_name: string;
  email: string;
  role: string;
  status: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function defaultOrgId(): string {
  try {
    return getEnv().NEXT_PUBLIC_DEFAULT_ORG_ID;
  } catch {
    return 'default';
  }
}

function toWorkspace(orgId: string, ownerId: string): Workspace {
  const now = new Date().toISOString();
  return {
    id: orgId,
    name: brand.appName,
    slug: orgId,
    owner_id: ownerId,
    setup_completed: true,
    setup_step: 5,
    created_at: now,
    updated_at: now,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [workspaceRole, setWorkspaceRole] = useState<string | null>(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const orgId = defaultOrgId();

  const loadMembership = useCallback(async (fbUser: FirebaseUser) => {
    setWorkspaceLoading(true);
    // Denial-tolerant read: brand-new users have no membership yet (rules deny).
    const safeGet = async (path: string): Promise<Record<string, never> | null> => {
      try {
        const snap = await get(ref(database, path));
        return (snap.exists() ? (snap.val() as Record<string, never>) : null);
      } catch {
        return null;
      }
    };
    try {
      const orgUser = await safeGet(`/orgs/${orgId}/users/${fbUser.uid}`) as { role?: string } | null;
      let orgRole: 'admin' | 'member' = 'member';
      if (orgUser) {
        orgRole = (orgUser.role === 'admin' ? 'admin' : 'member');
      } else {
        // First user in a fresh org becomes admin; honour email invites otherwise.
        const allUsers = await safeGet(`/orgs/${orgId}/users`);
        const invites = (await safeGet(`/orgs/${orgId}/invites`)) as Record<string, { email?: string; role?: string; status?: string }> | null;
        const mine = Object.entries(invites ?? {}).find(
          ([, inv]) => (inv.email ?? '').toLowerCase() === (fbUser.email ?? '').toLowerCase() && inv.status === 'pending',
        );
        const isFirst = !allUsers;
        orgRole = mine ? ((mine[1].role === 'admin' ? 'admin' : 'member')) : (isFirst ? 'admin' : 'member');
        const now = new Date().toISOString();
        await set(ref(database, `/orgs/${orgId}/users/${fbUser.uid}`), {
          id: fbUser.uid,
          uid: fbUser.uid,
          email: fbUser.email ?? '',
          displayName: fbUser.displayName ?? (fbUser.email ?? 'User').split('@')[0],
          photoURL: fbUser.photoURL ?? null,
          role: orgRole,
          createdAt: now,
        });
        if (mine) {
          try {
            await update(ref(database, `/orgs/${orgId}/invites/${mine[0]}`), { status: 'accepted' });
          } catch {
            // Non-fatal.
          }
        }
      }

      // Top-level profile mirror (shape the ported UI expects).
      const profile = (await safeGet(`users/${fbUser.uid}`)) as Record<string, string> | null;
      const now = new Date().toISOString();
      const fullName = fbUser.displayName ?? (fbUser.email ?? 'User').split('@')[0];
      if (!profile) {
        try {
          await set(ref(database, `users/${fbUser.uid}`), {
            company_id: orgId,
            email: fbUser.email ?? '',
            full_name: fullName,
            role: orgRole === 'admin' ? 'admin' : 'client',
            avatar_url: fbUser.photoURL ?? null,
            created_at: now,
            updated_at: now,
          });
        } catch {
          // Non-fatal (rules may restrict this write).
        }
      }
      const resolved: User = {
        id: fbUser.uid,
        user_id: fbUser.uid,
        company_id: orgId,
        email: fbUser.email ?? '',
        full_name: (profile?.full_name as string) ?? fullName,
        role: orgRole === 'admin' ? 'admin' : 'client',
        avatar_url: (profile?.avatar_url as string) ?? fbUser.photoURL ?? undefined,
        created_at: (profile?.created_at as string) ?? now,
        updated_at: now,
      };
      setUser(resolved);

      const ownerList = await safeGet(`/orgs/${orgId}/users`) as Record<string, { role?: string }> | null;
      let ownerId = fbUser.uid;
      if (ownerList) {
        const adminEntry = Object.entries(ownerList).find(([, u]) => u.role === 'admin');
        if (adminEntry) ownerId = adminEntry[0];
      }
      const ws = toWorkspace(orgId, ownerId);
      setWorkspace(ws);
      const wsRole: WorkspaceRole = orgRole === 'admin' ? 'admin' : 'employee';
      setWorkspaceRole(wsRole);

      // Pending email invites (drives the invites modal; empty hides it).
      if (fbUser.email) {
        const all = (await safeGet(`/orgs/${orgId}/invites`)) as Record<string, { email?: string; role?: string; status?: string }> | null;
        setPendingInvites(
          Object.entries(all ?? {})
            .filter(([, inv]) => (inv.email ?? '').toLowerCase() === (fbUser.email ?? '').toLowerCase() && inv.status === 'pending')
            .map(([id, inv]) => ({ id, workspace_id: orgId, workspace_name: brand.appName, email: inv.email ?? '', role: inv.role ?? 'member', status: inv.status ?? 'pending' })),
        );
      } else {
        setPendingInvites([]);
      }
    } finally {
      setWorkspaceLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (!fbUser) {
        setUser(null);
        setWorkspace(null);
        setWorkspaceRole(null);
        setPendingInvites([]);
        setLoading(false);
        return;
      }
      try {
        await loadMembership(fbUser);
      } finally {
        setLoading(false);
      }
    });
    return unsub;
  }, [loadMembership]);

  const signIn = async (email: string, password: string): Promise<{ error: Error | null }> => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e : new Error('Sign-in failed') };
    }
  };

  const signInWithGoogle = async (): Promise<{ error: Error | null }> => {
    try {
      await signInWithPopup(auth, googleProvider);
      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e : new Error('Google sign-in failed') };
    }
  };

  const signUp = async (email: string, password: string, fullName: string): Promise<{ error: Error | null; hasInvites?: boolean }> => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      try {
        await updateProfile(cred.user, { displayName: fullName });
      } catch {
        // Non-fatal.
      }
      let hasInvites = false;
      try {
        const invSnap = await get(ref(database, `/orgs/${orgId}/invites`));
        const all = (invSnap.val() ?? {}) as Record<string, { email?: string; status?: string }>;
        hasInvites = Object.values(all).some(
          (inv) => (inv.email ?? '').toLowerCase() === email.toLowerCase() && inv.status === 'pending',
        );
      } catch {
        hasInvites = false;
      }
      return { error: null, hasInvites };
    } catch (e) {
      return { error: e instanceof Error ? e : new Error('Sign-up failed') };
    }
  };

  const signOut = async (): Promise<void> => {
    await firebaseSignOut(auth);
    setUser(null);
    setWorkspace(null);
    setWorkspaceRole(null);
    setPendingInvites([]);
  };

  const resetPassword = async (email: string): Promise<{ error: Error | null; success: boolean }> => {
    try {
      await sendPasswordResetEmail(auth, email);
      return { error: null, success: true };
    } catch (e) {
      return { error: e instanceof Error ? e : new Error('Reset failed'), success: false };
    }
  };

  const refreshUser = async (): Promise<void> => {
    const current = auth.currentUser;
    if (current) await loadMembership(current);
  };

  const refreshWorkspace = async (): Promise<void> => {
    const current = auth.currentUser;
    if (current) {
      const ownerSnap = await get(child(ref(database), `orgs/${orgId}/users`));
      let ownerId = current.uid;
      if (ownerSnap.exists()) {
        const all = ownerSnap.val() as Record<string, { role?: string }>;
        const adminEntry = Object.entries(all).find(([, u]) => u.role === 'admin');
        if (adminEntry) ownerId = adminEntry[0];
      }
      setWorkspace(toWorkspace(orgId, ownerId));
    }
  };

  const createInitialWorkspace = async (): Promise<void> => {
    // Single-org model: nothing to create.
  };

  const switchWorkspace = async (): Promise<void> => {
    // Single-org model: nothing to switch.
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        loading,
        workspace,
        workspaceRole,
        workspaceLoading,
        signIn,
        signInWithGoogle,
        signUp,
        createInitialWorkspace,
        signOut,
        resetPassword,
        refreshUser,
        refreshWorkspace,
        availableWorkspaces: workspace ? [workspace] : [],
        pendingInvites,
        switchWorkspace,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
