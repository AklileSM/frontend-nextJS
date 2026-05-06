'use client';

import dynamic from 'next/dynamic';

const AuthPageProviders = dynamic(
  () => import('@/components/providers/RouteProviders').then((mod) => mod.AuthPageProviders),
  { ssr: false },
);

const LoginForm = dynamic(
  () => import('@/components/auth/LoginForm').then((mod) => mod.LoginForm),
  { ssr: false },
);

export function LoginClientIsland({ next }: { next?: string }) {
  return (
    <AuthPageProviders>
      <LoginForm next={next} />
    </AuthPageProviders>
  );
}
