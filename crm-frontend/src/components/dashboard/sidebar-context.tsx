'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useWorkspace } from '@/lib/settings/workspace-context';

interface SidebarContextType {
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType>({
  mobileOpen: false,
  setMobileOpen: () => {},
  collapsed: false,
  setCollapsed: () => {},
});

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsedState] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebar_collapsed');
      if (saved !== null) return saved === 'true';
    }
    return false;
  });
  const [initialized, setInitialized] = useState(false);
  const { settings } = useWorkspace();

  const setCollapsed = (val: boolean) => {
    setCollapsedState(val);
    if (typeof window !== 'undefined') {
      localStorage.setItem('sidebar_collapsed', String(val));
    }
  };

  useEffect(() => {
    if (!initialized && settings?.appearance?.sidebar_collapsed !== undefined) {
      setCollapsed(settings.appearance.sidebar_collapsed);
      setInitialized(true);
    }
  }, [settings?.appearance?.sidebar_collapsed, initialized]);

  return (
    <SidebarContext.Provider value={{ mobileOpen, setMobileOpen, collapsed, setCollapsed }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}
