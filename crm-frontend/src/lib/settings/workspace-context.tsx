// @ts-nocheck
'use client';

/**
 * WorkspaceProvider
 *
 * Global settings provider. Fetches workspace settings once after login
 * and makes them available to every page via useWorkspace().
 *
 * Flow:
 *   Login → AuthProvider loads user → WorkspaceProvider fetches settings → App renders
 */
import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { useAuth } from '@/lib/firebase/auth-context';
import {
  getWorkspaceSettings,
  saveWorkspaceSettings,
  clearSettingsCache,
  updateGeneralSettings,
  updateBrandingSettings,
  updateAppearanceSettings,
  updateNotificationSettings,
  updateSecuritySettings,
  updateTeamSettings,
  updateApiSettings,
} from '@/lib/settings/api';
import type {
  WorkspaceSettings,
  GeneralSettings,
  BrandingSettings,
  AppearanceSettings,
  NotificationSettings,
  SecuritySettings,
  TeamSettings,
  ApiSettings,
} from '@/lib/settings/types';
import { DEFAULT_WORKSPACE_SETTINGS } from '@/lib/settings/types';

interface WorkspaceContextType {
  settings: WorkspaceSettings;
  loading: boolean;
  error: string | null;

  // Convenience accessors
  companyName: string;
  logoUrl: string;
  currency: string;
  currencySymbol: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  timezone: string;
  dateFormat: string;
  gstNumber: string;
  panNumber: string;
  bankName: string;
  footerText: string;
  templateStyle: string;
  theme: 'system' | 'light' | 'dark';

  // Section updaters
  updateGeneral: (data: Partial<GeneralSettings>) => Promise<boolean>;
  updateBranding: (data: Partial<BrandingSettings>) => Promise<boolean>;
  updateAppearance: (data: Partial<AppearanceSettings>) => Promise<boolean>;
  updateNotifications: (data: Partial<NotificationSettings>) => Promise<boolean>;
  updateSecurity: (data: Partial<SecuritySettings>) => Promise<boolean>;
  updateTeam: (data: Partial<TeamSettings>) => Promise<boolean>;
  updateApi: (data: Partial<ApiSettings>) => Promise<boolean>;

  // Full replace
  replaceSettings: (settings: WorkspaceSettings) => Promise<boolean>;

  // Refresh from DB
  refresh: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user, workspace, loading: authLoading } = useAuth();
  const [settings, setSettings] = useState<WorkspaceSettings>(DEFAULT_WORKSPACE_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch settings when user is authenticated
  useEffect(() => {
    if (authLoading) return;

    if (!user || !workspace?.id) {
      setSettings(DEFAULT_WORKSPACE_SETTINGS);
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const fetched = await getWorkspaceSettings(workspace.id);
        if (!cancelled) {
          setSettings(fetched);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load settings');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user, workspace?.id, authLoading]);

  // Apply appearance settings (theme, font size) to the document
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;

    // Font size
    const sizeMap: Record<string, string> = {
      small: '14px',
      medium: '16px',
      large: '18px',
    };
    root.style.fontSize = sizeMap[settings.appearance.font_size] || '16px';

    // Compact mode
    if (settings.appearance.compact_mode) {
      root.classList.add('compact-mode');
    } else {
      root.classList.remove('compact-mode');
    }
  }, [settings.appearance.font_size, settings.appearance.compact_mode]);

  const refresh = useCallback(async () => {
    if (!workspace?.id) return;
    clearSettingsCache();
    try {
      setLoading(true);
      const fetched = await getWorkspaceSettings(workspace.id);
      setSettings(fetched);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh settings');
    } finally {
      setLoading(false);
    }
  }, [workspace?.id]);

  const updateGeneral = useCallback(async (data: Partial<GeneralSettings>) => {
    if (!workspace?.id) return false;
    const ok = await updateGeneralSettings(workspace.id, data);
    if (ok) setSettings(prev => ({ ...prev, general: { ...prev.general, ...data } }));
    return ok;
  }, [workspace?.id]);

  const updateBranding = useCallback(async (data: Partial<BrandingSettings>) => {
    if (!workspace?.id) return false;
    const ok = await updateBrandingSettings(workspace.id, data);
    if (ok) setSettings(prev => ({ ...prev, branding: { ...prev.branding, ...data } }));
    return ok;
  }, [workspace?.id]);

  const updateAppearance = useCallback(async (data: Partial<AppearanceSettings>) => {
    if (!workspace?.id) return false;
    const ok = await updateAppearanceSettings(workspace.id, data);
    if (ok) setSettings(prev => ({ ...prev, appearance: { ...prev.appearance, ...data } }));
    return ok;
  }, [workspace?.id]);

  const updateNotifications = useCallback(async (data: Partial<NotificationSettings>) => {
    if (!workspace?.id) return false;
    const ok = await updateNotificationSettings(workspace.id, data);
    if (ok) setSettings(prev => ({ ...prev, notifications: { ...prev.notifications, ...data } }));
    return ok;
  }, [workspace?.id]);

  const updateSecurity = useCallback(async (data: Partial<SecuritySettings>) => {
    if (!workspace?.id) return false;
    const ok = await updateSecuritySettings(workspace.id, data);
    if (ok) setSettings(prev => ({ ...prev, security: { ...prev.security, ...data } }));
    return ok;
  }, [workspace?.id]);

  const updateTeam = useCallback(async (data: Partial<TeamSettings>) => {
    if (!workspace?.id) return false;
    const ok = await updateTeamSettings(workspace.id, data);
    if (ok) setSettings(prev => ({ ...prev, team: { ...prev.team, ...data } }));
    return ok;
  }, [workspace?.id]);

  const updateApi = useCallback(async (data: Partial<ApiSettings>) => {
    if (!workspace?.id) return false;
    const ok = await updateApiSettings(workspace.id, data);
    if (ok) setSettings(prev => ({ ...prev, api: { ...prev.api, ...data } }));
    return ok;
  }, [workspace?.id]);

  const replaceSettings = useCallback(async (newSettings: WorkspaceSettings) => {
    const ok = await saveWorkspaceSettings(newSettings);
    if (ok) setSettings(newSettings);
    return ok;
  }, []);

  // Convenience accessors
  const companyName = settings.general.company_name;
  const logoUrl = settings.branding.logo_url;
  const currency = settings.general.default_currency;
  const currencySymbol = settings.general.currency_symbol;
  const primaryColor = settings.branding.primary_color;
  const secondaryColor = settings.branding.secondary_color;
  const accentColor = settings.branding.accent_color;
  const timezone = settings.general.timezone;
  const dateFormat = settings.branding.date_format;
  const gstNumber = settings.branding.gst_number;
  const panNumber = settings.branding.pan_number;
  const bankName = settings.branding.bank_name;
  const footerText = settings.branding.footer_text;
  const templateStyle = settings.branding.template_style;
  const theme = settings.appearance.theme;

  return (
    <WorkspaceContext.Provider
      value={{
        settings,
        loading,
        error,
        companyName,
        logoUrl,
        currency,
        currencySymbol,
        primaryColor,
        secondaryColor,
        accentColor,
        timezone,
        dateFormat,
        gstNumber,
        panNumber,
        bankName,
        footerText,
        templateStyle,
        theme,
        updateGeneral,
        updateBranding,
        updateAppearance,
        updateNotifications,
        updateSecurity,
        updateTeam,
        updateApi,
        replaceSettings,
        refresh,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

/**
 * useWorkspace - Access workspace settings from any component.
 *
 * Usage:
 *   const { companyName, currency, updateBranding } = useWorkspace();
 */
export function useWorkspace(): WorkspaceContextType {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}

/**
 * useWorkspaceSection - Access a specific settings section.
 *
 * Usage:
 *   const { branding, updateBranding } = useWorkspaceSection('branding');
 */
export function useWorkspaceSection<K extends keyof WorkspaceSettings>(
  section: K
): { data: WorkspaceSettings[K]; update: (data: Partial<WorkspaceSettings[K]>) => Promise<boolean> } {
  const ctx = useWorkspace();

  const updateMap: Record<string, (data: any) => Promise<boolean>> = {
    general: ctx.updateGeneral,
    branding: ctx.updateBranding,
    appearance: ctx.updateAppearance,
    notifications: ctx.updateNotifications,
    security: ctx.updateSecurity,
    team: ctx.updateTeam,
    api: ctx.updateApi,
  };

  return {
    data: ctx.settings[section],
    update: updateMap[section as string] || (async () => false),
  };
}
