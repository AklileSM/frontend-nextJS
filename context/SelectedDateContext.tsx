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
  filesVersion: number;
  bumpFilesVersion: () => void;
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

/**
 * Persists the user's selected date per explorer scope across navigation.
 *
 * A "scope" is a string key that identifies which part of the UI owns a date
 * selection, typically a project ID (e.g. `"proj-abc123"`). Using scopes lets
 * different projects remember different selected dates independently.
 *
 * State is kept in React for instant UI updates and mirrored to localStorage
 * under the key pattern `a6.explorerDate.<scope>` so the selection survives
 * page refreshes. SSR is guarded (`typeof window` check in `readFromStorage`).
 *
 * Mounted once at the app root inside `AuthProvider` via `AppProviders`.
 */
export function SelectedDateProvider({ children }: { children: ReactNode }) {
  const [dates, setDates] = useState<DatesByScope>(readFromStorage);
  const [filesVersion, setFilesVersion] = useState(0);

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

  const bumpFilesVersion = useCallback(() => setFilesVersion((v) => v + 1), []);

  const value = useMemo<SelectedDateContextValue>(
    () => ({ getDateForScope, setDateForScope, filesVersion, bumpFilesVersion }),
    [getDateForScope, setDateForScope, filesVersion, bumpFilesVersion],
  );

  return <SelectedDateContext.Provider value={value}>{children}</SelectedDateContext.Provider>;
}

export function useSelectedDate() {
  const ctx = useContext(SelectedDateContext);
  if (!ctx) throw new Error('useSelectedDate must be used within SelectedDateProvider');
  return ctx;
}
