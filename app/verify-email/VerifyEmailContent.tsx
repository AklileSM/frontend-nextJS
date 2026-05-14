'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { verifyEmail } from '@/services/apiClient';

export function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const { refreshUser } = useAuth();

  const [state, setState] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setErrorMessage('No verification token found. Please use the link from your email.');
      setState('error');
      return;
    }
    verifyEmail(token)
      .then(() => refreshUser())
      .then(() => setState('success'))
      .catch((err) => {
        setErrorMessage(
          err instanceof Error
            ? err.message
            : 'This verification link is invalid or has expired.',
        );
        setState('error');
      });
  }, [token]);

  return (
    <>
      {state === 'verifying' && (
        <div className="flex items-center gap-2 text-[14px] text-ink-400">
          <Loader2 size={14} className="animate-spin" />
          Verifying your email…
        </div>
      )}

      {state === 'success' && (
        <div className="space-y-6">
          <div className="rounded-md border border-base-700 bg-base-900/60 px-5 py-4 text-[14px] leading-relaxed text-ink-200">
            <span className="font-semibold text-white">Email verified. </span>
            Your account is fully set up and password reset is now available.
          </div>
          <Link
            href="/app"
            className="inline-flex w-full items-center justify-center rounded-md bg-amber-500 px-4 py-3 text-[14px] font-semibold text-base-950 transition-colors hover:bg-amber-400"
          >
            Continue to app
          </Link>
        </div>
      )}

      {state === 'error' && (
        <div className="space-y-6">
          <div className="rounded-md border border-red-800/50 bg-red-950/30 px-5 py-4 text-[14px] leading-relaxed text-red-200">
            {errorMessage}
          </div>
          <Link
            href="/app/profile"
            className="inline-flex w-full items-center justify-center rounded-md bg-amber-500 px-4 py-3 text-[14px] font-semibold text-base-950 transition-colors hover:bg-amber-400"
          >
            Go to profile to resend
          </Link>
          <p className="text-center text-[14px] text-ink-300">
            <Link href="/app" className="font-medium text-amber-500 transition-colors hover:text-amber-400 hover:underline">
              Back to app
            </Link>
          </p>
        </div>
      )}
    </>
  );
}
