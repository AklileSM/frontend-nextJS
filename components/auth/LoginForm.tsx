'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Field } from '@/components/auth/Field';

export function LoginForm({ next = '/projects' }: { next?: string }) {
  const router = useRouter();
  const { login, isAuthenticated } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated) router.replace(next);
  }, [isAuthenticated, next, router]);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await login({ username: username.trim(), password });
      toast.success(`Welcome back, ${username.trim() || 'admin'}.`);
      router.replace(next);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign in failed.';
      toast.error(msg);
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Field
        label="Username"
        name="username"
        autoComplete="username"
        required
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="your username"
      />
      <div>
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-300">Password</span>
          <Link
            href="/forgot-password"
            className="font-mono text-[11px] text-ink-400 transition-colors hover:text-amber-400"
          >
            Forgot password?
          </Link>
        </div>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="mt-2 block w-full rounded-md border border-base-700 bg-base-950 px-3.5 py-2.5 text-[15px] text-white placeholder:text-ink-400 outline-none transition-colors focus:border-amber-500"
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-amber-500 px-4 py-3 text-[14px] font-semibold text-base-950 transition-all duration-200 hover:bg-amber-400 hover:shadow-[0_8px_24px_-12px_rgba(245,158,11,0.7)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:shadow-none"
      >
        {submitting ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            Signing in…
          </>
        ) : (
          'Sign in'
        )}
      </button>
    </form>
  );
}
