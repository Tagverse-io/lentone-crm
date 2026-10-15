'use client';

/**
 * Permissions shim with the original public API. Org admins (and owners)
 * get full access; members get view+edit on operational modules.
 */
import React, { createContext, useContext } from 'react';
import { useAuth } from '@/lib/firebase/auth-context';
import type { ModulePermissions } from '@/lib/db/types';

interface PermissionsContextType {
  permissions: Record<string, ModulePermissions> | null;
  loading: boolean;
  hasPermission: (module: string, action: 'view' | 'edit' | 'delete') => boolean;
}

const MEMBER_EDIT_MODULES = new Set([
  'leads', 'deals', 'contracts', 'payments', 'workspace', 'analytics',
  'campaigns', 'content', 'social', 'calendar', 'projects', 'tasks',
]);

const PermissionsContext = createContext<PermissionsContextType>({
  permissions: null,
  loading: false,
  hasPermission: () => false,
});

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const { user, workspace } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'dev' || workspace?.owner_id === user?.id;

  const hasPermission = (module: string, action: 'view' | 'edit' | 'delete'): boolean => {
    if (isAdmin) return true;
    if (!user) return false;
    if (action === 'view') return true;
    if (action === 'edit') return MEMBER_EDIT_MODULES.has(module);
    return false;
  };

  return (
    <PermissionsContext.Provider value={{ permissions: null, loading: false, hasPermission }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export const usePermissions = (): PermissionsContextType => useContext(PermissionsContext);
