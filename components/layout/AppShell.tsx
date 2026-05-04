'use client';

import type { ReactNode } from 'react';
import { ProtectedRoute } from './ProtectedRoute';
import { SidebarProvider, useSidebar } from './SidebarContext';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <SidebarProvider>
        <Layout>{children}</Layout>
      </SidebarProvider>
    </ProtectedRoute>
  );
}

function Layout({ children }: { children: ReactNode }) {
  const { open } = useSidebar();
  return (
    <div className="min-h-screen bg-base-950">
      <Sidebar />
      <div
        className={`min-h-screen transition-[padding] duration-200 ease-out ${
          open ? 'lg:pl-[260px]' : 'lg:pl-[68px]'
        }`}
      >
        <Header />
        <main>{children}</main>
      </div>
    </div>
  );
}
