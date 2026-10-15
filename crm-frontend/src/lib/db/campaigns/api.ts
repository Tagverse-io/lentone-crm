import { ref, push, set, get, update, remove, onValue, off } from 'firebase/database';
import { database as db } from '@/lib/firebase/config';

export type SpendEntry = {
  id: string;
  date: string;
  amount: number;
};

export type Campaign = {
  id?: string;
  name: string;
  source: string; 
  status: string; 
  budget: number;
  spent: number;
  impressions: number;
  clicks: number;
  lastSynced: string | null;
  channel?: string;
  startDate?: string;
  endDate?: string;
  currency?: string;
  spendHistory?: SpendEntry[];
  workspace_id?: string;
};

function campaignsRef(workspaceId: string) {
  return ref(db, `orgs/${workspaceId}/campaigns`);
}

function campaignRef(workspaceId: string, campaignId: string) {
  return ref(db, `orgs/${workspaceId}/campaigns/${campaignId}`);
}

export async function createCampaign(workspaceId: string, data: Omit<Campaign, 'id'>): Promise<Campaign> {
  const newRef = push(campaignsRef(workspaceId));
  const campaignId = newRef.key!;
  
  const campaign: Campaign = {
    ...data,
    id: campaignId,
  };
  
  await set(newRef, campaign);
  return campaign;
}

export async function updateCampaign(workspaceId: string, campaignId: string, data: Partial<Campaign>): Promise<void> {
  await update(campaignRef(workspaceId, campaignId), data);
}

export async function getCampaigns(workspaceId: string): Promise<Campaign[]> {
  const snapshot = await get(campaignsRef(workspaceId));
  if (!snapshot.exists()) return [];
  const data = snapshot.val();
  return Object.values(data) as Campaign[];
}

export async function deleteCampaign(workspaceId: string, campaignId: string): Promise<void> {
  await remove(campaignRef(workspaceId, campaignId));
}

export function subscribeToCampaigns(workspaceId: string, callback: (campaigns: Campaign[]) => void): () => void {
  const reference = campaignsRef(workspaceId);
  
  const listener = onValue(reference, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      const items = Object.values(data) as Campaign[];
      callback(items);
    } else {
      callback([]);
    }
  });

  return () => {
    off(reference, 'value', listener);
  };
}
