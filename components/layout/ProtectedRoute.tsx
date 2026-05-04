'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import type { Role } from '@/types/api';

type Props = {
  children: ReactNode;
  roles?: Role[];
};

export function ProtectedRoute({ children, roles }: Props) {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    if (roles && user && !roles.includes(user.role)) {
      router.replace('/unauthorized');
    }
  }, [isAuthenticated, roles, router, user]);

  if (!isAuthenticated) return null;
  if (roles && user && !roles.includes(user.role)) return null;
  return <>{children}</>;
}
