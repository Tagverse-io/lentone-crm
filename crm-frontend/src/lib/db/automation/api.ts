import { ref, set, get, push, query, orderByChild, equalTo, onValue, off, update, remove } from 'firebase/database';
import { database } from '@/lib/firebase/config';
import { 
  AutomationRule, 
  ConnectedApp, 
  ExecutionLog, 
  Secret, 
  Variable, 
  AutomationTemplate,
  Webhook,
  WebhookLog,
  ApiKey,
  Campaign,
  SocialPost,
  EmailCampaign,
  EmailSegment,
  ContentItem,
  MediaFile,
  MediaFolder,
  CalendarEvent,
  DocPage,
  McpServer,
  McpTool
} from './types';
import { getCurrentUserId } from '@/lib/firebase/auth';

// ===== Helper Refs =====
const workspaceRef = (workspaceId: string) => ref(database, `orgs/${workspaceId}`);
const appsRef = (workspaceId: string) => ref(database, `orgs/${workspaceId}/connected_apps`);
const rulesRef = (workspaceId: string) => ref(database, `orgs/${workspaceId}/automation_rules`);
const executionsRef = (workspaceId: string) => ref(database, `orgs/${workspaceId}/execution_logs`);
const secretsRef = (workspaceId: string) => ref(database, `orgs/${workspaceId}/secrets`);
const variablesRef = (workspaceId: string) => ref(database, `orgs/${workspaceId}/variables`);
const templatesRef = (workspaceId: string) => ref(database, `orgs/${workspaceId}/automation_templates`);
const webhooksRef = (workspaceId: string) => ref(database, `orgs/${workspaceId}/webhooks`);
const webhookLogsRef = (workspaceId: string, webhookId: string) => ref(database, `orgs/${workspaceId}/webhook_logs/${webhookId}`);
const apiKeysRef = (workspaceId: string) => ref(database, `orgs/${workspaceId}/api_keys`);
const campaignsRef = (workspaceId: string) => ref(database, `orgs/${workspaceId}/campaigns`);
const socialPostsRef = (workspaceId: string) => ref(database, `orgs/${workspaceId}/social_posts`);
const emailCampaignsRef = (workspaceId: string) => ref(database, `orgs/${workspaceId}/email_campaigns`);
const emailSegmentsRef = (workspaceId: string) => ref(database, `orgs/${workspaceId}/email_segments`);
const contentRef = (workspaceId: string) => ref(database, `orgs/${workspaceId}/content`);
const mediaRef = (workspaceId: string) => ref(database, `orgs/${workspaceId}/media`);
const mediaFoldersRef = (workspaceId: string) => ref(database, `orgs/${workspaceId}/media_folders`);
const calendarRef = (workspaceId: string) => ref(database, `orgs/${workspaceId}/calendar_events`);
const docsRef = (workspaceId: string) => ref(database, `orgs/${workspaceId}/docs`);

// ===== Connected Apps =====

export async function connectApp(workspaceId: string, app: Omit<ConnectedApp, 'app_id' | 'created_at' | 'updated_at'>): Promise<ConnectedApp> {
  const newRef = push(appsRef(workspaceId));
  const appId = newRef.key!;
  const now = new Date().toISOString();
  
  const connectedApp: ConnectedApp = {
    ...app,
    app_id: appId,
    created_at: now,
    updated_at: now,
  };
  
  await set(newRef, connectedApp);
  return connectedApp;
}

export async function getConnectedApps(workspaceId: string): Promise<ConnectedApp[]> {
  const snapshot = await get(appsRef(workspaceId));
  if (!snapshot.exists()) return [];
  return Object.values(snapshot.val()) as ConnectedApp[];
}

export async function disconnectApp(workspaceId: string, appId: string): Promise<void> {
  await remove(ref(database, `orgs/${workspaceId}/connected_apps/${appId}`));
}

export function subscribeToApps(workspaceId: string, callback: (apps: ConnectedApp[]) => void): () => void {
  const q = appsRef(workspaceId);
  const unsubscribe = onValue(q, (snapshot) => {
    if (snapshot.exists()) {
      callback(Object.values(snapshot.val()) as ConnectedApp[]);
    } else {
      callback([]);
    }
  });
  return () => off(q, 'value', unsubscribe);
}

// ===== Automation Rules =====

export async function createRule(workspaceId: string, rule: Omit<AutomationRule, 'rule_id' | 'created_at' | 'updated_at'>): Promise<AutomationRule> {
  const newRef = push(rulesRef(workspaceId));
  const ruleId = newRef.key!;
  const now = new Date().toISOString();
  
  const fullRule: AutomationRule = {
    ...rule,
    rule_id: ruleId,
    created_at: now,
    updated_at: now,
  };
  
  await set(newRef, fullRule);
  return fullRule;
}

export async function getRules(workspaceId: string): Promise<AutomationRule[]> {
  const snapshot = await get(rulesRef(workspaceId));
  if (!snapshot.exists()) return [];
  return Object.values(snapshot.val()) as AutomationRule[];
}

export async function getRule(workspaceId: string, ruleId: string): Promise<AutomationRule | null> {
  const snapshot = await get(ref(database, `orgs/${workspaceId}/automation_rules/${ruleId}`));
  if (!snapshot.exists()) return null;
  return snapshot.val() as AutomationRule;
}

export async function updateRule(workspaceId: string, ruleId: string, updates: Partial<AutomationRule>): Promise<void> {
  const now = new Date().toISOString();
  await update(ref(database, `orgs/${workspaceId}/automation_rules/${ruleId}`), {
    ...updates,
    updated_at: now,
  });
}

export async function deleteRule(workspaceId: string, ruleId: string): Promise<void> {
  await remove(ref(database, `orgs/${workspaceId}/automation_rules/${ruleId}`));
}

export async function toggleRule(workspaceId: string, ruleId: string, enabled: boolean): Promise<void> {
  await updateRule(workspaceId, ruleId, { enabled });
}

export function subscribeToRules(workspaceId: string, callback: (rules: AutomationRule[]) => void): () => void {
  const q = rulesRef(workspaceId);
  const unsubscribe = onValue(q, (snapshot) => {
    if (snapshot.exists()) {
      callback(Object.values(snapshot.val()) as AutomationRule[]);
    } else {
      callback([]);
    }
  });
  return () => off(q, 'value', unsubscribe);
}

// ===== Execution Logs =====

export async function createExecutionLog(workspaceId: string, log: Omit<ExecutionLog, 'log_id' | 'created_at'>): Promise<ExecutionLog> {
  const newRef = push(executionsRef(workspaceId));
  const logId = newRef.key!;
  
  const fullLog: ExecutionLog = {
    ...log,
    log_id: logId,
    created_at: new Date().toISOString(),
  };
  
  await set(newRef, fullLog);
  return fullLog;
}

export async function getExecutionLogs(workspaceId: string, ruleId?: string, limit?: number): Promise<ExecutionLog[]> {
  let q;
  if (ruleId) {
    q = query(executionsRef(workspaceId), orderByChild('rule_id'), equalTo(ruleId));
  } else {
    q = query(executionsRef(workspaceId), orderByChild('created_at'));
  }
  
  const snapshot = await get(q);
  if (!snapshot.exists()) return [];
  
  const logs = Object.values(snapshot.val()) as ExecutionLog[];
  const sorted = logs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  
  return limit ? sorted.slice(0, limit) : sorted;
}

export async function updateExecutionLog(workspaceId: string, logId: string, updates: Partial<ExecutionLog>): Promise<void> {
  await update(ref(database, `orgs/${workspaceId}/execution_logs/${logId}`), updates);
}

export function subscribeToExecutionLogs(workspaceId: string, callback: (logs: ExecutionLog[]) => void, limit?: number): () => void {
  let q = query(executionsRef(workspaceId), orderByChild('created_at'));
  
  const unsubscribe = onValue(q, (snapshot) => {
    if (snapshot.exists()) {
      const logs = Object.values(snapshot.val()) as ExecutionLog[];
      const sorted = logs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      callback(limit ? sorted.slice(0, limit) : sorted);
    } else {
      callback([]);
    }
  });
  
  return () => off(q, 'value', unsubscribe);
}

// ===== Secrets =====

export async function createSecret(workspaceId: string, secret: Omit<Secret, 'secret_id' | 'created_at' | 'updated_at'>): Promise<Secret> {
  const newRef = push(secretsRef(workspaceId));
  const secretId = newRef.key!;
  const now = new Date().toISOString();
  
  const fullSecret: Secret = {
    ...secret,
    secret_id: secretId,
    created_at: now,
    updated_at: now,
  };
  
  await set(newRef, fullSecret);
  return fullSecret;
}

export async function getSecrets(workspaceId: string): Promise<Secret[]> {
  const snapshot = await get(secretsRef(workspaceId));
  if (!snapshot.exists()) return [];
  return Object.values(snapshot.val()) as Secret[];
}

export async function updateSecret(workspaceId: string, secretId: string, updates: Partial<Secret>): Promise<void> {
  const now = new Date().toISOString();
  await update(ref(database, `orgs/${workspaceId}/secrets/${secretId}`), {
    ...updates,
    updated_at: now,
  });
}

export async function deleteSecret(workspaceId: string, secretId: string): Promise<void> {
  await remove(ref(database, `orgs/${workspaceId}/secrets/${secretId}`));
}

// ===== Variables =====

export async function createVariable(workspaceId: string, variable: Omit<Variable, 'variable_id' | 'created_at' | 'updated_at'>): Promise<Variable> {
  const newRef = push(variablesRef(workspaceId));
  const variableId = newRef.key!;
  const now = new Date().toISOString();
  
  const fullVariable: Variable = {
    ...variable,
    variable_id: variableId,
    created_at: now,
    updated_at: now,
  };
  
  await set(newRef, fullVariable);
  return fullVariable;
}

export async function getVariables(workspaceId: string): Promise<Variable[]> {
  const snapshot = await get(variablesRef(workspaceId));
  if (!snapshot.exists()) return [];
  return Object.values(snapshot.val()) as Variable[];
}

export async function updateVariable(workspaceId: string, variableId: string, updates: Partial<Variable>): Promise<void> {
  const now = new Date().toISOString();
  await update(ref(database, `orgs/${workspaceId}/variables/${variableId}`), {
    ...updates,
    updated_at: now,
  });
}

export async function deleteVariable(workspaceId: string, variableId: string): Promise<void> {
  await remove(ref(database, `orgs/${workspaceId}/variables/${variableId}`));
}

// ===== Templates =====

export async function createTemplate(workspaceId: string, template: Omit<AutomationTemplate, 'template_id' | 'created_at' | 'updated_at'>): Promise<AutomationTemplate> {
  const newRef = push(templatesRef(workspaceId));
  const templateId = newRef.key!;
  const now = new Date().toISOString();
  
  const fullTemplate: AutomationTemplate = {
    ...template,
    template_id: templateId,
    created_at: now,
    updated_at: now,
  };
  
  await set(newRef, fullTemplate);
  return fullTemplate;
}

export async function getTemplates(workspaceId: string, type?: string): Promise<AutomationTemplate[]> {
  let q;
  if (type) {
    q = query(templatesRef(workspaceId), orderByChild('type'), equalTo(type));
  } else {
    q = templatesRef(workspaceId);
  }
  
  const snapshot = await get(q);
  if (!snapshot.exists()) return [];
  return Object.values(snapshot.val()) as AutomationTemplate[];
}

export async function updateTemplate(workspaceId: string, templateId: string, updates: Partial<AutomationTemplate>): Promise<void> {
  const now = new Date().toISOString();
  await update(ref(database, `orgs/${workspaceId}/automation_templates/${templateId}`), {
    ...updates,
    updated_at: now,
  });
}

export async function deleteTemplate(workspaceId: string, templateId: string): Promise<void> {
  await remove(ref(database, `orgs/${workspaceId}/automation_templates/${templateId}`));
}

// ===== Webhooks =====

export async function createWebhook(workspaceId: string, webhook: Omit<Webhook, 'webhook_id' | 'created_at' | 'updated_at'>): Promise<Webhook> {
  const newRef = push(webhooksRef(workspaceId));
  const webhookId = newRef.key!;
  const now = new Date().toISOString();
  
  const fullWebhook: Webhook = {
    ...webhook,
    webhook_id: webhookId,
    created_at: now,
    updated_at: now,
  };
  
  await set(newRef, fullWebhook);
  return fullWebhook;
}

export async function getWebhooks(workspaceId: string): Promise<Webhook[]> {
  const snapshot = await get(webhooksRef(workspaceId));
  if (!snapshot.exists()) return [];
  return Object.values(snapshot.val()) as Webhook[];
}

export async function updateWebhook(workspaceId: string, webhookId: string, updates: Partial<Webhook>): Promise<void> {
  const now = new Date().toISOString();
  await update(ref(database, `orgs/${workspaceId}/webhooks/${webhookId}`), {
    ...updates,
    updated_at: now,
  });
}

export async function deleteWebhook(workspaceId: string, webhookId: string): Promise<void> {
  await remove(ref(database, `orgs/${workspaceId}/webhooks/${webhookId}`));
}

export async function getWebhookLogs(workspaceId: string, webhookId: string, limit?: number): Promise<WebhookLog[]> {
  const q = query(webhookLogsRef(workspaceId, webhookId), orderByChild('created_at'));
  const snapshot = await get(q);
  if (!snapshot.exists()) return [];
  
  const logs = Object.values(snapshot.val()) as WebhookLog[];
  const sorted = logs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return limit ? sorted.slice(0, limit) : sorted;
}

// ===== API Keys =====

export async function createApiKey(workspaceId: string, apiKey: Omit<ApiKey, 'key_id' | 'created_at'>): Promise<ApiKey> {
  const newRef = push(apiKeysRef(workspaceId));
  const keyId = newRef.key!;
  
  const fullKey: ApiKey = {
    ...apiKey,
    key_id: keyId,
    created_at: new Date().toISOString(),
  };
  
  await set(newRef, fullKey);
  return fullKey;
}

export async function getApiKeys(workspaceId: string): Promise<ApiKey[]> {
  const snapshot = await get(apiKeysRef(workspaceId));
  if (!snapshot.exists()) return [];
  return Object.values(snapshot.val()) as ApiKey[];
}

export async function revokeApiKey(workspaceId: string, keyId: string): Promise<void> {
  await update(ref(database, `orgs/${workspaceId}/api_keys/${keyId}`), {
    revoked_at: new Date().toISOString(),
  });
}

// ===== Campaigns =====

export async function createCampaign(workspaceId: string, campaign: Omit<Campaign, 'id' | 'campaign_id' | 'created_at' | 'updated_at'>): Promise<Campaign> {
  const newRef = push(campaignsRef(workspaceId));
  const campaignId = newRef.key!;
  const now = new Date().toISOString();
  
  const fullCampaign: Campaign = {
    ...campaign,
    id: campaignId,
    campaign_id: campaignId,
    created_at: now,
    updated_at: now,
  };
  
  await set(newRef, fullCampaign);
  return fullCampaign;
}

export async function getCampaigns(workspaceId: string, channel?: string): Promise<Campaign[]> {
  let q;
  if (channel) {
    q = query(campaignsRef(workspaceId), orderByChild('channel'), equalTo(channel));
  } else {
    q = campaignsRef(workspaceId);
  }
  
  const snapshot = await get(q);
  if (!snapshot.exists()) return [];
  return Object.values(snapshot.val()) as Campaign[];
}

export async function updateCampaign(workspaceId: string, campaignId: string, updates: Partial<Campaign>): Promise<void> {
  const now = new Date().toISOString();
  await update(ref(database, `orgs/${workspaceId}/campaigns/${campaignId}`), {
    ...updates,
    updated_at: now,
  });
}

export async function deleteCampaign(workspaceId: string, campaignId: string): Promise<void> {
  await remove(ref(database, `orgs/${workspaceId}/campaigns/${campaignId}`));
}

// ===== Social Posts =====

export async function createSocialPost(workspaceId: string, post: Omit<SocialPost, 'id' | 'post_id' | 'created_at' | 'updated_at'>): Promise<SocialPost> {
  const newRef = push(socialPostsRef(workspaceId));
  const postId = newRef.key!;
  const now = new Date().toISOString();
  
  const fullPost: SocialPost = {
    ...post,
    id: postId,
    post_id: postId,
    created_at: now,
    updated_at: now,
  };
  
  await set(newRef, fullPost);
  return fullPost;
}

export async function getSocialPosts(workspaceId: string, platform?: string): Promise<SocialPost[]> {
  let q;
  if (platform) {
    q = query(socialPostsRef(workspaceId), orderByChild('platform'), equalTo(platform));
  } else {
    q = socialPostsRef(workspaceId);
  }
  
  const snapshot = await get(q);
  if (!snapshot.exists()) return [];
  return Object.values(snapshot.val()) as SocialPost[];
}

export async function updateSocialPost(workspaceId: string, postId: string, updates: Partial<SocialPost>): Promise<void> {
  const now = new Date().toISOString();
  await update(ref(database, `orgs/${workspaceId}/social_posts/${postId}`), {
    ...updates,
    updated_at: now,
  });
}

export async function deleteSocialPost(workspaceId: string, postId: string): Promise<void> {
  await remove(ref(database, `orgs/${workspaceId}/social_posts/${postId}`));
}

// ===== Email Campaigns =====

export async function createEmailCampaign(workspaceId: string, campaign: Omit<EmailCampaign, 'id' | 'campaign_id' | 'created_at' | 'updated_at'>): Promise<EmailCampaign> {
  const newRef = push(emailCampaignsRef(workspaceId));
  const campaignId = newRef.key!;
  const now = new Date().toISOString();
  
  const fullCampaign: EmailCampaign = {
    ...campaign,
    id: campaignId,
    campaign_id: campaignId,
    created_at: now,
    updated_at: now,
  };
  
  await set(newRef, fullCampaign);
  return fullCampaign;
}

export async function getEmailCampaigns(workspaceId: string): Promise<EmailCampaign[]> {
  const snapshot = await get(emailCampaignsRef(workspaceId));
  if (!snapshot.exists()) return [];
  return Object.values(snapshot.val()) as EmailCampaign[];
}

export async function updateEmailCampaign(workspaceId: string, campaignId: string, updates: Partial<EmailCampaign>): Promise<void> {
  const now = new Date().toISOString();
  await update(ref(database, `orgs/${workspaceId}/email_campaigns/${campaignId}`), {
    ...updates,
    updated_at: now,
  });
}

export async function deleteEmailCampaign(workspaceId: string, campaignId: string): Promise<void> {
  await remove(ref(database, `orgs/${workspaceId}/email_campaigns/${campaignId}`));
}

// ===== Email Segments =====

export async function createEmailSegment(workspaceId: string, segment: Omit<EmailSegment, 'id' | 'segment_id' | 'created_at' | 'updated_at'>): Promise<EmailSegment> {
  const newRef = push(emailSegmentsRef(workspaceId));
  const segmentId = newRef.key!;
  const now = new Date().toISOString();
  
  const fullSegment: EmailSegment = {
    ...segment,
    id: segmentId,
    segment_id: segmentId,
    created_at: now,
    updated_at: now,
  };
  
  await set(newRef, fullSegment);
  return fullSegment;
}

export async function getEmailSegments(workspaceId: string): Promise<EmailSegment[]> {
  const snapshot = await get(emailSegmentsRef(workspaceId));
  if (!snapshot.exists()) return [];
  return Object.values(snapshot.val()) as EmailSegment[];
}

// ===== Content Hub =====

export async function createContent(workspaceId: string, content: Omit<ContentItem, 'id' | 'content_id' | 'created_at' | 'updated_at'>): Promise<ContentItem> {
  const newRef = push(contentRef(workspaceId));
  const contentId = newRef.key!;
  const now = new Date().toISOString();
  
  const fullContent: ContentItem = {
    ...content,
    id: contentId,
    content_id: contentId,
    created_at: now,
    updated_at: now,
  };
  
  await set(newRef, fullContent);
  return fullContent;
}

export async function getContent(workspaceId: string, type?: string): Promise<ContentItem[]> {
  let q;
  if (type) {
    q = query(contentRef(workspaceId), orderByChild('type'), equalTo(type));
  } else {
    q = contentRef(workspaceId);
  }
  
  const snapshot = await get(q);
  if (!snapshot.exists()) return [];
  return Object.values(snapshot.val()) as ContentItem[];
}

export async function updateContent(workspaceId: string, contentId: string, updates: Partial<ContentItem>): Promise<void> {
  const now = new Date().toISOString();
  await update(ref(database, `orgs/${workspaceId}/content/${contentId}`), {
    ...updates,
    updated_at: now,
  });
}

export async function deleteContent(workspaceId: string, contentId: string): Promise<void> {
  await remove(ref(database, `orgs/${workspaceId}/content/${contentId}`));
}

// ===== Media Library =====

export async function createMediaFolder(workspaceId: string, folder: Omit<MediaFolder, 'id' | 'folder_id' | 'created_at'>): Promise<MediaFolder> {
  const newRef = push(mediaFoldersRef(workspaceId));
  const folderId = newRef.key!;
  
  const fullFolder: MediaFolder = {
    ...folder,
    id: folderId,
    folder_id: folderId,
    created_at: new Date().toISOString(),
  };
  
  await set(newRef, fullFolder);
  return fullFolder;
}

export async function getMediaFolders(workspaceId: string): Promise<MediaFolder[]> {
  const snapshot = await get(mediaFoldersRef(workspaceId));
  if (!snapshot.exists()) return [];
  return Object.values(snapshot.val()) as MediaFolder[];
}

export async function uploadMedia(workspaceId: string, file: Omit<MediaFile, 'id' | 'file_id' | 'created_at' | 'updated_at'>): Promise<MediaFile> {
  const newRef = push(mediaRef(workspaceId));
  const fileId = newRef.key!;
  const now = new Date().toISOString();
  
  const fullFile: MediaFile = {
    ...file,
    id: fileId,
    file_id: fileId,
    created_at: now,
    updated_at: now,
  };
  
  await set(newRef, fullFile);
  return fullFile;
}

export async function getMedia(workspaceId: string, folderId?: string, type?: string): Promise<MediaFile[]> {
  let q;
  if (folderId) {
    q = query(mediaRef(workspaceId), orderByChild('folder_id'), equalTo(folderId));
  } else {
    q = mediaRef(workspaceId);
  }
  
  const snapshot = await get(q);
  if (!snapshot.exists()) return [];
  
  let files = Object.values(snapshot.val()) as MediaFile[];
  if (type) {
    files = files.filter(f => f.type === type);
  }
  return files;
}

export async function deleteMedia(workspaceId: string, fileId: string): Promise<void> {
  await remove(ref(database, `orgs/${workspaceId}/media/${fileId}`));
}

// ===== Calendar =====

export async function createCalendarEvent(workspaceId: string, event: Omit<CalendarEvent, 'id' | 'event_id' | 'created_at' | 'updated_at' | 'workspace_id'>): Promise<CalendarEvent> {
  const newRef = push(calendarRef(workspaceId));
  const eventId = newRef.key!;
  const now = new Date().toISOString();
  
  const fullEvent: CalendarEvent = {
    ...event,
    workspace_id: workspaceId,
    id: eventId,
    event_id: eventId,
    created_at: now,
    updated_at: now,
  };
  
  await set(newRef, fullEvent);
  return fullEvent;
}

export async function getCalendarEvents(workspaceId: string, startDate?: string, endDate?: string): Promise<CalendarEvent[]> {
  const snapshot = await get(calendarRef(workspaceId));
  if (!snapshot.exists()) return [];
  
  let events = Object.values(snapshot.val()) as CalendarEvent[];
  
  if (startDate) {
    events = events.filter(e => (e.start_date || '') >= startDate);
  }
  if (endDate) {
    events = events.filter(e => (e.start_date || '') <= endDate);
  }
  
  return events.sort((a, b) => new Date(a.start_date || 0).getTime() - new Date(b.start_date || 0).getTime());
}

export async function updateCalendarEvent(workspaceId: string, eventId: string, updates: Partial<CalendarEvent>): Promise<void> {
  const now = new Date().toISOString();
  await update(ref(database, `orgs/${workspaceId}/calendar_events/${eventId}`), {
    ...updates,
    updated_at: now,
  });
}

export async function deleteCalendarEvent(workspaceId: string, eventId: string): Promise<void> {
  await remove(ref(database, `orgs/${workspaceId}/calendar_events/${eventId}`));
}

// ===== MCP Servers =====

export async function createMcpServer(workspaceId: string, server: Omit<McpServer, 'id' | 'server_id' | 'created_at' | 'updated_at'>): Promise<McpServer> {
  const newRef = push(ref(database, `orgs/${workspaceId}/mcp_servers`));
  const serverId = newRef.key!;
  const now = new Date().toISOString();
  
  const fullServer: McpServer = {
    ...server,
    id: serverId,
    server_id: serverId,
    created_at: now,
    updated_at: now,
  };
  
  await set(newRef, fullServer);
  return fullServer;
}

export async function getMcpServers(workspaceId: string): Promise<McpServer[]> {
  const snapshot = await get(ref(database, `orgs/${workspaceId}/mcp_servers`));
  if (!snapshot.exists()) return [];
  return Object.values(snapshot.val()) as McpServer[];
}

export async function updateMcpServer(workspaceId: string, serverId: string, updates: Partial<McpServer>): Promise<void> {
  const now = new Date().toISOString();
  await update(ref(database, `orgs/${workspaceId}/mcp_servers/${serverId}`), {
    ...updates,
    updated_at: now,
  });
}

export async function deleteMcpServer(workspaceId: string, serverId: string): Promise<void> {
  await remove(ref(database, `orgs/${workspaceId}/mcp_servers/${serverId}`));
}

export async function getMcpTools(workspaceId: string, serverId?: string): Promise<McpTool[]> {
  const toolsRef = ref(database, `orgs/${workspaceId}/mcp_tools`);
  let q;
  if (serverId) {
    q = query(toolsRef, orderByChild('server_id'), equalTo(serverId));
  } else {
    q = toolsRef;
  }
  
  const snapshot = await get(q);
  if (!snapshot.exists()) return [];
  return Object.values(snapshot.val()) as McpTool[];
}

// ===== Documentation =====

export async function createDocPage(workspaceId: string, page: Omit<DocPage, 'page_id' | 'created_at' | 'updated_at'>): Promise<DocPage> {
  const newRef = push(docsRef(workspaceId));
  const pageId = newRef.key!;
  const now = new Date().toISOString();
  
  const fullPage: DocPage = {
    ...page,
    page_id: pageId,
    created_at: now,
    updated_at: now,
  };
  
  await set(newRef, fullPage);
  return fullPage;
}

export async function getDocPages(workspaceId: string, category?: string): Promise<DocPage[]> {
  let q;
  if (category) {
    q = query(docsRef(workspaceId), orderByChild('category'), equalTo(category));
  } else {
    q = docsRef(workspaceId);
  }
  
  const snapshot = await get(q);
  if (!snapshot.exists()) return [];
  return Object.values(snapshot.val()) as DocPage[];
}

export async function updateDocPage(workspaceId: string, pageId: string, updates: Partial<DocPage>): Promise<void> {
  const now = new Date().toISOString();
  await update(ref(database, `orgs/${workspaceId}/docs/${pageId}`), {
    ...updates,
    updated_at: now,
  });
}

export async function deleteDocPage(workspaceId: string, pageId: string): Promise<void> {
  await remove(ref(database, `orgs/${workspaceId}/docs/${pageId}`));
}
