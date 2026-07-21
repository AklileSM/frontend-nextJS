'use client';

import { useEffect, useState } from 'react';
import { Loader2, Power, X, Zap } from 'lucide-react';
import type { ApiRobotCommand } from '@/types/api';
import { Modal } from '@/components/ui/Modal';
import { deriveConnection } from '../_lib/connection';
import { normalizeProgressEvents } from '../_lib/missions';
import { friendlyError } from '../_lib/friendlyError';
import { ProgressTimeline } from './ProgressTimeline';

type Props = {
  robotId: string;
  command: ApiRobotCommand | null;
  submitting: boolean;
  error: string | null;
  timedOut: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onCancel: () => void;
  onRetry: () => void;
};

const TIMEOUT_MESSAGE =
  'The robot didn’t finish connecting in time. It may still be starting up — try again in a moment.';

/**
 * The one-click "Connect robot" control. The button alone carries the state — Connect when idle,
 * a spinner-with-Cancel while working, Disconnect once up — so there is no separate status chip.
 * A failure (or a timeout) surfaces in a small modal offering Try again / Cancel; success is
 * silent, the button just flips to Disconnect. The progress tree stays inline under "Show details".
 */
export function ConnectControl({
  robotId,
  command,
  submitting,
  error,
  timedOut,
  onConnect,
  onDisconnect,
  onCancel,
  onRetry,
}: Props) {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const view = deriveConnection(command);
  const events = normalizeProgressEvents(command?.progress_events);
  const connected = view.connection === 'connected';
  const busy = view.busy || submitting;

  const failedByStatus = command?.kind === 'connect' && command?.status === 'failed';
  const showFailure = (failedByStatus || timedOut) && !dismissed;

  // A new command (or a fresh timeout) means a fresh failure to show.
  useEffect(() => setDismissed(false), [command?.id]);

  const failureMessage = timedOut
    ? TIMEOUT_MESSAGE
    : (failedByStatus ? friendlyError(command?.detail) : null) ?? 'The robot could not be connected.';

  if (!robotId) return null;

  return (
    <div className="rounded-2xl border border-base-800 bg-base-900/60 p-3">
      <div className="flex flex-wrap items-center gap-3">
        {busy ? (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-2 rounded-xl border border-base-700 px-4 py-2.5 text-[13px] font-medium text-ink-100 transition hover:border-ink-400"
          >
            <Loader2 size={15} className="animate-spin text-amber-300" />
            Cancel
          </button>
        ) : connected ? (
          <button
            type="button"
            onClick={onDisconnect}
            className="inline-flex items-center gap-2 rounded-xl border border-base-700 px-4 py-2.5 text-[13px] font-medium text-ink-100 transition hover:border-ink-400"
          >
            <Power size={15} />
            Disconnect
          </button>
        ) : (
          <button
            type="button"
            onClick={onConnect}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-[13px] font-medium text-base-950 transition hover:bg-amber-400"
          >
            <Zap size={15} />
            Connect robot
          </button>
        )}

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

      {error ? <p className="mt-2 text-[12px] text-red-200">{error}</p> : null}

      {open && events.length > 0 ? (
        <div className="mt-3 rounded-xl border border-base-800 bg-base-950/60 px-3 py-3">
          <ProgressTimeline events={events} />
        </div>
      ) : null}

      <Modal
        open={showFailure}
        onClose={() => setDismissed(true)}
        title="Couldn’t connect the robot"
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                setDismissed(true);
                onCancel();
              }}
              className="inline-flex items-center gap-2 rounded-md border border-base-700 px-3.5 py-1.5 text-[13px] font-medium text-ink-200 transition hover:border-ink-400"
            >
              <X size={14} />
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                setDismissed(true);
                onRetry();
              }}
              className="inline-flex items-center gap-2 rounded-md bg-amber-500 px-3.5 py-1.5 text-[13px] font-semibold text-base-950 transition hover:bg-amber-400"
            >
              <Zap size={14} />
              Try again
            </button>
          </>
        }
      >
        <p className="text-[13px] text-ink-200">{failureMessage}</p>
      </Modal>
    </div>
  );
}
