'use client';

import { useCallback, useEffect, useState } from 'react';

export type CoachmarkState = 'pending' | 'completed' | 'dismissed';

const storageKey = (id: string) => `a6.coachmark.${id}`;

function read(id: string): CoachmarkState {
  if (typeof window === 'undefined') return 'pending';
  try {
    const v = window.localStorage.getItem(storageKey(id));
    if (v === 'completed' || v === 'dismissed') return v;
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

  const complete = useCallback(() => { write(id, 'completed'); setState('completed'); }, [id]);
  const dismiss = useCallback(() => { write(id, 'dismissed'); setState('dismissed'); }, [id]);
  const reset = useCallback(() => { write(id, 'pending'); setState('pending'); }, [id]);

  return { state, mounted, isDone: state !== 'pending', complete, dismiss, reset };
}
