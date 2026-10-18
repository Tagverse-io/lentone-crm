// @ts-nocheck
/**
 * Workspace Settings API
 *
 * All settings operations go through this module.
 * Storage: Firebase Realtime Database → system_settings/workspace
 *
 * Usage (client-side):
 *   import { getWorkspaceSettings, updateWorkspaceSection } from '@/lib/settings/api';
 */
import { ref, get, set } from 'firebase/database';
import { database } from '@/lib/firebase/config';
import { deepClean } from '@/lib/db';
import {
  WorkspaceSettings,
  DEFAULT_WORKSPACE_SETTINGS,
  GeneralSettings,
  BrandingSettings,
  AppearanceSettings,
  NotificationSettings,
  SecuritySettings,
  TeamSettings,
  ApiSettings,
} from './types';

// Cache mapped by workspaceId
let cachedSettingsMap: Record<string, WorkspaceSettings> = {};
let fetchPromiseMap: Record<string, Promise<WorkspaceSettings>> = {};

function getSettingsPath(workspaceId: string) {
  return `orgs/${workspaceId}/settings`;
}
// ─── Cache ──────────────────────────────────────────────────────────

// ─── Core Read/Write ────────────────────────────────────────────────

export async function getWorkspaceSettings(workspaceId: string): Promise<WorkspaceSettings> {
  if (!workspaceId) return { ...DEFAULT_WORKSPACE_SETTINGS };
  if (cachedSettingsMap[workspaceId]) return cachedSettingsMap[workspaceId];

  // Deduplicate concurrent fetches
  if (fetchPromiseMap[workspaceId]) return fetchPromiseMap[workspaceId];

  fetchPromiseMap[workspaceId] = (async () => {
    try {
      const settingsRef = ref(database, getSettingsPath(workspaceId));
      const snapshot = await get(settingsRef);

      if (snapshot.exists()) {
        const data = snapshot.val();
        cachedSettingsMap[workspaceId] = deepMerge(DEFAULT_WORKSPACE_SETTINGS, data);
      } else {
        // Since we are scoping to workspace, if missing we just return default
        // Legacy migration could be added here if needed per workspace
        cachedSettingsMap[workspaceId] = { ...DEFAULT_WORKSPACE_SETTINGS };
      }
    } catch (error) {
      console.error('Error fetching workspace settings:', error);
      cachedSettingsMap[workspaceId] = { ...DEFAULT_WORKSPACE_SETTINGS };
    }
    return cachedSettingsMap[workspaceId];
  })();

  try {
    const result = await fetchPromiseMap[workspaceId];
    return result;
  } finally {
    delete fetchPromiseMap[workspaceId];
  }
}

export async function saveWorkspaceSettings(workspaceId: string, settings: WorkspaceSettings): Promise<boolean> {
  if (!workspaceId) return false;
  try {
    const settingsRef = ref(database, getSettingsPath(workspaceId));
    const payload = deepClean({ ...settings, updated_at: new Date().toISOString() });
    await set(settingsRef, payload);
    cachedSettingsMap[workspaceId] = payload;
    return true;
  } catch (error) {
    console.error('Error saving workspace settings:', error);
    return false;
  }
}

export function clearSettingsCache(workspaceId?: string): void {
  if (workspaceId) {
    delete cachedSettingsMap[workspaceId];
    delete fetchPromiseMap[workspaceId];
  } else {
    cachedSettingsMap = {};
    fetchPromiseMap = {};
  }
}

// ─── Section Updates ────────────────────────────────────────────────

export async function updateGeneralSettings(workspaceId: string, data: Partial<GeneralSettings>): Promise<boolean> {
  const settings = await getWorkspaceSettings(workspaceId);
  settings.general = { ...settings.general, ...data };
  return saveWorkspaceSettings(workspaceId, settings);
}

export async function updateBrandingSettings(workspaceId: string, data: Partial<BrandingSettings>): Promise<boolean> {
  const settings = await getWorkspaceSettings(workspaceId);
  settings.branding = { ...settings.branding, ...data };
  return saveWorkspaceSettings(workspaceId, settings);
}

export async function updateAppearanceSettings(workspaceId: string, data: Partial<AppearanceSettings>): Promise<boolean> {
  const settings = await getWorkspaceSettings(workspaceId);
  settings.appearance = { ...settings.appearance, ...data };
  return saveWorkspaceSettings(workspaceId, settings);
}

export async function updateNotificationSettings(workspaceId: string, data: Partial<NotificationSettings>): Promise<boolean> {
  const settings = await getWorkspaceSettings(workspaceId);
  settings.notifications = { ...settings.notifications, ...data };
  return saveWorkspaceSettings(workspaceId, settings);
}

export async function updateSecuritySettings(workspaceId: string, data: Partial<SecuritySettings>): Promise<boolean> {
  const settings = await getWorkspaceSettings(workspaceId);
  settings.security = { ...settings.security, ...data };
  return saveWorkspaceSettings(workspaceId, settings);
}

export async function updateTeamSettings(workspaceId: string, data: Partial<TeamSettings>): Promise<boolean> {
  const settings = await getWorkspaceSettings(workspaceId);
  settings.team = { ...settings.team, ...data };
  return saveWorkspaceSettings(workspaceId, settings);
}

export async function updateApiSettings(workspaceId: string, data: Partial<ApiSettings>): Promise<boolean> {
  const settings = await getWorkspaceSettings(workspaceId);
  settings.api = { ...settings.api, ...data };
  return saveWorkspaceSettings(workspaceId, settings);
}

// ─── Convenience Accessors (for PDF, Email, etc.) ──────────────────

/**
 * Get settings as a flat CompanySettings object for PDF engine compatibility.
 */
export async function getCompanySettingsFlat(): Promise<Record<string, any>> {
  const s = await getWorkspaceSettings();
  return {
    ...s.general,
    ...s.branding,
    ...s.appearance,
    template_style: s.branding.template_style,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────

function deepMerge(target: any, source: any): any {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === 'object'
    ) {
      result[key] = deepMerge(target[key], source[key]);
    } else if (source[key] !== undefined) {
      result[key] = source[key];
    }
  }
  return result;
}

function migrateLegacySettings(legacy: any): WorkspaceSettings {
  return {
    general: {
      ...DEFAULT_WORKSPACE_SETTINGS.general,
      company_name: legacy.company_name || DEFAULT_WORKSPACE_SETTINGS.general.company_name,
      legal_name: legacy.legal_name || '',
      tagline: legacy.tagline || '',
      timezone: legacy.timezone || 'UTC',
      default_currency: legacy.default_currency || 'USD',
      currency_symbol: legacy.currency_symbol || '$',
    },
    branding: {
      ...DEFAULT_WORKSPACE_SETTINGS.branding,
      logo_url: legacy.logo_url || '',
      footer_logo_url: legacy.footer_logo_url || '',
      address: legacy.address || '',
      phone: legacy.phone || '',
      email: legacy.email || '',
      website: legacy.website || '',
      primary_color: legacy.primary_color || '#2563eb',
      secondary_color: legacy.secondary_color || '#1e40af',
      accent_color: legacy.accent_color || '#f59e0b',
      footer_text: legacy.footer_text || '',
      gst_number: legacy.gst_number || '',
      pan_number: legacy.pan_number || '',
      tax_cgst: legacy.tax_cgst || 0,
      tax_sgst: legacy.tax_sgst || 0,
      tax_igst: legacy.tax_igst || 0,
      tax_vat: legacy.tax_vat || 0,
      tax_tin: legacy.tax_tin || '',
      registration_number: legacy.registration_number || '',
      bank_name: legacy.bank_name || '',
      bank_account: legacy.bank_account || '',
      bank_ifsc: legacy.bank_ifsc || '',
      bank_swift: legacy.bank_swift || '',
      upi_id: legacy.upi_id || '',
      qr_code_url: legacy.qr_code_url || '',
      invoice_prefix: legacy.invoice_prefix || 'INV',
      quote_prefix: legacy.quote_prefix || 'QTE',
      purchase_order_prefix: legacy.purchase_order_prefix || 'PO',
      credit_note_prefix: legacy.credit_note_prefix || 'CN',
      invoice_number_format: legacy.invoice_number_format || '{prefix}-{year}-{num}',
      quote_number_format: legacy.quote_number_format || '{prefix}-{year}-{num}',
      credit_note_number_format: legacy.credit_note_number_format || '{prefix}-{year}-{num}',
      date_format: legacy.date_format || 'MM/dd/yyyy',
      default_terms: legacy.default_terms || '',
      default_notes: legacy.default_notes || '',
      template_style: legacy.template_style || 'modern',
      social_links: legacy.social_links || '',
      support_contact: legacy.support_contact || '',
      watermark: legacy.watermark || '',
    },
    appearance: DEFAULT_WORKSPACE_SETTINGS.appearance,
    notifications: DEFAULT_WORKSPACE_SETTINGS.notifications,
    security: DEFAULT_WORKSPACE_SETTINGS.security,
    team: DEFAULT_WORKSPACE_SETTINGS.team,
    api: DEFAULT_WORKSPACE_SETTINGS.api,
    updated_at: legacy.updated_at || new Date().toISOString(),
  };
}
