'use client';

import { useState } from 'react';
import { FeedbackModal } from './FeedbackModal';

export function FeedbackFab() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Share feedback"
        title="Share feedback"
        className="fixed bottom-5 right-5 z-40 inline-flex items-center justify-center rounded-full bg-amber-500 px-6 py-3 text-[14px] font-semibold tracking-[0.01em] text-base-950 shadow-[0_8px_24px_-8px_rgba(245,158,11,0.55)] transition-all hover:bg-amber-400 hover:shadow-[0_10px_28px_-6px_rgba(245,158,11,0.7)] active:scale-95 sm:bottom-6 sm:right-6"
      >
        Feedback
      </button>
      <FeedbackModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
