'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { Field } from '@/components/auth/Field';
import { requestPasswordReset } from '@/services/apiClient';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await requestPasswordReset(email.trim());
    } catch {
      // Swallow errors — always show the same success message to
      // avoid revealing whether an email address is registered.
    } finally {
      setSubmitting(false);
      setSent(true);
    }
  };

  if (sent) {
    return (
      <div className="space-y-6">
        <div className="rounded-md border border-base-700 bg-base-900/60 px-5 py-4 text-[14px] leading-relaxed text-ink-200">
          If that email address is registered, you'll receive a reset link shortly. Check your inbox — it may take a minute or two.
        </div>
        <Link
          href="/login"
          className="block text-center text-[14px] text-ink-300 transition-colors hover:text-white"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Field
        label="Email address"
        name="email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
      />

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-amber-500 px-4 py-3 text-[14px] font-semibold text-base-950 transition-all duration-200 hover:bg-amber-400 hover:shadow-[0_8px_24px_-12px_rgba(245,158,11,0.7)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:shadow-none"
      >
        {submitting ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            Sending…
          </>
        ) : (
          'Send reset link'
        )}
      </button>

      <p className="text-center text-[14px] text-ink-300">
        Remembered it?{' '}
        <Link href="/login" className="font-medium text-amber-500 transition-colors hover:text-amber-400 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
