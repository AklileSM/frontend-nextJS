'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Field } from '@/components/auth/Field';
import { validateResetToken, resetPassword } from '@/services/apiClient';

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [validating, setValidating] = useState(true);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setTokenError('No reset token found. Please request a new password reset link.');
      setValidating(false);
      return;
    }
    validateResetToken(token)
      .then(() => setValidating(false))
      .catch(() => {
        setTokenError('This reset link is invalid or has expired. Please request a new one.');
        setValidating(false);
      });
  }, [token]);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    if (password !== confirm) {
      toast.error('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters.');
      return;
    }
    setSubmitting(true);
    try {
      await resetPassword(token, password);
      toast.success('Password updated. You can now sign in.');
      router.replace('/login');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not reset password.');
      setSubmitting(false);
    }
  };

  if (validating) {
    return (
      <div className="flex items-center gap-2 text-[14px] text-ink-400">
        <Loader2 size={14} className="animate-spin" />
        Verifying link…
      </div>
    );
  }

  if (tokenError) {
    return (
      <div className="space-y-6">
        <div className="rounded-md border border-red-800/50 bg-red-950/30 px-5 py-4 text-[14px] leading-relaxed text-red-200">
          {tokenError}
        </div>
        <Link
          href="/forgot-password"
          className="inline-flex w-full items-center justify-center rounded-md bg-amber-500 px-4 py-3 text-[14px] font-semibold text-base-950 transition-colors hover:bg-amber-400"
        >
          Request a new link
        </Link>
        <p className="text-center text-[14px] text-ink-300">
          <Link href="/login" className="font-medium text-amber-500 transition-colors hover:text-amber-400 hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Field
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="••••••••"
        hint="Min. 8 characters"
      />
      <Field
        label="Confirm password"
        name="confirm"
        type="password"
        autoComplete="new-password"
        required
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        placeholder="••••••••"
      />

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-amber-500 px-4 py-3 text-[14px] font-semibold text-base-950 transition-all duration-200 hover:bg-amber-400 hover:shadow-[0_8px_24px_-12px_rgba(245,158,11,0.7)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:shadow-none"
      >
        {submitting ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            Updating…
          </>
        ) : (
          'Set new password'
        )}
      </button>
    </form>
  );
}
