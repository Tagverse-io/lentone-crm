// Shared CRM domain types. RTDB schema root: /orgs/{orgId}/...

export type OrgRole = "admin" | "member";

export interface OrgUser {
  id: string; // mirrors uid (RTDB key)
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: OrgRole;
  notificationPrefs?: NotificationPrefs;
  createdAt: string;
}

export type LeadStage = "New" | "Contacted" | "Qualified" | "Proposal" | "Won" | "Lost";

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  stage: LeadStage;
  value?: number;
  source?: string;
  assignedTo?: string;
  notes?: string;
  nextFollowUp?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  address?: string;
  source?: string;
  leadId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Contact {
  id: string;
  clientId?: string;
  name: string;
  email: string;
  phone?: string;
  designation?: string;
  isPrimary?: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FollowUp {
  id: string;
  leadId?: string;
  clientId?: string;
  title: string;
  notes?: string;
  dueAt: string;
  done: boolean;
  assignedTo?: string;
  createdAt: string;
}

export type QuotationStatus = "draft" | "sent" | "accepted" | "rejected" | "expired";

export interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface Quotation {
  id: string;
  number: string;
  clientId: string;
  clientName?: string;
  items: LineItem[];
  subtotal: number;
  taxAmount: number;
  total: number;
  status: QuotationStatus;
  validUntil: string;
  notes?: string;
  createProjectOnAccept?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type InvoiceStatus = "draft" | "sent" | "paid" | "partial" | "overdue" | "cancelled";

export interface Invoice {
  id: string;
  number: string;
  clientId: string;
  clientName?: string;
  quotationId?: string;
  projectId?: string;
  items: LineItem[];
  subtotal: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  amountDue: number;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  method: string;
  reference?: string;
  date: string;
  notes?: string;
  createdAt: string;
}

export type ProjectStatus = "not_started" | "in_progress" | "on_hold" | "completed" | "cancelled";

export interface Project {
  id: string;
  title: string;
  description?: string;
  clientId?: string;
  clientName?: string;
  status: ProjectStatus;
  progress: number;
  deadline?: string;
  assignedTo?: string[];
  leadId?: string;
  createdAt: string;
  updatedAt: string;
}

export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface Task {
  id: string;
  projectId?: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string;
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
}

export type SocialPlatform = "facebook" | "instagram" | "linkedin" | "x" | "youtube";

export interface SocialAccount {
  id: string;
  platform: SocialPlatform;
  handle: string;
  connected: boolean;
  createdAt: string;
}

export type PostStatus = "draft" | "scheduled" | "published" | "failed";

export interface Post {
  id: string;
  platform: SocialPlatform | "all";
  content: string;
  mediaUrl?: string;
  status: PostStatus;
  scheduledAt?: string;
  publishedAt?: string;
  accountId?: string;
  createdAt: string;
  updatedAt: string;
}

export type VideoStage = "idea" | "script" | "shoot" | "edit" | "review" | "published";

export interface VideoProduction {
  id: string;
  title: string;
  stage: VideoStage;
  assignee?: string;
  dueDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type CalendarSource = "crm" | "task" | "project" | "followup" | "social" | "google";

export interface CrmEvent {
  id: string;
  title: string;
  description?: string;
  start: string;
  end?: string;
  allDay?: boolean;
  location?: string;
  relatedId?: string;
  relatedType?: string;
  createdAt: string;
}

// Normalized event merging every source for the Central Calendar.
export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay?: boolean;
  source: CalendarSource;
  color: string;
  description?: string;
  link?: string;
}

export const SOURCE_COLORS: Record<CalendarSource, string> = {
  crm: "#4f46e5",
  task: "#f59e0b",
  project: "#10b981",
  followup: "#ef4444",
  social: "#ec4899",
  google: "#0ea5e9",
};

export type NotificationType =
  | "lead_assigned"
  | "lead_won"
  | "followup_due"
  | "followup_overdue"
  | "quotation_accepted"
  | "quotation_rejected"
  | "invoice_created"
  | "invoice_overdue"
  | "payment_received"
  | "task_assigned"
  | "task_due_soon"
  | "digest";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

export interface NotificationPrefs {
  emailEnabled: boolean;
  inAppEnabled: boolean;
  mutedTypes?: NotificationType[];
}

export const DEFAULT_PREFS: NotificationPrefs = { emailEnabled: true, inAppEnabled: true, mutedTypes: [] };

export interface AutomationLogEntry {
  id: string;
  name: string;
  status: "ok" | "error" | "skipped";
  detail?: string;
  emailSent?: boolean;
  emailError?: string;
  createdAt: string;
}

export type EntityKey =
  | "leads"
  | "clients"
  | "contacts"
  | "followUps"
  | "quotations"
  | "invoices"
  | "payments"
  | "projects"
  | "tasks"
  | "socialAccounts"
  | "posts"
  | "videoProductions"
  | "events"
  | "notifications"
  | "users"
  | "automationsLog";
