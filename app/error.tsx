'use client';

import { useEffect } from 'react';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[SiteScope] app error boundary', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center bg-base-950 px-6 text-white">
      <section className="w-full max-w-[520px] rounded-lg border border-base-800 bg-base-900/60 p-8 shadow-2xl">
        <p className="font-mono text-[12px] uppercase tracking-[0.22em] text-amber-500">
          Runtime error
        </p>
        <h1 className="mt-4 font-display text-[36px] font-semibold tracking-[-0.018em]">
          Something failed while rendering this page.
        </h1>
        <p className="mt-4 text-[14px] leading-6 text-ink-200">
          Open DevTools Console and look for the latest <code>[SiteScope]</code> log entry.
        </p>
        <pre className="mt-5 max-h-40 overflow-auto rounded-md border border-base-800 bg-base-950 p-4 text-[12px] text-ink-200">
          {error.message}
          {error.digest ? `\nDigest: ${error.digest}` : ''}
        </pre>
        <button
          type="button"
          onClick={reset}
          className="mt-6 rounded-md bg-amber-500 px-4 py-2.5 text-[14px] font-semibold text-base-950 transition-colors hover:bg-amber-400"
        >
          Try again
        </button>
      </section>
    </main>
  );
}
