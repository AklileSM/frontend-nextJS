'use client';

import { useMemo } from 'react';
import type { ApiProject, ApiRobotMission, ApiRobotSummary } from '@/types/api';
import { activeStepSummary } from '../_lib/missions';
import { formatQuietFor, robotPresence } from '../_lib/presence';

type Props = {
  projects: ApiProject[];
  projectSlug: string;
  onProjectChange: (slug: string) => void;
  robots: ApiRobotSummary[];
  robotId: string;
  onRobotChange: (robotId: string) => void;
  activeMission: ApiRobotMission | null;
};

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
    const { online, ageSeconds } = robotPresence(robot, Date.now());
    if (!online) {
      return {
        label: `Offline, ${formatQuietFor(ageSeconds)}`,
        tone: 'border-base-800 bg-base-950 text-ink-400',
        dot: 'bg-ink-500',
      };
    }
    const busy = activeMission ? activeStepSummary(activeMission) : null;
    if (busy) {
      return { label: busy, tone: 'border-amber-500/30 bg-amber-500/10 text-amber-200', dot: 'bg-amber-400' };
    }
    return null;
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

      {health ? (
        <span className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-[12px] ${health.tone}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${health.dot}`} />
          {health.label}
        </span>
      ) : null}
    </div>
  );
}
