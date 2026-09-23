import type { ReactNode } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { AppProviders } from '@/components/providers/RouteProviders';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AppProviders>
      <AppShell>{children}</AppShell>
    </AppProviders>
  );
}
