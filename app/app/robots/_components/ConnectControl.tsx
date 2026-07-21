'use client';

import { useState } from 'react';
import { Loader2, Power, Zap } from 'lucide-react';
import type { ApiRobotCommand } from '@/types/api';
import { deriveConnection } from '../_lib/connection';
import { normalizeProgressEvents } from '../_lib/missions';
import { friendlyError } from '../_lib/friendlyError';
import { ProgressTimeline } from './ProgressTimeline';

type Props = {
  robotId: string;
  command: ApiRobotCommand | null;
  submitting: boolean;
  error: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
};

/**
 * The one-click "Connect robot" control. It hides the localization/navigation bring-up behind a
 * single button and shows the same progress tree a capture uses, tucked under "Show details".
 */
export function ConnectControl({ robotId, command, submitting, error, onConnect, onDisconnect }: Props) {
  const [open, setOpen] = useState(false);
  if (!robotId) return null;

  const view = deriveConnection(command);
  const events = normalizeProgressEvents(command?.progress_events);
  const connected = view.connection === 'connected';
  const disabled = view.busy || submitting;

  // The friendly failure line, shown when the latest connect run failed (technical text lives in
  // the tree's per-step toggle).
  const failureLine =
    error ??
    (command && command.status === 'failed' && command.kind === 'connect'
      ? friendlyError(command.detail)
      : null);

  return (
    <div className="rounded-2xl border border-base-800 bg-base-900/60 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={connected ? onDisconnect : onConnect}
          disabled={disabled}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-medium transition disabled:opacity-50 ${
            connected
              ? 'border border-base-700 text-ink-100 hover:border-ink-400'
              : 'bg-amber-500 text-base-950 hover:bg-amber-400'
          }`}
        >
          {disabled ? (
            <Loader2 size={15} className="animate-spin" />
          ) : connected ? (
            <Power size={15} />
          ) : (
            <Zap size={15} />
          )}
          {view.busy ? view.label : connected ? 'Disconnect' : 'Connect robot'}
        </button>

        <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] ${view.tone}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${view.dot}`} />
          {view.label}
        </span>

        {events.length > 0 ? (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="ml-auto text-[12px] text-ink-400 underline decoration-dotted underline-offset-2 transition hover:text-ink-200"
          >
            {open ? 'Hide details' : 'Show details'}
          </button>
        ) : null}
      </div>

      {failureLine ? <p className="mt-2 text-[12px] text-red-200">{failureLine}</p> : null}

      {open && events.length > 0 ? (
        <div className="mt-3 rounded-xl border border-base-800 bg-base-950/60 px-3 py-3">
          <ProgressTimeline events={events} />
        </div>
      ) : null}
    </div>
  );
}
