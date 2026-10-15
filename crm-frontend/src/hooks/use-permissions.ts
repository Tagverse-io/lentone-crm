// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/firebase/auth-context';
import { getRoles } from '@/lib/db/roles/api';
import { Role } from '@/lib/db/types';

export function usePermissions() {
  const { user, workspace } = useAuth();
  const [userRole, setUserRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRole() {
      if (!user || !workspace?.id) {
        setLoading(false);
        return;
      }
      
      try {
        const roles = await getRoles(workspace.id);
        const role = roles.find(r => r.name === user.role || r.id === user.role);
        setUserRole(role || null);
      } catch (error) {
        console.error('Failed to load user role permissions', error);
      } finally {
        setLoading(false);
      }
    }
    
    loadRole();
  }, [user, workspace?.id]);

  const can = (module: string, action: 'view' | 'edit' | 'delete'): boolean => {
    if (loading) return false;
    
    // Admins always have full access
    if (user?.role === 'Admin' || user?.role === 'admin' || workspace?.owner_id === user?.id) {
      return true;
    }
    
    if (!userRole || !userRole.permissions || !userRole.permissions[module]) {
      return false;
    }
    
    return userRole.permissions[module][action] === true;
  };

  return { can, loading, userRole };
}
