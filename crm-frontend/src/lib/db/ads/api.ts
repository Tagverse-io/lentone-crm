import { ref, push, set, update, remove, onValue, off, get } from 'firebase/database';
import { database as db } from '@/lib/firebase/config';

// --- Types ---
export interface GoogleAdsAccount {
  id: string;
  tenant_id: string;
  customer_id: string;
  account_name: string;
  access_token_encrypted?: string;
  refresh_token_encrypted?: string;
  token_expiry?: number;
  scopes?: string;
  status: 'connected' | 'disconnected' | 'error';
  created_at: string;
  updated_at: string;
}

// --- Refs ---
const getAdsAccountsRef = (tenantId: string) => ref(db, `google_ads_accounts/${tenantId}`);
const getAdsAccountItemRef = (tenantId: string, accountId: string) => ref(db, `google_ads_accounts/${tenantId}/${accountId}`);

// --- Subscriptions ---
export const subscribeToAdsData = (
  tenantId: string,
  callback: (accounts: GoogleAdsAccount[]) => void
) => {
  const aRef = getAdsAccountsRef(tenantId);

  let currentAccounts: GoogleAdsAccount[] = [];

  const unsubAccounts = onValue(aRef, (snap) => {
    const data = snap.val();
    if (data) {
      currentAccounts = Object.keys(data).map(key => {
        const { access_token_encrypted, refresh_token_encrypted, ...safeData } = data[key];
        return { id: key, ...safeData } as GoogleAdsAccount;
      });
    } else {
      currentAccounts = [];
    }
    callback(currentAccounts);
  });

  return () => {
    off(aRef, 'value', unsubAccounts);
  };
};

// --- Mutations ---
export const saveGoogleAdsAccount = async (tenantId: string, account: Omit<GoogleAdsAccount, 'id'>) => {
  // Check if we already have an account for this tenant & customer ID
  const snapshot = await get(getAdsAccountsRef(tenantId));
  let existingId = null;
  if (snapshot.exists()) {
    const data = snapshot.val();
    const existing = Object.keys(data).find(key => data[key].customer_id === account.customer_id);
    if (existing) {
      existingId = existing;
    }
  }

  if (existingId) {
    await update(getAdsAccountItemRef(tenantId, existingId), {
      ...account,
      updated_at: new Date().toISOString()
    });
    return existingId;
  } else {
    const newRef = push(getAdsAccountsRef(tenantId));
    await set(newRef, {
      ...account,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    return newRef.key;
  }
};

export const updateGoogleAdsAccount = async (tenantId: string, accountId: string, updates: Partial<GoogleAdsAccount>) => {
  await update(getAdsAccountItemRef(tenantId, accountId), {
    ...updates,
    updated_at: new Date().toISOString()
  });
};

export const deleteGoogleAdsAccount = async (tenantId: string, accountId: string) => {
  await remove(getAdsAccountItemRef(tenantId, accountId));
};
