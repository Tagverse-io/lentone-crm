import { ref, push, set, update, remove, onValue, off, get } from 'firebase/database';
import { database as db } from '@/lib/firebase/config';

// --- Types ---
export type SocialPlatform = 'linkedin' | 'instagram' | 'twitter' | 'facebook' | 'youtube';
export type PostStatus = 'pending' | 'published' | 'failed' | 'draft' | 'scheduled';

export interface SocialAccount {
  id: string;
  platform: SocialPlatform;
  connected: boolean;
  followers: number;
  engagement: number;
  postsThisMonth: number;
  impressions: number;
  growth: number;
  handle?: string;
  
  // OAuth credentials (should never be sent to the client)
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: number;
  externalAccountId?: string;
}

export interface SocialPost {
  id: string;
  platform: SocialPlatform;
  content: string;
  mediaUrl?: string | null;
  status: PostStatus;
  scheduledTime: string;
  createdAt: string;
  authorId?: string;
  authorName?: string;
  likes?: number;
  comments?: number;
  shares?: number;
}

export type SocialData = {
  accounts: SocialAccount[];
  posts: SocialPost[];
};

// --- Refs ---
const getAccountsRef = (companyId: string) => ref(db, `social_accounts/${companyId}`);
const getAccountItemRef = (companyId: string, accountId: string) => ref(db, `social_accounts/${companyId}/${accountId}`);

const getPostsRef = (companyId: string) => ref(db, `social_posts/${companyId}`);
const getPostItemRef = (companyId: string, postId: string) => ref(db, `social_posts/${companyId}/${postId}`);

// --- Default accounts (used when no data exists yet) ---
const DEFAULT_ACCOUNTS: Omit<SocialAccount, 'id'>[] = [
  { platform: 'linkedin', connected: false, followers: 0, engagement: 0, postsThisMonth: 0, impressions: 0, growth: 0 },
  { platform: 'twitter', connected: false, followers: 0, engagement: 0, postsThisMonth: 0, impressions: 0, growth: 0 },
  { platform: 'instagram', connected: false, followers: 0, engagement: 0, postsThisMonth: 0, impressions: 0, growth: 0 },
  { platform: 'facebook', connected: false, followers: 0, engagement: 0, postsThisMonth: 0, impressions: 0, growth: 0 },
];

// --- Subscriptions ---
export const subscribeToSocialData = (
  companyId: string,
  callback: (data: SocialData) => void
) => {
  const aRef = getAccountsRef(companyId);
  const pRef = getPostsRef(companyId);

  let currentAccounts: SocialAccount[] = [];
  let currentPosts: SocialPost[] = [];

  const triggerCallback = () => {
    callback({
      accounts: currentAccounts,
      posts: currentPosts,
    });
  };

  const unsubAccounts = onValue(aRef, (snap) => {
    const data = snap.val();
    if (data) {
      currentAccounts = Object.keys(data).map(key => {
        const { accessToken, refreshToken, tokenExpiresAt, ...safeData } = data[key];
        return { id: key, ...safeData };
      });
    } else {
      currentAccounts = [];
    }
    triggerCallback();
  });

  const unsubPosts = onValue(pRef, (snap) => {
    const data = snap.val();
    if (data) {
      currentPosts = Object.keys(data).map(key => ({ id: key, ...data[key] }));
    } else {
      currentPosts = [];
    }
    triggerCallback();
  });

  return () => {
    off(aRef, 'value', unsubAccounts);
    off(pRef, 'value', unsubPosts);
  };
};

// --- Mutations ---
export const createAccount = async (companyId: string, account: Omit<SocialAccount, 'id'>) => {
  const newRef = push(getAccountsRef(companyId));
  await set(newRef, account);
  return newRef.key;
};

export const updateAccount = async (companyId: string, accountId: string, updates: Partial<SocialAccount>) => {
  await update(getAccountItemRef(companyId, accountId), updates);
};

export const deleteAccount = async (companyId: string, accountId: string) => {
  await remove(getAccountItemRef(companyId, accountId));
};

export const createPost = async (companyId: string, post: Omit<SocialPost, 'id'>) => {
  const newRef = push(getPostsRef(companyId));
  await set(newRef, post);
  return newRef.key;
};

export const updatePost = async (companyId: string, postId: string, updates: Partial<SocialPost>) => {
  await update(getPostItemRef(companyId, postId), updates);
};

export const deletePost = async (companyId: string, postId: string) => {
  await remove(getPostItemRef(companyId, postId));
};

// --- Helper: Ensure default accounts exist ---
export const ensureDefaultAccounts = async (companyId: string) => {
  const snapshot = await get(getAccountsRef(companyId));
  const existingPlatforms = new Set<string>();

  if (snapshot.exists()) {
    const data = snapshot.val();
    
    // Clean up duplicates if any were created due to race conditions
    for (const [key, acc] of Object.entries(data) as [string, any][]) {
      if (existingPlatforms.has(acc.platform)) {
        await remove(getAccountItemRef(companyId, key));
      } else {
        existingPlatforms.add(acc.platform);
      }
    }
  }

  for (const account of DEFAULT_ACCOUNTS) {
    if (!existingPlatforms.has(account.platform)) {
      await createAccount(companyId, account);
      existingPlatforms.add(account.platform); // add to set in case of rapid successive calls
    }
  }
};
