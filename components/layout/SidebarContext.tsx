'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

// Single boolean controls sidebar visibility:
//   lg+ open  → expanded 260px
//   lg+ false → icon rail 68px
//   < lg open → drawer overlay
//   < lg false → drawer hidden
// Persisted in localStorage so refreshes remember the user's preference.

type Ctx = {
  open: boolean;
  toggle: () => void;
  close: () => void;
};

const SidebarCtx = createContext<Ctx | undefined>(undefined);
const STORAGE_KEY = 'a6.sidebarOpen';

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === '0') setOpen(false);
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    try {
      localStorage.setItem(STORAGE_KEY, '0');
    } catch {
      /* ignore */
    }
  }, []);

  return <SidebarCtx.Provider value={{ open, toggle, close }}>{children}</SidebarCtx.Provider>;
}

export function useSidebar() {
  const c = useContext(SidebarCtx);
  if (!c) throw new Error('useSidebar must be used within SidebarProvider');
  return c;
}
