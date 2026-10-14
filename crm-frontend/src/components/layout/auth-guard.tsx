"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { LoadingState } from "@/components/ui/card";

export function AuthGuard({ children }: { children: React.ReactNode }): JSX.Element {
  const { fbUser, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!loading && !fbUser) router.replace("/login");
  }, [loading, fbUser, router]);
  if (loading) return <LoadingState label="Checking sign-in…" />;
  if (!fbUser) return <LoadingState label="Redirecting to sign-in…" />;
  return <>{children}</>;
}
