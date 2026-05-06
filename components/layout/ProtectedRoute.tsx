'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';

type Props = {
  children: ReactNode;
  requireAdmin?: boolean;
};

export function ProtectedRoute({ children, requireAdmin }: Props) {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    if (requireAdmin && user && !user.is_admin) {
      router.replace('/unauthorized');
    }
  }, [isAuthenticated, requireAdmin, router, user]);

  if (!isAuthenticated) return null;
  if (requireAdmin && user && !user.is_admin) return null;
  return <>{children}</>;
}
