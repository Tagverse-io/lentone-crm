import { ref, push, set, update, remove, onValue, off, get } from 'firebase/database';
import { database as db } from '@/lib/firebase/config';

// --- Types ---
export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused' | 'failed';
export type CampaignType = 'newsletter' | 'promotional' | 'drip' | 'transactional' | 'reengagement';

export interface CampaignRow {
  id: string;
  name: string;
  subject: string;
  type: CampaignType;
  audience: string;
  audienceSize: number;
  sent: number;
  opened: number;
  clicked: number;
  bounced: number;
  unsubscribed: number;
  openRate: number;
  clickRate: number;
  status: CampaignStatus;
  sentAt: string | null;
  createdBy?: string;
}

export interface SavedTemplate {
  id: string;
  name: string;
  category: CampaignType;
  thumbnailColor: string;
  lastEdited: string;
  usageCount: number;
  htmlBody?: string;
}

export interface ScheduledCampaign {
  id: string;
  name: string;
  audience: string;
  scheduledFor: string;
  recipients: number;
  active: boolean;
}

export interface AudienceSegment {
  id: string;
  name: string;
  contactCount: number;
  criteria: string;
  growth: number;
}

export type EmailData = {
  campaigns: CampaignRow[];
  templates: SavedTemplate[];
  scheduled: ScheduledCampaign[];
  audiences: AudienceSegment[];
};

// --- Refs ---
const getCampaignsRef = (companyId: string) => ref(db, `email_campaigns/${companyId}`);
const getCampaignItemRef = (companyId: string, campaignId: string) => ref(db, `email_campaigns/${companyId}/${campaignId}`);

const getTemplatesRef = (companyId: string) => ref(db, `email_templates/${companyId}`);
const getTemplateItemRef = (companyId: string, templateId: string) => ref(db, `email_templates/${companyId}/${templateId}`);

const getScheduledRef = (companyId: string) => ref(db, `email_scheduled/${companyId}`);
const getScheduledItemRef = (companyId: string, scheduledId: string) => ref(db, `email_scheduled/${companyId}/${scheduledId}`);

const getAudiencesRef = (companyId: string) => ref(db, `email_audiences/${companyId}`);
const getAudienceItemRef = (companyId: string, audienceId: string) => ref(db, `email_audiences/${companyId}/${audienceId}`);

// --- Subscriptions ---
export const subscribeToEmailData = (
  companyId: string,
  callback: (data: EmailData) => void
) => {
  let currentCampaigns: CampaignRow[] = [];
  let currentTemplates: SavedTemplate[] = [];
  let currentScheduled: ScheduledCampaign[] = [];
  let currentAudiences: AudienceSegment[] = [];

  const triggerCallback = () => {
    callback({
      campaigns: currentCampaigns,
      templates: currentTemplates,
      scheduled: currentScheduled,
      audiences: currentAudiences,
    });
  };

  const unsubCampaigns = onValue(getCampaignsRef(companyId), (snap) => {
    const data = snap.val();
    currentCampaigns = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
    triggerCallback();
  });

  const unsubTemplates = onValue(getTemplatesRef(companyId), (snap) => {
    const data = snap.val();
    currentTemplates = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
    triggerCallback();
  });

  const unsubScheduled = onValue(getScheduledRef(companyId), (snap) => {
    const data = snap.val();
    currentScheduled = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
    triggerCallback();
  });

  const unsubAudiences = onValue(getAudiencesRef(companyId), (snap) => {
    const data = snap.val();
    currentAudiences = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
    triggerCallback();
  });

  return () => {
    off(getCampaignsRef(companyId), 'value', unsubCampaigns);
    off(getTemplatesRef(companyId), 'value', unsubTemplates);
    off(getScheduledRef(companyId), 'value', unsubScheduled);
    off(getAudiencesRef(companyId), 'value', unsubAudiences);
  };
};

// --- Mutations: Campaigns ---
export const createCampaign = async (companyId: string, campaign: Omit<CampaignRow, 'id'>) => {
  const newRef = push(getCampaignsRef(companyId));
  await set(newRef, campaign);
  return newRef.key;
};

export const updateCampaign = async (companyId: string, campaignId: string, updates: Partial<CampaignRow>) => {
  await update(getCampaignItemRef(companyId, campaignId), updates);
};

export const deleteCampaign = async (companyId: string, campaignId: string) => {
  await remove(getCampaignItemRef(companyId, campaignId));
};

// --- Mutations: Templates ---
export const createTemplate = async (companyId: string, template: Omit<SavedTemplate, 'id'>) => {
  const newRef = push(getTemplatesRef(companyId));
  await set(newRef, template);
  return newRef.key;
};

export const updateTemplate = async (companyId: string, templateId: string, updates: Partial<SavedTemplate>) => {
  await update(getTemplateItemRef(companyId, templateId), updates);
};

export const deleteTemplate = async (companyId: string, templateId: string) => {
  await remove(getTemplateItemRef(companyId, templateId));
};

// --- Mutations: Scheduled ---
export const createScheduled = async (companyId: string, scheduled: Omit<ScheduledCampaign, 'id'>) => {
  const newRef = push(getScheduledRef(companyId));
  await set(newRef, scheduled);
  return newRef.key;
};

export const updateScheduled = async (companyId: string, scheduledId: string, updates: Partial<ScheduledCampaign>) => {
  await update(getScheduledItemRef(companyId, scheduledId), updates);
};

export const deleteScheduled = async (companyId: string, scheduledId: string) => {
  await remove(getScheduledItemRef(companyId, scheduledId));
};

// --- Mutations: Audiences ---
export const createAudience = async (companyId: string, audience: Omit<AudienceSegment, 'id'>) => {
  const newRef = push(getAudiencesRef(companyId));
  await set(newRef, audience);
  return newRef.key;
};

export const updateAudience = async (companyId: string, audienceId: string, updates: Partial<AudienceSegment>) => {
  await update(getAudienceItemRef(companyId, audienceId), updates);
};

export const deleteAudience = async (companyId: string, audienceId: string) => {
  await remove(getAudienceItemRef(companyId, audienceId));
};

// --- Helper: Ensure default audiences exist ---
export const ensureDefaultAudiences = async (companyId: string) => {
  const snapshot = await get(getAudiencesRef(companyId));
  if (!snapshot.exists()) {
    const defaults: Omit<AudienceSegment, 'id'>[] = [
      { name: 'All Subscribers', contactCount: 0, criteria: 'Has active email subscription', growth: 0 },
      { name: 'Highly Engaged', contactCount: 0, criteria: 'Opened >3 emails in last 30 days', growth: 0 },
    ];
    for (const audience of defaults) {
      await createAudience(companyId, audience);
    }
  }
};
