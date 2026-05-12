'use client';

import dynamic from 'next/dynamic';

const LoginForm = dynamic(
  () => import('@/components/auth/LoginForm').then((mod) => mod.LoginForm),
  { ssr: false },
);

export function LoginClientIsland({ next }: { next?: string }) {
  return <LoginForm next={next} />;
}
