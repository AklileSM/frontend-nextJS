'use client';

import { useMemo } from 'react';
import type { ApiProject, ApiRobotMission, ApiRobotSummary } from '@/types/api';
import { activeStepSummary } from '../_lib/missions';
import { timestampAgeSeconds } from '../_lib/robotMap';

/** Heartbeats are frequent; a robot quiet for two minutes is not "ready". */
const ONLINE_WINDOW_SECONDS = 120;

type Props = {
  projects: ApiProject[];
  projectSlug: string;
  onProjectChange: (slug: string) => void;
  robots: ApiRobotSummary[];
  robotId: string;
  onRobotChange: (robotId: string) => void;
  activeMission: ApiRobotMission | null;
};

function formatQuietFor(ageSeconds: number | null): string {
  if (ageSeconds === null) return 'never checked in';
  if (ageSeconds < 90) return `quiet for ${Math.round(ageSeconds)}s`;
  if (ageSeconds < 5400) return `quiet for ${Math.round(ageSeconds / 60)}m`;
  return `quiet for ${Math.round(ageSeconds / 3600)}h`;
}

export function RobotContextBar({
  projects,
  projectSlug,
  onProjectChange,
  robots,
  robotId,
  onRobotChange,
  activeMission,
}: Props) {
  const robot = useMemo(
    () => robots.find((candidate) => candidate.username === robotId) ?? null,
    [robotId, robots],
  );

  /* Presence comes from the robot's own heartbeat, so it stays honest even when the ROS
   * stack (and therefore live position) is down. */
  const health = useMemo(() => {
    if (!robot) return { label: 'No robot selected', tone: 'border-base-800 bg-base-950 text-ink-400', dot: 'bg-ink-500' };
    const age = timestampAgeSeconds(robot.last_seen_at, Date.now());
    const online = age !== null && age < ONLINE_WINDOW_SECONDS;
    if (!online) {
      return {
        label: `Offline — ${formatQuietFor(age)}`,
        tone: 'border-base-800 bg-base-950 text-ink-400',
        dot: 'bg-ink-500',
      };
    }
    const busy = activeMission ? activeStepSummary(activeMission) : null;
    if (busy) {
      return { label: busy, tone: 'border-amber-500/30 bg-amber-500/10 text-amber-200', dot: 'bg-amber-400' };
    }
    return { label: 'Ready', tone: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200', dot: 'bg-emerald-400' };
  }, [activeMission, robot]);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-base-800 bg-base-900/60 p-3">
      <label className="min-w-0 flex-1">
        <span className="sr-only">Project</span>
        <select
          value={projectSlug}
          onChange={(event) => onProjectChange(event.target.value)}
          className="w-full rounded-xl border border-base-700 bg-base-950 px-3 py-2.5 text-[14px] text-white outline-none transition focus:border-amber-500"
        >
          <option value="">Select project</option>
          {projects.map((project) => (
            <option key={project.id} value={project.slug}>{project.name}</option>
          ))}
        </select>
      </label>

      <label className="min-w-0 flex-1">
        <span className="sr-only">Robot</span>
        <select
          value={robotId}
          onChange={(event) => onRobotChange(event.target.value)}
          className="w-full rounded-xl border border-base-700 bg-base-950 px-3 py-2.5 text-[14px] text-white outline-none transition focus:border-amber-500"
        >
          <option value="">Select robot</option>
          {robots.map((candidate) => (
            <option key={candidate.robot_id} value={candidate.username}>{candidate.username}</option>
          ))}
        </select>
      </label>

      <span className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-[12px] ${health.tone}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${health.dot}`} />
        {health.label}
      </span>
    </div>
  );
}
