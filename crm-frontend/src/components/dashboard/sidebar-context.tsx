'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

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
  // Default must be identical on server and client first render (hydration).
  // The stored preference is applied after mount instead.
  const [collapsed, setCollapsedState] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('sidebar_collapsed');
      if (saved !== null) setCollapsedState(saved === 'true');
    } catch {
      // storage unavailable — keep default
    }
  }, []);

  const setCollapsed = (val: boolean) => {
    setCollapsedState(val);
    try {
      localStorage.setItem('sidebar_collapsed', String(val));
    } catch {
      // storage unavailable — keep in-memory state only
    }
  };

  return (
    <SidebarContext.Provider value={{ mobileOpen, setMobileOpen, collapsed, setCollapsed }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}
