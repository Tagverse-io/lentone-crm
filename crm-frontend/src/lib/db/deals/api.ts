import { 
  ref, 
  push, 
  set, 
  get, 
  update, 
  remove, 
  query, 
  orderByChild, 
  equalTo,
  onValue,
  off
} from 'firebase/database';
import { database as db } from '@/lib/firebase/config';
import { Deal, DealStatus } from '../types';
import { emitEvent } from '../events';
import { getCurrentUserId } from '@/lib/firebase/auth';

// ===== Collection Reference =====
function dealsRef(workspaceId: string) {
  return ref(db, `orgs/${workspaceId}/deals`);
}

function dealRef(workspaceId: string, dealId: string) {
  return ref(db, `orgs/${workspaceId}/deals/${dealId}`);
}

// ===== CRUD Operations =====

/**
 * Create a new deal
 */
export async function createDeal(
  workspaceId: string,
  data: Omit<Deal, 'deal_id' | 'workspace_id' | 'created_at' | 'updated_at' | 'created_by'>
): Promise<Deal> {
  const newRef = push(dealsRef(workspaceId));
  const dealId = newRef.key!;
  
  const now = new Date().toISOString();
  const deal: Deal = {
    ...data,
    deal_id: dealId,
    workspace_id: workspaceId,
    created_at: now,
    updated_at: now,
    created_by: getCurrentUserId() || '',
  };
  
  await set(newRef, deal);
  
  emitEvent('deal:created', deal);
  
  return deal;
}

/**
 * Get a deal by ID
 */
export async function getDeal(
  workspaceId: string, 
  dealId: string
): Promise<Deal | null> {
  const snapshot = await get(dealRef(workspaceId, dealId));
  if (snapshot.exists()) {
    return snapshot.val() as Deal;
  }
  return null;
}

/**
 * Get all deals in a workspace
 */
export async function getDeals(workspaceId: string): Promise<Deal[]> {
  const snapshot = await get(dealsRef(workspaceId));
  if (snapshot.exists()) {
    const data = snapshot.val();
    return Object.values(data) as Deal[];
  }
  return [];
}

/**
 * Get all deals for a company
 */
export async function getCompanyDeals(
  workspaceId: string, 
  companyId: string
): Promise<Deal[]> {
  const q = query(dealsRef(workspaceId), orderByChild('workspace_id'), equalTo(companyId));
  const snapshot = await get(q);
  
  if (snapshot.exists()) {
    const data = snapshot.val();
    return Object.values(data) as Deal[];
  }
  return [];
}

/**
 * Get all deals for a contact
 */
export async function getContactDeals(
  workspaceId: string, 
  contactId: string
): Promise<Deal[]> {
  const q = query(dealsRef(workspaceId), orderByChild('contact_id'), equalTo(contactId));
  const snapshot = await get(q);
  
  if (snapshot.exists()) {
    const data = snapshot.val();
    return Object.values(data) as Deal[];
  }
  return [];
}

/**
 * Get all deals in a pipeline
 */
export async function getPipelineDeals(
  workspaceId: string, 
  pipelineId: string
): Promise<Deal[]> {
  const q = query(dealsRef(workspaceId), orderByChild('pipeline_id'), equalTo(pipelineId));
  const snapshot = await get(q);
  
  if (snapshot.exists()) {
    const data = snapshot.val();
    return Object.values(data) as Deal[];
  }
  return [];
}

/**
 * Get all deals in a stage
 */
export async function getStageDeals(
  workspaceId: string, 
  stageId: string
): Promise<Deal[]> {
  const q = query(dealsRef(workspaceId), orderByChild('stage_id'), equalTo(stageId));
  const snapshot = await get(q);
  
  if (snapshot.exists()) {
    const data = snapshot.val();
    return Object.values(data) as Deal[];
  }
  return [];
}

/**
 * Update a deal
 */
export async function updateDeal(
  workspaceId: string,
  dealId: string,
  data: Partial<Omit<Deal, 'deal_id' | 'workspace_id' | 'created_at' | 'created_by'>>
): Promise<void> {
  const now = new Date().toISOString();
  await update(dealRef(workspaceId, dealId), {
    ...data,
    updated_at: now,
  });
  
  const updated = await getDeal(workspaceId, dealId);
  if (updated) {
    emitEvent('deal:updated', updated);
    
    // Emit specific events for status changes
    if (data.status === 'won' && updated.status === 'won') {
      emitEvent('deal:won', updated);
    } else if (data.status === 'lost' && updated.status === 'lost') {
      emitEvent('deal:lost', updated);
    } else if (data.stage_id) {
      emitEvent('deal:stage_changed', updated);
    }
  }
}

/**
 * Delete a deal
 */
export async function deleteDeal(
  workspaceId: string, 
  dealId: string
): Promise<void> {
  const deal = await getDeal(workspaceId, dealId);
  await remove(dealRef(workspaceId, dealId));
  
  if (deal) {
    emitEvent('deal:deleted', deal);
  }
}

// ===== Pipeline Operations =====

/**
 * Move a deal to a different stage
 */
export async function moveDealToStage(
  workspaceId: string,
  dealId: string,
  stageId: string,
  probability?: number
): Promise<void> {
  const updateData: Partial<Deal> = {
    stage_id: stageId,
  };
  
  if (probability !== undefined) {
    updateData.probability = probability;
  }
  
  await updateDeal(workspaceId, dealId, updateData);
}

/**
 * Move a deal to won
 */
export async function markDealAsWon(
  workspaceId: string,
  dealId: string
): Promise<void> {
  await updateDeal(workspaceId, dealId, {
    status: 'won',
    actual_close_date: new Date().toISOString(),
    probability: 100,
  });
}

/**
 * Move a deal to lost
 */
export async function markDealAsLost(
  workspaceId: string,
  dealId: string
): Promise<void> {
  await updateDeal(workspaceId, dealId, {
    status: 'lost',
    actual_close_date: new Date().toISOString(),
    probability: 0,
  });
}

// ===== Query Operations =====

/**
 * Search deals by title (partial match)
 */
export async function searchDeals(
  workspaceId: string, 
  searchTerm: string
): Promise<Deal[]> {
  const deals = await getDeals(workspaceId);
  const lowerSearch = searchTerm.toLowerCase();
  
  return deals.filter(deal => 
    deal.title.toLowerCase().includes(lowerSearch)
  );
}

/**
 * Get deals by status
 */
export async function getDealsByStatus(
  workspaceId: string, 
  status: DealStatus
): Promise<Deal[]> {
  const q = query(dealsRef(workspaceId), orderByChild('status'), equalTo(status));
  const snapshot = await get(q);
  
  if (snapshot.exists()) {
    const data = snapshot.val();
    return Object.values(data) as Deal[];
  }
  return [];
}

// ===== Statistics =====

/**
 * Calculate deal statistics
 */
export async function getDealStats(
  workspaceId: string, 
  companyId?: string
): Promise<{
  total_deals: number;
  total_value: number;
  won_deals: number;
  won_value: number;
  lost_deals: number;
  lost_value: number;
  open_deals: number;
  open_value: number;
  average_deal_value: number;
  win_rate: number;
}> {
  const deals = companyId 
    ? await getCompanyDeals(workspaceId, companyId)
    : await getDeals(workspaceId);
  
  const wonDeals = deals.filter(d => d.status === 'won');
  const lostDeals = deals.filter(d => d.status === 'lost');
  const openDeals = deals.filter(d => d.status === 'open');
  
  const totalValue = deals.reduce((sum, d) => sum + (d.value || 0), 0);
  const wonValue = wonDeals.reduce((sum, d) => sum + (d.value || 0), 0);
  const lostValue = lostDeals.reduce((sum, d) => sum + (d.value || 0), 0);
  const openValue = openDeals.reduce((sum, d) => sum + (d.value || 0), 0);
  
  const totalWithOutcome = wonDeals.length + lostDeals.length;
  const winRate = totalWithOutcome > 0 ? (wonDeals.length / totalWithOutcome) * 100 : 0;
  
  return {
    total_deals: deals.length,
    total_value: totalValue,
    won_deals: wonDeals.length,
    won_value: wonValue,
    lost_deals: lostDeals.length,
    lost_value: lostValue,
    open_deals: openDeals.length,
    open_value: openValue,
    average_deal_value: deals.length > 0 ? totalValue / deals.length : 0,
    win_rate: winRate,
  };
}

// ===== Real-time Subscriptions =====

/**
 * Subscribe to deals changes
 */
export function subscribeToDeals(
  workspaceId: string,
  callback: (deals: Deal[]) => void
): () => void {
  const q = dealsRef(workspaceId);
  
  const unsubscribe = onValue(q, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      callback(Object.values(data) as Deal[]);
    } else {
      callback([]);
    }
  });
  
  return () => off(q, 'value', unsubscribe);
}

/**
 * Subscribe to company deals changes
 */
export function subscribeToCompanyDeals(
  workspaceId: string,
  companyId: string,
  callback: (deals: Deal[]) => void
): () => void {
  const q = query(dealsRef(workspaceId), orderByChild('workspace_id'), equalTo(companyId));
  
  const unsubscribe = onValue(q, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      callback(Object.values(data) as Deal[]);
    } else {
      callback([]);
    }
  });
  
  return () => off(q, 'value', unsubscribe);
}
