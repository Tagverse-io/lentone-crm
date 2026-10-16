// @ts-nocheck
'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { SearchableSelect, SimpleSelect } from '@/components/ui/searchable-select';
import {
  User, Bell, Shield, Palette, Key, Users, Loader2, Save, Copy, Check,
  Building2, Upload, X, Image as ImageIcon, ChevronDown, Search,
  Download, RotateCcw, AlertTriangle, ExternalLink,
  Globe, Zap, Lock, Mail as MailIcon, Clock, Smartphone, Laptop,
} from 'lucide-react';
import { ThemeSwitcher } from '@/components/dashboard/theme-switcher';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '@/lib/firebase/auth-context';
import { useWorkspace } from '@/lib/settings/workspace-context';
import { brand } from '@/brand.config';
import { getWorkspaceSettings, saveWorkspaceSettings, clearSettingsCache } from '@/lib/settings/api';
import { updateWorkspace, getWorkspaceMembersWithDetails } from '@/lib/workspace/api';
import { WorkspaceSettings, GeneralSettings, BrandingSettings, AppearanceSettings, NotificationSettings, TeamSettings, ApiKey } from '@/lib/settings/types';
import { DEFAULT_WORKSPACE_SETTINGS, DEFAULT_GENERAL_SETTINGS, DEFAULT_BRANDING_SETTINGS, DEFAULT_APPEARANCE_SETTINGS, DEFAULT_NOTIFICATION_SETTINGS, DEFAULT_TEAM_SETTINGS } from '@/lib/settings/types';
import { toast } from 'sonner';
import { InviteMemberDialog } from '@/components/dashboard/invite-member-dialog';
import { NotificationPrefsCard } from '@/components/dashboard/notification-prefs-card';
import { DeleteWorkspaceDialog } from '@/components/dashboard/delete-workspace-dialog';
import {
  TIMEZONES, CURRENCIES, COUNTRIES, STATES_BY_COUNTRY, LANGUAGES,
  DATE_FORMATS, NUMBER_FORMATS, FINANCIAL_YEARS,
  SESSION_TIMEOUTS, TEMPLATE_STYLES, TAX_SYSTEMS, BANKS,
  PREFIX_PRESETS, INVOICE_PREFIX_PRESETS, CREDIT_NOTE_PREFIX_PRESETS, INVOICE_DUE_DAYS, LOGO_POSITIONS,
  SIGNATURE_TEMPLATES, DIGEST_FREQUENCIES, TEAM_ROLES,
  API_PERMISSIONS, API_EXPIRY, THEME_OPTIONS, FONT_SIZES,
} from '@/lib/settings/constants';

interface LoginSession {
  id: string;
  device: string;
  browser: string;
  ip: string;
  location: string;
  last_active: string;
  current: boolean;
}

const TAB_SEARCH_MAP: Record<string, string[]> = {
  general: ['workspace', 'name', 'currency', 'timezone', 'url', 'country', 'state', 'number format', 'financial year'],
  notifications: ['email', 'push', 'slack', 'digest', 'mention', 'notification', 'frequency'],
  security: ['password', '2fa', 'session', 'timeout', 'auth', 'login'],
  appearance: ['theme', 'dark', 'light', 'sidebar', 'compact', 'color', 'font', 'language'],
  branding: ['company', 'logo', 'color', 'tax', 'bank', 'document', 'template', 'gst', 'invoice', 'prefix', 'format', 'currency'],
  team: ['member', 'invite', 'role', 'permission', 'team'],
  api: ['api', 'key', 'token', 'integration', 'webhook', 'permission', 'expiry'],
};

function CollapsibleSection({ title, defaultOpen = true, children, helper }: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  helper?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border rounded-lg">
      <button type="button" onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors">
        <div>
          <span className="text-sm font-medium">{title}</span>
          {helper && <p className="text-xs text-muted-foreground mt-0.5">{helper}</p>}
        </div>
        <ChevronDown size={16} className={`text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-4 pb-4 border-t">{children}</div>}
    </div>
  );
}

function FieldHelper({ text }: { text: string }) {
  return <p className="text-xs text-muted-foreground mt-1">{text}</p>;
}

function PrefixSelect({ value, onValueChange, presets, label }: {
  value: string;
  onValueChange: (v: string) => void;
  presets: { label: string; value: string }[];
  label: string;
}) {
  const isCustom = !presets.some((p) => p.value === value) && value !== '';
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {isCustom ? (
        <div className="flex gap-2">
          <Input value={value} onChange={(e) => onValueChange(e.target.value)} placeholder="Enter custom prefix" />
          <Button variant="ghost" size="sm" onClick={() => onValueChange(presets[0].value)}>Reset</Button>
        </div>
      ) : (
        <SearchableSelect options={presets} value={value}
          onValueChange={(v) => { if (v === 'custom') onValueChange(''); else onValueChange(v); }}
          allowCustom />
      )}
      <FieldHelper text="Used in document numbering" />
    </div>
  );
}

export default function SettingsPage() {
  const { workspace, user, resetPassword } = useAuth();
  const { refresh: refreshWorkspaceSettings } = useWorkspace();
  const isPrivileged = user?.role === 'admin' || (workspace as { owner_id?: string })?.owner_id === user?.id;
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [sendingTest, setSendingTest] = useState<'invoice' | 'quotation' | null>(null);

  const [workspaceName, setWorkspaceName] = useState(brand.appName);
  const [workspaceUrl, setWorkspaceUrl] = useState('my-crm');
  const [defaultCurrency, setDefaultCurrency] = useState('USD');
  const [timezone, setTimezone] = useState('America/New_York');
  const [country, setCountry] = useState('');
  const [state, setState] = useState('');
  const [numberFormat, setNumberFormat] = useState('1,234.56');
  const [financialYear, setFinancialYear] = useState('jan-dec');
  const [currencyPosition, setCurrencyPosition] = useState<'before' | 'after'>('before');
  const [currencyDecimals, setCurrencyDecimals] = useState(2);
  const [unitsText, setUnitsText] = useState('pcs, hrs, days, kg, box, lot');
  const [expenseCategoriesText, setExpenseCategoriesText] = useState('Rent, Salaries, Utilities, Marketing, Travel, Software, Tax, Other');
  const [invoiceDueDays, setInvoiceDueDays] = useState('30');
  const [logoPosition, setLogoPosition] = useState('left');
  const [emailSignature, setEmailSignature] = useState('default');
  const [notifications, setNotifications] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [teamSettings, setTeamSettings] = useState<TeamSettings>(DEFAULT_TEAM_SETTINGS);
  const [appearance, setAppearance] = useState<AppearanceSettings>(DEFAULT_APPEARANCE_SETTINGS);
  const [sessionTimeout, setSessionTimeout] = useState('30');
  const [twoFactor, setTwoFactor] = useState(false);

  const [workspaceMembersList, setWorkspaceMembersList] = useState<Array<{id: string, name: string, email: string, role: string}>>([]);

  const [ipWhitelist, setIpWhitelist] = useState<string[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [copiedKey, setCopiedKey] = useState('');
  const [branding, setBranding] = useState<BrandingSettings>(DEFAULT_BRANDING_SETTINGS);
  const [general, setGeneral] = useState<GeneralSettings>(DEFAULT_GENERAL_SETTINGS);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFooterLogo, setUploadingFooterLogo] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('general');
  const [taxSystem, setTaxSystem] = useState('none');

  const initialState = useRef<string>('');

  const markDirty = useCallback(() => { setHasUnsavedChanges(true); }, []);

  const handleEnable2fa = async (v: boolean) => {
    if (!v) {
      setTwoFactor(false);
      markDirty();
      return;
    }
    // TOTP enrolment needs a server authenticator, which this deployment
    // does not provide — fail fast with a clear message instead of a hang.
    toast.error('Two-factor enrolment is not enabled on this deployment');
  };

  // 2FA enrolment removed: no TOTP authenticator in this deployment
  // (the toggle is stored as a setting only).


  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { if (hasUnsavedChanges) e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (!user?.id) return;
    const loadSettings = async () => {
      try {
        const workspaceId = workspace?.id || user?.company_id;
        if (!workspaceId) return;
        const ws = await getWorkspaceSettings(workspaceId);
        setGeneral(ws.general);
        setBranding(ws.branding);
        setWorkspaceName(ws.general.workspace_name);
        setWorkspaceUrl(ws.general.workspace_url);
        setDefaultCurrency(ws.general.default_currency);
        setTimezone(ws.general.timezone);
        setCountry(ws.general.country);
        setState(ws.general.state);
        setNumberFormat(ws.general.number_format);
        setFinancialYear(ws.general.financial_year);
        setCurrencyPosition(ws.general.currency_position === 'after' ? 'after' : 'before');
        setCurrencyDecimals(typeof ws.general.currency_decimals === 'number' ? ws.general.currency_decimals : 2);
        if (Array.isArray(ws.general.units) && ws.general.units.length > 0) setUnitsText(ws.general.units.join(', '));
        if (Array.isArray((ws.general as { expense_categories?: string[] }).expense_categories) && (ws.general as { expense_categories?: string[] }).expense_categories!.length > 0) setExpenseCategoriesText((ws.general as { expense_categories?: string[] }).expense_categories!.join(', '));
        setInvoiceDueDays(String(ws.branding.invoice_due_days));
        setLogoPosition(ws.branding.logo_position);
        setEmailSignature(ws.branding.email_signature);
        setNotifications({
          email_notifications: ws.notifications.email_notifications,
          push_notifications: ws.notifications.push_notifications,
          slack_integration: ws.notifications.slack_integration,
          weekly_digest: ws.notifications.weekly_digest,
          mention_alerts: ws.notifications.mention_alerts,
          digest_frequency: ws.notifications.digest_frequency,
          slack_webhook_url: ws.notifications.slack_webhook_url,
          invoice_alerts: ws.notifications.invoice_alerts,
          payment_alerts: ws.notifications.payment_alerts,
          project_alerts: ws.notifications.project_alerts,
          support_alerts: ws.notifications.support_alerts,
          test_email: (ws.notifications as { test_email?: string }).test_email || '',
        });
        setTeamSettings({
          default_role: ws.team.default_role,
          allow_invitations: ws.team.allow_invitations,
          members: ws.team.members,
        });
        setAppearance({
          sidebar_collapsed: ws.appearance.sidebar_collapsed,
          theme: ws.appearance.theme,
          compact_mode: ws.appearance.compact_mode,
          accent_color: ws.appearance.accent_color,
          font_size: ws.appearance.font_size,
          language: ws.appearance.language,
          sidebar_style: ws.appearance.sidebar_style,
          primary_color: ws.appearance.primary_color,
          secondary_color: ws.appearance.secondary_color,
        });
        setSessionTimeout(ws.security.session_timeout);
        setTwoFactor(ws.security.two_factor_enabled);
        setApiKeys(ws.api.keys);
        setTaxSystem(ws.branding.tax_system || 'none');
        if (ws.updated_at) setLastUpdated(ws.updated_at);
        
        const actualMembers = await getWorkspaceMembersWithDetails(workspaceId);
        setWorkspaceMembersList(actualMembers);
      } catch { console.warn('Could not load workspace settings'); }
    };
    loadSettings();
  }, [user?.id]);

  useEffect(() => {
    if (!initialState.current) return;
    const current = JSON.stringify({
      workspaceName, workspaceUrl, defaultCurrency, timezone, country, state,
      numberFormat, financialYear, invoiceDueDays, logoPosition,
      emailSignature, notifications, teamSettings, appearance, sessionTimeout,
      twoFactor, apiKeys, branding, taxSystem, expenseCategoriesText,
    });
    setHasUnsavedChanges(current !== initialState.current);
  }, [workspaceName, workspaceUrl, defaultCurrency, timezone, country, state,
    numberFormat, financialYear, invoiceDueDays, logoPosition,
    emailSignature, notifications, teamSettings, appearance, sessionTimeout,
    twoFactor, apiKeys, branding, taxSystem, expenseCategoriesText]);

  const saveSettings = async () => {
    if (!user?.id) return;
    if (!isPrivileged) {
      toast.error('Only owners/admins can change settings');
      return;
    }
    setSaveState('saving');
    setSaving(true);
    try {
      const ws: WorkspaceSettings = {
        general: {
          ...general,
          workspace_name: workspaceName,
          workspace_url: workspaceUrl,
          default_currency: defaultCurrency,
          timezone,
          country,
          state,
          number_format: numberFormat,
          financial_year: financialYear,
          currency_position: currencyPosition,
          currency_decimals: currencyDecimals,
          units: unitsText.split(',').map((u) => u.trim()).filter(Boolean),
          expense_categories: expenseCategoriesText.split(',').map((c) => c.trim()).filter(Boolean),
        },
        branding: {
          ...branding,
          invoice_due_days: Number(invoiceDueDays),
          logo_position: logoPosition,
          email_signature: emailSignature,
          tax_system: taxSystem,
        },
        appearance,
        notifications,
        security: {
          session_timeout: sessionTimeout,
          two_factor_enabled: twoFactor,
          password_strength: 'medium',
          login_notifications: true,
          ip_whitelist: ipWhitelist,
        },
        team: teamSettings,
        api: {
          keys: apiKeys,
        },
        updated_at: new Date().toISOString(),
      };
      const workspaceId = workspace?.id || user?.company_id;
      if (!workspaceId) throw new Error('No workspace ID found');
      await saveWorkspaceSettings(workspaceId, ws);
      
      // Update core workspace data to sync sidebar
      await updateWorkspace(workspaceId, {
        name: workspaceName,
        logo_url: branding.logo_url || null
      });

      clearSettingsCache();
      try { await refreshWorkspaceSettings(); } catch { /* non-fatal */ }
      setSaveState('saved');
      setHasUnsavedChanges(false);
      setLastUpdated(new Date().toISOString());
      toast.success('Settings saved');
      setTimeout(() => setSaveState('idle'), 2000);
    } catch {
      setSaveState('error');
      toast.error('Failed to save settings');
      setTimeout(() => setSaveState('idle'), 3000);
    } finally { setSaving(false); }
  };

  const handleTabChange = (value: string) => {
    if (hasUnsavedChanges) {
      if (!window.confirm('You have unsaved changes. Switch tab without saving?')) return;
      setHasUnsavedChanges(false);
    }
    setActiveTab(value);
  };

  const filteredTabs = searchQuery
    ? Object.entries(TAB_SEARCH_MAP)
        .filter(([, kws]) => kws.some((k) => k.includes(searchQuery.toLowerCase())))
        .map(([tab]) => tab)
    : null;

  function toggleNotification(key: keyof NotificationSettings) {
    if (key === 'test_email') return;
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));
    markDirty();
  }

  function isValidTestEmail(v: string): boolean {
    return /.+@.+\..+/.test(v.trim());
  }

  async function sendTestDocument(kind: 'invoice' | 'quotation') {
    const to = (notifications.test_email || '').trim();
    if (!isValidTestEmail(to)) {
      toast.error('Add a test email in Settings');
      return;
    }
    const workspaceId = workspace?.id || user?.company_id;
    if (!workspaceId) {
      toast.error('No workspace ID found');
      return;
    }
    setSendingTest(kind);
    try {
      const { backendFetch } = await import('@/lib/backend-client');
      await backendFetch<{ ok: boolean }>(`/api/test/send-${kind}`, {
        method: 'POST',
        body: JSON.stringify({ orgId: workspaceId }),
      });
      toast.success(`Test ${kind} sent to ${to} (test mode — no customer emailed)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `Failed to send test ${kind}`);
    } finally {
      setSendingTest(null);
    }
  }

  function generateApiKey() {
    const id = `tv_${Array.from({ length: 16 }, () => Math.random().toString(36)[2]).join('')}`;
    const key = `tv_${Array.from({ length: 32 }, () => Math.random().toString(36)[2]).join('')}`;
    setApiKeys((prev) => [...prev, { id, key, name: `API Key ${prev.length + 1}`, created_at: new Date().toISOString(), permission: 'read', expires_at: '' }]);
    markDirty();
    toast.success('API key generated');
  }

  function revokeApiKey(i: number) {
    setApiKeys((prev) => prev.filter((_, idx) => idx !== i));
    markDirty();
    toast.success('API key revoked');
  }

  function copyToClipboard(key: string) {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(''), 2000);
  }

  /**
   * Logo upload stores a base64 data URL directly in RTDB settings
   * (no Firebase Storage / upload API needed). Images are downscaled
   * to max 512px so settings writes stay small.
   */
  async function handleLogoUpload(file: File, field: 'logo_url' | 'footer_logo_url') {
    const setLoading = field === 'logo_url' ? setUploadingLogo : setUploadingFooterLogo;
    setLoading(true);
    try {
      if (!file.type.startsWith('image/')) {
        toast.error('Please choose an image file');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Logo file too large (max 5MB)');
        return;
      }

      const dataUrl = await readAsDataUrl(file);
      const { dataUrl: resized, width, height } = await downscaleImage(dataUrl, 512);
      setBranding((p) => ({ ...p, [field]: resized }));
      markDirty();
      if (Math.max(width, height) < 300) {
        toast.warning(`Logo is only ${width}×${height}px — under 300px it may look blurry on PDFs. Upload still accepted.`);
      } else {
        toast.success('Logo ready — press Save to apply');
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to read logo');
    } finally {
      setLoading(false);
    }
  }

  function readAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Could not read file'));
      reader.readAsDataURL(file);
    });
  }

  function downscaleImage(dataUrl: string, maxDim: number): Promise<{ dataUrl: string; width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const done = (url: string): void => resolve({ dataUrl: url, width: img.width, height: img.height });
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        if (scale >= 1) {
          done(dataUrl);
          return;
        }
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          done(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        done(canvas.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('Could not decode image'));
      img.src = dataUrl;
    });
  }

  function exportSettings() {
    const data = {
      workspace: { workspaceName, workspaceUrl, defaultCurrency, timezone, country, state, numberFormat, financialYear, invoiceDueDays, logoPosition, emailSignature, currencyPosition, currencyDecimals, unitsText, expenseCategoriesText },
      notifications, teamSettings, appearance, sessionTimeout, twoFactor, branding, taxSystem,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `settings-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    toast.success('Settings exported');
  }

  function importSettings() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string);
          if (data.workspace) {
            const w = data.workspace;
            if (w.workspaceName) setWorkspaceName(w.workspaceName);
            if (w.workspaceUrl) setWorkspaceUrl(w.workspaceUrl);
            if (w.defaultCurrency) setDefaultCurrency(w.defaultCurrency);
            if (w.timezone) setTimezone(w.timezone);
            if (w.country) setCountry(w.country);
            if (w.state) setState(w.state);
            if (w.numberFormat) setNumberFormat(w.numberFormat);
            if (w.financialYear) setFinancialYear(w.financialYear);
            if (w.currencyPosition) setCurrencyPosition(w.currencyPosition);
            if (typeof w.currencyDecimals === 'number') setCurrencyDecimals(w.currencyDecimals);
            if (w.unitsText) setUnitsText(w.unitsText);
            if (typeof w.expenseCategoriesText === 'string') setExpenseCategoriesText(w.expenseCategoriesText);
            if (w.invoiceDueDays) setInvoiceDueDays(w.invoiceDueDays);
            if (w.logoPosition) setLogoPosition(w.logoPosition);
            if (w.emailSignature) setEmailSignature(w.emailSignature);
          }
          if (data.notifications) setNotifications({ ...DEFAULT_NOTIFICATION_SETTINGS, ...data.notifications });
          if (data.teamSettings) setTeamSettings({ ...DEFAULT_TEAM_SETTINGS, ...data.teamSettings });
          if (data.appearance) setAppearance({ ...DEFAULT_APPEARANCE_SETTINGS, ...data.appearance });
          if (data.sessionTimeout) setSessionTimeout(data.sessionTimeout);
          if (typeof data.twoFactor === 'boolean') setTwoFactor(data.twoFactor);
          if (data.branding) setBranding((prev) => ({ ...prev, ...data.branding }));
          if (data.taxSystem) setTaxSystem(data.taxSystem);
          markDirty();
          toast.success('Settings imported - click Save to apply');
        } catch { toast.error('Invalid settings file'); }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  function resetDefaults() {
    if (!window.confirm('Reset all settings to defaults? This cannot be undone.')) return;
    const d = DEFAULT_WORKSPACE_SETTINGS;
    setGeneral(d.general);
    setBranding(d.branding);
    setWorkspaceName(d.general.workspace_name);
    setWorkspaceUrl(d.general.workspace_url);
    setDefaultCurrency(d.general.default_currency);
    setTimezone(d.general.timezone);
    setCountry(d.general.country);
    setState(d.general.state);
    setNumberFormat(d.general.number_format);
    setFinancialYear(d.general.financial_year);
    setCurrencyPosition(d.general.currency_position);
    setCurrencyDecimals(d.general.currency_decimals);
    setUnitsText(d.general.units.join(', '));
    setExpenseCategoriesText(d.general.expense_categories.join(', '));
    setInvoiceDueDays(String(d.branding.invoice_due_days));
    setLogoPosition(d.branding.logo_position);
    setEmailSignature(d.branding.email_signature);
    setNotifications(d.notifications);
    setTeamSettings({ default_role: d.team.default_role, allow_invitations: d.team.allow_invitations, members: [] });
    setAppearance(d.appearance);
    setSessionTimeout(d.security.session_timeout);
    setTwoFactor(d.security.two_factor_enabled);
    setApiKeys([]);
    setTaxSystem(d.branding.tax_system);
    markDirty();
    toast.success('Settings reset to defaults - click Save to apply');
  }

  const showTab = (tab: string) => !filteredTabs || filteredTabs.includes(tab);

  const currencySymbol = useMemo(() => {
    const c = CURRENCIES.find((c) => c.value === defaultCurrency);
    return c?.symbol || '$';
  }, [defaultCurrency]);

  const stateOptions = useMemo(() => country ? (STATES_BY_COUNTRY[country] || []) : [], [country]);

  const taxFields = useMemo(() => {
    switch (taxSystem) {
      case 'gst': return ['gst_number', 'pan_number', 'tax_cgst', 'tax_sgst', 'tax_igst'];
      case 'vat': return ['registration_number', 'tax_vat', 'tax_tin'];
      case 'sales_tax': return ['registration_number', 'tax_tin'];
      case 'custom': return ['gst_number', 'pan_number', 'tax_cgst', 'tax_sgst', 'tax_igst', 'tax_vat', 'tax_tin'];
      default: return [];
    }
  }, [taxSystem]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Settings</h2>
          <p className="text-sm text-muted-foreground">
            Manage your workspace settings
            {lastUpdated && (
              <span className="ml-2 text-xs">
                Last saved {new Date(lastUpdated).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasUnsavedChanges && <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">Unsaved changes</span>}
          {!isPrivileged && <span className="text-xs text-muted-foreground">Only owners/admins can change settings</span>}
          <Button onClick={saveSettings} disabled={saving || !isPrivileged} className="w-full sm:w-auto">
            {saveState === 'saving' && <Loader2 size={16} className="mr-2 animate-spin" />}
            {saveState === 'saved' && <Check size={16} className="mr-2" />}
            {saveState === 'error' && <X size={16} className="mr-2" />}
            {saveState === 'idle' && <Save size={16} className="mr-2" />}
            {saveState === 'saving' ? 'Saving...' : saveState === 'saved' ? 'Saved!' : saveState === 'error' ? 'Error' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search settings..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <div className="overflow-x-auto pb-1">
          <TabsList>
            {showTab('general') && <TabsTrigger value="general" className="flex items-center gap-2"><User size={14} />General</TabsTrigger>}
            {showTab('notifications') && <TabsTrigger value="notifications" className="flex items-center gap-2"><Bell size={14} />Notifications</TabsTrigger>}
            {showTab('security') && <TabsTrigger value="security" className="flex items-center gap-2"><Shield size={14} />Security</TabsTrigger>}
            {showTab('appearance') && <TabsTrigger value="appearance" className="flex items-center gap-2"><Palette size={14} />Appearance</TabsTrigger>}
            {showTab('branding') && <TabsTrigger value="branding" className="flex items-center gap-2"><Building2 size={14} />Branding</TabsTrigger>}
            {showTab('team') && <TabsTrigger value="team" className="flex items-center gap-2"><Users size={14} />Team</TabsTrigger>}
            {showTab('api') && <TabsTrigger value="api" className="flex items-center gap-2"><Key size={14} />API</TabsTrigger>}
          </TabsList>
        </div>

        <TabsContent value="general" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle className="text-lg">Workspace</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Workspace Name</Label>
                  <Input value={workspaceName} onChange={(e) => { setWorkspaceName(e.target.value); markDirty(); }} />
                  <FieldHelper text="Displayed in the sidebar and browser tab" />
                </div>
                <div className="space-y-2">
                  <Label>Workspace URL</Label>
                  <Input value={workspaceUrl} onChange={(e) => { setWorkspaceUrl(e.target.value); markDirty(); }} />
                  <FieldHelper text="Used for your workspace subdomain" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Organization ID</Label>
                <div className="flex gap-2">
                  <Input value={workspace?.id ?? ''} readOnly className="font-mono" aria-label="Organization ID" />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (!workspace?.id) return;
                      navigator.clipboard?.writeText(workspace.id).then(
                        () => toast.success('Organization ID copied'),
                        () => toast.error('Copy failed'),
                      );
                    }}
                  >
                    Copy
                  </Button>
                </div>
                <FieldHelper text="Use this ID for API, MCP and automation calls" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <SearchableSelect options={TIMEZONES} value={timezone} onValueChange={(v) => { setTimezone(v); markDirty(); }} searchPlaceholder="Search timezones..." />
                  <FieldHelper text="Affects scheduling and timestamps" />
                </div>
                <div className="space-y-2">
                  <Label>Country</Label>
                  <SearchableSelect options={COUNTRIES} value={country} onValueChange={(v) => { setCountry(v); setState(''); markDirty(); }} searchPlaceholder="Search countries..." placeholder="Select country..." />
                  <FieldHelper text="Determines tax and regional defaults" />
                </div>
              </div>
              {stateOptions.length > 0 && (
                <div className="space-y-2 max-w-sm">
                  <Label>State</Label>
                  <SearchableSelect options={stateOptions} value={state} onValueChange={(v) => { setState(v); markDirty(); }} searchPlaceholder="Search states..." placeholder="Select state..." />
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Number Format</Label>
                  <SimpleSelect options={NUMBER_FORMATS} value={numberFormat} onValueChange={(v) => { setNumberFormat(v); markDirty(); }} />
                </div>

                <div className="space-y-2">
                  <Label>Financial Year</Label>
                  <SimpleSelect options={FINANCIAL_YEARS} value={financialYear} onValueChange={(v) => { setFinancialYear(v); markDirty(); }} />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-lg">Finance</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Expense Categories</Label>
                <Input value={expenseCategoriesText} onChange={(e) => { setExpenseCategoriesText(e.target.value); markDirty(); }} placeholder="Rent, Salaries, Utilities, …" />
                <FieldHelper text="Comma-separated list used by the Finance expenses form. Names are defaults only — edit freely, no code changes needed." />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-lg">Data Management</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" size="sm" onClick={exportSettings}><Download size={14} className="mr-2" /> Export Settings</Button>
                <Button variant="outline" size="sm" onClick={importSettings}><Upload size={14} className="mr-2" /> Import Settings</Button>
                <Button variant="outline" size="sm" onClick={resetDefaults} className="text-destructive hover:text-destructive"><RotateCcw size={14} className="mr-2" /> Reset to Defaults</Button>
              </div>
              <FieldHelper text="Export your settings as JSON, import from a file, or reset everything to defaults" />
            </CardContent>
          </Card>
          <Card className="border-destructive/50">
            <CardHeader><CardTitle className="text-lg text-destructive">Danger Zone</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2">
                <p className="text-sm text-muted-foreground mb-4">
                  Permanently delete this workspace and all of its data. This action cannot be undone.
                </p>
                <div>
                  <DeleteWorkspaceDialog />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle className="text-lg">Notification Preferences</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <CollapsibleSection title="Project Notifications" helper="Updates about your projects and tasks">
                <div className="space-y-3 pt-3">
                  <div className="flex items-center justify-between">
                    <div><p className="text-sm font-medium">Email Notifications</p><p className="text-xs text-muted-foreground">Receive email updates about project activity</p></div>
                    <Switch checked={notifications.email_notifications} onCheckedChange={() => toggleNotification('email_notifications')} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div><p className="text-sm font-medium">Push Notifications</p><p className="text-xs text-muted-foreground">Browser push notifications for real-time updates</p></div>
                    <Switch checked={notifications.push_notifications} onCheckedChange={() => toggleNotification('push_notifications')} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div><p className="text-sm font-medium">Mention Alerts</p><p className="text-xs text-muted-foreground">Notify when someone mentions you in a comment</p></div>
                    <Switch checked={notifications.mention_alerts} onCheckedChange={() => toggleNotification('mention_alerts')} />
                  </div>
                </div>
              </CollapsibleSection>
              <CollapsibleSection title="System Notifications" helper="Digests and integrations" defaultOpen={false}>
                <div className="space-y-3 pt-3">
                  <div className="space-y-2">
                    <Label>Digest Frequency</Label>
                    <SimpleSelect options={DIGEST_FREQUENCIES} value={notifications.digest_frequency} onValueChange={(v) => { setNotifications((prev) => ({ ...prev, digest_frequency: v })); markDirty(); }} />
                    <FieldHelper text="How often to receive activity summaries" />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Slack Integration</p>
                      <p className="text-xs text-muted-foreground">Send notifications to your Slack workspace</p>
                    </div>
                    {notifications.slack_integration ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-emerald-600 font-medium flex items-center gap-1"><Check size={12} /> Connected</span>
                        <Button variant="ghost" size="sm" onClick={() => toggleNotification('slack_integration')}>Disconnect</Button>
                      </div>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => toggleNotification('slack_integration')}>
                        <ExternalLink size={12} className="mr-1" /> Connect Slack
                      </Button>
                    )}
                  </div>
                </div>
              </CollapsibleSection>
              <CollapsibleSection title="Test Email" helper="Test mode — outbound test mail goes ONLY to this address, never to customers">
                <div className="space-y-3 pt-3">
                  <div className="space-y-2">
                    <Label>Test email recipient</Label>
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      value={notifications.test_email || ''}
                      onChange={(e) => { setNotifications((prev) => ({ ...prev, test_email: e.target.value })); markDirty(); }}
                    />
                    <FieldHelper text="Stored in orgs/{id}/settings. Test invoice/quotation emails are sent only here." />
                    {notifications.test_email && !isValidTestEmail(notifications.test_email) && (
                      <p className="text-xs text-destructive">Enter a valid email address.</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!isValidTestEmail(notifications.test_email || '') || sendingTest !== null}
                      onClick={() => sendTestDocument('invoice')}
                    >
                      {sendingTest === 'invoice' ? 'Sending…' : 'Send test invoice'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!isValidTestEmail(notifications.test_email || '') || sendingTest !== null}
                      onClick={() => sendTestDocument('quotation')}
                    >
                      {sendingTest === 'quotation' ? 'Sending…' : 'Send test quotation'}
                    </Button>
                  </div>
                  {!isValidTestEmail(notifications.test_email || '') && (
                    <p className="text-xs text-muted-foreground">Add a test email in Settings</p>
                  )}
                </div>
              </CollapsibleSection>
            </CardContent>
          </Card>
          <NotificationPrefsCard />
        </TabsContent>

        <TabsContent value="security" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle className="text-lg">Security Settings</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <CollapsibleSection title="Authentication">
                <div className="space-y-3 pt-3">
                  <div className="flex items-center justify-between">
                    <div><p className="text-sm font-medium">Two-Factor Authentication</p><p className="text-xs text-muted-foreground">Add an extra layer of security to your account</p></div>
                    <Switch checked={twoFactor} onCheckedChange={handleEnable2fa} />
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <Label>Password</Label>
                    <div className="flex items-center gap-3">
                      <Button variant="outline" size="sm" onClick={async () => { if (user?.email) { const r = await resetPassword(user.email); if (r.success) toast.success('Password reset email sent'); else toast.error('Failed to send reset email'); } }}>Change Password</Button>
                      <span className="text-xs text-muted-foreground">A reset link will be sent to your email</span>
                    </div>
                  </div>
                  <Separator />
                  <div className="space-y-2 pt-2">
                    <Label>IP Whitelist</Label>
                    <div className="space-y-2">
                      {ipWhitelist.map((ip, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <Input value={ip} readOnly className="font-mono text-sm" />
                          <Button variant="ghost" size="icon" onClick={() => {
                            setIpWhitelist(prev => prev.filter((_, idx) => idx !== i));
                            markDirty();
                          }}>
                            <X size={14} />
                          </Button>
                        </div>
                      ))}
                      <div className="flex items-center gap-2">
                        <Input 
                          placeholder="e.g. 192.168.1.1" 
                          id="new-ip"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const val = e.currentTarget.value.trim();
                              if (val && !ipWhitelist.includes(val)) {
                                setIpWhitelist([...ipWhitelist, val]);
                                e.currentTarget.value = '';
                                markDirty();
                              }
                            }
                          }}
                        />
                        <Button variant="outline" onClick={() => {
                          const input = document.getElementById('new-ip') as HTMLInputElement;
                          const val = input.value.trim();
                          if (val && !ipWhitelist.includes(val)) {
                            setIpWhitelist([...ipWhitelist, val]);
                            input.value = '';
                            markDirty();
                          }
                        }}>Add</Button>
                      </div>
                      <p className="text-xs text-muted-foreground">Only these IP addresses will be allowed to access this workspace. Leave empty to allow all.</p>
                    </div>
                  </div>

                </div>
              </CollapsibleSection>
              <CollapsibleSection title="Sessions" helper="Manage your active sessions" defaultOpen={false}>
                <div className="space-y-3 pt-3">
                  <div className="space-y-2">
                    <Label>Session Timeout</Label>
                    <SimpleSelect options={SESSION_TIMEOUTS} value={sessionTimeout} onValueChange={(v) => { setSessionTimeout(v); markDirty(); }} />
                    <FieldHelper text="Automatically log out after a period of inactivity" />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium flex items-center gap-2"><Laptop size={14} /> Current Session</p>
                      <p className="text-xs text-muted-foreground">Chrome on macOS</p>
                    </div>
                    <span className="text-xs text-emerald-600 font-medium">Active now</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium flex items-center gap-2"><Smartphone size={14} /> Mobile App</p>
                      <p className="text-xs text-muted-foreground">Safari on iPhone</p>
                    </div>
                    <span className="text-xs text-muted-foreground">2 hours ago</span>
                  </div>
                </div>
              </CollapsibleSection>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle className="text-lg">Appearance</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <CollapsibleSection title="Theme">
                <div className="space-y-3 pt-3">
                  <div className="space-y-2">
                    <Label>Theme</Label>
                    <div className="flex gap-2">
                      {THEME_OPTIONS.map((opt) => (
                        <button key={opt.value} type="button"
                          onClick={() => { setAppearance((prev) => ({ ...prev, theme: opt.value as 'system' | 'light' | 'dark' })); markDirty(); }}
                          className={`flex-1 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${appearance.theme === opt.value ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:border-muted-foreground/30'}`}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </CollapsibleSection>
              <CollapsibleSection title="Layout" helper="Sidebar and display options" defaultOpen={false}>
                <div className="space-y-3 pt-3">
                  <div className="flex items-center justify-between">
                    <div><p className="text-sm font-medium">Sidebar Collapsed</p><p className="text-xs text-muted-foreground">Keep sidebar collapsed by default</p></div>
                    <Switch checked={appearance.sidebar_collapsed} onCheckedChange={(v) => { setAppearance((prev) => ({ ...prev, sidebar_collapsed: v })); markDirty(); }} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div><p className="text-sm font-medium">Compact Mode</p><p className="text-xs text-muted-foreground">Reduce spacing for more content on screen</p></div>
                    <Switch checked={appearance.compact_mode} onCheckedChange={(v) => { setAppearance((prev) => ({ ...prev, compact_mode: v })); markDirty(); }} />
                  </div>
                </div>
              </CollapsibleSection>
              <CollapsibleSection title="Text & Language" defaultOpen={false}>
                <div className="space-y-3 pt-3">
                  <div className="space-y-2">
                    <Label>Font Size</Label>
                    <div className="flex gap-2">
                      {FONT_SIZES.map((opt) => (
                        <button key={opt.value} type="button"
                          onClick={() => { setAppearance((prev) => ({ ...prev, font_size: opt.value })); markDirty(); }}
                          className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${appearance.font_size === opt.value ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:border-muted-foreground/30'}`}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Language</Label>
                    <SearchableSelect options={LANGUAGES} value={appearance.language} onValueChange={(v) => { setAppearance((prev) => ({ ...prev, language: v })); markDirty(); }} searchPlaceholder="Search languages..." />
                  </div>
                </div>
              </CollapsibleSection>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="branding" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Company Branding</CardTitle>
              <p className="text-sm text-muted-foreground">These details appear on all PDF documents and invoices</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <CollapsibleSection title="Company Information" helper="Basic company identity">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3">
                  <div className="space-y-2"><Label>Company Name</Label><Input value={general.company_name} onChange={(e) => { setGeneral((p) => ({ ...p, company_name: e.target.value })); markDirty(); }} /><FieldHelper text="Your company display name" /></div>
                  <div className="space-y-2"><Label>Legal Name</Label><Input value={general.legal_name} onChange={(e) => { setGeneral((p) => ({ ...p, legal_name: e.target.value })); markDirty(); }} /><FieldHelper text="Official registered name for legal documents" /></div>
                  <div className="space-y-2"><Label>Tagline</Label><Input value={general.tagline} onChange={(e) => { setGeneral((p) => ({ ...p, tagline: e.target.value })); markDirty(); }} /></div>
                  <div className="space-y-2"><Label>Website</Label><Input value={branding.website} onChange={(e) => { setBranding((p) => ({ ...p, website: e.target.value })); markDirty(); }} /></div>
                  <div className="space-y-2"><Label>Email</Label><Input value={branding.email} onChange={(e) => { setBranding((p) => ({ ...p, email: e.target.value })); markDirty(); }} /></div>
                  <div className="space-y-2"><Label>Phone</Label><Input value={branding.phone} onChange={(e) => { setBranding((p) => ({ ...p, phone: e.target.value })); markDirty(); }} /></div>
                  <div className="space-y-2 sm:col-span-2"><Label>Address</Label><Input value={branding.address} onChange={(e) => { setBranding((p) => ({ ...p, address: e.target.value })); markDirty(); }} /></div>
                </div>
              </CollapsibleSection>
              <CollapsibleSection title="Logo" helper="Company branding visuals" defaultOpen={false}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-3">
                  <div className="space-y-2">
                    <Label>Company Logo</Label>
                    <div className="border-2 border-dashed rounded-lg p-4 text-center hover:border-primary/50 transition-colors">
                      {branding.logo_url ? (
                        <div className="space-y-3">
                          <div className="flex justify-center">
                            <img src={branding.logo_url} alt="Company logo" className="max-h-20 max-w-[200px] object-contain" />
                          </div>
                          <p className="text-xs text-emerald-600 font-medium flex items-center justify-center gap-1"><Check size={12} /> Logo uploaded</p>
                          <div className="flex gap-2 justify-center">
                            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer transition-colors">
                              <Upload size={12} /> Change
                              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f, 'logo_url'); }} />
                            </label>
                            <button type="button" onClick={() => { setBranding((p) => ({ ...p, logo_url: '' })); markDirty(); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors">
                              <X size={12} /> Remove
                            </button>
                          </div>
                        </div>
                      ) : (
                        <label className="cursor-pointer block">
                          {uploadingLogo ? (
                            <div className="py-4"><Loader2 size={24} className="animate-spin mx-auto text-muted-foreground" /><p className="text-xs text-muted-foreground mt-2">Uploading...</p></div>
                          ) : (
                            <div className="py-4">
                              <ImageIcon size={32} className="mx-auto text-muted-foreground/50 mb-2" />
                              <p className="text-sm text-muted-foreground">Click to upload logo</p>
                              <p className="text-xs text-muted-foreground/70 mt-1">PNG, JPG, SVG up to 5MB</p>
                            </div>
                          )}
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f, 'logo_url'); }} />
                        </label>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Footer Logo</Label>
                    <div className="border-2 border-dashed rounded-lg p-4 text-center hover:border-primary/50 transition-colors">
                      {branding.footer_logo_url ? (
                        <div className="space-y-3">
                          <div className="flex justify-center">
                            <img src={branding.footer_logo_url} alt="Footer logo" className="max-h-16 max-w-[160px] object-contain" />
                          </div>
                          <p className="text-xs text-emerald-600 font-medium flex items-center justify-center gap-1"><Check size={12} /> Logo uploaded</p>
                          <div className="flex gap-2 justify-center">
                            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer transition-colors">
                              <Upload size={12} /> Change
                              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f, 'footer_logo_url'); }} />
                            </label>
                            <button type="button" onClick={() => { setBranding((p) => ({ ...p, footer_logo_url: '' })); markDirty(); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors">
                              <X size={12} /> Remove
                            </button>
                          </div>
                        </div>
                      ) : (
                        <label className="cursor-pointer block">
                          {uploadingFooterLogo ? (
                            <div className="py-4"><Loader2 size={24} className="animate-spin mx-auto text-muted-foreground" /><p className="text-xs text-muted-foreground mt-2">Uploading...</p></div>
                          ) : (
                            <div className="py-4">
                              <ImageIcon size={32} className="mx-auto text-muted-foreground/50 mb-2" />
                              <p className="text-sm text-muted-foreground">Click to upload footer logo</p>
                              <p className="text-xs text-muted-foreground/70 mt-1">PNG, JPG, SVG up to 5MB</p>
                            </div>
                          )}
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f, 'footer_logo_url'); }} />
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              </CollapsibleSection>
              <CollapsibleSection title="Brand Colors" helper="Used across all generated documents" defaultOpen={false}>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3">
                  <div className="space-y-2"><Label>Primary Color</Label><div className="flex gap-2"><Input value={branding.primary_color} onChange={(e) => { setBranding((p) => ({ ...p, primary_color: e.target.value })); markDirty(); }} /><input type="color" value={branding.primary_color} onChange={(e) => { setBranding((p) => ({ ...p, primary_color: e.target.value })); markDirty(); }} className="w-9 h-9 rounded border cursor-pointer" /></div></div>
                  <div className="space-y-2"><Label>Secondary Color</Label><div className="flex gap-2"><Input value={branding.secondary_color} onChange={(e) => { setBranding((p) => ({ ...p, secondary_color: e.target.value })); markDirty(); }} /><input type="color" value={branding.secondary_color} onChange={(e) => { setBranding((p) => ({ ...p, secondary_color: e.target.value })); markDirty(); }} className="w-9 h-9 rounded border cursor-pointer" /></div></div>
                  <div className="space-y-2"><Label>Accent Color</Label><div className="flex gap-2"><Input value={branding.accent_color} onChange={(e) => { setBranding((p) => ({ ...p, accent_color: e.target.value })); markDirty(); }} /><input type="color" value={branding.accent_color} onChange={(e) => { setBranding((p) => ({ ...p, accent_color: e.target.value })); markDirty(); }} className="w-9 h-9 rounded border cursor-pointer" /></div></div>
                </div>
              </CollapsibleSection>
              <CollapsibleSection title="Tax Information" helper="Applied to invoices automatically" defaultOpen={false}>
                <div className="space-y-4 pt-3">
                  <div className="space-y-2">
                    <Label>Tax System</Label>
                    <SimpleSelect options={TAX_SYSTEMS} value={taxSystem} onValueChange={(v) => { setTaxSystem(v); markDirty(); }} />
                    <FieldHelper text="Select your tax system to show relevant fields" />
                  </div>
                  {taxFields.includes('gst_number') && (
                    <div className="space-y-2"><Label>GST Number</Label><Input value={branding.gst_number} onChange={(e) => { setBranding((p) => ({ ...p, gst_number: e.target.value })); markDirty(); }} /></div>
                  )}
                  {taxFields.includes('pan_number') && (
                    <div className="space-y-2"><Label>PAN Number</Label><Input value={branding.pan_number} onChange={(e) => { setBranding((p) => ({ ...p, pan_number: e.target.value })); markDirty(); }} /></div>
                  )}
                  {taxFields.includes('registration_number') && (
                    <div className="space-y-2"><Label>Registration Number</Label><Input value={branding.registration_number} onChange={(e) => { setBranding((p) => ({ ...p, registration_number: e.target.value })); markDirty(); }} /></div>
                  )}
                  {taxFields.includes('tax_cgst') && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-2"><Label>CGST (%)</Label><Input type="number" value={branding.tax_cgst} onChange={(e) => { setBranding((p) => ({ ...p, tax_cgst: parseFloat(e.target.value) || 0 })); markDirty(); }} /></div>
                      <div className="space-y-2"><Label>SGST (%)</Label><Input type="number" value={branding.tax_sgst} onChange={(e) => { setBranding((p) => ({ ...p, tax_sgst: parseFloat(e.target.value) || 0 })); markDirty(); }} /></div>
                      <div className="space-y-2"><Label>IGST (%)</Label><Input type="number" value={branding.tax_igst} onChange={(e) => { setBranding((p) => ({ ...p, tax_igst: parseFloat(e.target.value) || 0 })); markDirty(); }} /></div>
                    </div>
                  )}
                  {taxFields.includes('tax_vat') && (
                    <div className="space-y-2 max-w-xs"><Label>VAT (%)</Label><Input type="number" value={branding.tax_vat} onChange={(e) => { setBranding((p) => ({ ...p, tax_vat: parseFloat(e.target.value) || 0 })); markDirty(); }} /></div>
                  )}
                  {taxFields.includes('tax_tin') && (
                    <div className="space-y-2 max-w-xs"><Label>TIN</Label><Input value={branding.tax_tin} onChange={(e) => { setBranding((p) => ({ ...p, tax_tin: e.target.value })); markDirty(); }} /></div>
                  )}
                </div>
              </CollapsibleSection>
              <CollapsibleSection title="Bank Details" helper="For payment processing" defaultOpen={false}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3">
                  <div className="space-y-2">
                    <Label>Bank Name</Label>
                    <SearchableSelect options={BANKS} value={branding.bank_name} onValueChange={(v) => { setBranding((p) => ({ ...p, bank_name: v })); markDirty(); }} searchPlaceholder="Search banks..." allowCustom placeholder="Select or type bank..." />
                  </div>
                  <div className="space-y-2"><Label>Account Number</Label><Input value={branding.bank_account} onChange={(e) => { setBranding((p) => ({ ...p, bank_account: e.target.value })); markDirty(); }} /></div>
                  <div className="space-y-2"><Label>IFSC Code</Label><Input value={branding.bank_ifsc} onChange={(e) => { setBranding((p) => ({ ...p, bank_ifsc: e.target.value })); markDirty(); }} /></div>
                  <div className="space-y-2"><Label>SWIFT Code</Label><Input value={branding.bank_swift} onChange={(e) => { setBranding((p) => ({ ...p, bank_swift: e.target.value })); markDirty(); }} /></div>
                  <div className="space-y-2"><Label>UPI ID</Label><Input value={branding.upi_id} onChange={(e) => { setBranding((p) => ({ ...p, upi_id: e.target.value })); markDirty(); }} /></div>
                </div>
              </CollapsibleSection>
              <CollapsibleSection title="Document Settings" helper="Prefixes and formatting for generated documents" defaultOpen={false}>
                <div className="space-y-4 pt-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <PrefixSelect value={branding.quote_prefix} onValueChange={(v) => { setBranding((p) => ({ ...p, quote_prefix: v })); markDirty(); }} presets={PREFIX_PRESETS} label="Quote Prefix" />
                    <PrefixSelect value={branding.invoice_prefix} onValueChange={(v) => { setBranding((p) => ({ ...p, invoice_prefix: v })); markDirty(); }} presets={INVOICE_PREFIX_PRESETS} label="Invoice Prefix" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <PrefixSelect value={branding.credit_note_prefix} onValueChange={(v) => { setBranding((p) => ({ ...p, credit_note_prefix: v })); markDirty(); }} presets={CREDIT_NOTE_PREFIX_PRESETS} label="Credit Note Prefix" />
                  </div>
                  <Separator />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Currency</Label>
                      <SearchableSelect options={CURRENCIES.map((c) => ({ label: c.label, value: c.value }))} value={defaultCurrency} onValueChange={(v) => {
                        const cur = CURRENCIES.find((c) => c.value === v);
                        setDefaultCurrency(v);
                        setGeneral((p) => ({ ...p, default_currency: v, currency_symbol: cur?.symbol || '$' }));
                        markDirty();
                      }} searchPlaceholder="Search currencies..." />
                    </div>
                    <div className="space-y-2">
                      <Label>Currency Symbol</Label>
                      <Input value={currencySymbol} readOnly className="bg-muted" />
                      <FieldHelper text="Auto-filled from currency selection" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Symbol Position</Label>
                      <SimpleSelect options={[{ label: 'Before amount ($100)', value: 'before' }, { label: 'After amount (100 $)', value: 'after' }]} value={currencyPosition} onValueChange={(v) => { setCurrencyPosition(v as 'before' | 'after'); markDirty(); }} />
                    </div>
                    <div className="space-y-2">
                      <Label>Decimals</Label>
                      <SimpleSelect options={[{ label: '0', value: '0' }, { label: '2', value: '2' }, { label: '3', value: '3' }]} value={String(currencyDecimals)} onValueChange={(v) => { setCurrencyDecimals(Number(v)); markDirty(); }} />
                      <FieldHelper text="Number grouping (e.g. INR lakh) follows the Number Format" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Units</Label>
                      <Input value={unitsText} onChange={(e) => { setUnitsText(e.target.value); markDirty(); }} placeholder="pcs, hrs, days, kg, box, lot" />
                      <FieldHelper text="Comma-separated units for quote/invoice line items" />
                    </div>
                    <div className="space-y-2">
                      <Label>Default Payment Terms</Label>
                      <Input value={branding.default_payment_terms || ''} onChange={(e) => { setBranding((p) => ({ ...p, default_payment_terms: e.target.value })); markDirty(); }} placeholder="Net 30" />
                      <FieldHelper text="Applied to new invoices automatically" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Date Format</Label>
                      <SimpleSelect options={DATE_FORMATS} value={branding.date_format} onValueChange={(v) => { setBranding((p) => ({ ...p, date_format: v })); markDirty(); }} />
                    </div>
                    <div className="space-y-2">
                      <Label>Invoice Due Days</Label>
                      <SimpleSelect options={INVOICE_DUE_DAYS} value={invoiceDueDays} onValueChange={(v) => { setInvoiceDueDays(v); markDirty(); }} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Logo Position</Label>
                      <SimpleSelect options={LOGO_POSITIONS} value={logoPosition} onValueChange={(v) => { setLogoPosition(v); markDirty(); }} />
                    </div>
                    <div className="space-y-2">
                      <Label>Email Signature Template</Label>
                      <SimpleSelect options={SIGNATURE_TEMPLATES} value={emailSignature} onValueChange={(v) => { setEmailSignature(v); markDirty(); }} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Footer Text</Label>
                    <Input value={branding.footer_text} onChange={(e) => { setBranding((p) => ({ ...p, footer_text: e.target.value })); markDirty(); }} />
                    <FieldHelper text="Appears at the bottom of every generated document" />
                  </div>
                  <div className="space-y-2">
                    <Label>Default Notes</Label>
                    <textarea className="w-full min-h-[80px] rounded-md border bg-background px-3 py-2 text-sm" value={branding.default_notes} onChange={(e) => { setBranding((p) => ({ ...p, default_notes: e.target.value })); markDirty(); }} />
                  </div>
                  <div className="space-y-2">
                    <Label>Default Terms &amp; Conditions</Label>
                    <textarea className="w-full min-h-[80px] rounded-md border bg-background px-3 py-2 text-sm" value={branding.default_terms} onChange={(e) => { setBranding((p) => ({ ...p, default_terms: e.target.value })); markDirty(); }} />
                  </div>
                </div>
              </CollapsibleSection>
              <CollapsibleSection title="Template Style" helper="Visual style for generated PDF documents" defaultOpen={false}>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3">
                  {TEMPLATE_STYLES.map((style) => (
                    <button key={style.value} type="button"
                      onClick={() => { setBranding((p) => ({ ...p, template_style: style.value })); markDirty(); }}
                      className={`p-4 rounded-lg border text-left transition-all ${branding.template_style === style.value ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:border-muted-foreground/30'}`}>
                      <div className="mb-2">
                        <div className={`h-8 rounded ${style.value === 'modern' ? 'bg-gradient-to-r from-blue-500 to-purple-500' : style.value === 'corporate' ? 'bg-slate-700' : 'bg-gray-200'}`} />
                      </div>
                      <p className="text-sm font-medium">{style.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{style.description}</p>
                    </button>
                  ))}
                </div>
              </CollapsibleSection>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Team Management</CardTitle>
                <InviteMemberDialog />
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <CollapsibleSection title="Team Settings">
                <div className="space-y-3 pt-3">
                  <div className="space-y-2">
                    <Label>Default Role for New Members</Label>
                    <SimpleSelect options={TEAM_ROLES} value={teamSettings.default_role} onValueChange={(v) => { setTeamSettings((prev) => ({ ...prev, default_role: v })); markDirty(); }} />
                    <FieldHelper text="Role assigned to newly invited team members" />
                  </div>
                  <div className="flex items-center justify-between">
                    <div><p className="text-sm font-medium">Allow Invitations</p><p className="text-xs text-muted-foreground">Let members invite new users to the workspace</p></div>
                    <Switch checked={teamSettings.allow_invitations} onCheckedChange={(v) => { setTeamSettings((prev) => ({ ...prev, allow_invitations: v })); markDirty(); }} />
                  </div>
                </div>
              </CollapsibleSection>
              <CollapsibleSection title="Members" helper="People in this workspace" defaultOpen={false}>
                <div className="space-y-3 pt-3">
                  {workspaceMembersList.length === 0 ? (
                    <div className="text-center py-6">
                      <Users size={32} className="mx-auto text-muted-foreground/50 mb-2" />
                      <p className="text-sm text-muted-foreground">No team members yet</p>
                      <p className="text-xs text-muted-foreground/70 mt-1">Invite people to start collaborating</p>
                    </div>
                  ) : (
                    workspaceMembersList.map((m) => (
                      <div key={m.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">{m.name.charAt(0)}</div>
                          <div><p className="text-sm font-medium">{m.name}</p><p className="text-xs text-muted-foreground">{m.email}</p></div>
                        </div>
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">{m.role}</span>
                      </div>
                    ))
                  )}
                </div>
              </CollapsibleSection>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">API Keys</CardTitle>
                <Button onClick={generateApiKey}><Key size={16} className="mr-2" /> Generate New Key</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">Manage API keys for integrations and third-party access</p>
              {apiKeys.length === 0 ? (
                <div className="text-center py-8">
                  <Key size={32} className="mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">No API keys generated yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {apiKeys.map((k, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-mono truncate">{k.key}</p>
                          <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={() => copyToClipboard(k.key)}>
                            {copiedKey === k.key ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                          </Button>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-muted-foreground">{k.name}</span>
                          <span className="text-xs text-muted-foreground">Created {new Date(k.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive flex-shrink-0" onClick={() => revokeApiKey(i)}>Revoke</Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-lg text-destructive flex items-center gap-2">
            <AlertTriangle size={18} /> Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg border border-destructive/20">
            <div><p className="text-sm font-medium">Delete Workspace</p><p className="text-xs text-muted-foreground">Permanently delete this workspace and all its data</p></div>
            <Button variant="destructive" size="sm">Delete</Button>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg border border-destructive/20">
            <div><p className="text-sm font-medium">Transfer Ownership</p><p className="text-xs text-muted-foreground">Transfer workspace ownership to another team member</p></div>
            <Button variant="outline" size="sm">Transfer</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
