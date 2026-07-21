'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createRobotCommand, getLatestRobotCommand } from '@/services/apiClient';
import type { ApiRobotCommand } from '@/types/api';
import { isCommandActive } from '../_lib/connection';

type RobotConnectionState = {
  command: ApiRobotCommand | null;
  busy: boolean;
  submitting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  refresh: () => Promise<void>;
};

const ACTIVE_POLL_MS = 1500;
const IDLE_POLL_MS = 20000;

/**
 * Tracks a robot's connect/disconnect lifecycle by polling its latest command. Polls fast while
 * a bring-up is in flight so the progress tree feels live, and backs off hard once it settles.
 */
export function useRobotConnection(robotId: string): RobotConnectionState {
  const [command, setCommand] = useState<ApiRobotCommand | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const robotRef = useRef(robotId);
  robotRef.current = robotId;

  const refresh = useCallback(async () => {
    if (!robotId) {
      setCommand(null);
      return;
    }
    try {
      const latest = await getLatestRobotCommand(robotId);
      // Guard against a stale response landing after the operator switched robots.
      if (robotRef.current === robotId) setCommand(latest);
    } catch {
      // Transient poll failure — keep the last known state rather than flapping the UI.
    }
  }, [robotId]);

  useEffect(() => {
    setCommand(null);
    setError(null);
    void refresh();
  }, [robotId, refresh]);

  const busy = isCommandActive(command);

  useEffect(() => {
    if (!robotId) return;
    const period = busy ? ACTIVE_POLL_MS : IDLE_POLL_MS;
    const timer = setInterval(() => void refresh(), period);
    return () => clearInterval(timer);
  }, [robotId, busy, refresh]);

  const send = useCallback(
    async (kind: 'connect' | 'disconnect') => {
      if (!robotId) return;
      setSubmitting(true);
      setError(null);
      try {
        const created = await createRobotCommand(robotId, kind);
        setCommand(created);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not reach the robot.');
      } finally {
        setSubmitting(false);
      }
    },
    [robotId],
  );

  const connect = useCallback(() => send('connect'), [send]);
  const disconnect = useCallback(() => send('disconnect'), [send]);

  return { command, busy, submitting, error, connect, disconnect, refresh };
}
