import { CompanySettings } from './types';
import { getWorkspaceSettings } from '@/lib/settings/api';

const DEFAULT_SETTINGS: CompanySettings = {
  company_name: 'Your Company',
  legal_name: 'Your Legal Name',
  tagline: 'Your Professional Solution Partner',
  address: '',
  phone: '',
  email: '',
  website: '',
  logo_url: '',
  footer_logo_url: '',
  gst_number: '',
  pan_number: '',
  registration_number: '',
  bank_name: '',
  bank_account: '',
  bank_ifsc: '',
  bank_swift: '',
  upi_id: '',
  qr_code_url: '',
  primary_color: '#2563eb',
  secondary_color: '#1e40af',
  accent_color: '#f59e0b',
  default_currency: 'USD',
  currency_symbol: '$',
  date_format: 'MM/dd/yyyy',
  timezone: 'UTC',
  tax_cgst: 0,
  tax_sgst: 0,
  tax_igst: 0,
  tax_vat: 0,
  tax_tin: '',
  default_terms: '',
  default_notes: '',
  footer_text: '',
  watermark: '',
  invoice_prefix: 'INV',
  quote_prefix: 'QTE',
  purchase_order_prefix: 'PO',
  invoice_number_format: '{prefix}-{year}-{num}',
  quote_number_format: '{prefix}-{year}-{num}',
  template_style: 'modern',
  social_links: '',
  support_contact: '',
};

let cachedSettings: CompanySettings | null = null;

/**
 * Get company settings as a flat object (for PDF engine compatibility).
 * Reads from the new workspace settings API.
 */
export async function getCompanySettings(workspaceId: string): Promise<CompanySettings> {
  try {
    const workspace = await getWorkspaceSettings(workspaceId);
    return {
      ...DEFAULT_SETTINGS,
      company_name: workspace.general.company_name,
      legal_name: workspace.general.legal_name,
      tagline: workspace.general.tagline,
      address: workspace.branding.address,
      phone: workspace.branding.phone,
      email: workspace.branding.email,
      website: workspace.branding.website,
      logo_url: workspace.branding.logo_url,
      footer_logo_url: workspace.branding.footer_logo_url,
      gst_number: workspace.branding.gst_number,
      pan_number: workspace.branding.pan_number,
      registration_number: workspace.branding.registration_number,
      bank_name: workspace.branding.bank_name,
      bank_account: workspace.branding.bank_account,
      bank_ifsc: workspace.branding.bank_ifsc,
      bank_swift: workspace.branding.bank_swift,
      upi_id: workspace.branding.upi_id,
      qr_code_url: workspace.branding.qr_code_url,
      primary_color: workspace.branding.primary_color,
      secondary_color: workspace.branding.secondary_color,
      accent_color: workspace.branding.accent_color,
      default_currency: workspace.general.default_currency,
      currency_symbol: workspace.general.currency_symbol,
      date_format: workspace.branding.date_format,
      timezone: workspace.general.timezone,
      tax_cgst: workspace.branding.tax_cgst,
      tax_sgst: workspace.branding.tax_sgst,
      tax_igst: workspace.branding.tax_igst,
      tax_vat: workspace.branding.tax_vat,
      tax_tin: workspace.branding.tax_tin,
      default_terms: workspace.branding.default_terms,
      default_notes: workspace.branding.default_notes,
      footer_text: workspace.branding.footer_text,
      watermark: workspace.branding.watermark,
      invoice_prefix: workspace.branding.invoice_prefix,
      quote_prefix: workspace.branding.quote_prefix,
      purchase_order_prefix: workspace.branding.purchase_order_prefix,
      invoice_number_format: workspace.branding.invoice_number_format,
      quote_number_format: workspace.branding.quote_number_format,
      template_style: workspace.branding.template_style,
      social_links: workspace.branding.social_links,
      support_contact: workspace.branding.support_contact,
    };
  } catch (err) {
    console.error('Error getting company settings:', err);
    return DEFAULT_SETTINGS;
  }
}

export function clearSettingsCache(): void {
}

export function formatCurrency(amount: number, settings: CompanySettings): string {
  const symbol = settings.currency_symbol || '$';
  return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(dateStr: string, settings: CompanySettings): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const fmt = settings.date_format || 'MM/dd/yyyy';
  const map: Record<string, string> = {
    'MM/dd/yyyy': d.toLocaleDateString('en-US'),
    'dd/MM/yyyy': d.toLocaleDateString('en-GB'),
    'yyyy-MM-dd': d.toISOString().split('T')[0],
    'dd-MM-yyyy': d.toLocaleDateString('en-GB').replace(/\//g, '-'),
    'MM-dd-yyyy': d.toLocaleDateString('en-US').replace(/\//g, '-'),
  };
  return map[fmt] || d.toLocaleDateString('en-US');
}

export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const big = parseInt(clean, 16);
  return [(big >> 16) & 255, (big >> 8) & 255, big & 255];
}

const logoCache = new Map<string, string>();

export function getBase64ImageFromURL(url: string): Promise<string> {
  const cached = logoCache.get(url);
  if (cached) return Promise.resolve(cached);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.setAttribute('crossOrigin', 'anonymous');
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0);
      const dataUrl = canvas.toDataURL('image/png');
      logoCache.set(url, dataUrl);
      resolve(dataUrl);
    };
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

export function preloadLogo(url: string): void {
  if (url && !logoCache.has(url)) {
    getBase64ImageFromURL(url).catch(() => {});
  }
}
