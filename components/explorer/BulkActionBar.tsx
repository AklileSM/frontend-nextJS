'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Download, Loader2, Trash2, X } from 'lucide-react';

type Props = {
  count: number;
  // Set to true when an action is in flight so the bar disables itself
  // and shows a spinner.
  busy: boolean;
  onDelete: () => void;
  onDownload: () => void;
  onClear: () => void;
};

export function BulkActionBar({ count, busy, onDelete, onDownload, onClear }: Props) {
  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          key="bulk-bar"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 30 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          // Pinned to the bottom centre, above any other floating UI. Sits
          // outside the page flow so it doesn't push the file grid around.
          className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2"
          role="toolbar"
          aria-label="Bulk actions"
        >
          <div className="flex items-center gap-2 rounded-full border border-base-700 bg-base-900/95 px-3 py-2 shadow-2xl shadow-black/60 backdrop-blur">
            <button
              type="button"
              onClick={onClear}
              aria-label="Clear selection"
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-ink-300 transition-colors hover:bg-base-800 hover:text-white"
            >
              <X size={14} />
            </button>
            <span className="font-mono text-[11.5px] uppercase tracking-[0.16em] text-ink-300">
              <span className="text-white">{count}</span> selected
            </span>

            <span className="mx-1 h-5 w-px bg-base-700" aria-hidden />

            <button
              type="button"
              disabled={busy}
              onClick={onDownload}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium text-white transition-colors hover:bg-base-800 disabled:opacity-50"
            >
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              Download
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={onDelete}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium text-red-300 transition-colors hover:bg-red-600/15 hover:text-red-200 disabled:opacity-50"
            >
              <Trash2 size={13} />
              Delete
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
