"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { brand } from "@/brand.config";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, LoadingState } from "@/components/ui/card";

export default function LoginPage(): JSX.Element {
  const { fbUser, loading, error, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && fbUser) router.replace("/dashboard");
  }, [loading, fbUser, router]);

  if (loading) return <LoadingState label="Checking sign-in…" />;

  const onGoogle = async (): Promise<void> => {
    setBusy(true);
    setLocalError(null);
    try {
      await signInWithGoogle();
      router.replace("/dashboard");
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Google sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle style={{ color: "var(--brand-primary)" }}>{brand.appName}</CardTitle>
          <p className="text-sm text-muted-foreground">Sign in with Google to continue.</p>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Button onClick={onGoogle} disabled={busy}>
            {busy ? "Signing in…" : "Continue with Google"}
          </Button>
          {error || localError ? (
            <p className="text-sm text-destructive" role="alert">{localError ?? error}</p>
          ) : null}
          <p className="text-xs text-muted-foreground">Need help? Contact {brand.supportEmail}.</p>
        </CardContent>
      </Card>
    </main>
  );
}
