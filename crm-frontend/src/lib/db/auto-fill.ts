import { Company, AutoFillDefaults } from './types';
import { GeneralSettings, BrandingSettings } from '@/lib/settings/types';

/**
 * Get auto-fill defaults from a company
 */
export function getCompanyAutoFillDefaults(company: Company): AutoFillDefaults {
  return {
    currency: company.currency || 'INR',
    timezone: company.timezone || 'Asia/Kolkata',
    gst_number: company.gst_number || '',
    pan_number: company.pan_number || '',
    vat_number: company.vat_number || '',
    bank_name: company.bank_name || '',
    account_number: company.account_number || '',
    ifsc: company.ifsc || '',
    swift: company.swift || '',
    upi: company.upi || '',
    logo_url: company.logo_url || '',
    footer_text: company.footer_text || '',
    address: company.address || '',
    city: company.city || '',
    state: company.state || '',
    country: company.country || '',
    pincode: company.pincode || '',
  };
}

/**
 * Get auto-fill defaults from workspace settings
 */
export function getWorkspaceAutoFillDefaults(
  general: GeneralSettings,
  branding?: BrandingSettings
): AutoFillDefaults {
  return {
    currency: general.default_currency || 'INR',
    timezone: general.timezone || 'Asia/Kolkata',
    gst_number: '',
    pan_number: '',
    vat_number: '',
    bank_name: '',
    account_number: '',
    ifsc: '',
    swift: '',
    upi: '',
    logo_url: branding?.logo_url || '',
    footer_text: '',
    address: branding?.address || '',
    city: '',
    state: '',
    country: general.country || '',
    pincode: '',
  };
}

/**
 * Merge defaults with company-specific overrides
 * Company values take precedence over workspace defaults
 */
export function mergeAutoFillDefaults(
  workspaceDefaults: AutoFillDefaults,
  companyDefaults: Partial<AutoFillDefaults>
): AutoFillDefaults {
  return {
    currency: companyDefaults.currency || workspaceDefaults.currency,
    timezone: companyDefaults.timezone || workspaceDefaults.timezone,
    gst_number: companyDefaults.gst_number || workspaceDefaults.gst_number,
    pan_number: companyDefaults.pan_number || workspaceDefaults.pan_number,
    vat_number: companyDefaults.vat_number || workspaceDefaults.vat_number,
    bank_name: companyDefaults.bank_name || workspaceDefaults.bank_name,
    account_number: companyDefaults.account_number || workspaceDefaults.account_number,
    ifsc: companyDefaults.ifsc || workspaceDefaults.ifsc,
    swift: companyDefaults.swift || workspaceDefaults.swift,
    upi: companyDefaults.upi || workspaceDefaults.upi,
    logo_url: companyDefaults.logo_url || workspaceDefaults.logo_url,
    footer_text: companyDefaults.footer_text || workspaceDefaults.footer_text,
    address: companyDefaults.address || workspaceDefaults.address,
    city: companyDefaults.city || workspaceDefaults.city,
    state: companyDefaults.state || workspaceDefaults.state,
    country: companyDefaults.country || workspaceDefaults.country,
    pincode: companyDefaults.pincode || workspaceDefaults.pincode,
  };
}

/**
 * Apply auto-fill defaults to a quote
 */
export function applyQuoteDefaults(
  defaults: AutoFillDefaults,
  overrides?: Partial<{
    currency: string;
    notes: string;
    terms_and_conditions: string;
  }>
): {
  currency: string;
  notes: string;
  terms_and_conditions: string;
} {
  return {
    currency: overrides?.currency || defaults.currency,
    notes: overrides?.notes || '',
    terms_and_conditions: overrides?.terms_and_conditions || '',
  };
}

/**
 * Apply auto-fill defaults to an invoice
 */
export function applyInvoiceDefaults(
  defaults: AutoFillDefaults,
  overrides?: Partial<{
    currency: string;
    notes: string;
    terms_and_conditions: string;
  }>
): {
  currency: string;
  notes: string;
  terms_and_conditions: string;
} {
  return {
    currency: overrides?.currency || defaults.currency,
    notes: overrides?.notes || '',
    terms_and_conditions: overrides?.terms_and_conditions || '',
  };
}

/**
 * Get contact display info for forms
 */
export function getContactDisplayInfo(contact: {
  name: string;
  email: string;
  phone: string;
  role?: string;
  department?: string;
}): string {
  const parts = [contact.name];
  if (contact.role) parts.push(contact.role);
  if (contact.department) parts.push(contact.department);
  return parts.join(' • ');
}

/**
 * Get company display info for forms
 */
export function getCompanyDisplayInfo(company: {
  name: string;
  city?: string;
  country?: string;
}): string {
  const parts = [company.name];
  if (company.city) parts.push(company.city);
  if (company.country) parts.push(company.country);
  return parts.join(', ');
}
