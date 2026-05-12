'use client';

import dynamic from 'next/dynamic';

const RegisterForm = dynamic(
  () => import('@/components/auth/RegisterForm').then((mod) => mod.RegisterForm),
  { ssr: false },
);

export function RegisterClientIsland() {
  return <RegisterForm />;
}
