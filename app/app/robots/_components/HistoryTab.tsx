'use client';

import { useState } from 'react';
import { ChevronDown, Trash2 } from 'lucide-react';
import type { ApiRobotMission } from '@/types/api';
import {
  canDeleteMission,
  formatCaptureOutputs,
  captureOutputsOf,
  formatMissionTime,
  missionFailureMessage,
  missionProgressEvents,
  routeSummary,
} from '../_lib/missions';

const OUTCOME_STYLES: Record<string, string> = {
  succeeded: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  failed: 'border-red-500/30 bg-red-500/10 text-red-200',
  cancelled: 'border-base-800 bg-base-950 text-ink-400',
  running: 'border-blue-500/30 bg-blue-500/10 text-blue-200',
  queued: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  dispatched: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200',
};

const OUTCOME_LABELS: Record<string, string> = {
  succeeded: 'Complete',
  failed: 'Failed',
  cancelled: 'Stopped',
  running: 'Running',
  queued: 'Queued',
  dispatched: 'Starting',
};

type Props = {
  missions: ApiRobotMission[];
  onDelete: (mission: ApiRobotMission) => void;
};

function HistoryRow({ mission, onDelete }: { mission: ApiRobotMission; onDelete: (m: ApiRobotMission) => void }) {
  const [open, setOpen] = useState(false);
  const failure = missionFailureMessage(mission);

  return (
    <div className="rounded-xl border border-base-800 bg-base-950/50">
      <div className="flex items-center gap-3 px-4 py-3">
        <button type="button" onClick={() => setOpen((c) => !c)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <ChevronDown size={14} className={`shrink-0 text-ink-500 transition-transform ${open ? 'rotate-180' : ''}`} />
          <span className="w-28 shrink-0 font-mono text-[11px] text-ink-400">{formatMissionTime(mission.created_at)}</span>
          <span className="min-w-0 flex-1 truncate text-[13px] text-white">{routeSummary(mission, 3)}</span>
          <span className="hidden shrink-0 font-mono text-[10px] uppercase text-ink-500 sm:inline">
            {formatCaptureOutputs(captureOutputsOf(mission))}
          </span>
          <span className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase ${OUTCOME_STYLES[mission.status] ?? 'border-base-800 bg-base-950 text-ink-400'}`}>
            {OUTCOME_LABELS[mission.status] ?? mission.status}
          </span>
        </button>
        {canDeleteMission(mission.status) ? (
          <button
            type="button"
            onClick={() => onDelete(mission)}
            title="Delete"
            className="shrink-0 rounded-lg p-1.5 text-ink-500 transition hover:bg-red-500/10 hover:text-red-200"
          >
            <Trash2 size={13} />
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="border-t border-base-800 px-4 py-3">
          <ol className="space-y-1.5">
            {missionProgressEvents(mission).map((event, index) => (
              <li key={`${event.id}-${index}`} className="flex items-baseline justify-between gap-3 text-[12px]">
                <span className={event.status === 'failed' ? 'text-red-200' : 'text-ink-300'}>{event.label}</span>
                {event.at ? <span className="shrink-0 font-mono text-[10px] text-ink-500">{formatMissionTime(event.at)}</span> : null}
              </li>
            ))}
          </ol>
          {failure ? <p className="mt-3 text-[12px] text-red-200">{failure}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

export function HistoryTab({ missions, onDelete }: Props) {
  if (missions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-base-700 px-4 py-14 text-center text-[14px] text-ink-400">
        No captures yet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {missions.map((mission) => (
        <HistoryRow key={mission.id} mission={mission} onDelete={onDelete} />
      ))}
    </div>
  );
}
