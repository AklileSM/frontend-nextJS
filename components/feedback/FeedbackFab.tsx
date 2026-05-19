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
        className="fixed bottom-5 right-5 z-40 inline-flex items-center justify-center rounded-full bg-amber-500 px-5 py-2.5 text-[13px] font-semibold text-base-950 shadow-lg shadow-black/40 transition-all hover:bg-amber-400 hover:shadow-xl active:scale-95 sm:bottom-6 sm:right-6"
      >
        Feedback
      </button>
      <FeedbackModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
