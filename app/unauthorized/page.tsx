'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { AuthPageProviders } from '@/components/providers/RouteProviders';

export const dynamic = 'force-dynamic';

export default function UnauthorizedPage() {
  return (
    <AuthPageProviders>
      <UnauthorizedContent />
    </AuthPageProviders>
  );
}

function UnauthorizedContent() {
  const { user, logout } = useAuth();

  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="w-full max-w-[480px] text-center">
        <p className="inline-flex items-center gap-3 font-mono text-[12px] uppercase tracking-[0.22em] text-amber-500">
          <span className="h-px w-8 bg-amber-500/60" />
          403
          <span className="h-px w-8 bg-amber-500/60" />
        </p>
        <h1 className="mt-5 font-display text-[44px] font-semibold leading-[1.05] tracking-[-0.02em] text-white sm:text-[52px]">
          Access denied
        </h1>
        <p className="mt-4 text-[16px] leading-[1.65] text-ink-200">
          {user
            ? `Your account (${user.username}, role ${user.role}) doesn't have permission for that page.`
            : "You're not signed in. Sign in to continue."}
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/app"
            className="rounded-md bg-amber-500 px-4 py-2.5 text-[14px] font-semibold text-base-950 transition-colors hover:bg-amber-400"
          >
            Back to app
          </Link>
          <button
            type="button"
            onClick={logout}
            className="rounded-md border border-base-700 px-4 py-2.5 text-[14px] font-medium text-white transition-colors hover:border-ink-300"
          >
            Sign out
          </button>
        </div>
      </div>
    </main>
  );
}
