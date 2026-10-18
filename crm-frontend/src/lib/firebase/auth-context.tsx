'use client';

/**
 * Auth provider for the Lentone field-force CRM.
 * Firebase Auth (Google + email/password); flat RTDB model — no orgs.
 * Keeps the same public API the shell (login, header, sidebar) expects.
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
import { ref, set, get } from 'firebase/database';
import { getFirebaseAuth, getFirebaseDatabase } from '@/lib/firebase';
import { brand } from '@/brand.config';
import { isEmailAllowed, getUserRole, AllowedUserConfig } from '@/lib/auth-allowlist';

const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');

export interface CrmUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
}

export interface CrmWorkspace {
  id: string;
  name: string;
  setup_completed: boolean;
}

export interface PendingInvite {
  id: string;
  workspace_id?: string;
  workspace_name: string;
  email: string;
  role: string;
  status: string;
}

interface AuthContextType {
  user: CrmUser | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  workspace: CrmWorkspace | null;
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
  availableWorkspaces: CrmWorkspace[];
  pendingInvites: PendingInvite[];
  switchWorkspace: (workspaceId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function defaultWorkspace(): CrmWorkspace {
  return { id: 'default', name: brand.appName, setup_completed: true };
}

async function fetchAllowedUsers(): Promise<Record<string, AllowedUserConfig> | null> {
  try {
    const db = getFirebaseDatabase();
    const snap = await get(ref(db, 'allowedUsers'));
    return snap.exists() ? snap.val() : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CrmUser | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [workspace, setWorkspace] = useState<CrmWorkspace | null>(null);

  const loadProfile = useCallback(async (fbUser: FirebaseUser) => {
    const dynamicUsers = await fetchAllowedUsers();
    if (!isEmailAllowed(fbUser.email, dynamicUsers)) {
      // Unauthorized user: kick them out immediately
      await firebaseSignOut(getFirebaseAuth());
      setUser(null);
      setWorkspace(null);
      return;
    }

    const assignedRole = getUserRole(fbUser.email, dynamicUsers);
    const fullName = fbUser.displayName ?? (fbUser.email ?? 'User').split('@')[0];

    // Best-effort profile mirror at /users/{uid} (rules allow authed users).
    try {
      const db = getFirebaseDatabase();
      const snap = await get(ref(db, `users/${fbUser.uid}`));
      const now = new Date().toISOString();
      if (!snap.exists()) {
        await set(ref(db, `users/${fbUser.uid}`), {
          email: fbUser.email ?? '',
          full_name: fullName,
          role: assignedRole,
          created_at: now,
          updated_at: now,
        });
      } else if (snap.val()?.role !== assignedRole) {
        await set(ref(db, `users/${fbUser.uid}/role`), assignedRole);
      }
    } catch {
      // Non-fatal (offline / rules).
    }
    setUser({ id: fbUser.uid, email: fbUser.email ?? '', full_name: fullName, role: assignedRole });
    setWorkspace(defaultWorkspace());
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(getFirebaseAuth(), async (fbUser) => {
      setFirebaseUser(fbUser);
      if (!fbUser) {
        setUser(null);
        setWorkspace(null);
        setLoading(false);
        return;
      }
      try {
        await loadProfile(fbUser);
      } finally {
        setLoading(false);
      }
    });
    return unsub;
  }, [loadProfile]);

  const signIn = async (email: string, password: string): Promise<{ error: Error | null }> => {
    const dynamicUsers = await fetchAllowedUsers();
    if (!isEmailAllowed(email, dynamicUsers)) {
      return { error: new Error('Access denied: this email is not authorized to sign in.') };
    }
    try {
      await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e : new Error('Sign-in failed') };
    }
  };

  const signInWithGoogle = async (): Promise<{ error: Error | null }> => {
    try {
      const cred = await signInWithPopup(getFirebaseAuth(), googleProvider);
      const userEmail = cred.user.email;
      const dynamicUsers = await fetchAllowedUsers();
      if (!isEmailAllowed(userEmail, dynamicUsers)) {
        await firebaseSignOut(getFirebaseAuth());
        return {
          error: new Error(`Access denied: Google account (${userEmail || 'unknown'}) is not authorized to access this CRM.`),
        };
      }
      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e : new Error('Google sign-in failed') };
    }
  };

  const signUp = async (email: string, password: string, fullName: string): Promise<{ error: Error | null; hasInvites?: boolean }> => {
    const dynamicUsers = await fetchAllowedUsers();
    if (!isEmailAllowed(email, dynamicUsers)) {
      return { error: new Error('Access denied: registration is restricted to authorized personnel only.') };
    }
    try {
      const cred = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
      try {
        await updateProfile(cred.user, { displayName: fullName });
      } catch {
        // Non-fatal.
      }
      return { error: null, hasInvites: false };
    } catch (e) {
      return { error: e instanceof Error ? e : new Error('Sign-up failed') };
    }
  };

  const signOut = async (): Promise<void> => {
    await firebaseSignOut(getFirebaseAuth());
    setUser(null);
    setWorkspace(null);
  };

  const resetPassword = async (email: string): Promise<{ error: Error | null; success: boolean }> => {
    try {
      await sendPasswordResetEmail(getFirebaseAuth(), email);
      return { error: null, success: true };
    } catch (e) {
      return { error: e instanceof Error ? e : new Error('Reset failed'), success: false };
    }
  };

  const refreshUser = async (): Promise<void> => {
    const current = getFirebaseAuth().currentUser;
    if (current) await loadProfile(current);
  };

  const refreshWorkspace = async (): Promise<void> => {
    setWorkspace(defaultWorkspace());
  };

  const createInitialWorkspace = async (): Promise<void> => {
    // Single-workspace model: nothing to create.
  };

  const switchWorkspace = async (): Promise<void> => {
    // Single-workspace model: nothing to switch.
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        loading,
        workspace,
        workspaceRole: user ? user.role : null,
        workspaceLoading: false,
        signIn,
        signInWithGoogle,
        signUp,
        createInitialWorkspace,
        signOut,
        resetPassword,
        refreshUser,
        refreshWorkspace,
        availableWorkspaces: workspace ? [workspace] : [],
        pendingInvites: [],
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
