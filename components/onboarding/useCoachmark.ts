'use client';

import { useCallback, useEffect, useState } from 'react';

export type CoachmarkState = 'pending' | 'dismissed';

const storageKey = (id: string) => `a6.coachmark.${id}`;

function read(id: string): CoachmarkState {
  if (typeof window === 'undefined') return 'pending';
  try {
    if (window.localStorage.getItem(storageKey(id)) === 'dismissed') return 'dismissed';
  } catch { /* ignore */ }
  return 'pending';
}

function write(id: string, value: CoachmarkState) {
  if (typeof window === 'undefined') return;
  try {
    if (value === 'pending') window.localStorage.removeItem(storageKey(id));
    else window.localStorage.setItem(storageKey(id), value);
  } catch { /* ignore */ }
}

export function useCoachmark(id: string) {
  const [state, setState] = useState<CoachmarkState>('pending');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setState(read(id));
    setMounted(true);
  }, [id]);

  const dismiss = useCallback(() => { write(id, 'dismissed'); setState('dismissed'); }, [id]);
  const reset = useCallback(() => { write(id, 'pending'); setState('pending'); }, [id]);

  return { state, mounted, isDismissed: state === 'dismissed', dismiss, reset };
}
