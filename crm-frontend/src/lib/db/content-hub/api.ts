import { ref, push, set, get, update, remove, onValue, off } from 'firebase/database';
import { database as db } from '@/lib/firebase/config';

export type Comment = { 
  id: string; 
  author: string; 
  avatar: string; 
  text: string; 
  date: string 
};

export type HistoryEntry = { 
  date: string; 
  action: string; 
  user: string 
};

export type ContentItem = {
  id: string;
  title: string;
  type: string; 
  campaign: string;
  persona: string; 
  author: string; 
  owner: string;
  lastEdited: string; 
  status: string; 
  priority: string; 
  dueDate: string;
  description: string; 
  comments: Comment[]; 
  history: HistoryEntry[];
  workspace_id?: string;
};

function contentHubRef(workspaceId: string) {
  return ref(db, `orgs/${workspaceId}/content_hub`);
}

function contentItemRef(workspaceId: string, itemId: string) {
  return ref(db, `orgs/${workspaceId}/content_hub/${itemId}`);
}

export async function createContentItem(workspaceId: string, data: Omit<ContentItem, 'id'>): Promise<ContentItem> {
  const newRef = push(contentHubRef(workspaceId));
  const itemId = newRef.key!;
  
  const item: ContentItem = {
    ...data,
    id: itemId,
  };
  
  await set(newRef, item);
  return item;
}

export async function updateContentItem(workspaceId: string, itemId: string, data: Partial<ContentItem>): Promise<void> {
  await update(contentItemRef(workspaceId, itemId), data);
}

export async function deleteContentItem(workspaceId: string, itemId: string): Promise<void> {
  await remove(contentItemRef(workspaceId, itemId));
}

export function subscribeToContentHub(workspaceId: string, callback: (items: ContentItem[]) => void): () => void {
  const reference = contentHubRef(workspaceId);
  
  const listener = onValue(reference, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      const itemsList = Object.values(data) as ContentItem[];
      
      // Ensure comments and history are at least empty arrays if they were removed/empty in DB
      const safeItemsList = itemsList.map(item => ({
        ...item,
        comments: item.comments || [],
        history: item.history || []
      }));
      
      callback(safeItemsList);
    } else {
      callback([]);
    }
  });

  return () => {
    off(reference, 'value', listener);
  };
}
