'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
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
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-base-950">
      <Sidebar />
      <div
        className={`min-h-screen transition-[padding] duration-200 ease-out ${
          open ? 'lg:pl-[260px]' : 'lg:pl-[68px]'
        }`}
      >
        <Header />
        <main>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
