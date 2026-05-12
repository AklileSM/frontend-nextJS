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

const PREFIX = 'a6.explorerDate.';

function readFromStorage(): DatesByScope {
  if (typeof window === 'undefined') return {};
  try {
    const result: DatesByScope = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(PREFIX)) {
        result[key.slice(PREFIX.length)] = localStorage.getItem(key);
      }
    }
    return result;
  } catch {
    return {};
  }
}

export function SelectedDateProvider({ children }: { children: ReactNode }) {
  const [dates, setDates] = useState<DatesByScope>(readFromStorage);

  const getDateForScope = useCallback((scope: string) => dates[scope] ?? null, [dates]);

  const setDateForScope = useCallback((scope: string, date: string | null) => {
    setDates((prev) => ({ ...prev, [scope]: date }));
    try {
      if (date === null) {
        localStorage.removeItem(`${PREFIX}${scope}`);
      } else {
        localStorage.setItem(`${PREFIX}${scope}`, date);
      }
    } catch {
      /* ignore */
    }
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
