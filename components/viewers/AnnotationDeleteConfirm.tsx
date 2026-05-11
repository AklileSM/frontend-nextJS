'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ApiAnnotation } from '@/types/api';

type Props = {
  annotation: ApiAnnotation | null;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
};

export function AnnotationDeleteConfirm({ annotation, onConfirm, onCancel }: Props) {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!annotation) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [annotation, onCancel]);

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  const preview =
    annotation && annotation.text.length > 120 ? `${annotation.text.slice(0, 120)}…` : (annotation?.text ?? '');

  return (
    <AnimatePresence>
      {annotation && (
        <>
          <motion.div
            key="bd"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={busy ? undefined : onCancel}
            className="fixed inset-0 z-50 bg-base-950/75 backdrop-blur-sm"
          />
          <motion.div
            key="md"
            initial={{ opacity: 0, scale: 0.96, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 4 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            role="dialog"
            aria-modal="true"
            className="fixed left-1/2 top-1/2 z-50 w-[440px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-base-700 bg-base-900 shadow-2xl shadow-black/60"
          >
            <div className="flex items-start gap-4 p-6">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-amber-500/15 text-amber-500">
                <AlertTriangle size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-[18px] font-semibold text-white">Delete this annotation?</h3>
                <p className="mt-2 text-[13px] leading-[1.6] text-ink-200">
                  This will remove the marker at{' '}
                  <code className="rounded bg-base-800 px-1.5 py-0.5 font-mono text-[12px] text-ink-100">
                    x={annotation.x.toFixed(3)} · y={annotation.y.toFixed(3)}
                  </code>
                  . The note below will be deleted permanently.
                </p>
                {preview ? (
                  <p className="mt-2 rounded-md border border-base-800 bg-base-950/80 px-2.5 py-2 text-[12px] text-ink-200">
                    {preview}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-base-800 px-5 py-3">
              <button
                type="button"
                disabled={busy}
                onClick={onCancel}
                className="rounded-md border border-base-700 px-3.5 py-1.5 text-[13px] font-medium text-white transition-colors hover:border-ink-300 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={confirm}
                className="inline-flex items-center gap-2 rounded-md bg-amber-500 px-3.5 py-1.5 text-[13px] font-semibold text-base-950 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy && <Loader2 size={13} className="animate-spin" />}
                {busy ? 'Deleting…' : 'Delete annotation'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
