'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getViewerContext, backHrefFor, type ViewerContext } from './viewerContext';

// Shared shell for the not-yet-built viewer routes. Reads the file context the
// explorer stashed in sessionStorage and shows a tight summary so navigation
// can be reviewed end-to-end without the real viewer code.

type Props = {
  kind: string;
  phase: string;
  description: string;
};

export function ViewerStub({ kind, phase, description }: Props) {
  const [ctx, setCtx] = useState<ViewerContext | null>(null);

  useEffect(() => {
    setCtx(getViewerContext());
  }, []);

  return (
    <div className="px-6 py-10 sm:px-8 lg:px-12 xl:px-16">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <p className="font-mono text-[12px] uppercase tracking-[0.22em] text-amber-500">
          Viewer · {kind}
        </p>
        <h1 className="mt-3 font-display text-[36px] font-semibold leading-[1.08] tracking-[-0.018em] text-white sm:text-[44px]">
          {ctx?.file.file_name ?? 'No file selected'}
        </h1>
        <p className="mt-2 font-mono text-[12px] text-ink-300">
          {ctx
            ? `room ${ctx.roomSlug} · captured ${ctx.date} · type ${ctx.file.type}`
            : 'Open a file from the explorer to load it here.'}
        </p>

        <div className="mt-8 max-w-[68ch] rounded-md border border-base-800 bg-base-900/30 p-6 text-[14px] leading-[1.7] text-ink-200">
          {description}{' '}
          The full {kind.toLowerCase()} viewer ships in <span className="text-white">{phase}</span>.
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          {ctx && (
            <Link
              href={backHrefFor(ctx)}
              className="inline-flex items-center gap-1.5 rounded-md border border-base-700 bg-base-900/40 px-3 py-1.5 text-[13px] font-medium text-white transition-colors hover:border-ink-300"
            >
              <ArrowLeft size={14} />
              Back to {ctx.origin === 'project' ? 'file explorer' : 'room explorer'}
            </Link>
          )}
          <Link
            href="/app"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] text-ink-300 transition-colors hover:text-white"
          >
            Home
          </Link>
        </div>
      </motion.section>
    </div>
  );
}
