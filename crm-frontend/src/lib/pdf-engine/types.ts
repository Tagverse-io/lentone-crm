export type PdfTemplateStyle = 'modern' | 'corporate' | 'minimal';

export interface CompanySettings {
  company_name: string;
  legal_name: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  logo_url: string;
  footer_logo_url: string;
  gst_number: string;
  pan_number: string;
  registration_number: string;

  bank_name: string;
  bank_account: string;
  bank_ifsc: string;
  bank_swift: string;
  upi_id: string;
  qr_code_url: string;

  primary_color: string;
  secondary_color: string;
  accent_color: string;

  default_currency: string;
  currency_symbol: string;
  date_format: string;
  timezone: string;

  tax_cgst: number;
  tax_sgst: number;
  tax_igst: number;
  tax_vat: number;
  tax_tin: string;

  default_terms: string;
  default_notes: string;
  footer_text: string;
  watermark: string;

  invoice_prefix: string;
  quote_prefix: string;
  purchase_order_prefix: string;
  invoice_number_format: string;
  quote_number_format: string;

  template_style: PdfTemplateStyle;

  social_links: string;
  support_contact: string;
}

export interface PdfDocumentMeta {
  title: string;
  number: string;
  date: string;
  due_date?: string;
  valid_until?: string;
  status?: string;
  primaryColor?: string; // ← passed into HTML template for theming
}

export interface PdfAddress {
  label: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  address?: string;
  gstin?: string;
}

export interface PdfLineItem {
  name: string;
  description: string;
  quantity: string;
  unit_price: string;
  total: string;
}

export interface PdfDocumentInput {
  meta: PdfDocumentMeta;
  from: PdfAddress;
  to: PdfAddress;
  items: PdfLineItem[];
  totals: { label: string; value: string; bold?: boolean }[];
  notes?: string;
  terms?: string;
  bank_details?: string[];
  payment_summary?: { amount_paid: number; balance_due: number };
}

// Old jsPDF types kept for reference — no longer used in generation
export interface PdfTableRow {
  cells: string[];
  styles?: Record<number, { halign?: 'left' | 'center' | 'right'; fontStyle?: string }>;
}
