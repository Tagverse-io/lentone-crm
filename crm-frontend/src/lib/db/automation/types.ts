// ============================================================================
// Automation Hub Types — Re-exports from consolidated types.ts
// ============================================================================
// All types are now defined in lib/db/types.ts
// This file re-exports them for backward compatibility
// ============================================================================

export type {
  // Automation Rules
  TriggerType,
  ActionType,
  ConditionOperator,
  AutomationCondition,
  AutomationAction,
  AutomationRule,
  // Workflows
  WorkflowNodeType,
  WorkflowNode,
  Workflow,
  // Execution
  ExecutionStatus,
  TriggerSource,
  ExecutionLog,
  ExecutionStep,
  // Secrets
  Secret,
  // Variables
  VariableCategory,
  Variable,
  // Templates
  AutomationTemplateType,
  AutomationTemplate,
  // Webhooks
  WebhookDirection,
  WebhookStatus,
  Webhook,
  WebhookLog,
  // Connected Apps
  IntegrationPlatform,
  ConnectedApp,
  // Campaigns
  CampaignChannel,
  CampaignStatus,
  CampaignMetrics,
  Campaign,
  // Social
  SocialPlatform,
  PostStatus,
  SocialMetrics,
  SocialPost,
  // Email
  EmailTemplateStatus,
  EmailTemplate,
  EmailCampaignStatus,
  EmailRecipientStatus,
  EmailRecipient,
  EmailMetrics,
  EmailCampaign,
  EmailLog,
  EmailSegment,
  // Content
  ContentType,
  ContentStatus,
  SEOData,
  ContentItem,
  // Media
  MediaType,
  MediaFolder,
  MediaVersion,
  MediaFile,
  // Calendar
  CalendarEventType,
  CalendarEvent,
  // MCP
  McpServerStatus,
  McpServer,
  McpTool,
  // Docs
  DocCategory,
  DocPage,
  IntegrationDoc,
  // API Keys
  ApiKeyScope,
  ApiKey,
} from '../types';
