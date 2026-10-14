"use client";

// Firebase Auth (Google sign-in primary) + org membership/role check.

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
  type User as FirebaseUser,
} from "firebase/auth";
import { ref, get } from "firebase/database";
import { firebaseAuth, firebaseDb, googleProvider } from "./firebase";
import { getEnv } from "./env";
import type { OrgRole, OrgUser } from "./types";

interface AuthState {
  fbUser: FirebaseUser | null;
  orgUser: OrgUser | null;
  orgId: string;
  role: OrgRole | null;
  loading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [fbUser, setFbUser] = useState<FirebaseUser | null>(null);
  const [orgUser, setOrgUser] = useState<OrgUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const orgId = getEnvSafe();

  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth(), async (u) => {
      setFbUser(u);
      if (!u) {
        setOrgUser(null);
        setLoading(false);
        return;
      }
      try {
        const snap = await get(ref(firebaseDb(), `/orgs/${orgId}/users/${u.uid}`));
        if (snap.exists()) {
          setOrgUser({ ...(snap.val() as object), id: u.uid, uid: u.uid } as OrgUser);
          setError(null);
        } else {
          // First login: auto-provision as member (first user of a fresh org becomes admin via seed or manual promote).
          setOrgUser({
            id: u.uid,
            uid: u.uid,
            email: u.email ?? "",
            displayName: u.displayName ?? (u.email ?? "User").split("@")[0],
            photoURL: u.photoURL ?? undefined,
            role: "member",
            createdAt: new Date().toISOString(),
          });
          setError(null);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load membership");
      } finally {
        setLoading(false);
      }
    });
    return unsub;
  }, [orgId]);

  const value = useMemo<AuthState>(
    () => ({
      fbUser,
      orgUser,
      orgId,
      role: orgUser?.role ?? null,
      loading,
      error,
      signInWithGoogle: async () => {
        setLoading(true);
        setError(null);
        try {
          await signInWithPopup(firebaseAuth(), googleProvider);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Google sign-in failed");
          setLoading(false);
          throw e;
        }
      },
      signOut: async () => {
        await fbSignOut(firebaseAuth());
        setOrgUser(null);
      },
    }),
    [fbUser, orgUser, orgId, loading, error],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function getEnvSafe(): string {
  try {
    return getEnv().NEXT_PUBLIC_DEFAULT_ORG_ID;
  } catch {
    return "default";
  }
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
