'use client';

import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';

export const dynamic = 'force-dynamic';

export default function ProfilePage() {
  const { user } = useAuth();

  return (
    <div className="px-6 py-10 sm:px-10 lg:px-12 xl:px-16">
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="inline-flex items-center gap-3 font-mono text-[12px] uppercase tracking-[0.22em] text-amber-500">
          <span className="h-px w-8 bg-amber-500/60" />
          Profile
        </p>
        <h1 className="mt-4 font-display text-[40px] font-semibold leading-[1.08] tracking-[-0.018em] text-white sm:text-[48px]">
          {user?.username}
        </h1>
        <p className="mt-3 text-[16px] text-ink-300">
          {user?.email ?? 'no email on file'} · role <span className="text-white">{user?.role}</span>
        </p>

        <div className="mt-10 max-w-[68ch] rounded-md border border-base-800 bg-base-900/30 p-6 text-[14.5px] leading-[1.7] text-ink-200">
          The full profile page — published reports, draft list, continue-editing, download, delete —
          ships in <span className="text-white">Phase 9</span>.
        </div>
      </motion.section>
    </div>
  );
}
