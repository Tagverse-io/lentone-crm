import { get, push, remove, set, update, onValue } from 'firebase/database';
import { wsRef, cleanData } from '../../firebase/database';
import { Role, ModulePermissions } from '../types';

const DEFAULT_ROLES: Omit<Role, 'id' | 'workspace_id' | 'created_at' | 'updated_at'>[] = [
  {
    name: 'Owner',
    description: 'Full ownership and administrative control over the workspace.',
    is_system: true,
    permissions: {
      contracts: { view: true, edit: true, delete: true },
      payments: { view: true, edit: true, delete: true },
      marketing: { view: true, edit: true, delete: true },
      workspace: { view: true, edit: true, delete: true },
      analytics: { view: true, edit: true, delete: true },
      leads: { view: true, edit: true, delete: true },
    }
  },
  {
    name: 'Admin',
    description: 'Full access to all modules and settings.',
    is_system: true,
    permissions: {
      contracts: { view: true, edit: true, delete: true },
      payments: { view: true, edit: true, delete: true },
      marketing: { view: true, edit: true, delete: true },
      workspace: { view: true, edit: true, delete: true },
      analytics: { view: true, edit: true, delete: true },
      leads: { view: true, edit: true, delete: true },
    }
  },
  {
    name: 'Editor',
    description: 'Can edit content but cannot access workspace settings or delete records.',
    is_system: true,
    permissions: {
      contracts: { view: true, edit: true, delete: false },
      payments: { view: true, edit: true, delete: false },
      marketing: { view: true, edit: true, delete: false },
      workspace: { view: false, edit: false, delete: false },
      analytics: { view: true, edit: false, delete: false },
      leads: { view: true, edit: true, delete: false },
    }
  },
  {
    name: 'Viewer',
    description: 'Read-only access to most modules.',
    is_system: true,
    permissions: {
      contracts: { view: true, edit: false, delete: false },
      payments: { view: true, edit: false, delete: false },
      marketing: { view: true, edit: false, delete: false },
      workspace: { view: false, edit: false, delete: false },
      analytics: { view: true, edit: false, delete: false },
      leads: { view: true, edit: false, delete: false },
    }
  }
];

export async function getRoles(workspaceId: string): Promise<Role[]> {
  try {
    const refPath = wsRef(workspaceId, 'roles');
    const snapshot = await get(refPath);
    if (!snapshot.exists()) return [];
    
    const items: Role[] = [];
    snapshot.forEach((child) => {
      items.push({ id: child.key, ...child.val() } as Role);
    });
    return items;
  } catch {
    return [];
  }
}

export async function createRole(workspaceId: string, roleData: Omit<Role, 'id' | 'workspace_id' | 'created_at' | 'updated_at'>): Promise<string | null> {
  try {
    const refPath = wsRef(workspaceId, 'roles');
    const newRef = push(refPath);
    const now = new Date().toISOString();
    
    await set(newRef, cleanData({
      ...roleData,
      workspace_id: workspaceId,
      created_at: now,
      updated_at: now
    }));
    return newRef.key;
  } catch (error) {
    console.error('Error creating role:', error);
    return null;
  }
}

export async function updateRole(workspaceId: string, roleId: string, updates: Partial<Role>): Promise<boolean> {
  try {
    const refPath = wsRef(workspaceId, `roles/${roleId}`);
    await update(refPath, cleanData({
      ...updates,
      updated_at: new Date().toISOString()
    }));
    return true;
  } catch {
    return false;
  }
}

export async function deleteRole(workspaceId: string, roleId: string): Promise<boolean> {
  try {
    const refPath = wsRef(workspaceId, `roles/${roleId}`);
    await remove(refPath);
    return true;
  } catch {
    return false;
  }
}

export function subscribeToRoles(workspaceId: string, callback: (roles: Role[]) => void): () => void {
  const refPath = wsRef(workspaceId, 'roles');
  const unsubscribe = onValue(refPath, (snapshot) => {
    if (snapshot.exists()) {
      const items: Role[] = [];
      snapshot.forEach((child) => {
        items.push({ id: child.key, ...child.val() } as Role);
      });
      callback(items);
    } else {
      callback([]);
    }
  });
  return unsubscribe;
}

export async function ensureDefaultRoles(workspaceId: string): Promise<void> {
  const roles = await getRoles(workspaceId);
  if (roles.length === 0) {
    for (const defaultRole of DEFAULT_ROLES) {
      await createRole(workspaceId, defaultRole);
    }
  } else {
    // Check if Owner role exists, if not, create it
    const hasOwner = roles.some(r => r.name.toLowerCase() === 'owner');
    if (!hasOwner) {
      const ownerRole = DEFAULT_ROLES.find(r => r.name.toLowerCase() === 'owner');
      if (ownerRole) {
        await createRole(workspaceId, ownerRole);
      }
    }
  }
}
