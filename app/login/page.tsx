'use client';

import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { AuthShell } from '@/components/auth/AuthShell';
import { Field } from '@/components/auth/Field';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginInner />
    </Suspense>
  );
}

function LoginFallback() {
  return (
    <AuthShell title="Sign in">
      <div className="h-[260px]" />
    </AuthShell>
  );
}

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') ?? '/app';
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
    <AuthShell
      title="Sign in"
      subtitle="Welcome back. Use your username and password."
      altLink={{ href: '/register', prompt: "Don't have an account?", cta: 'Create one' }}
    >
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
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
              Signing in…
            </>
          ) : (
            'Sign in'
          )}
        </button>
      </form>
    </AuthShell>
  );
}
