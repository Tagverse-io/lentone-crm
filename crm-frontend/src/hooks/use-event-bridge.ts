'use client';

import { useEffect } from 'react';
import { initEventBridge } from '@/lib/db/events/bridge';
import { useAuth } from '@/lib/firebase/auth-context';

/**
 * Hook to initialize the event bridge
 * 
 * Usage: Call this in your root layout or app component
 * 
 * Example:
 * ```tsx
 * function App() {
 *   useEventBridge();
 *   return <div>...</div>;
 * }
 * ```
 */
export function useEventBridge() {
  const { workspace } = useAuth();
  
  useEffect(() => {
    if (!workspace?.id) return;
    
    // Initialize event bridge with workspace ID
    const cleanupEventBridge = initEventBridge(workspace.id);
    
    // Cleanup on unmount
    return () => {
      cleanupEventBridge();
    };
  }, [workspace?.id]);
}
