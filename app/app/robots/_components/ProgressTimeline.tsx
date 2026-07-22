'use client';

import { useState } from 'react';
import { formatMissionTime } from '../_lib/missions';
import type { MissionProgressEvent, MissionProgressStatus } from '../_lib/missions';
import { friendlyError, hasTechnicalDetail } from '../_lib/friendlyError';

/**
 * A failure line in plain English, with the raw robot/backend text tucked behind a toggle so
 * operators read something actionable while the original stays one click away for debugging.
 * Shared by the mission progress view and the connect/disconnect progress tree.
 */
export function FailureDetail({ raw, className }: { raw: string | null | undefined; className?: string }) {
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
            {open ? 'Hide details' : 'Show details'}
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

/** A vertical timeline of progress events, used for both a capture mission and a connect run. */
export function ProgressTimeline({ events }: { events: MissionProgressEvent[] }) {
  return (
    <ol>
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
  );
}
