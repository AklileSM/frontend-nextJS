'use client';

import { Loader2, XCircle } from 'lucide-react';
import type { ApiRobotMission } from '@/types/api';
import {
  activeStepSummary,
  canCancelMission,
  canForceCloseMission,
  canStopMission,
  formatMissionTime,
  missionProgressEvents,
  routeSummary,
  scheduleNameOf,
} from '../_lib/missions';
import { ProgressTimeline } from './ProgressTimeline';

type Props = {
  mission: ApiRobotMission | null;
  onCancel: (mission: ApiRobotMission) => void;
  onStop: (mission: ApiRobotMission) => void;
  onForceClose: (mission: ApiRobotMission) => void;
};

/**
 * The trusted view of a capture. Unlike the live map this is backed by mission steps from the
 * backend, so it keeps working when the robot's ROS stack is down.
 */
export function ProgressTab({ mission, onCancel, onStop, onForceClose }: Props) {
  if (!mission) {
    return (
      <div className="rounded-2xl border border-dashed border-base-700 px-4 py-14 text-center">
        <p className="text-[14px] text-ink-300">No capture running.</p>
        <p className="mt-1 text-[13px] text-ink-500">Build a route and start one to watch its progress here.</p>
      </div>
    );
  }

  const events = missionProgressEvents(mission);
  const summary = activeStepSummary(mission);
  const scheduleName = scheduleNameOf(mission);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-[20px] text-white">{routeSummary(mission, 3)}</p>
          <p className="mt-1 text-[13px] text-ink-400">
            {scheduleName ? `${scheduleName} · ` : ''}
            Started {formatMissionTime(mission.started_at ?? mission.created_at)}
          </p>
        </div>
        {canCancelMission(mission.status) ? (
          <button
            type="button"
            onClick={() => onCancel(mission)}
            className="inline-flex items-center gap-2 rounded-xl border border-amber-600/40 px-3 py-2 text-[12px] text-amber-200 transition hover:bg-amber-500/10"
          >
            <XCircle size={13} />
            Cancel and return
          </button>
        ) : canStopMission(mission.status) ? (
          <button
            type="button"
            onClick={() => onStop(mission)}
            className="inline-flex items-center gap-2 rounded-xl border border-red-500/40 px-3 py-2 text-[12px] text-red-200 transition hover:bg-red-500/10"
          >
            <XCircle size={13} />
            Stop now
          </button>
        ) : canForceCloseMission(mission.status) ? (
          <button
            type="button"
            onClick={() => onForceClose(mission)}
            className="inline-flex items-center gap-2 rounded-xl border border-red-500/40 px-3 py-2 text-[12px] text-red-200 transition hover:bg-red-500/10"
          >
            <XCircle size={13} />
            Close stuck task
          </button>
        ) : null}
      </div>

      {summary ? (
        <div className="mt-4 flex items-center gap-2.5 rounded-2xl border border-amber-500/25 bg-amber-500/5 px-4 py-3">
          <Loader2 size={14} className="shrink-0 animate-spin text-amber-300" />
          <p className="text-[14px] text-amber-100">{summary}</p>
        </div>
      ) : null}

      {mission.status === 'cancel_failed' ? (
        <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/5 px-4 py-3">
          <p className="text-[14px] text-red-100">Task stopped, but return to start failed.</p>
          {mission.cancel_error ? (
            <p className="mt-1 text-[12px] text-red-300">{mission.cancel_error}</p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-5">
        <ProgressTimeline events={events} />
      </div>
    </div>
  );
}
