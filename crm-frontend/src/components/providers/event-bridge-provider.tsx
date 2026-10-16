'use client';

import { useEffect } from 'react';
import { initEventBridge } from '@/lib/db/events/bridge';
import { useAuth } from '@/lib/firebase/auth-context';

/**
 * Event Bridge Provider
 * 
 * Initializes the event bridge when the user is authenticated.
 * This enables automatic cascade updates across all modules.
 */
export function EventBridgeProvider({ children }: { children: React.ReactNode }) {
  const { workspace } = useAuth();
  
  useEffect(() => {
    if (!workspace?.id) return;
    
    // Initialize event bridge with workspace ID
    const cleanupEventBridge = initEventBridge(workspace.id);

    return () => {
      cleanupEventBridge();
    };
  }, [workspace?.id]);
  
  return <>{children}</>;
}
