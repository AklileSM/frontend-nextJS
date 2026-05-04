'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type DatesByScope = Record<string, string | null>;

type SelectedDateContextValue = {
  getDateForScope: (scope: string) => string | null;
  setDateForScope: (scope: string, date: string | null) => void;
};

const SelectedDateContext = createContext<SelectedDateContextValue | undefined>(undefined);

export function SelectedDateProvider({ children }: { children: ReactNode }) {
  // Phase 0: in-memory only. Phase 2/3 will wire localStorage persistence
  // (`a6.explorerDate.{scope}`) to match the existing app.
  const [dates, setDates] = useState<DatesByScope>({});

  const getDateForScope = useCallback((scope: string) => dates[scope] ?? null, [dates]);

  const setDateForScope = useCallback((scope: string, date: string | null) => {
    setDates((prev) => ({ ...prev, [scope]: date }));
  }, []);

  const value = useMemo<SelectedDateContextValue>(
    () => ({ getDateForScope, setDateForScope }),
    [getDateForScope, setDateForScope],
  );

  return <SelectedDateContext.Provider value={value}>{children}</SelectedDateContext.Provider>;
}

export function useSelectedDate() {
  const ctx = useContext(SelectedDateContext);
  if (!ctx) throw new Error('useSelectedDate must be used within SelectedDateProvider');
  return ctx;
}
