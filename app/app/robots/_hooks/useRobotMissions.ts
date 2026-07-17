'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { listRobotMissions, listRobots } from '@/services/apiClient';
import type { ApiRobotMission, ApiRobotSummary } from '@/types/api';
import {
  ACTIVE_MISSION_POLL_LIMIT,
  ACTIVE_POLL_MS,
  IDLE_POLL_MS,
  MISSION_LIST_LIMIT,
  isActiveMissionStatus,
  mergeMissions,
} from '../_lib/missions';

type RobotMissionsState = {
  robots: ApiRobotSummary[];
  missions: ApiRobotMission[];
  activeMission: ApiRobotMission | null;
  hasActiveMission: boolean;
  loading: boolean;
  refresh: (options?: { partial?: boolean }) => Promise<void>;
};

/**
 * Mission steps are the trusted progress source — they come from the backend, and unlike
 * telemetry they do not depend on the robot's ROS stack being up. So this polls fast enough
 * for a running capture to feel live, backs off hard when idle, and stops in a background tab.
 */
export function useRobotMissions(): RobotMissionsState {
  const [robots, setRobots] = useState<ApiRobotSummary[]>([]);
  const [missions, setMissions] = useState<ApiRobotMission[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (options?: { partial?: boolean }) => {
    const partial = options?.partial ?? false;
    const [robotsData, missionsData] = await Promise.all([
      listRobots(),
      listRobotMissions({ limit: partial ? ACTIVE_MISSION_POLL_LIMIT : MISSION_LIST_LIMIT }),
    ]);
    setRobots(robotsData);
    setMissions((current) => (partial ? mergeMissions(current, missionsData) : missionsData));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    refresh()
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const hasActiveMission = useMemo(
    () => missions.some((mission) => isActiveMissionStatus(mission.status)),
    [missions],
  );

  const activeMission = useMemo(
    () => missions.find((mission) => isActiveMissionStatus(mission.status)) ?? null,
    [missions],
  );

  useEffect(() => {
    let timer: number | null = null;

    const stop = () => {
      if (timer === null) return;
      window.clearInterval(timer);
      timer = null;
    };
    const start = () => {
      if (timer !== null) return;
      timer = window.setInterval(() => {
        refresh({ partial: hasActiveMission }).catch(() => undefined);
      }, hasActiveMission ? ACTIVE_POLL_MS : IDLE_POLL_MS);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        stop();
        return;
      }
      // The view can be a whole interval stale on return, so catch up before resuming the cadence.
      refresh().catch(() => undefined);
      start();
    };

    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [hasActiveMission, refresh]);

  return { robots, missions, activeMission, hasActiveMission, loading, refresh };
}
