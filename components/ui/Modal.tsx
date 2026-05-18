'use client';

/**
 * Generic modal shell. Use this for every dialog that has any content
 * beyond a title + one or two buttons. For pure yes/no confirmations,
 * use `ConfirmDialog` instead, it is a thin wrapper around this.
 *
 * The shell handles:
 *   - portal into document.body
 *   - Framer Motion entrance / exit
 *   - backdrop click → onClose (suppressed when `busy`)
 *   - Escape key → onClose (suppressed when `busy`)
 *   - X close button in the top-right
 *   - optional header (title + subtitle)
 *   - optional footer (border-top, right-aligned children)
 *   - optional full-shell "busy" overlay with spinner + message
 *
 * Sizing tokens (caller chooses one of these to match the existing
 * conventions in the app):
 *
 *   sm  — 400px (compact dialogs)
 *   md  — 440px (default; matches ConfirmDialog)
 *   lg  — 560px (the publish-drafts modal)
 *   xl  — 768px (the screenshot side-by-side modal)
 */

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, X } from 'lucide-react';
import { createPortal } from 'react-dom';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

const SIZE_CLASS: Record<ModalSize, string> = {
  sm: 'w-[400px]',
  md: 'w-[440px]',
  lg: 'w-[560px]',
  xl: 'w-[768px]',
};

type Props = {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  size?: ModalSize;
  /** Disables backdrop click, X button, and Escape while truthy.
   *  Shows a full-shell overlay with a spinner. */
  busy?: boolean;
  busyMessage?: string;
  busySubMessage?: string;
  /** Hide the X button entirely. Backdrop + Escape still work unless `busy`. */
  hideCloseButton?: boolean;
  /** Bottom action bar. If omitted, no footer is rendered. */
  footer?: ReactNode;
  /** Disable padding on the body wrapper. Use when the caller renders its
   *  own padded sections (e.g. scrollable list + sticky filter rail). */
  bodyClassName?: string;
  children: ReactNode;
};

const SHELL_VARIANTS = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit:    { opacity: 0 },
};

const PANEL_VARIANTS = {
  initial: { opacity: 0, scale: 0.96, y: 4 },
  animate: { opacity: 1, scale: 1,    y: 0 },
  exit:    { opacity: 0, scale: 0.96, y: 4 },
};

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  size = 'md',
  busy = false,
  busyMessage,
  busySubMessage,
  hideCloseButton = false,
  footer,
  bodyClassName,
  children,
}: Props) {
  // Esc-to-close, suppressed while busy or closed.
  useEffect(() => {
    if (!open || busy) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  // SSR guard, `document` is unavailable on the server.
  if (typeof document === 'undefined') return null;

  // Two header modes:
  //  - With title/subtitle → render a proper header bar with the X inside it.
  //  - Without → render the X as an absolutely positioned button over the
  //    body, so compact dialogs (like ConfirmDialog) can render their own
  //    icon+title inline in the body.
  const hasHeader = !!(title || subtitle);
  const showFloatingClose = !hasHeader && !hideCloseButton;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="modal-shell"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          variants={SHELL_VARIANTS}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.15 }}
        >
          <div
            className="absolute inset-0 bg-base-950/75 backdrop-blur-sm"
            onClick={busy ? undefined : onClose}
          />
          <motion.div
            key="modal-panel"
            variants={PANEL_VARIANTS}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            role="dialog"
            aria-modal="true"
            className={`relative z-10 ${SIZE_CLASS[size]} max-w-[calc(100vw-32px)] max-h-[90vh] overflow-hidden rounded-lg border border-base-700 bg-base-900 shadow-2xl shadow-black/60 flex flex-col`}
          >
            {/* Busy overlay */}
            {busy && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-base-900/95 backdrop-blur-sm">
                <Loader2 size={28} className="animate-spin text-amber-400" />
                {(busyMessage || busySubMessage) && (
                  <div className="text-center">
                    {busyMessage && <p className="font-semibold text-white">{busyMessage}</p>}
                    {busySubMessage && <p className="mt-1 text-[12px] text-ink-400">{busySubMessage}</p>}
                  </div>
                )}
              </div>
            )}

            {/* Header (only when title/subtitle is provided) */}
            {hasHeader && (
              <div className="flex items-start justify-between gap-4 border-b border-base-800 px-6 py-5">
                <div className="min-w-0 flex-1">
                  {title && (
                    <h2 className="font-display text-[18px] font-semibold text-white">{title}</h2>
                  )}
                  {subtitle && (
                    <p className="mt-1 text-[12px] text-ink-400">{subtitle}</p>
                  )}
                </div>
                {!hideCloseButton && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={onClose}
                    aria-label="Close"
                    className="-mt-1 -mr-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-300 transition-colors hover:bg-base-800 hover:text-white disabled:opacity-40"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            )}

            {/* Floating close (when there is no header bar) */}
            {showFloatingClose && (
              <button
                type="button"
                disabled={busy}
                onClick={onClose}
                aria-label="Close"
                className="absolute right-2 top-2 z-10 inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-300 transition-colors hover:bg-base-800 hover:text-white disabled:opacity-50"
              >
                <X size={16} />
              </button>
            )}

            {/* Body */}
            <div className={bodyClassName ?? 'flex-1 overflow-y-auto px-6 py-4'}>
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="flex items-center justify-end gap-2 border-t border-base-800 px-5 py-3">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
