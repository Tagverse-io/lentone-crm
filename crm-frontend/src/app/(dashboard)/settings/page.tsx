'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ThemeSwitcher } from '@/components/dashboard/theme-switcher';
import { useAuth } from '@/lib/firebase/auth-context';
import { brand } from '@/brand.config';
import { toast } from 'sonner';
import { updateProfile } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';
import { DEFAULT_SETTINGS, saveSettings, type AppSettings, type CustomFieldDef, type CustomFieldEntity, type CustomFieldType } from '@/lib/db';
import { useAppSettings } from '@/lib/realtime';
import { LoadingState } from '@/components/ui/states';
import { Plus, Trash2 } from 'lucide-react';

const ENTITY_LABELS: Record<CustomFieldEntity, string> = { clients: 'Clients', leads: 'Leads', products: 'Products' };

export default function SettingsPage() {
  const { user, signOut, refreshUser } = useAuth();
  const { data: loaded, isLoading, refresh } = useAppSettings();
  const [displayName, setDisplayName] = useState(user?.full_name ?? '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [form, setForm] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [categoriesText, setCategoriesText] = useState('');
  const [saving, setSaving] = useState(false);
  const [newField, setNewField] = useState<Record<CustomFieldEntity, { label: string; type: CustomFieldType; options: string }>>({
    clients: { label: '', type: 'text', options: '' },
    leads: { label: '', type: 'text', options: '' },
    products: { label: '', type: 'text', options: '' },
  });

  useEffect(() => {
    if (loaded) {
      setForm({ ...DEFAULT_SETTINGS, ...loaded });
      setCategoriesText((loaded.clientCategories ?? DEFAULT_SETTINGS.clientCategories).join(', '));
    }
  }, [loaded]);

  if (isLoading || !loaded) return <LoadingState label="Loading settings…" />;

  const set = <K extends keyof AppSettings>(k: K, v: AppSettings[K]) => setForm((p) => ({ ...p, [k]: v }));

  const saveProfile = async () => {
    if (!displayName.trim()) {
      toast.error('Name is required');
      return;
    }
    setSavingProfile(true);
    try {
      const current = getFirebaseAuth().currentUser;
      if (current) await updateProfile(current, { displayName: displayName.trim() });
      await refreshUser();
      toast.success('Profile updated');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setSavingProfile(false);
    }
  };

  const saveAll = async () => {
    const cats = categoriesText.split(',').map((c) => c.trim()).filter(Boolean);
    if (cats.length === 0) {
      toast.error('At least one client category is required');
      return;
    }
    if ((form.taxRate ?? 0) < 0 || (form.taxRate ?? 0) > 100) {
      toast.error('Tax rate must be 0–100');
      return;
    }
    if (![10, 25, 50, 100].includes(Number(form.defaultRowsPerPage))) {
      toast.error('Default rows per page must be 10, 25, 50 or 100');
      return;
    }
    setSaving(true);
    try {
      await saveSettings({ ...form, clientCategories: cats });
      toast.success('Settings saved — lists, forms and numbering read from here');
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const addCustomField = (entity: CustomFieldEntity) => {
    const draft = newField[entity];
    if (!draft.label.trim()) {
      toast.error('Field label is required');
      return;
    }
    const key = draft.label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || `field_${Date.now()}`;
    if ((form.customFields[entity] ?? []).some((f) => f.key === key)) {
      toast.error('A field with this key already exists');
      return;
    }
    const def: CustomFieldDef = {
      key,
      label: draft.label.trim(),
      type: draft.type,
      options: draft.type === 'select' ? draft.options.split(',').map((o) => o.trim()).filter(Boolean) : undefined,
    };
    if (draft.type === 'select' && (!def.options || def.options.length === 0)) {
      toast.error('Select fields need comma-separated options');
      return;
    }
    setForm((p) => ({ ...p, customFields: { ...p.customFields, [entity]: [...(p.customFields[entity] ?? []), def] } }));
    setNewField((p) => ({ ...p, [entity]: { label: '', type: 'text', options: '' } }));
  };

  const removeCustomField = (entity: CustomFieldEntity, key: string) => {
    setForm((p) => ({ ...p, customFields: { ...p.customFields, [entity]: (p.customFields[entity] ?? []).filter((f) => f.key !== key) } }));
  };

  const num = (v: string, fallback: number) => (v.trim() === '' || Number.isNaN(Number(v)) ? fallback : Number(v));

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">Profile, company, numbering, defaults, categories and custom fields. Stored in /settings.</p>
        </div>
        <Button onClick={saveAll} disabled={saving}>
          {saving ? 'Saving…' : 'Save settings'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Signed in as {user?.email || '—'}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-1.5 max-w-sm">
            <Label>Display name</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={user?.full_name || 'Your name'} />
          </div>
          <div className="flex gap-2">
            <Button onClick={saveProfile} disabled={savingProfile}>
              {savingProfile ? 'Saving…' : 'Save profile'}
            </Button>
            <Button variant="outline" onClick={signOut}>
              Log out
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Company</CardTitle>
          <CardDescription>Used across documents, PDFs and the header.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Company name</Label>
              <Input value={form.companyName} onChange={(e) => set('companyName', e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>GSTIN</Label>
              <Input value={form.gstin ?? ''} onChange={(e) => set('gstin', e.target.value)} placeholder="32ABCDE1234F1Z5" />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Address</Label>
            <Input value={form.address ?? ''} onChange={(e) => set('address', e.target.value)} />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Logo URL</Label>
              <Input value={form.logo ?? ''} onChange={(e) => set('logo', e.target.value)} placeholder="/logo.png" />
            </div>
            <div className="grid gap-1.5">
              <Label>Currency symbol</Label>
              <Input value={form.currency} onChange={(e) => set('currency', e.target.value)} placeholder="₹" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tax & numbering</CardTitle>
          <CardDescription>Prefixes feed the auto-numbering (e.g. INV-2026-0001).</CardDescription>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label>Tax rate (%)</Label>
            <Input type="number" min={0} max={100} value={form.taxRate} onChange={(e) => set('taxRate', num(e.target.value, 18))} />
          </div>
          <div className="grid gap-1.5">
            <Label>Invoice prefix</Label>
            <Input value={form.invoicePrefix} onChange={(e) => set('invoicePrefix', e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Quotation prefix</Label>
            <Input value={form.quotationPrefix} onChange={(e) => set('quotationPrefix', e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Order prefix</Label>
            <Input value={form.orderPrefix} onChange={(e) => set('orderPrefix', e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Defaults</CardTitle>
          <CardDescription>Applied to every list page, form and schedule.</CardDescription>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label>Default rows per page</Label>
            <Select value={String(form.defaultRowsPerPage)} onValueChange={(v) => set('defaultRowsPerPage', Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 25, 50, 100].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Default task time slot</Label>
            <Input type="time" value={form.defaultTaskSlot} onChange={(e) => set('defaultTaskSlot', e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Low-stock threshold</Label>
            <Input type="number" min={0} value={form.lowStockThreshold} onChange={(e) => set('lowStockThreshold', num(e.target.value, 10))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Work start</Label>
              <Input type="time" value={form.workingHoursStart} onChange={(e) => set('workingHoursStart', e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Work end</Label>
              <Input type="time" value={form.workingHoursEnd} onChange={(e) => set('workingHoursEnd', e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Client categories</CardTitle>
          <CardDescription>Comma-separated. Used by the client form, filters and seed-compatible lists.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-1.5">
          <Label>Categories</Label>
          <Input value={categoriesText} onChange={(e) => setCategoriesText(e.target.value)} placeholder="Hotel, Restaurant, Mall, …" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Custom fields</CardTitle>
          <CardDescription>Admin-defined extra fields (text, number, date, select) for Clients, Leads and Products. They appear in forms, tables and exports.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {(Object.keys(ENTITY_LABELS) as CustomFieldEntity[]).map((entity) => (
            <div key={entity} className="space-y-2">
              <p className="text-sm font-medium">{ENTITY_LABELS[entity]}</p>
              {(form.customFields[entity] ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No custom fields.</p>
              ) : (
                <div className="space-y-1">
                  {(form.customFields[entity] ?? []).map((f) => (
                    <div key={f.key} className="flex items-center justify-between rounded border px-3 py-1.5 text-sm">
                      <span>
                        {f.label} <span className="text-muted-foreground">· {f.type}{f.type === 'select' ? ` (${(f.options ?? []).join(', ')})` : ''}</span>
                      </span>
                      <Button variant="ghost" size="icon" onClick={() => removeCustomField(entity, f.key)} aria-label={`Remove ${f.label}`}>
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-[1fr_130px_1fr_auto] gap-2">
                <Input placeholder="Label" value={newField[entity].label} onChange={(e) => setNewField((p) => ({ ...p, [entity]: { ...p[entity], label: e.target.value } }))} />
                <Select value={newField[entity].type} onValueChange={(v) => setNewField((p) => ({ ...p, [entity]: { ...p[entity], type: v as CustomFieldType } }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="select">Select</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder={newField[entity].type === 'select' ? 'Options, comma,separated' : 'Options (select only)'}
                  disabled={newField[entity].type !== 'select'}
                  value={newField[entity].options}
                  onChange={(e) => setNewField((p) => ({ ...p, [entity]: { ...p[entity], options: e.target.value } }))}
                />
                <Button variant="outline" onClick={() => addCustomField(entity)} aria-label="Add field">
                  <Plus size={16} />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>


      {/* ── PDF / Document branding ── */}
      <Card>
        <CardHeader>
          <CardTitle>PDF &amp; Document branding</CardTitle>
          <CardDescription>Controls the look of exported invoices and quotations.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Template style */}
          <div className="grid sm:grid-cols-3 gap-3">
            {(['modern', 'corporate', 'minimal'] as const).map((style) => {
              const active = (form.templateStyle ?? 'modern') === style;
              const labels: Record<string, string> = { modern: 'Modern', corporate: 'Corporate', minimal: 'Minimal' };
              const desc: Record<string, string> = { modern: 'Clean layout, dark titles, soft gray header', corporate: 'Solid brand header, grid borders', minimal: 'Same clean layout as Modern' };
              return (
                <button
                  key={style}
                  type="button"
                  onClick={() => set('templateStyle', style)}
                  className={`rounded-lg border-2 p-3 text-left transition-all cursor-pointer ${active ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}
                >
                  <p className={`text-sm font-semibold ${active ? 'text-primary' : ''}`}>{labels[style]}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{desc[style]}</p>
                </button>
              );
            })}
          </div>

          {/* Primary color */}
          <div className="grid gap-1.5">
            <Label>Brand / accent color</Label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={form.primaryColor ?? '#2563eb'}
                onChange={(e) => set('primaryColor', e.target.value)}
                className="h-10 w-14 cursor-pointer rounded border border-input bg-background p-0.5"
                aria-label="Primary color picker"
              />
              <Input
                value={form.primaryColor ?? '#2563eb'}
                onChange={(e) => set('primaryColor', e.target.value)}
                placeholder="#2563eb"
                className="max-w-[140px] font-mono text-sm"
              />
              <div
                className="h-10 flex-1 rounded border border-input"
                style={{ background: form.primaryColor ?? '#2563eb' }}
              />
            </div>
          </div>

          {/* Company contact */}
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label>Company phone</Label>
              <Input value={form.companyPhone ?? ''} onChange={(e) => set('companyPhone', e.target.value)} placeholder="+91 98765 43210" />
            </div>
            <div className="grid gap-1.5">
              <Label>Company email</Label>
              <Input value={form.companyEmail ?? ''} onChange={(e) => set('companyEmail', e.target.value)} placeholder="billing@company.com" />
            </div>
            <div className="grid gap-1.5">
              <Label>Website</Label>
              <Input value={form.companyWebsite ?? ''} onChange={(e) => set('companyWebsite', e.target.value)} placeholder="https://company.com" />
            </div>
          </div>

          {/* Bank details */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Bank name</Label>
              <Input value={form.bankName ?? ''} onChange={(e) => set('bankName', e.target.value)} placeholder="HDFC Bank" />
            </div>
            <div className="grid gap-1.5">
              <Label>Account number</Label>
              <Input value={form.bankAccount ?? ''} onChange={(e) => set('bankAccount', e.target.value)} placeholder="0123456789" />
            </div>
            <div className="grid gap-1.5">
              <Label>IFSC code</Label>
              <Input value={form.bankIfsc ?? ''} onChange={(e) => set('bankIfsc', e.target.value)} placeholder="HDFC0001234" />
            </div>
            <div className="grid gap-1.5">
              <Label>UPI ID</Label>
              <Input value={form.upiId ?? ''} onChange={(e) => set('upiId', e.target.value)} placeholder="company@upi" />
            </div>
          </div>

          {/* Default notes & terms */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Default notes</Label>
              <textarea
                value={form.defaultNotes ?? ''}
                onChange={(e) => set('defaultNotes', e.target.value)}
                rows={3}
                placeholder="Thank you for your business…"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Default terms &amp; conditions</Label>
              <textarea
                value={form.defaultTerms ?? ''}
                onChange={(e) => set('defaultTerms', e.target.value)}
                rows={3}
                placeholder="Payment due within 30 days…"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
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
          <p><code className="rounded bg-muted px-1.5 py-0.5 text-xs">GET /api/app/tasks?workerId=</code> — open tasks and deliveries (app polls every 30s)</p>
          <p className="text-muted-foreground">The web UI polls Firebase directly (15s on hot lists, 60s elsewhere) — no WebSockets, no SSE.</p>
        </CardContent>
      </Card>
    </div>
  );
}
