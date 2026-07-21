'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cancelRobotCommand, createRobotCommand, getLatestRobotCommand } from '@/services/apiClient';
import type { ApiRobotCommand } from '@/types/api';
import { isCommandActive } from '../_lib/connection';
import { parseUtcTimestamp } from '../_lib/robotMap';

type RobotConnectionState = {
  command: ApiRobotCommand | null;
  busy: boolean;
  submitting: boolean;
  error: string | null;
  /** True once a connect has been in flight past the timeout without finishing. */
  timedOut: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  cancel: () => Promise<void>;
  retry: () => Promise<void>;
  refresh: () => Promise<void>;
};

const ACTIVE_POLL_MS = 1500;
const IDLE_POLL_MS = 20000;
/* Two full bring-ups take real time; give up only well after that so a slow-but-fine connect is
 * never called a failure. Kept above the agent's own timeout so the agent's concrete error wins. */
const CONNECT_TIMEOUT_MS = 180000;

/**
 * Tracks a robot's connect/disconnect lifecycle by polling its latest command. Polls fast while
 * a bring-up is in flight so the progress tree feels live, backs off hard once it settles, and
 * declares a timeout if a connect never reaches a terminal state.
 */
export function useRobotConnection(robotId: string): RobotConnectionState {
  const [command, setCommand] = useState<ApiRobotCommand | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
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
    setTimedOut(false);
    void refresh();
  }, [robotId, refresh]);

  const busy = isCommandActive(command);

  useEffect(() => {
    if (!robotId) return;
    const period = busy ? ACTIVE_POLL_MS : IDLE_POLL_MS;
    const timer = setInterval(() => void refresh(), period);
    return () => clearInterval(timer);
  }, [robotId, busy, refresh]);

  // A fresh active command clears the timeout; then fire once it has run too long.
  useEffect(() => {
    setTimedOut(false);
    if (!busy || !command) return;
    const started = parseUtcTimestamp(command.created_at) ?? Date.now();
    const remaining = started + CONNECT_TIMEOUT_MS - Date.now();
    if (remaining <= 0) {
      setTimedOut(true);
      return;
    }
    const timer = setTimeout(() => setTimedOut(true), remaining);
    return () => clearTimeout(timer);
  }, [busy, command]);

  const send = useCallback(
    async (kind: 'connect' | 'disconnect') => {
      if (!robotId) return;
      setSubmitting(true);
      setError(null);
      setTimedOut(false);
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

  const cancel = useCallback(async () => {
    setTimedOut(false);
    if (command && isCommandActive(command)) {
      try {
        const cancelled = await cancelRobotCommand(command.id);
        setCommand(cancelled);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not cancel the connection.');
      }
    }
  }, [command]);

  const retry = useCallback(async () => {
    // Cancel a stuck/failed run first so the backend doesn't hand us back the same command.
    if (command && isCommandActive(command)) {
      try {
        await cancelRobotCommand(command.id);
      } catch {
        // best effort — the create below still supersedes on the happy path
      }
    }
    await send('connect');
  }, [command, send]);

  return { command, busy, submitting, error, timedOut, connect, disconnect, cancel, retry, refresh };
}
