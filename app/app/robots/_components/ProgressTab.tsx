'use client';

import { Loader2, XCircle } from 'lucide-react';
import type { ApiRobotMission } from '@/types/api';
import {
  activeStepSummary,
  canCancelMission,
  formatMissionTime,
  missionFailureMessage,
  missionProgressEvents,
  routeSummary,
} from '../_lib/missions';
import type { MissionProgressStatus } from '../_lib/missions';

const DOT_STYLES: Record<MissionProgressStatus, string> = {
  pending: 'border-base-700 bg-base-900',
  running: 'border-amber-300 bg-amber-400',
  succeeded: 'border-emerald-300 bg-emerald-400',
  failed: 'border-red-300 bg-red-400',
  skipped: 'border-base-600 bg-base-700',
  cancelled: 'border-base-600 bg-base-700',
};

const TEXT_STYLES: Record<MissionProgressStatus, string> = {
  pending: 'text-ink-500',
  running: 'text-amber-100',
  succeeded: 'text-white',
  failed: 'text-red-100',
  skipped: 'text-ink-500',
  cancelled: 'text-ink-500',
};

type Props = {
  mission: ApiRobotMission | null;
  onCancel: (mission: ApiRobotMission) => void;
};

/**
 * The trusted view of a capture. Unlike the live map this is backed by mission steps from the
 * backend, so it keeps working when the robot's ROS stack is down.
 */
export function ProgressTab({ mission, onCancel }: Props) {
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
  const failure = missionFailureMessage(mission);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-[20px] text-white">{routeSummary(mission, 3)}</p>
          <p className="mt-1 text-[13px] text-ink-400">
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
            Stop capture
          </button>
        ) : null}
      </div>

      {summary ? (
        <div className="mt-4 flex items-center gap-2.5 rounded-2xl border border-amber-500/25 bg-amber-500/5 px-4 py-3">
          <Loader2 size={14} className="shrink-0 animate-spin text-amber-300" />
          <p className="text-[14px] text-amber-100">{summary}</p>
        </div>
      ) : null}

      <ol className="mt-5">
        {events.map((event, index) => {
          const isLast = index === events.length - 1;
          const muted = event.status === 'pending' || event.status === 'skipped' || event.status === 'cancelled';
          return (
            <li key={`${event.id}-${index}`} className={`relative flex gap-3 ${muted ? 'opacity-50' : ''} ${isLast ? '' : 'pb-4'}`}>
              {!isLast ? <span className="absolute left-[7px] top-4 h-full w-px bg-base-800" /> : null}
              <span className={`relative mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-2 ${DOT_STYLES[event.status]}`}>
                {event.status === 'running' ? (
                  <span className="absolute -inset-1 rounded-full bg-amber-400/25 animate-ping" />
                ) : null}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className={`min-w-0 text-[13px] ${TEXT_STYLES[event.status]}`}>{event.label}</p>
                  {event.at ? (
                    <span className="font-mono text-[11px] text-ink-500">{formatMissionTime(event.at)}</span>
                  ) : null}
                </div>
                {event.detail ? (
                  <p className="mt-1 break-words text-[11px] text-red-200">{event.detail}</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      {failure ? (
        <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-3 text-[12px] text-red-200">
          {failure}
        </div>
      ) : null}
    </div>
  );
}
