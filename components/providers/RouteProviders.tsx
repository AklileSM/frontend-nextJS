'use client';

import type { ReactNode } from 'react';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/context/AuthContext';
import { SelectedDateProvider } from '@/context/SelectedDateContext';
import { ClientLogger } from '@/components/diagnostics/ClientLogger';

function AppToaster() {
  return (
    <Toaster
      theme="dark"
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            '!bg-base-900 !border !border-base-700 !text-white !font-body !text-[14px]',
          error: '!bg-base-900 !border-amber-500/40',
          description: '!text-ink-300',
        },
      }}
    />
  );
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <SelectedDateProvider>
        <ClientLogger />
        {children}
        <AppToaster />
      </SelectedDateProvider>
    </AuthProvider>
  );
}

export function AuthPageProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ClientLogger />
      {children}
      <AppToaster />
    </AuthProvider>
  );
}
