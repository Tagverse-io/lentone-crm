'use client';

import { useEffect, useState } from 'react';
import { ref, get, update } from 'firebase/database';
import { database } from '@/lib/firebase/config';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useAuth } from '@/lib/firebase/auth-context';
import { backend } from '@/lib/backend-client';
import { brand } from '@/brand.config';
import type { NotificationPrefs, NotificationType } from '@/lib/types';
import { DEFAULT_PREFS } from '@/lib/types';

const TYPES: NotificationType[] = [
  'lead_assigned', 'lead_won', 'followup_due', 'followup_overdue',
  'quotation_accepted', 'quotation_rejected', 'invoice_created', 'invoice_overdue',
  'payment_received', 'task_assigned', 'task_due_soon', 'digest',
];

/** Delivery preferences for the Gmail + in-app notification fan-out. */
export function NotificationPrefsCard() {
  const { firebaseUser, user, workspace } = useAuth();
  const orgId = workspace?.id ?? null;
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (!firebaseUser || !orgId) return;
    get(ref(database, `/orgs/${orgId}/users/${firebaseUser.uid}/notificationPrefs`))
      .then((snap) => {
        if (snap.exists()) setPrefs({ ...DEFAULT_PREFS, ...(snap.val() as NotificationPrefs) });
      })
      .catch(() => undefined);
  }, [firebaseUser, orgId]);

  const save = async () => {
    if (!firebaseUser || !orgId) return;
    setSaving(true);
    try {
      await update(ref(database, `/orgs/${orgId}/users/${firebaseUser.uid}`), { notificationPrefs: prefs });
      toast.success('Notification preferences saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    if (!firebaseUser || !orgId) return;
    setTesting(true);
    try {
      await backend.sendNotification({
        orgId,
        uid: firebaseUser.uid,
        type: 'digest',
        title: `Test from ${brand.appName}`,
        body: 'If you see this in the bell and by email, notifications are wired correctly. Check spam on first run.',
        link: '/settings',
        email: user?.email ?? firebaseUser.email ?? undefined,
      });
      toast.success('Test notification sent — check the bell and your inbox');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Test failed');
    } finally {
      setTesting(false);
    }
  };

  const toggleMute = (t: NotificationType) => {
    setPrefs((p) => {
      const muted = new Set(p.mutedTypes ?? []);
      if (muted.has(t)) muted.delete(t);
      else muted.add(t);
      return { ...p, mutedTypes: [...muted] };
    });
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Delivery Preferences</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div><p className="text-sm font-medium">In-app notifications</p><p className="text-xs text-muted-foreground">Bell icon in the header</p></div>
          <Switch checked={prefs.inAppEnabled} onCheckedChange={(v) => setPrefs({ ...prefs, inAppEnabled: v })} />
        </div>
        <div className="flex items-center justify-between">
          <div><p className="text-sm font-medium">Email notifications</p><p className="text-xs text-muted-foreground">Sent via Gmail SMTP, one per event</p></div>
          <Switch checked={prefs.emailEnabled} onCheckedChange={(v) => setPrefs({ ...prefs, emailEnabled: v })} />
        </div>
        <div className="space-y-2">
          <Label>Enabled event types</Label>
          <div className="grid grid-cols-2 gap-1">
            {TYPES.map((t) => (
              <label key={t} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!(prefs.mutedTypes ?? []).includes(t)} onChange={() => toggleMute(t)} />
                {t}
              </label>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save preferences'}</Button>
          <Button variant="outline" onClick={sendTest} disabled={testing}>{testing ? 'Sending…' : 'Send test'}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
