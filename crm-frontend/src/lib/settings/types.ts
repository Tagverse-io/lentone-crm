import { PdfTemplateStyle } from '@/lib/pdf-engine/types';
import { TeamMember as DbTeamMember, ApiKey as DbApiKey } from '@/lib/db/types';

// ─── General Settings ───────────────────────────────────────────────
export interface GeneralSettings {
  company_name: string;
  workspace_name: string;
  workspace_url: string;
  legal_name: string;
  tagline: string;
  timezone: string;
  default_currency: string;
  currency_symbol: string;
  country: string;
  state: string;
  number_format: string;
  first_day_of_week: string;
  financial_year: string;
}

// ─── Branding Settings ──────────────────────────────────────────────
export interface BrandingSettings {
  logo_url: string;
  footer_logo_url: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  footer_text: string;
  watermark: string;

  // Tax
  tax_system: string;
  gst_number: string;
  pan_number: string;
  tax_cgst: number;
  tax_sgst: number;
  tax_igst: number;
  tax_vat: number;
  tax_tin: string;
  registration_number: string;

  // Banking
  bank_name: string;
  bank_account: string;
  bank_ifsc: string;
  bank_swift: string;
  upi_id: string;
  qr_code_url: string;

  // Documents
  invoice_prefix: string;
  quote_prefix: string;
  purchase_order_prefix: string;
  invoice_number_format: string;
  quote_number_format: string;
  invoice_due_days: number;
  date_format: string;
  default_terms: string;
  default_notes: string;
  template_style: PdfTemplateStyle;
  logo_position: string;
  email_signature: string;
  social_links: string;
  support_contact: string;
}

// ─── Appearance Settings ────────────────────────────────────────────
export interface AppearanceSettings {
  theme: 'system' | 'light' | 'dark';
  sidebar_collapsed: boolean;
  sidebar_style: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  font_size: string;
  language: string;
  compact_mode: boolean;
}

// ─── Notification Settings ──────────────────────────────────────────
export interface NotificationSettings {
  email_notifications: boolean;
  push_notifications: boolean;
  slack_integration: boolean;
  slack_webhook_url: string;
  weekly_digest: boolean;
  digest_frequency: string;
  mention_alerts: boolean;
  invoice_alerts: boolean;
  payment_alerts: boolean;
  project_alerts: boolean;
  support_alerts: boolean;
}

// ─── Security Settings ──────────────────────────────────────────────
export interface SecuritySettings {
  session_timeout: string;
  two_factor_enabled: boolean;
  password_strength: string;
  login_notifications: boolean;
  ip_whitelist: string[];
}

// ─── Team Settings ──────────────────────────────────────────────────
/** Settings-specific team member view (lighter than the full DB TeamMember) */
export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  joined_at: string;
  avatar?: string;
}

export interface TeamSettings {
  default_role: string;
  allow_invitations: boolean;
  members: TeamMember[];
}

// ─── API Settings ───────────────────────────────────────────────────
/** Settings-specific API key view (lighter than the full DB ApiKey) */
export interface ApiKey {
  id: string;
  name: string;
  key: string;
  permission: string;
  expires_at: string;
  last_used_at?: string;
  created_at: string;
}

export interface ApiSettings {
  keys: ApiKey[];
}

// ─── Combined Workspace Settings ────────────────────────────────────
export interface WorkspaceSettings {
  general: GeneralSettings;
  branding: BrandingSettings;
  appearance: AppearanceSettings;
  notifications: NotificationSettings;
  security: SecuritySettings;
  team: TeamSettings;
  api: ApiSettings;
  updated_at: string;
}

// ─── Re-export DB types for convenience ─────────────────────────────
export type { DbTeamMember, DbApiKey };

// ─── Default Settings ───────────────────────────────────────────────
export const DEFAULT_GENERAL_SETTINGS: GeneralSettings = {
  company_name: 'Your Company',
  workspace_name: 'My Workspace',
  workspace_url: '',
  legal_name: '',
  tagline: '',
  timezone: 'UTC',
  default_currency: 'USD',
  currency_symbol: '$',
  country: '',
  state: '',
  number_format: '1,234,567.89',
  first_day_of_week: 'Monday',
  financial_year: 'January - December',
};

export const DEFAULT_BRANDING_SETTINGS: BrandingSettings = {
  logo_url: '',
  footer_logo_url: '',
  address: '',
  phone: '',
  email: '',
  website: '',
  primary_color: '#2563eb',
  secondary_color: '#1e40af',
  accent_color: '#f59e0b',
  footer_text: '',
  watermark: '',
  tax_system: 'none',
  gst_number: '',
  pan_number: '',
  tax_cgst: 0,
  tax_sgst: 0,
  tax_igst: 0,
  tax_vat: 0,
  tax_tin: '',
  registration_number: '',
  bank_name: '',
  bank_account: '',
  bank_ifsc: '',
  bank_swift: '',
  upi_id: '',
  qr_code_url: '',
  invoice_prefix: 'INV',
  quote_prefix: 'QTE',
  purchase_order_prefix: 'PO',
  invoice_number_format: '{prefix}-{year}-{num}',
  quote_number_format: '{prefix}-{year}-{num}',
  invoice_due_days: 30,
  date_format: 'MM/dd/yyyy',
  default_terms: '',
  default_notes: '',
  template_style: 'modern',
  logo_position: 'left',
  email_signature: 'default',
  social_links: '',
  support_contact: '',
};

export const DEFAULT_APPEARANCE_SETTINGS: AppearanceSettings = {
  theme: 'system',
  sidebar_collapsed: false,
  sidebar_style: 'default',
  primary_color: '#2563eb',
  secondary_color: '#1e40af',
  accent_color: '#f59e0b',
  font_size: 'medium',
  language: 'en',
  compact_mode: false,
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  email_notifications: true,
  push_notifications: true,
  slack_integration: false,
  slack_webhook_url: '',
  weekly_digest: true,
  digest_frequency: 'weekly',
  mention_alerts: true,
  invoice_alerts: true,
  payment_alerts: true,
  project_alerts: true,
  support_alerts: true,
};

export const DEFAULT_SECURITY_SETTINGS: SecuritySettings = {
  session_timeout: '30',
  two_factor_enabled: false,
  password_strength: 'medium',
  login_notifications: true,
  ip_whitelist: [],
};

export const DEFAULT_TEAM_SETTINGS: TeamSettings = {
  default_role: 'member',
  allow_invitations: true,
  members: [],
};

export const DEFAULT_API_SETTINGS: ApiSettings = {
  keys: [],
};

export const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
  general: DEFAULT_GENERAL_SETTINGS,
  branding: DEFAULT_BRANDING_SETTINGS,
  appearance: DEFAULT_APPEARANCE_SETTINGS,
  notifications: DEFAULT_NOTIFICATION_SETTINGS,
  security: DEFAULT_SECURITY_SETTINGS,
  team: DEFAULT_TEAM_SETTINGS,
  api: DEFAULT_API_SETTINGS,
  updated_at: new Date().toISOString(),
};
