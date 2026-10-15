export type UserRole = 'client' | 'admin' | 'dev';

// ===== WORKSPACE & ROLE SYSTEM =====

export type WorkspaceRole = 'owner' | 'admin' | 'manager' | 'employee' | 'viewer';

export interface Workspace {
  id: string;
  workspace_id?: string;
  name: string;
  slug: string;
  owner_id: string;
  setup_completed: boolean;
  setup_step: number; // 0-5, tracks wizard progress
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_member_id?: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  invited_by?: string;
  joined_at: string;
  created_at: string;
  updated_at: string;
}

export interface PlatformAdmin {
  id: string;
  user_id: string;
  assigned_by?: string;
  created_at: string;
}

export type ProjectStatus =
  | 'pending'
  | 'under_review'
  | 'accepted'
  | 'in_progress'
  | 'testing'
  | 'completed'
  | 'cancelled';

export type FileType = 'document' | 'voice_note' | 'image' | 'other';

export type SupportStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export type PriorityLevel = 'low' | 'medium' | 'high';

export type MeetingStatus = 'pending' | 'accepted' | 'declined' | 'completed';

export type InvoiceStatus = 'pending' | 'paid' | 'overdue' | 'cancelled' | 'partially_paid' | 'overpaid';

export type ContractTemplateType = 'employment' | 'nda' | 'service' | 'subscription' | 'vendor';
export type ContractStatus = 'draft' | 'sent' | 'active' | 'expiring' | 'terminated';


export interface ModulePermissions {
  view: boolean;
  edit: boolean;
  delete: boolean;
}

export interface Role {
  id: string;
  workspace_id: string;
  name: string;
  description: string;
  is_system?: boolean;
  permissions: {
    [module: string]: ModulePermissions;
  };
  created_at: string;
  updated_at: string;
}

export type MemberStatus = 'active' | 'inactive' | 'invited';



export type NotificationType = 'project' | 'payment' | 'support' | 'meeting' | 'system';

export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id: string;
  workspace_id: string;
  type: TransactionType;
  amount: number;
  category: string;
  description: string;
  date: string;
  attachment_url?: string;
  tax_rate_id?: string;
  currency?: string;
  exchange_rate?: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  user_id?: string;
  company_id: string; // Foreign key referencing the Company
  email: string;
  full_name: string;
  role: UserRole;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  workspace_id: string;
  client_id: string;
  title: string;
  description: string;
  status: ProjectStatus;
  github_link?: string;
  document_url?: string;
  estimated_cost?: number;
  actual_cost?: number;
  deadline?: string;
  progress_percentage?: number;
  test_asset_url?: string;
  deployment_url?: string; // Kept for backward compatibility or primary link

  // LIVE PREVIEW CONFIG
  live_preview_type?: 'url' | 'image';
  live_preview_url?: string;

  // DYNAMIC TECHNICAL CONFIG
  technical_config?: Array<{
    id: string;
    label: string;
    value: string;
    isLink?: boolean;
    isSecret?: boolean;
    category: 'infra' | 'admin' | 'deploy';
  }>;

  // TICKETS & NOTES
  tickets?: Array<{
    id: string;
    title: string;
    description?: string;
    attachment_url?: string;
    completed: boolean;
    created_at?: string;
  }>;
  notes?: string[];

  is_featured?: boolean; // Mark project as featured for portfolio/showcase

  // Manual Client Details (for non-registered clients)
  manual_client_name?: string;
  manual_client_email?: string;
  manual_client_company?: string;
  manual_client_phone?: string;

  // RECURRING COSTS & MAINTENANCE
  maintenance_cost?: number;        // What we charge the client
  maintenance_frequency?: 'monthly' | 'yearly';
  
  internal_resource_cost?: number;  // What we actually pay (Admin only)
  resource_frequency?: 'monthly' | 'yearly';
  
  next_billing_date?: string;

  created_at: string;
  updated_at: string;
}

export interface ProjectFile {
  id: string;
  project_id: string;
  file_name: string;
  file_url: string;
  file_type: FileType;
  file_size: number;
  uploaded_by: string;
  created_at: string;
}

export interface ProjectUpdate {
  id: string;
  project_id: string;
  update_text: string;
  created_by: string;
  created_at: string;
}

export interface SupportRequest {
  id: string;
  workspace_id: string;
  project_id?: string;
  client_id: string;
  subject: string;
  description: string;
  status: SupportStatus;
  priority: PriorityLevel;
  attachment_url?: string;
  created_at: string;
  updated_at: string;
}

export interface SupportMessage {
  id: string;
  support_request_id: string;
  user_id: string;
  message: string;
  created_at: string;
}

export interface MeetingRequest {
  id: string;
  workspace_id: string;
  project_id?: string;
  client_id: string;
  requested_date: string;
  duration_minutes: number;
  purpose: string;
  status: MeetingStatus;
  meeting_link?: string;
  admin_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  project_id?: string;
  client_id?: string;
  contact_id?: string;
  workspace_id?: string;
  deal_id?: string;
  quote_id?: string;
  invoice_number: string;
  items?: InvoiceItem[];
  subtotal?: number;
  discount?: number;
  discount_type?: 'percentage' | 'fixed';
  discount_amount?: number;
  tax?: number;
  tax_rate?: number;
  discount_percent?: number;
  cgst_percent?: number;
  sgst_percent?: number;
  igst_percent?: number;
  tax_amount?: number;
  total?: number;
  amount: number;
  currency?: string;
  currency_symbol?: string;
  due_date: string;
  issue_date?: string;
  paid_date?: string;
  paid_at?: string;
  amount_paid?: number;
  amount_due?: number;
  status: InvoiceStatus;
  description?: string;
  notes?: string;
  terms?: string;
  terms_and_conditions?: string; // Legacy
  internal_notes?: string;
  delivery_timeline?: string;
  client_gstin?: string;
  client_name?: string;
  client_email?: string;
  client_company?: string;
  client_address?: string;
  payment_qr_url?: string;
  payment_method?: string;
  payment_terms?: string;
  transaction_id?: string;
  custom_bank_name?: string;
  custom_bank_account?: string;
  custom_bank_ifsc?: string;
  custom_upi_id?: string;
  billing_address?: string;
  shipping_address?: string;
  recurring?: boolean;
  recurring_interval?: string;
  tax_enabled?: boolean;
  bank_details?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Contract {
  id: string;
  contract_number: string;
  template_type: ContractTemplateType;
  client_id?: string;
  client_name: string;
  client_email: string;
  client_address?: string;
  value?: number;
  currency?: string;
  start_date?: string;
  end_date?: string;
  status: ContractStatus;
  variables: Record<string, any>;
  content?: string;
  workspace_id: string;
  created_at: string;
  updated_at: string;
}


export interface Payment {
  id: string;
  invoice_id: string;
  amount: number;
  payment_method: string;
  transaction_id?: string;
  payment_date: string;
  notes?: string;
  created_at: string;
}

export interface TeamMember {
  id: string;
  workspace_id: string;
  name: string;
  email: string;
  role: string; // Contains role_id
  role_id?: string;
  monthly_salary: number;
  joined_date: string;
  status: MemberStatus;
  created_at: string;
  updated_at: string;
}

export interface SalaryPayment {
  id: string;
  team_member_id: string;
  amount: number;
  payment_date: string;
  month: string;
  notes?: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  workspace_id: string;
  title: string;
  message: string;
  type: NotificationType;
  link?: string;
  read: boolean;
  created_at: string;
}

export type AgentStatus = 'Active' | 'On Break' | 'Offline';

export interface FieldAgent {
  id: string;
  name: string;
  status: AgentStatus;
  location: string;
  battery: number;
  lastCheckin: string;
  route: string;
  created_at: string;
  updated_at: string;
}

export interface FieldAlert {
  id: string;
  agent: string;
  type: string;
  message: string;
  time: string;
  created_at: string;
}

export type ContentStatus = 'Draft' | 'draft' | 'In Review' | 'in_review' | 'Scheduled' | 'scheduled' | 'Published' | 'published';

export interface ContentItem {
  id: string;
  workspace_id: string;
  content_id?: string;
  title: string;
  type: string;
  slug?: string;
  content?: string;
  excerpt?: string;
  author?: string;
  author_id?: string;
  status: ContentStatus;
  tags?: string[];
  seo?: Record<string, any>;
  updated_at: string;
  created_at: string;
}

export interface MediaItem {
  id: string;
  name: string;
  type: string;
  size: string;
  dimensions: string;
  url: string;
  created_at: string;
}

export interface CalendarEvent {
  id: string;
  workspace_id: string;
  event_id?: string;
  title: string;
  type: string;
  date?: string;
  start_date?: string;
  end_date?: string;
  time?: string;
  description?: string;
  attendees?: string | string[];
  attendees_list?: string[];
  all_day?: boolean;
  color?: string;
  location?: string;
  project_id?: string;
  created_by?: string;
  recurrence?: string;
  created_at: string;
  updated_at: string;
}

export type IntegrationStatus = 'Connected' | 'Available' | 'Active';

export interface Integration {
  id: string;
  name: string;
  description: string;
  status: IntegrationStatus;
  category: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface AutomationRule {
  id: string;
  workspace_id: string;
  rule_id?: string;
  name?: string;
  description?: string;
  trigger: string;
  trigger_config?: Record<string, any>;
  action: string;
  actions?: AutomationAction[];
  status: string;
  enabled?: boolean;
  execution_count?: number;
  last_executed_at?: string;
  conditions?: any[];
  created_at: string;
  updated_at: string;
}

export interface AutomationAction {
  type: string;
  config: Record<string, any>;
}

export interface AiMessage {
  role: 'user' | 'assistant';
  message: string;
  timestamp: string;
}

export interface AiConversation {
  id: string;
  ai_conversation_id?: string;
  title: string;
  assistant: string;
  messages: AiMessage[];
  created_by: string;
  created_at: string;
  updated_at: string;
}



export type QuotationStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';

export interface QuotationItem {
  item_id?: string;
  name?: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface Quotation {
  id: string;
  workspace_id: string;
  project_id?: string;
  project_title?: string; // Snapshot or manual
  client_id: string; // Can be empty if manual
  quotation_number: string;
  amount: number;
  subtotal?: number;
  discount_percent?: number;
  discount_amount?: number;
  tax_amount?: number;
  cgst_percent?: number;
  sgst_percent?: number;
  igst_percent?: number;
  valid_until: string;
  status: QuotationStatus;
  currency: string;
  description?: string;
  items: QuotationItem[];
  notes?: string;
  terms?: string;
  internal_notes?: string;
  delivery_timeline?: string;
  client_gstin?: string;

  // Manual Client Details \(Non-registered\)
  client_name?: string;
  client_email?: string;
  client_company?: string;
  client_address?: string;
  client_is_company?: boolean;

  created_at: string;
  updated_at: string;
}

export interface SystemSettings {
  id: string;
  key: string;
  value: Record<string, any>;
  updated_at: string;
}

export interface PlanningNote {
  id: string;
  title: string;
  content: string;
  category: 'idea' | 'strategy' | 'todo' | 'other';
  created_by: string;
  updated_at: string;
  created_at: string;
}

// ===== TAGS TO ADD FROM TAGVERSE CRM =====

export type CampaignStatus = 'draft' | 'active' | 'running' | 'paused' | 'completed' | 'archived';
export type CampaignChannel = 'email' | 'social' | 'paid' | 'sms';

export interface Campaign {
  id: string;
  workspace_id: string;
  campaign_id?: string;
  name: string;
  description?: string;
  channel: CampaignChannel;
  status: CampaignStatus;
  budget?: number;
  spent?: number;
  currency?: string;
  target_audience?: string | string[];
  start_date?: string;
  end_date?: string;
  kpi_metrics?: Record<string, number>;
  content?: Record<string, any>;
  metrics?: {
    impressions?: number;
    clicks?: number;
    conversions?: number;
    ctr?: number;
    cpc?: number;
    cpm?: number;
    roas?: number;
    spend?: number;
    revenue?: number;
  };
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export type SocialPlatform = 'facebook' | 'instagram' | 'linkedin' | 'twitter' | 'youtube';

export interface SocialPost {
  id: string;
  workspace_id: string;
  post_id?: string;
  platform: SocialPlatform;
  content: string;
  media_url?: string;
  media_urls?: string[];
  scheduled_at?: string;
  published_at?: string;
  status: 'scheduled' | 'publishing' | 'published' | 'failed' | 'draft';
  hashtags?: string[];
  engagement?: { likes?: number; comments?: number; shares?: number };
  metrics?: { likes: number; comments: number; shares: number; impressions: number; reach: number; engagement_rate: number };
  campaign_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export type DeliveryStage = 'pending' | 'out_for_delivery' | 'delivered' | 'returned' | 'issue';

export interface Delivery {
  id: string;
  client_name: string;
  client_phone?: string;
  client_address?: string;
  items: DeliveryItem[];
  stage: DeliveryStage;
  scheduled_date?: string;
  delivered_date?: string;
  proof_url?: string;
  notes?: string;
  assigned_agent?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface DeliveryItem {
  id: string;
  name: string;
  quantity: number;
  description?: string;
}

export interface PipelineStage {
  id: string;
  name: string;
  color: string;
  order: number;
  description?: string;
  probability?: number;
  stage_type?: "open" | "won" | "lost";
  is_folded?: boolean;
}

export interface Pipeline {
  id: string;
  name: string;
  stages: PipelineStage[];
  created_at: string;
  updated_at: string;
  description?: string;
  is_active?: boolean;
  entity_type?: "deal";
  created_by?: string;
  workspace_id?: string;
}

export type ActivityAction =
  | 'lead_created' | 'lead_updated' | 'lead_deleted'
  | 'deal_stage_changed'
  | 'invoice_created' | 'invoice_paid'
  | 'quote_created' | 'quote_accepted'
  | 'project_created' | 'project_updated'
  | 'task_created' | 'task_completed'
  | 'contract_signed'
  | 'campaign_created'
  | 'payment_received'
  | 'update_invoice' | 'create_invoice'
  | 'user_login' | 'user_created';

export interface ActivityLog {
  id: string;
  action: ActivityAction;
  description: string;
  entity_type: string;
  entity_id?: string;
  user_id: string;
  user_name: string;
  workspace_id?: string;
  title?: string;
  date?: string;
  time?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export type EmailCampaignStatus = 'draft' | 'scheduling' | 'scheduled' | 'sent' | 'active' | 'completed' | 'paused';

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  html_body: string;
  variables?: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface EmailCampaign {
  id: string;
  workspace_id: string;
  campaign_id?: string;
  name: string;
  subject: string;
  preview_text?: string;
  content?: string;
  template_id?: string;
  recipient_list?: string[];
  recipients?: string[];
  scheduled_at?: string;
  sequence_step?: number;
  status: EmailCampaignStatus;
  stats?: { sent: number; delivered?: number; opened: number; clicked: number; bounced: number; complaints?: number; unsubscribes?: number; unsubscribed?: number; bounce_rate?: number; open_rate: number; click_rate: number; unsubscribe_rate: number };
  metrics?: { sent: number; delivered?: number; opened: number; clicked: number; bounced: number; complaints?: number; unsubscribes?: number; unsubscribed?: number; bounce_rate?: number; open_rate: number; click_rate: number; unsubscribe_rate: number };
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface EmailLog {
  id: string;
  campaign_id: string;
  recipient_email: string;
  sent_at: string;
  opened_at?: string;
  clicked_at?: string;
  bounced?: boolean;
}

export type EnquiryStatus = 'new' | 'read' | 'replied' | 'converted';

export interface Enquiry {
  id: string;
  workspace_id?: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  phone?: string;
  status: EnquiryStatus;
  created_at: string;
  updated_at: string;
}

export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';
export type TaskStatus = 'todo' | 'in_progress' | 'done';

export interface TaskItem {
  id: string;
  workspace_id: string;
  title: string;
  project?: string;
  priority: TaskPriority;
  due_date?: string;
  assignee?: string;
  status: TaskStatus;
  description?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'proposal'
  | 'negotiation'
  | 'won'
  | 'lost';

export type LeadSource =
  | 'Website'
  | 'Facebook'
  | 'Instagram'
  | 'LinkedIn'
  | 'Referral'
  | 'Email'
  | 'Cold Call'
  | 'Event'
  | 'Google Ads'
  | 'Manual';

export type LeadTag =
  | 'VIP'
  | 'Hot'
  | 'Warm'
  | 'Cold'
  | 'High Value'
  | 'Returning Customer'
  | 'Decision Maker'
  | 'Follow Up'
  | 'Demo Scheduled'
  | 'Interested'
  | 'Not Interested'
  | 'Urgent';

export type LeadPriority =
  | 'Low'
  | 'Medium'
  | 'High'
  | 'Urgent';

export interface Lead {
  id: string;
  workspace_id: string;

  // Contact Information
  name: string;
  email: string;
  phone?: string;
  company?: string;

  // Lead Information
  status: LeadStatus;
  source?: LeadSource;
  estimated_value?: number;

  // Assignment
  owner_id: string;

  // Follow-up
  next_follow_up?: string;

  // Additional Details
  notes?: string;
  tags?: LeadTag[];
  priority?: LeadPriority;

  // Audit
  created_at: string;
  updated_at: string;
}

// ============================================================================
// NORMALIZED DATA MODEL - Relationship-driven CRM
// ============================================================================

// ===== COMPANY (New Entity) =====
export interface Company {
  company_id: string;
  workspace_id: string;
  
  // Basic Info
  name: string;
  legal_name: string;
  website: string;
  phone: string;
  email: string;
  
  // Address
  address: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  
  // Tax IDs
  gst_number: string;
  pan_number: string;
  vat_number: string;
  registration_number: string;
  
  // Financial
  currency: string;
  timezone: string;
  
  // Bank Details
  bank_name: string;
  account_number: string;
  ifsc: string;
  swift: string;
  upi: string;
  
  // Branding (overrides workspace defaults)
  logo_url: string;
  footer_text: string;
  
  // Stats (computed on read)
  contact_count?: number;
  deal_count?: number;
  quote_count?: number;
  invoice_count?: number;
  total_revenue?: number;
  
  // Metadata
  created_at: string;
  updated_at: string;
  created_by: string;
}

// ===== CONTACT (New Entity) =====
export interface Contact {
  contact_id: string;
  workspace_id: string;

  // Basic Information
  name: string;
  email: string;
  phone?: string;

  // Professional Information
  designation?: string;

  // Contact Details
  is_primary: boolean;

  // Notes
  notes?: string;

  // Audit
  created_at: string;
  updated_at: string;
}

// ===== LEAD (Enhanced) =====
export interface NormalizedLead {
  lead_id: string;
  workspace_id: string;
  company_id?: string; // FK → Company (optional)
  contact_id: string; // FK → Contact (created when qualified)
  
  // Basic Info
  name: string;
  email: string;
  phone: string;
  
  // Lead Info
  source: string;
  status: NormalizedLeadStatus;
  intent: 'hot' | 'warm' | 'cold';
  
  // Scoring
  lead_score: number;
  probability: number;
  
  // Value
  potential_value: number;
  
  // Tags
  tags: string[];
  
  // Follow-up
  last_contacted: string;
  next_follow_up: string;
  follow_up_notes: string;
  
  // Conversion
  converted_to_contact: string;
  converted_to_deal: string;
  converted_at: string;
  
  // Metadata
  created_at: string;
  updated_at: string;
  created_by: string;
}

export type NormalizedLeadStatus = 
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'unqualified'
  | 'converted_contact'
  | 'converted_deal'
  | 'lost';

export type DealStatus = 'open' | 'won' | 'lost';

export type DealPriority = 'Low' | 'Medium' | 'High' | 'Urgent';

export interface Deal {
  deal_id: string;
  workspace_id: string;

  // Relationships
  company_id?: string;      // FK → Company
  contact_id: string;      // FK → Contact
  lead_id?: string;        // FK → Lead (optional)
  pipeline_id: string;     // FK → Pipeline
  stage_id: string;        // FK → PipelineStage
  owner_id: string;        // FK → User

  // Basic Information
  title: string;
  description?: string;

  // Deal Value
  value: number;
  currency: string;

  // Status
  status: DealStatus;
  priority?: DealPriority;
  probability?: number;    // 0–100

  // Source
  source?: LeadSource;

  // Timeline
  expected_close_date?: string;
  actual_close_date?: string;

  // Additional Information
  notes?: string;

  // Computed (Read-only)
  quote_count?: number;
  invoice_count?: number;
  total_quoted?: number;
  total_invoiced?: number;
  total_paid?: number;
  days_in_pipeline?: number;

  // Metadata
  created_at: string;
  updated_at: string;
  created_by: string;
}

// ===== QUOTE (Enhanced) =====
export interface NormalizedQuote {
  quote_id: string;
  workspace_id: string;
  company_id?: string; // FK → Company
  contact_id: string; // FK → Contact
  deal_id: string; // FK → Deal
  
  // Number
  quote_number: string;
  
  // Items
  items: QuoteItem[];
  
  // Financials
  subtotal: number;
  discount: number;
  discount_type: 'percentage' | 'fixed';
  tax: number;
  tax_rate: number;
  total: number;
  currency: string;
  
  // Status
  status: NormalizedQuoteStatus;
  
  // Validity
  valid_until: string;
  
  // Notes
  notes: string;
  terms_and_conditions: string;
  
  // Conversion
  converted_to_invoice: string;
  
  // Metadata
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface QuoteItem {
  item_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  tax_rate: number;
}

export type NormalizedQuoteStatus = 
  | 'draft'
  | 'sent'
  | 'viewed'
  | 'accepted'
  | 'rejected'
  | 'expired'
  | 'converted';

// ===== INVOICE (Enhanced) =====
export interface NormalizedInvoice {
  invoice_id: string;
  workspace_id: string;
  company_id?: string; // FK → Company
  contact_id: string; // FK → Contact
  deal_id: string; // FK → Deal
  quote_id: string; // FK → Quote
  
  // Number
  invoice_number: string;
  
  // Items
  items: InvoiceItem[];
  
  // Financials
  subtotal: number;
  discount: number;
  discount_type: 'percentage' | 'fixed';
  tax: number;
  tax_rate: number;
  total: number;
  currency: string;
  
  // Status
  status: NormalizedInvoiceStatus;
  
  // Timeline
  issue_date: string;
  due_date: string;
  paid_date: string;
  
  // Payment
  amount_paid: number;
  amount_due: number;
  
  // Notes
  notes: string;
  terms_and_conditions: string;
  
  // Metadata
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface InvoiceItem {
  item_id: string;
  name?: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  tax_rate: number;
}

export type NormalizedInvoiceStatus = 
  | 'draft'
  | 'pending'
  | 'sent'
  | 'viewed'
  | 'overdue'
  | 'paid'
  | 'partially_paid'
  | 'cancelled';

// ===== PAYMENT (Enhanced) =====
export interface NormalizedPayment {
  payment_type?: string;
  payment_id: string;
  workspace_id: string;
  company_id?: string; // FK → Company
  contact_id: string; // FK → Contact
  invoice_id: string; // FK → Invoice
  quote_id: string; // FK → Quote
  deal_id: string; // FK → Deal
  
  // Amount
  amount: number;
  currency: string;
  
  // Method
  method: PaymentMethod;
  reference: string;
  
  // Status
  status: PaymentStatus;
  
  // Date
  date: string;
  
  // Notes
  notes: string;
  
  // Metadata
  created_at: string;
  updated_at: string;
  created_by: string;
}

export type PaymentMethod = 
  | 'cash'
  | 'bank_transfer'
  | 'upi'
  | 'credit_card'
  | 'debit_card'
  | 'cheque'
  | 'other';

export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';

// ===== ACTIVITY (New Entity) =====
export interface NormalizedActivity {
  activity_id: string;
  workspace_id: string;
  
  // Relationships
  company_id: string;
  contact_id: string;
  deal_id: string;
  quote_id: string;
  invoice_id: string;
  lead_id: string;
  
  // Type
  type: ActivityType;
  action?: ActivityType;
  
  // Content
  title: string;
  description: string;
  
  // Metadata
  metadata: Record<string, any>;
  
  // User
  user_id: string;
  
  // Timestamps
  created_at: string;
}

export type ActivityType = 
  | 'lead_created'
  | 'lead_qualified'
  | 'lead_converted_contact'
  | 'lead_converted_deal'
  | 'lead_converted'
  | 'contact_created'
  | 'contact_updated'
  | 'deal_created'
  | 'deal_stage_changed'
  | 'deal_won'
  | 'deal_lost'
  | 'quote_created'
  | 'quote_sent'
  | 'quote_viewed'
  | 'quote_accepted'
  | 'quote_rejected'
  | 'quote_expired'
  | 'invoice_created'
  | 'invoice_sent'
  | 'invoice_viewed'
  | 'invoice_paid'
  | 'invoice_overdue'
  | 'payment_received'
  | 'payment_failed'
  | 'meeting_scheduled'
  | 'meeting_completed'
  | 'meeting_cancelled'
  | 'email_sent'
  | 'email_received'
  | 'email_opened'
  | 'email_clicked'
  | 'note_added'
  | 'task_created'
  | 'task_completed'
  | 'call_logged'
  | 'whatsapp_sent'
  | 'whatsapp_received'
  | 'document_uploaded'
  | 'document_downloaded'
  | 'status_changed'
  | 'stage_changed'
  | 'comment_added'
  | 'mention_added'
  | 'entity_created'
  | 'entity_updated'
  | 'entity_deleted'
  | 'assigned'
  | 'unassigned'
  | 'file_uploaded'
  | 'file_downloaded'
  | 'approval_requested'
  | 'approval_approved'
  | 'approval_rejected'
  | 'project_created'
  | 'project_updated'
  | 'campaign_created'
  | 'automation_executed'
  | 'webhook_triggered'
  | 'import_completed'
  | 'export_completed'
  | 'merged'
  | 'restored'
  | 'archived'
  | 'user_login'
  | 'user_created'
  | 'contract_signed';

// ===== PIPELINE (Enhanced) =====
export interface NormalizedPipeline {
  pipeline_id: string;
  workspace_id: string;

  // Basic Information
  name: string;
  description?: string;

  // Pipeline Configuration
  is_default: boolean;
  is_active: boolean;
  entity_type: "deal";
  created_by: string;

  // Relationships
  stages: NormalizedPipelineStage[];

  // Audit
  created_at: string;
  updated_at: string;
}

export interface NormalizedPipelineStage {
  stage_id: string;
  pipeline_id: string;

  // Basic Information
  name: string;
  description?: string;

  // Stage Configuration
  order: number;
  color: string;
  probability: number;
  stage_type: "open" | "won" | "lost";
  is_folded: boolean;

  // Analytics (Computed Fields)
  deal_count?: number;
  total_value?: number;

  // Audit
  created_at: string;
  updated_at: string;
}

// ===== Relationship Check Types =====
export interface RelationshipCheck {
  entity_type: string;
  entity_id: string;
  related_count: number;
  related_type: string;
}

export interface DeleteCheckResult {
  canDelete: boolean;
  reason?: string;
  relationships: RelationshipCheck[];
}

// ===== Related Entities (for Context Panel) =====
export interface RelatedEntities {
  contacts: Contact[];
  deals: Deal[];
  quotes: NormalizedQuote[];
  invoices: NormalizedInvoice[];
  payments: NormalizedPayment[];
  activities: NormalizedActivity[];
  tasks: TaskItem[];
  meetings: MeetingRequest[];
}

// ===== Auto-Fill Defaults =====
export interface AutoFillDefaults {
  currency: string;
  timezone: string;
  gst_number: string;
  pan_number: string;
  vat_number: string;
  bank_name: string;
  account_number: string;
  ifsc: string;
  swift: string;
  upi: string;
  logo_url: string;
  footer_text: string;
  address: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
}

// ===== Event Types =====
export type EventType = 
  | 'company:created'
  | 'company:updated'
  | 'company:deleted'
  | 'contact:created'
  | 'contact:updated'
  | 'contact:deleted'
  | 'lead:created'
  | 'lead:updated'
  | 'lead:qualified'
  | 'lead:converted'
  | 'deal:created'
  | 'deal:updated'
  | 'deal:deleted'
  | 'deal:stage_changed'
  | 'deal:won'
  | 'deal:lost'
  | 'quote:created'
  | 'quote:updated'
  | 'quote:deleted'
  | 'quote:sent'
  | 'quote:accepted'
  | 'quote:rejected'
  | 'invoice:created'
  | 'invoice:updated'
  | 'invoice:deleted'
  | 'invoice:sent'
  | 'invoice:paid'
  | 'invoice:overdue'
  | 'payment:created'
  | 'payment:updated'
  | 'payment:deleted'
  | 'payment:received'
  | 'payment:failed'
  | 'activity:created'
  | 'dashboard:refresh';


// ============================================================================
// NEW MODULES - Extended CRM Features
// ============================================================================

// ===== 1. CUSTOM FIELDS =====
export interface CustomField {
  custom_field_id: string;
  workspace_id: string;
  entity_type: string;
  field_name: string;
  field_type: string;
  options: string[];
  is_required: boolean;
  order: number;
}

export interface CustomFieldValue {
  custom_field_value_id: string;
  custom_field_id: string;
  entity_id: string;
  entity_type: string;
  value: string;
}

// ===== 2. TAGS =====
export interface Tag {
  tag_id: string;
  workspace_id: string;
  name: string;
  color: string;
}

export interface TagRelation {
  tag_relation_id: string;
  tag_id: string;
  entity_id: string;
  entity_type: string;
}

// ===== 3. COMMENTS =====
export interface Comment {
  comment_id: string;
  workspace_id: string;
  entity_id: string;
  entity_type: string;
  content: string;
  author_id: string;
  parent_id: string;
}

// ===== 4. MENTIONS =====
export interface Mention {
  mention_id: string;
  comment_id: string;
  user_id: string;
  mentioned_at: string;
}

// ===== 5. ATTACHMENTS =====
export interface Attachment {
  attachment_id: string;
  workspace_id: string;
  entity_id: string;
  entity_type: string;
  file_url: string;
  file_name: string;
  file_type: string;
  file_size: number;
  uploaded_by: string;
}

// ===== 6. WATCHERS =====
export interface Watcher {
  watcher_id: string;
  entity_id: string;
  entity_type: string;
  user_id: string;
  notify_on: string;
}

// ===== 7. ACTIVITY FEED =====
// ActivityLog interface already exists above with all required fields:
// activity_id, workspace_id, type, title, description, workspace_id, contact_id,
// deal_id, quote_id, invoice_id, project_id, task_id, user_id, metadata

// ===== 8. APPROVAL WORKFLOW =====
export interface Approval {
  approval_id: string;
  workspace_id: string;
  entity_id: string;
  entity_type: string;
  status: string;
  requested_by: string;
  approved_by: string;
  approved_at: string;
  notes: string;
}

// ===== 9. IMPORT/EXPORT =====
export interface ImportJob {
  import_job_id: string;
  workspace_id: string;
  entity_type: string;
  file_url: string;
  status: string;
  total_rows: number;
  processed_rows: number;
  error_count: number;
}

export interface ExportJob {
  export_job_id: string;
  workspace_id: string;
  entity_type: string;
  status: string;
  file_url: string;
  filters: Record<string, any>;
}

// ===== 10. DUPLICATE DETECTION =====
export interface DuplicateRecord {
  duplicate_record_id: string;
  workspace_id: string;
  entity_type: string;
  entity_id_1: string;
  entity_id_2: string;
  similarity_score: number;
  status: string;
}

// ===== 11. MERGE HISTORY =====
export interface MergeHistory {
  merge_history_id: string;
  workspace_id: string;
  entity_type: string;
  primary_id: string;
  merged_id: string;
  merged_by: string;
  merged_at: string;
}

// ===== 12. TRASH/RESTORE =====
export interface TrashRecord {
  trash_record_id: string;
  workspace_id: string;
  entity_type: string;
  entity_id: string;
  deleted_by: string;
  deleted_at: string;
  expires_at: string;
}

// ===== 13. ARCHIVE =====
export interface ArchiveRecord {
  archive_record_id: string;
  workspace_id: string;
  entity_type: string;
  entity_id: string;
  archived_by: string;
  archived_at: string;
}

// ===== 14. VERSION HISTORY =====
export interface VersionHistory {
  version_history_id: string;
  entity_type: string;
  entity_id: string;
  field_name: string;
  old_value: string;
  new_value: string;
  changed_by: string;
  changed_at: string;
}

// ===== 15. RECURRING INVOICES =====
export interface RecurringInvoice {
  recurring_invoice_id: string;
  workspace_id: string;
  invoice_template_id: string;
  frequency: string;
  next_date: string;
  end_date: string;
  status: string;
}

// ===== 16. SUBSCRIPTIONS =====
export interface Subscription {
  subscription_id: string;
  workspace_id: string;
  contact_id: string;
  plan_id: string;
  status: string;
  start_date: string;
  end_date: string;
  next_billing_date: string;
}

export interface SubscriptionPlan {
  subscription_plan_id: string;
  workspace_id: string;
  name: string;
  price: number;
  billing_cycle: string;
  features: string[];
}

// ===== 17. PRODUCT CATALOG =====
export interface Product {
  product_id: string;
  workspace_id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  sku: string;
  category: string;
  status: string;
  is_active: boolean;
}

// ===== 18. PURCHASE ORDERS =====
export interface PurchaseOrder {
  purchase_order_id: string;
  workspace_id: string;
  contact_id: string;
  order_number: string;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: string;
  expected_delivery_date: string;
}

// ===== 19. CONTRACTS =====
export interface ContractLegacy {
  contract_id: string;
  workspace_id: string;
  contact_id: string;
  deal_id: string;
  title: string;
  status: string;
  start_date: string;
  end_date: string;
  value: number;
  terms: string;
}

// ===== 20. ESIGNATURE =====
export interface Esignature {
  esignature_id: string;
  contract_id: string;
  signer_name: string;
  signer_email: string;
  status: string;
  signed_at: string;
  signature_data: string;
}

// ===== 21. CALL LOGS =====
export interface CallLog {
  call_log_id: string;
  workspace_id: string;
  contact_id: string;
  direction: string;
  duration: number;
  notes: string;
  outcome: string;
  call_date: string;
}

// ===== 22. EMAIL INBOX SYNC =====
export interface EmailAccount {
  email_account_id: string;
  workspace_id: string;
  email: string;
  provider: string;
  status: string;
  last_synced_at: string;
}

export interface EmailThread {
  email_thread_id: string;
  workspace_id: string;
  subject: string;
  contact_id: string;
  last_message_at: string;
  message_count: number;
}

export interface EmailMessage {
  email_message_id: string;
  thread_id: string;
  from_address: string;
  to_addresses: string[];
  subject: string;
  body: string;
  sent_at: string;
  is_read: boolean;
}

// ===== 23. WHATSAPP CONVERSATIONS =====
export interface WhatsAppConversation {
  whatsapp_conversation_id: string;
  workspace_id: string;
  contact_id: string;
  phone_number: string;
  status: string;
  last_message_at: string;
}

export interface WhatsAppMessage {
  whatsapp_message_id: string;
  conversation_id: string;
  direction: string;
  content: string;
  media_url: string;
  sent_at: string;
  status: string;
}

// ===== 24. CALENDAR SYNC =====
export interface CalendarSync {
  calendar_sync_id: string;
  workspace_id: string;
  provider: string;
  calendar_id: string;
  status: string;
  last_synced_at: string;
}

// ===== 25. NOTIFICATION CHANNELS =====
export interface NotificationChannel {
  notification_channel_id: string;
  workspace_id: string;
  type: string;
  name: string;
  config: Record<string, any>;
  is_active: boolean;
}

// ===== 26. AUDIT LOGS =====
export interface AuditLog {
  audit_log_id: string;
  workspace_id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  old_value: Record<string, any>;
  new_value: Record<string, any>;
  ip_address: string;
  user_agent: string;
  created_at: string;
}

// ===== 27. API RATE LIMITS =====
// ApiKey is defined in automation types
export interface ApiRateLimit {
  api_rate_limit_id: string;
  workspace_id: string;
  endpoint: string;
  method: string;
  limit: number;
  window_seconds: number;
  current_count: number;
}

// ===== 28. FEATURE FLAGS =====
export interface FeatureFlag {
  feature_flag_id: string;
  workspace_id: string;
  name: string;
  description: string;
  is_enabled: boolean;
  rollout_percentage: number;
  created_by: string;
}

// ===== 29. BILLING USAGE =====
export interface BillingUsage {
  billing_usage_id: string;
  workspace_id: string;
  period: string;
  api_calls: number;
  storage_used_mb: number;
  active_users: number;
  cost: number;
}

// ===== 30. SEARCH INDEX =====
export interface SearchIndex {
  search_index_id: string;
  workspace_id: string;
  entity_type: string;
  entity_id: string;
  title: string;
  content: string;
  tags: string[];
  indexed_at: string;
}

// ===== 31. SAVED FILTERS =====
export interface SavedFilter {
  saved_filter_id: string;
  workspace_id: string;
  user_id: string;
  name: string;
  entity_type: string;
  filters: Record<string, any>;
  is_shared: boolean;
}

// ===== 32. DASHBOARD WIDGETS =====
export interface DashboardWidget {
  dashboard_widget_id: string;
  workspace_id: string;
  user_id: string;
  widget_type: string;
  title: string;
  config: Record<string, any>;
  position: number;
  size: string;
}

// ===== 33. SLA =====
export interface SLAPolicy {
  sla_policy_id: string;
  workspace_id: string;
  name: string;
  entity_type: string;
  response_time_hours: number;
  resolution_time_hours: number;
  escalation_chain: string[];
}

// ===== 34. KNOWLEDGE BASE =====
export interface KnowledgeBaseCategory {
  knowledge_base_category_id: string;
  workspace_id: string;
  name: string;
  description: string;
  order: number;
}

export interface KnowledgeBaseArticle {
  knowledge_base_article_id: string;
  workspace_id: string;
  category_id: string;
  title: string;
  content: string;
  author_id: string;
  status: string;
  view_count: number;
}

// ===== 35. CUSTOMER PORTAL =====
export interface PortalUser {
  portal_user_id: string;
  workspace_id: string;
  contact_id: string;
  role: string;
  last_login_at: string;
}

export interface PortalSession {
  portal_session_id: string;
  portal_user_id: string;
  token: string;
  expires_at: string;
}

// ===== 36. MOBILE PUSH TOKENS =====
export interface MobilePushToken {
  mobile_push_token_id: string;
  workspace_id: string;
  user_id: string;
  token: string;
  platform: string;
  device_name: string;
  is_active: boolean;
}

// ===== 37. AI MEMORY =====
export interface AiMemory {
  ai_memory_id: string;
  workspace_id: string;
  user_id: string;
  entity_type: string;
  entity_id: string;
  context: string;
  embedding: number[];
  created_at: string;
}

// ===== AUTOMATION / MARKETING / ADDITIONAL TYPES =====

// Automation Rules
export type TriggerType = 'record_created' | 'record_updated' | 'record_deleted' | 'field_changed' | 'schedule' | 'webhook' | 'manual';
export type ActionType = 'send_email' | 'create_record' | 'update_record' | 'delete_record' | 'add_tag' | 'remove_tag' | 'send_notification' | 'run_webhook' | 'update_field' | 'assign_to' | 'create_task';
export type ConditionOperator = 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'is_empty' | 'is_not_empty' | 'in' | 'not_in' | 'starts_with' | 'ends_with';
export interface AutomationCondition {
  field: string;
  operator: ConditionOperator;
  value: any;
}

// Workflows
export type WorkflowNodeType = 'trigger' | 'action' | 'condition' | 'delay' | 'branch' | 'loop' | 'end';
export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  config: Record<string, any>;
  next?: string[];
  position?: { x: number; y: number };
}
export interface Workflow {
  id: string;
  workspace_id: string;
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: Array<{ source: string; target: string }>;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

// Execution
export type ExecutionStatus = 'running' | 'completed' | 'failed' | 'cancelled' | 'pending' | 'timeout';
export type TriggerSource = 'manual' | 'schedule' | 'webhook' | 'event';
export interface ExecutionLog {
  id: string;
  log_id?: string;
  rule_id?: string;
  workflow_id?: string;
  status: ExecutionStatus;
  trigger_source: TriggerSource;
  input?: Record<string, any>;
  output?: Record<string, any>;
  error?: string;
  steps?: ExecutionStep[];
  duration_ms?: number;
  started_at: string;
  completed_at?: string;
  created_at: string;
}
export interface ExecutionStep {
  id: string;
  execution_id: string;
  node_id?: string;
  action_type?: string;
  status: ExecutionStatus;
  input?: Record<string, any>;
  output?: Record<string, any>;
  error?: string;
  started_at: string;
  completed_at?: string;
}

// Secrets
export interface Secret {
  id: string;
  secret_id?: string;
  workspace_id: string;
  name: string;
  value: string;
  description?: string;
  category?: string;
  platform?: string;
  created_at: string;
  updated_at: string;
}

// Variables
export type VariableCategory = 'system' | 'user' | 'workspace' | 'global';
export interface Variable {
  id: string;
  variable_id?: string;
  workspace_id?: string;
  name: string;
  value: any;
  category?: VariableCategory;
  description?: string;
  created_at: string;
  updated_at: string;
}

// Automation Templates
export type AutomationTemplateType = 'prebuilt' | 'custom' | 'community';
export interface AutomationTemplate {
  id: string;
  template_id?: string;
  name: string;
  description?: string;
  type: AutomationTemplateType;
  category?: string;
  trigger?: string;
  content?: string;
  actions?: AutomationAction[];
  conditions?: AutomationCondition[];
  config?: Record<string, any>;
  usage_count?: number;
  rating?: number;
  created_at: string;
  updated_at: string;
}

// Webhooks
export type WebhookDirection = 'inbound' | 'outbound' | 'incoming' | 'outgoing';
export type WebhookStatus = 'active' | 'inactive' | 'error' | 'pending' | 'disabled';
export interface Webhook {
  id: string;
  webhook_id?: string;
  workspace_id: string;
  name: string;
  url: string;
  direction?: WebhookDirection;
  events?: string[];
  headers?: Record<string, string>;
  secret?: string;
  status: WebhookStatus;
  success_count?: number;
  failure_count?: number;
  last_triggered_at?: string;
  created_at: string;
  updated_at: string;
}
export interface WebhookLog {
  id: string;
  webhook_id: string;
  direction?: WebhookDirection;
  request?: Record<string, any>;
  response?: Record<string, any>;
  status_code?: number;
  error?: string;
  created_at: string;
}

// Connected Apps / Integrations
export type IntegrationPlatform = 'google' | 'microsoft' | 'slack' | 'zapier' | 'hubspot' | 'salesforce' | 'quickbooks' | 'stripe' | 'whatsapp' | 'meta_ads' | 'google_ads' | 'website_enquiries' | 'custom';
export interface ConnectedApp {
  id: string;
  app_id?: string;
  workspace_id?: string;
  platform: IntegrationPlatform;
  name: string;
  status: string;
  api_key?: string;
  config?: Record<string, any>;
  last_synced_at?: string;
  connected_at?: string;
  created_at: string;
  updated_at: string;
}

// Campaign Metrics
export interface CampaignMetrics {
  impressions?: number;
  clicks?: number;
  conversions?: number;
  ctr?: number;
  cpc?: number;
  cpm?: number;
  roas?: number;
  spend?: number;
  revenue?: number;
}

// Social
export type PostStatus = 'scheduled' | 'publishing' | 'published' | 'failed' | 'draft';
export interface SocialMetrics {
  likes: number;
  comments: number;
  shares: number;
  impressions: number;
  reach: number;
  engagement_rate: number;
}

// Email
export type EmailTemplateStatus = 'draft' | 'active' | 'archived' | 'scheduled';
export type EmailRecipientStatus = 'pending' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed';
export interface EmailRecipient {
  id?: string;
  email: string;
  name?: string;
  status?: EmailRecipientStatus;
  opened_at?: string;
  clicked_at?: string;
}
export interface EmailMetrics {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complaints: number;
  unsubscribes: number;
  open_rate: number;
  click_rate: number;
  unsubscribe_rate: number;
}
export interface EmailSegment {
  id: string;
  segment_id?: string;
  workspace_id?: string;
  name: string;
  description?: string;
  conditions?: Record<string, any>[];
  contact_count?: number;
  created_at: string;
  updated_at: string;
}

// Content
export type ContentType = 'blog' | 'page' | 'landing_page' | 'email' | 'social' | 'document' | 'template';
export interface SEOData {
  title?: string;
  description?: string;
  keywords?: string[];
  og_image?: string;
  canonical_url?: string;
  no_index?: boolean;
}

// Media
export type MediaType = 'image' | 'video' | 'document' | 'audio' | 'other';
export interface MediaFolder {
  id: string;
  folder_id?: string;
  workspace_id?: string;
  name: string;
  parent_id?: string;
  path?: string;
  created_at: string;
}
export interface MediaVersion {
  id: string;
  file_id?: string;
  url: string;
  size: number;
  dimensions?: string;
  created_at: string;
}
export interface MediaFile {
  id: string;
  file_id?: string;
  workspace_id?: string;
  name: string;
  type: MediaType;
  size: number;
  dimensions: string;
  url: string;
  folder_id?: string;
  created_at: string;
  updated_at?: string;
}

// Calendar
export type CalendarEventType = 'meeting' | 'task' | 'deadline' | 'reminder' | 'call' | 'campaign' | 'other';

// MCP
export type McpServerStatus = 'connected' | 'disconnected' | 'error' | 'pending';
export interface McpServer {
  id: string;
  server_id?: string;
  workspace_id?: string;
  name: string;
  status: McpServerStatus;
  url?: string;
  description?: string;
  api_key?: string;
  capabilities?: string[];
  tools?: McpTool[];
  config?: Record<string, any>;
  created_at: string;
  updated_at: string;
}
export interface McpTool {
  id: string;
  tool_id?: string;
  server_id?: string;
  name: string;
  description?: string;
  parameters?: Record<string, any>;
  enabled?: boolean;
}

// Docs
export type DocCategory = 'getting_started' | 'api' | 'guides' | 'faq' | 'changelog' | 'support' | 'other';
export interface DocPage {
  id: string;
  page_id?: string;
  title: string;
  slug?: string;
  content?: string;
  category?: DocCategory;
  tags?: string[];
  published?: boolean;
  author?: string;
  created_at: string;
  updated_at: string;
}
export interface IntegrationDoc {
  id: string;
  integration_id?: string;
  title: string;
  content?: string;
  url?: string;
  created_at: string;
  updated_at: string;
}

// API Keys
export type ApiKeyScope = 'read' | 'write' | 'admin' | 'full_access';
export interface ApiKey {
  id: string;
  key_id?: string;
  workspace_id?: string;
  name: string;
  key: string;
  key_prefix?: string;
  scopes?: ApiKeyScope[];
  rate_limit?: number;
  expires_at?: string;
  last_used_at?: string;
  created_at: string;
}

// ===== TYPE ALIASES (Backward Compatibility) =====
// Note: Some aliases (TaskItem, NormalizedActivity, NormalizedDeal, NormalizedLead,
// NormalizedQuote, NormalizedInvoice, NormalizedPayment, NormalizedQuoteStatus,
// NormalizedInvoiceStatus, ActivityType, TeamMember, MediaItem) already exist as
// interfaces or types in this file. These aliases are intentionally omitted to
// avoid duplicate identifier conflicts. The existing definitions serve the same purpose.
