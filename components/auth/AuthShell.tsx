import Link from 'next/link';
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
    <div
      className="grid min-h-screen bg-base-950 text-white lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]"
      style={{ backgroundColor: '#020617', color: '#fff' }}
    >
      <aside
        className="relative hidden flex-col justify-between overflow-hidden border-r border-base-800 bg-base-900/30 px-12 py-10 lg:flex"
      >
        <BackgroundGrid />
        <Logo />

        <div className="relative max-w-[42ch]">
          <p className="font-mono text-[12px] uppercase tracking-[0.22em] text-amber-500">
            Site documentation
          </p>
          <h2 className="mt-5 font-display text-[40px] font-semibold leading-[1.08] tracking-[-0.018em] text-white">
            Documentation that doesn&rsquo;t go missing.
          </h2>
          <p className="mt-5 text-[16px] leading-[1.7] text-ink-200">
            Every photo, panorama, video, point cloud, and field report, keyed to the room and
            date it came from, ready for the timeline that already lives in your team.
          </p>
        </div>
      </aside>

      <main className="flex min-h-screen flex-col justify-center px-6 py-10 sm:px-12 lg:px-16 xl:px-24">
        <div className="mb-10 lg:hidden">
          <Logo />
        </div>
        <div className="w-full max-w-[440px]">
          <h1 className="font-display text-[36px] font-semibold leading-[1.1] tracking-[-0.018em] text-white sm:text-[42px]">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-3 text-[16px] leading-[1.65] text-ink-200">{subtitle}</p>
          )}
          <div className="mt-8">{children}</div>
          {altLink && (
            <p className="mt-8 text-[14px] text-ink-300">
              {altLink.prompt}{' '}
              <Link
                href={altLink.href}
                className="font-medium text-amber-500 transition-colors hover:text-amber-400 hover:underline"
              >
                {altLink.cta}
              </Link>
            </p>
          )}
        </div>
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
