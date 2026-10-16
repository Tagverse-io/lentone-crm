'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ThemeSwitcher } from '@/components/dashboard/theme-switcher';
import { useAuth } from '@/lib/firebase/auth-context';
import { brand } from '@/brand.config';
import { toast } from 'sonner';
import { updateProfile } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';

export default function SettingsPage() {
  const { user, signOut, refreshUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.full_name ?? '');
  const [saving, setSaving] = useState(false);

  const saveProfile = async () => {
    if (!displayName.trim()) {
      toast.error('Name is required');
      return;
    }
    setSaving(true);
    try {
      const current = getFirebaseAuth().currentUser;
      if (current) await updateProfile(current, { displayName: displayName.trim() });
      await refreshUser();
      toast.success('Profile updated');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Profile, appearance and app integration.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Signed in as {user?.email || '—'}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-1.5">
            <Label>Display name</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={user?.full_name || 'Your name'} />
          </div>
          <div className="flex gap-2">
            <Button onClick={saveProfile} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
            <Button variant="outline" onClick={signOut}>Log out</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>{brand.appName} theme</CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeSwitcher />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Field app integration</CardTitle>
          <CardDescription>Expo app → ERP webhook (Bearer key required, see docs/app-api.md)</CardDescription>
        </CardHeader>
        <CardContent className="text-sm space-y-1.5">
          <p><code className="rounded bg-muted px-1.5 py-0.5 text-xs">POST /api/app/events</code> — login, logout, location, task and delivery updates</p>
          <p><code className="rounded bg-muted px-1.5 py-0.5 text-xs">GET /api/app/tasks?workerId=</code> — open tasks and deliveries</p>
          <p><code className="rounded bg-muted px-1.5 py-0.5 text-xs">GET /api/app/stream?workerId=</code> — live change stream (SSE, 30s poll fallback)</p>
        </CardContent>
      </Card>
    </div>
  );
}
