"use client";

import { useEffect, useState } from "react";
import { ref, get, update } from "firebase/database";
import { brand } from "@/brand.config";
import { useAuth } from "@/lib/auth-context";
import { firebaseDb } from "@/lib/firebase";
import type { NotificationPrefs, NotificationType } from "@/lib/types";
import { DEFAULT_PREFS } from "@/lib/types";
import { backend } from "@/lib/backend-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, LoadingState, PageHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/input";

const TYPES: NotificationType[] = [
  "lead_assigned", "lead_won", "followup_due", "followup_overdue",
  "quotation_accepted", "quotation_rejected", "invoice_created", "invoice_overdue",
  "payment_received", "task_assigned", "task_due_soon", "digest",
];

export default function SettingsPage(): JSX.Element {
  const { fbUser, orgUser, orgId } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!fbUser) return;
    get(ref(firebaseDb(), `/orgs/${orgId}/users/${fbUser.uid}/notificationPrefs`)).then((snap) => {
      if (snap.exists()) setPrefs({ ...DEFAULT_PREFS, ...(snap.val() as NotificationPrefs) });
      else if (orgUser?.notificationPrefs) setPrefs({ ...DEFAULT_PREFS, ...orgUser.notificationPrefs });
      setLoading(false);
    });
  }, [fbUser, orgId, orgUser]);

  const save = async (): Promise<void> => {
    if (!fbUser) return;
    setSaving(true);
    setMsg(null);
    try {
      await update(ref(firebaseDb(), `/orgs/${orgId}/users/${fbUser.uid}`), { notificationPrefs: prefs });
      setMsg("Preferences saved.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async (): Promise<void> => {
    setMsg(null);
    try {
      await backend.sendNotification({
        orgId,
        uid: fbUser?.uid ?? "",
        type: "digest",
        title: `Test from ${brand.appName}`,
        body: "This is a test notification (in-app + email per your prefs).",
        link: "/settings",
        email: fbUser?.email ?? undefined,
      });
      setMsg("Test notification sent — check the bell and your inbox (and spam on first run).");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Test failed");
    }
  };

  const toggleMute = (t: NotificationType): void => {
    setPrefs((p) => {
      const muted = new Set(p.mutedTypes ?? []);
      if (muted.has(t)) muted.delete(t);
      else muted.add(t);
      return { ...p, mutedTypes: [...muted] };
    });
  };

  if (loading) return <LoadingState label="Loading settings…" />;

  return (
    <div>
      <PageHeader title="Settings" subtitle={`${brand.appName} · ${brand.currency} · ${brand.locale}`} actions={<Button variant="outline" onClick={sendTest}>Send test notification</Button>} />
      {msg ? <p className="mb-3 text-sm" role="status">{msg}</p> : null}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Notification preferences</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={prefs.inAppEnabled} onChange={(e) => setPrefs({ ...prefs, inAppEnabled: e.target.checked })} />
              In-app notifications
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={prefs.emailEnabled} onChange={(e) => setPrefs({ ...prefs, emailEnabled: e.target.checked })} />
              Email notifications (via Gmail SMTP)
            </label>
            <Field label="Mute specific event types">
              <div className="grid grid-cols-2 gap-1">
                {TYPES.map((t) => (
                  <label key={t} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={!(prefs.mutedTypes ?? []).includes(t)} onChange={() => toggleMute(t)} />
                    {t}
                  </label>
                ))}
              </div>
            </Field>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save preferences"}</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Brand & modules</CardTitle></CardHeader>
          <CardContent className="text-sm">
            <p>App: <strong>{brand.appName}</strong></p>
            <p>Support: {brand.supportEmail}</p>
            <p>Currency: {brand.currency} · Locale: {brand.locale}</p>
            <ul className="mt-2">
              {Object.entries(brand.modules).map(([k, v]) => <li key={k}>{k}: {v ? "on" : "off"}</li>)}
            </ul>
            <p className="mt-2 text-muted-foreground">Change via NEXT_PUBLIC_* env vars — no code edits needed.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
