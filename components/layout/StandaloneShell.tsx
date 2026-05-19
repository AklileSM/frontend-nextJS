'use client';

import type { ReactNode } from 'react';
import { Logo } from '@/components/landing/Logo';
import { ProfileMenu } from '@/components/app/ProfileMenu';

type Props = {
  children: ReactNode;
  maxWidth?: string;
};

export function StandaloneShell({ children, maxWidth = '1280px' }: Props) {
  return (
    <div className="relative min-h-screen bg-base-950 text-white">
      <BackgroundGrid />
      <header className="relative z-10 flex h-14 items-center justify-between border-b border-base-800/60 px-6 sm:px-10">
        <Logo />
        <ProfileMenu />
      </header>
      <main
        className="relative z-10 mx-auto px-6 py-14 sm:px-10 lg:py-20"
        style={{ maxWidth }}
      >
        {children}
      </main>
    </div>
  );
}

function BackgroundGrid() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 h-full w-full opacity-[0.32]"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <pattern id="standalone-grid" width="56" height="56" patternUnits="userSpaceOnUse">
          <path d="M 56 0 L 0 0 0 56" fill="none" stroke="rgba(255,255,255,0.035)" strokeWidth="1" />
        </pattern>
        <radialGradient id="standalone-glow-tr" cx="80%" cy="0%" r="55%">
          <stop offset="0%" stopColor="rgba(245,158,11,0.08)" />
          <stop offset="100%" stopColor="rgba(245,158,11,0)" />
        </radialGradient>
        <radialGradient id="standalone-glow-bl" cx="10%" cy="100%" r="45%">
          <stop offset="0%" stopColor="rgba(245,158,11,0.04)" />
          <stop offset="100%" stopColor="rgba(245,158,11,0)" />
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#standalone-grid)" />
      <rect width="100%" height="100%" fill="url(#standalone-glow-tr)" />
      <rect width="100%" height="100%" fill="url(#standalone-glow-bl)" />
    </svg>
  );
}
