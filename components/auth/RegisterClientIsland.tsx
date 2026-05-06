'use client';

import dynamic from 'next/dynamic';

const AuthPageProviders = dynamic(
  () => import('@/components/providers/RouteProviders').then((mod) => mod.AuthPageProviders),
  { ssr: false },
);

const RegisterForm = dynamic(
  () => import('@/components/auth/RegisterForm').then((mod) => mod.RegisterForm),
  { ssr: false },
);

export function RegisterClientIsland() {
  return (
    <AuthPageProviders>
      <RegisterForm />
    </AuthPageProviders>
  );
}
