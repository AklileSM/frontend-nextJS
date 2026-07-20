'use client';

import { useState } from 'react';
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
import { friendlyError, hasTechnicalDetail } from '../_lib/friendlyError';

/**
 * A failure line in plain English, with the raw robot/backend text tucked behind a toggle so
 * operators read something actionable while the original stays one click away for debugging.
 */
function FailureDetail({ raw, className }: { raw: string | null | undefined; className?: string }) {
  const [open, setOpen] = useState(false);
  const friendly = friendlyError(raw);
  if (!friendly) return null;
  return (
    <div className={className}>
      <p className="break-words text-red-200">{friendly}</p>
      {hasTechnicalDetail(raw, friendly) ? (
        <>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="mt-0.5 text-[10px] text-ink-500 underline decoration-dotted underline-offset-2 transition hover:text-ink-300"
          >
            {open ? 'Hide technical details' : 'Show technical details'}
          </button>
          {open ? (
            <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md border border-base-800 bg-base-950 px-2 py-1 font-mono text-[10px] text-ink-400">
              {raw}
            </pre>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

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
                {event.detail ? <FailureDetail raw={event.detail} className="mt-1 text-[11px]" /> : null}
              </div>
            </li>
          );
        })}
      </ol>

      {failure ? (
        <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-3 text-[12px]">
          <FailureDetail raw={failure} />
        </div>
      ) : null}
    </div>
  );
}
