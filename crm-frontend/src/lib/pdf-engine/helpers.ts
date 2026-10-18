import { CompanySettings } from './types';
import { getWorkspaceSettings } from '@/lib/settings/api';
import { getSettings } from '@/lib/db';

const DEFAULT_SETTINGS: CompanySettings = {
  company_name: 'Lentone Consumer Products',
  legal_name: 'Lentone Consumer Products',
  tagline: 'WHERE QUALITY MEETS CLEAN',
  address: 'Padur, Rajiv Gandhi Salai (OMR), Chennai – 603103',
  phone: '+91 6374580424',
  email: 'lentonecp@gmail.com',
  website: 'www.lentone.in',
  logo_url: '/logo.png',
  footer_logo_url: '',
  gst_number: '33OHMPS7204B1Z6',
  pan_number: '',
  registration_number: '',
  bank_name: 'IndusInd Bank',
  bank_account: '256374580424',
  bank_ifsc: 'INDB0000932',
  bank_holder: 'Lentone',
  bank_swift: '',
  upi_id: '',
  qr_code_url: '',
  primary_color: '#C88A2C',
  secondary_color: '#A06E23',
  accent_color: '#F9EED9',
  default_currency: 'INR',
  currency_symbol: 'Rs.',
  currency_position: 'before',
  currency_decimals: 2,
  number_format: '12,34,567.89',
  date_format: 'DD/MM/YYYY',
  timezone: 'Asia/Kolkata',
  tax_cgst: 9,
  tax_sgst: 9,
  tax_igst: 0,
  tax_vat: 0,
  tax_tin: '',
  default_terms: '',
  default_notes: '',
  footer_text: 'Lentone Consumer Products | www.lentone.in | lentonecp@gmail.com',
  watermark: '',
  invoice_prefix: 'INV',
  quote_prefix: 'QUO',
  purchase_order_prefix: 'PO',
  invoice_number_format: '{prefix}-{num}',
  quote_number_format: '{prefix}-{num}',
  template_style: 'modern',
  social_links: '',
  support_contact: '',
};

let cachedSettings: CompanySettings | null = null;

/**
 * Get company settings as a flat object (for PDF engine compatibility).
 * Reads from both AppSettings (in db.ts) and the workspace settings API.
 */
export async function getCompanySettings(workspaceId?: string): Promise<CompanySettings> {
  let appSettings: any = null;
  try {
    appSettings = await getSettings();
  } catch (err) {
    // ignore
  }

  let workspace: any = null;
  try {
    if (workspaceId) {
      workspace = await getWorkspaceSettings(workspaceId);
    }
  } catch (err) {
    // ignore
  }

  const companyName = appSettings?.companyName || workspace?.general?.company_name || DEFAULT_SETTINGS.company_name;
  const primaryColor = appSettings?.primaryColor || workspace?.branding?.primary_color || DEFAULT_SETTINGS.primary_color;
  const currencySymbol = appSettings?.currency === '₹' ? 'Rs.' : (appSettings?.currency || workspace?.general?.currency_symbol || 'Rs.');
  const defaultCurrency = currencySymbol === '₹' || currencySymbol === 'Rs.' ? 'INR' : (currencySymbol || workspace?.general?.default_currency || 'INR');
  const templateStyle = appSettings?.templateStyle || workspace?.branding?.template_style || 'modern';
  const taxRate = typeof appSettings?.taxRate === 'number' ? appSettings.taxRate : 18;

  return {
    ...DEFAULT_SETTINGS,
    company_name: companyName,
    legal_name: workspace?.general?.legal_name || companyName,
    tagline: appSettings?.tagline || workspace?.general?.tagline || DEFAULT_SETTINGS.tagline,
    address: appSettings?.address || workspace?.branding?.address || DEFAULT_SETTINGS.address,
    phone: appSettings?.companyPhone || workspace?.branding?.phone || DEFAULT_SETTINGS.phone,
    email: appSettings?.companyEmail || workspace?.branding?.email || DEFAULT_SETTINGS.email,
    website: appSettings?.companyWebsite || workspace?.branding?.website || DEFAULT_SETTINGS.website,
    logo_url: appSettings?.logo || workspace?.branding?.logo_url || DEFAULT_SETTINGS.logo_url,
    footer_logo_url: workspace?.branding?.footer_logo_url || '',
    gst_number: appSettings?.gstin || workspace?.branding?.gst_number || DEFAULT_SETTINGS.gst_number,
    pan_number: workspace?.branding?.pan_number || '',
    registration_number: workspace?.branding?.registration_number || '',
    bank_name: appSettings?.bankName || workspace?.branding?.bank_name || DEFAULT_SETTINGS.bank_name,
    bank_account: appSettings?.bankAccount || workspace?.branding?.bank_account || DEFAULT_SETTINGS.bank_account,
    bank_ifsc: appSettings?.bankIfsc || workspace?.branding?.bank_ifsc || DEFAULT_SETTINGS.bank_ifsc,
    bank_holder: appSettings?.bankHolder || DEFAULT_SETTINGS.bank_holder || 'Lentone',
    bank_swift: workspace?.branding?.bank_swift || '',
    upi_id: appSettings?.upiId || workspace?.branding?.upi_id || '',
    qr_code_url: workspace?.branding?.qr_code_url || '',
    primary_color: primaryColor,
    secondary_color: workspace?.branding?.secondary_color || DEFAULT_SETTINGS.secondary_color,
    accent_color: workspace?.branding?.accent_color || DEFAULT_SETTINGS.accent_color,
    default_currency: defaultCurrency,
    currency_symbol: currencySymbol,
    currency_position: workspace?.general?.currency_position ?? 'before',
    currency_decimals: workspace?.general?.currency_decimals ?? 2,
    number_format: workspace?.general?.number_format ?? '12,34,567.89',
    date_format: workspace?.branding?.date_format || 'DD/MM/YYYY',
    timezone: workspace?.general?.timezone || 'Asia/Kolkata',
    tax_cgst: workspace?.branding?.tax_cgst || (taxRate > 0 ? taxRate / 2 : 9),
    tax_sgst: workspace?.branding?.tax_sgst || (taxRate > 0 ? taxRate / 2 : 9),
    tax_igst: workspace?.branding?.tax_igst || 0,
    tax_vat: workspace?.branding?.tax_vat || 0,
    tax_tin: workspace?.branding?.tax_tin || '',
    default_terms: appSettings?.defaultTerms || workspace?.branding?.default_terms || '',
    default_notes: appSettings?.defaultNotes || workspace?.branding?.default_notes || '',
    footer_text: appSettings?.footerText || workspace?.branding?.footer_text || DEFAULT_SETTINGS.footer_text,
    watermark: workspace?.branding?.watermark || '',
    invoice_prefix: appSettings?.invoicePrefix || workspace?.branding?.invoice_prefix || 'INV',
    quote_prefix: appSettings?.quotationPrefix || workspace?.branding?.quote_prefix || 'QUO',
    purchase_order_prefix: appSettings?.orderPrefix || workspace?.branding?.purchase_order_prefix || 'PO',
    invoice_number_format: workspace?.branding?.invoice_number_format || '{prefix}-{year}-{num}',
    quote_number_format: workspace?.branding?.quote_number_format || '{prefix}-{year}-{num}',
    template_style: templateStyle,
    social_links: workspace?.branding?.social_links || '',
    support_contact: workspace?.branding?.support_contact || '',
  };
}

export function clearSettingsCache(): void {
}

function groupInteger(intPart: string, numberFormat: string, currency: string): string {
  const digits = intPart.replace(/\D/g, '') || '0';
  const lakh = numberFormat.includes('12,34') || currency === 'INR';
  if (lakh) {
    const last3 = digits.slice(-3);
    const rest = digits.slice(0, -3);
    if (!rest) return last3;
    return `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}`;
  }
  if (numberFormat.includes('1.234,56')) return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  if (numberFormat.includes('1 234')) return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  if (numberFormat === '1234.56') return digits;
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function formatCurrency(amount: number, settings: CompanySettings): string {
  const v = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;
  const decimals = typeof settings.currency_decimals === 'number' ? settings.currency_decimals : 2;
  const neg = v < 0 ? '-' : '';
  const fixed = Math.abs(v).toFixed(decimals);
  const [intPart, fracPart] = fixed.split('.');
  const european = (settings.number_format || '').includes('1.234,56');
  const decSep = european ? ',' : '.';
  const num = fracPart !== undefined
    ? `${groupInteger(intPart, settings.number_format || '1,234.56', settings.default_currency || 'USD')}${decSep}${fracPart}`
    : groupInteger(intPart, settings.number_format || '1,234.56', settings.default_currency || 'USD');
  const symbol = settings.currency_symbol || '$';
  return (settings.currency_position || 'before') === 'after' ? `${neg}${num} ${symbol}` : `${neg}${symbol}${num}`;
}

function partsInTimezone(d: Date, timezone: string): { y: number; m: number; day: number } {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: timezone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' });
    const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
    return { y: Number(parts.year), m: Number(parts.month), day: Number(parts.day) };
  } catch {
    return { y: d.getFullYear(), m: d.getMonth() + 1, day: d.getDate() };
  }
}

const pad2 = (n: number): string => String(n).padStart(2, '0');

export function formatDate(dateStr: string, settings: CompanySettings): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const p = partsInTimezone(d, settings.timezone || 'UTC');
  const fmt = settings.date_format || 'MM/dd/yyyy';
  if (fmt === 'DD/MM/YYYY' || fmt === 'dd/MM/yyyy') return `${pad2(p.day)}/${pad2(p.m)}/${p.y}`;
  if (fmt === 'YYYY-MM-DD' || fmt === 'yyyy-MM-dd') return `${p.y}-${pad2(p.m)}-${pad2(p.day)}`;
  if (fmt === 'DD MMM YYYY') {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${pad2(p.day)} ${months[p.m - 1]} ${p.y}`;
  }
  if (fmt === 'MMM DD, YYYY') {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[p.m - 1]} ${pad2(p.day)}, ${p.y}`;
  }
  if (fmt === 'DD.MM.YYYY') return `${pad2(p.day)}.${pad2(p.m)}.${p.y}`;
  if (fmt === 'dd-MM-yyyy') return `${pad2(p.day)}-${pad2(p.m)}-${p.y}`;
  if (fmt === 'MM-dd-yyyy') return `${pad2(p.m)}-${pad2(p.day)}-${p.y}`;
  return `${pad2(p.m)}/${pad2(p.day)}/${p.y}`;
}

export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const big = parseInt(clean, 16);
  return [(big >> 16) & 255, (big >> 8) & 255, big & 255];
}

const logoCache = new Map<string, string>();

export function getBase64ImageFromURL(url: string): Promise<string> {
  if (!url) return Promise.reject(new Error('No url provided'));
  if (url.startsWith('data:')) return Promise.resolve(url);

  const cached = logoCache.get(url);
  if (cached) return Promise.resolve(cached);

  if (typeof Image === 'undefined') {
    return Promise.reject(new Error('Image constructor not available (SSR)'));
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.setAttribute('crossOrigin', 'anonymous');
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL('image/png');
        logoCache.set(url, dataUrl);
        resolve(dataUrl);
      } catch (err) {
        reject(err);
      }
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
