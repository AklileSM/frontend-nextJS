import type { ApiRobotSummary } from '@/types/api';
import { timestampAgeSeconds } from './robotMap';

/** The agent heartbeats often; a robot quiet for two minutes is not "ready". */
export const ONLINE_WINDOW_SECONDS = 120;

export type RobotPresence = {
  online: boolean;
  ageSeconds: number | null;
};

/**
 * Presence comes from the robot agent's own heartbeat (`last_seen_at`), which is a completely
 * separate path from telemetry: the agent talks HTTP to the backend, while live position comes
 * from the ROS stack. Keeping them apart is what lets the UI tell "the robot is gone" apart
 * from "the robot is fine but its navigation stack isn't publishing a pose" — which is the
 * failure that previously showed up as a robot frozen on the map with no explanation.
 */
export function robotPresence(robot: ApiRobotSummary | null, nowMs: number): RobotPresence {
  if (!robot) return { online: false, ageSeconds: null };
  const ageSeconds = timestampAgeSeconds(robot.last_seen_at, nowMs);
  return { online: ageSeconds !== null && ageSeconds < ONLINE_WINDOW_SECONDS, ageSeconds };
}

export function formatQuietFor(ageSeconds: number | null): string {
  if (ageSeconds === null) return 'never checked in';
  if (ageSeconds < 90) return `quiet for ${Math.round(ageSeconds)}s`;
  if (ageSeconds < 5400) return `quiet for ${Math.round(ageSeconds / 60)}m`;
  return `quiet for ${Math.round(ageSeconds / 3600)}h`;
}
