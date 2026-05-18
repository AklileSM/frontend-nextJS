'use client';

/**
 * Yes/no confirmation dialog with an alert icon and a single confirm button.
 * Dismissal is via the X, Escape, or a backdrop click — there is no Cancel
 * button. For anything more complex, use `<Modal>` directly.
 */

import type { ReactNode } from 'react';
import { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Modal } from './Modal';

type Props = {
  open: boolean;
  title: string;
  /** Plain text (rendered in the standard paragraph styling) or a ReactNode
   *  if the caller wants inline code spans, a preview block, etc. */
  body: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Confirm',
  danger = false,
  onConfirm,
  onCancel,
}: Props) {
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onCancel}
      busy={busy}
      footer={
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleConfirm()}
          className={`inline-flex items-center gap-2 rounded-md px-3.5 py-1.5 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
            danger
              ? 'border border-red-700/60 text-red-200 hover:border-red-600/60 hover:bg-red-950/50'
              : 'bg-amber-500 text-base-950 hover:bg-amber-400'
          }`}
        >
          {busy && <Loader2 size={13} className="animate-spin" />}
          {confirmLabel}
        </button>
      }
    >
      <div className="flex items-start gap-4">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-amber-500/15 text-amber-500">
          <AlertTriangle size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-[18px] font-semibold text-white">{title}</h3>
          <div className="mt-2 text-[13px] leading-[1.6] text-ink-200">
            {typeof body === 'string' ? <p>{body}</p> : body}
          </div>
        </div>
      </div>
    </Modal>
  );
}
