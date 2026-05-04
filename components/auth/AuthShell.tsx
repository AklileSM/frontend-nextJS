'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { Logo } from '@/components/landing/Logo';

// Two-column auth shell. Left column carries the brand + a short pitch + a
// mock-mode hint. Right column hosts the form. On mobile the left column
// collapses and the form takes the viewport.

type Props = {
  title: string;
  subtitle?: string;
  altLink?: { href: string; prompt: string; cta: string };
  children: ReactNode;
};

export function AuthShell({ title, subtitle, altLink, children }: Props) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <motion.aside
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.45 }}
        className="relative hidden flex-col justify-between overflow-hidden border-r border-base-800 bg-base-900/30 px-12 py-10 lg:flex"
      >
        <BackgroundGrid />
        <Logo />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="relative max-w-[42ch]"
        >
          <p className="inline-flex items-center gap-3 font-mono text-[12px] uppercase tracking-[0.22em] text-amber-500">
            <span className="h-px w-8 bg-amber-500/60" />
            Site documentation
          </p>
          <h2 className="mt-5 font-display text-[40px] font-semibold leading-[1.08] tracking-[-0.018em] text-white">
            Documentation that doesn&rsquo;t go missing.
          </h2>
          <p className="mt-5 text-[16px] leading-[1.7] text-ink-200">
            Every photo, panorama, video, point cloud, and field report — keyed to the room and
            date it came from, ready for the timeline that already lives in your team.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="relative rounded-md border border-base-800 bg-base-900/50 px-5 py-4"
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-amber-500">
            Mock mode
          </p>
          <p className="mt-2 text-[13px] leading-[1.65] text-ink-200">
            Any username works. Use{' '}
            <code className="rounded bg-base-800 px-1.5 py-0.5 font-mono text-[12px] text-ink-100">
              admin
            </code>
            {', '}
            <code className="rounded bg-base-800 px-1.5 py-0.5 font-mono text-[12px] text-ink-100">
              manager
            </code>
            {', or '}
            <code className="rounded bg-base-800 px-1.5 py-0.5 font-mono text-[12px] text-ink-100">
              viewer
            </code>{' '}
            as the username to demo a specific role. Sign in as{' '}
            <code className="rounded bg-base-800 px-1.5 py-0.5 font-mono text-[12px] text-ink-100">
              fail
            </code>{' '}
            to see the error path.
          </p>
        </motion.div>
      </motion.aside>

      <main className="flex flex-col px-6 py-10 sm:px-12 lg:px-16 xl:px-24">
        <div className="mb-10 lg:hidden">
          <Logo />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="my-auto w-full max-w-[440px]"
        >
          <h1 className="font-display text-[36px] font-semibold leading-[1.1] tracking-[-0.018em] text-white sm:text-[42px]">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-3 text-[16px] leading-[1.65] text-ink-200">{subtitle}</p>
          )}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            className="mt-8"
          >
            {children}
          </motion.div>
          {altLink && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="mt-8 text-[14px] text-ink-300"
            >
              {altLink.prompt}{' '}
              <Link
                href={altLink.href}
                className="font-medium text-amber-500 transition-colors hover:text-amber-400 hover:underline"
              >
                {altLink.cta}
              </Link>
            </motion.p>
          )}
        </motion.div>
      </main>
    </div>
  );
}

function BackgroundGrid() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 h-full w-full opacity-50"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <pattern id="auth-grid" width="48" height="48" patternUnits="userSpaceOnUse">
          <path d="M 48 0 L 0 0 0 48" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
        </pattern>
        <radialGradient id="auth-glow" cx="20%" cy="0%" r="60%">
          <stop offset="0%" stopColor="rgba(245,158,11,0.10)" />
          <stop offset="100%" stopColor="rgba(245,158,11,0)" />
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#auth-grid)" />
      <rect width="100%" height="100%" fill="url(#auth-glow)" />
    </svg>
  );
}
