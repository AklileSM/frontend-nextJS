'use client';

import { useEffect, useRef, useState } from 'react';
import {
  getRobotTelemetry,
  openRobotTelemetryWebSocket,
  streamRobotTelemetry,
} from '@/services/apiClient';
import type { ApiRobotTelemetry } from '@/types/api';
import { timestampAgeSeconds } from '../_lib/robotMap';

export const TELEMETRY_STALE_SECONDS = 6;
const TELEMETRY_TRAIL_LIMIT = 160;

export type TelemetryTrailPoint = {
  x: number;
  y: number;
  z: number;
  yaw: number | null;
  received_at_utc: string;
};

/** 'waiting' = nothing ever arrived; 'behind' = we have a pose but it has gone stale. */
export type TelemetryStatus = 'live' | 'behind' | 'waiting';

export type TelemetryState = {
  telemetry: ApiRobotTelemetry | null;
  trail: TelemetryTrailPoint[];
  ageSeconds: number | null;
  status: TelemetryStatus;
};

function telemetryTimestampMs(telemetry: ApiRobotTelemetry): number | null {
  const value = telemetry.received_at_utc ?? telemetry.reported_at_utc;
  return value ? new Date(/(?:z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : `${value}Z`).getTime() : null;
}

/**
 * Live position is a nice-to-have, not the source of truth — it depends on the robot's ROS
 * stack being up, which it often is not. So this only connects while the caller is actually
 * showing it (`enabled`) and the tab is visible; everything else reads mission steps instead.
 */
export function useRobotTelemetry(robotId: string, enabled: boolean): TelemetryState {
  const [telemetry, setTelemetry] = useState<ApiRobotTelemetry | null>(null);
  const [trail, setTrail] = useState<TelemetryTrailPoint[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [visible, setVisible] = useState(true);
  const latestTimestampRef = useRef<number | null>(null);
  const onSnapshotRef = useRef<(telemetry: ApiRobotTelemetry) => void>(() => undefined);

  useEffect(() => {
    const onChange = () => setVisible(document.visibilityState === 'visible');
    onChange();
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);

  const active = enabled && visible && Boolean(robotId);

  onSnapshotRef.current = (incoming: ApiRobotTelemetry) => {
    const incomingTimestamp = telemetryTimestampMs(incoming);
    const latest = latestTimestampRef.current;
    if (incomingTimestamp !== null && latest !== null && incomingTimestamp <= latest) return;
    if (incomingTimestamp !== null) latestTimestampRef.current = incomingTimestamp;

    setNow(Date.now());
    setTelemetry(incoming);
    const receivedAt = incoming.received_at_utc || incoming.reported_at_utc
      || `${incoming.pose.x}:${incoming.pose.y}`;
    setTrail((current) => {
      if (current[current.length - 1]?.received_at_utc === receivedAt) return current;
      return [
        ...current,
        { ...incoming.pose, yaw: incoming.pose.yaw ?? null, received_at_utc: receivedAt },
      ].slice(-TELEMETRY_TRAIL_LIMIT);
    });
  };

  // Reset whenever the subject changes, so one robot's trail never bleeds into another's.
  useEffect(() => {
    latestTimestampRef.current = null;
    setTelemetry(null);
    setTrail([]);
  }, [robotId]);

  useEffect(() => {
    if (!active) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active]);

  useEffect(() => {
    if (!active) return undefined;

    let cancelled = false;
    let fallbackTimer: number | null = null;
    let streamStarted = false;
    let socket: WebSocket | null = null;
    let requestInFlight = false;
    const controller = new AbortController();

    const loadOnce = async () => {
      if (requestInFlight) return;
      requestInFlight = true;
      try {
        const next = await getRobotTelemetry(robotId);
        if (!cancelled) onSnapshotRef.current(next);
      } catch {
        // Staleness is surfaced from the pose timestamp, not from transport errors.
      } finally {
        requestInFlight = false;
      }
    };

    const startPolling = () => {
      if (fallbackTimer !== null) return;
      loadOnce().catch(() => undefined);
      fallbackTimer = window.setInterval(() => {
        loadOnce().catch(() => undefined);
      }, 1000);
    };

    const startStream = () => {
      if (streamStarted) return;
      streamStarted = true;
      streamRobotTelemetry(robotId, (next) => {
        if (!cancelled) onSnapshotRef.current(next);
      }, controller.signal)
        .then(() => {
          if (!cancelled) startPolling();
        })
        .catch(() => {
          if (!cancelled && !controller.signal.aborted) startPolling();
        });
    };

    try {
      socket = openRobotTelemetryWebSocket(robotId, (next) => {
        if (!cancelled) onSnapshotRef.current(next);
      }, {
        onClose: () => {
          if (!cancelled) startStream();
        },
      });
    } catch {
      startStream();
    }

    return () => {
      cancelled = true;
      if (socket) socket.close();
      controller.abort();
      if (fallbackTimer !== null) window.clearInterval(fallbackTimer);
    };
  }, [active, robotId]);

  const ageSeconds = telemetry
    ? timestampAgeSeconds(telemetry.received_at_utc ?? telemetry.reported_at_utc, now)
    : null;
  const status: TelemetryStatus = !telemetry
    ? 'waiting'
    : ageSeconds !== null && ageSeconds <= TELEMETRY_STALE_SECONDS
      ? 'live'
      : 'behind';

  return { telemetry, trail, ageSeconds, status };
}
