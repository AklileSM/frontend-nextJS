'use client';

import { motion } from 'framer-motion';

export const dynamic = 'force-dynamic';

export default function ComparePlaceholder() {
  return (
    <div className="px-6 py-10 sm:px-10 lg:px-12 xl:px-16">
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="inline-flex items-center gap-3 font-mono text-[12px] uppercase tracking-[0.22em] text-amber-500">
          <span className="h-px w-8 bg-amber-500/60" />
          Compare
        </p>
        <h1 className="mt-4 font-display text-[40px] font-semibold leading-[1.08] tracking-[-0.018em] text-white sm:text-[48px]">
          Side-by-side viewer
        </h1>
        <p className="mt-3 max-w-[68ch] text-[16px] leading-[1.7] text-ink-200">
          The dual viewer with independent left/right room+date selectors, autosaved comparison
          drafts, and PDF publish ships in <span className="text-white">Phase 8</span>. The header
          chrome already swaps the Compare button for Back-to-app while you&rsquo;re here.
        </p>
      </motion.section>
    </div>
  );
}
