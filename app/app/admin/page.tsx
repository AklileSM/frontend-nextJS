'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Users, Folder, KeyRound, ShieldCheck } from 'lucide-react';

export const dynamic = 'force-dynamic';

const CARDS = [
  {
    href: '/app/admin/users',
    icon: Users,
    title: 'Users',
    description: 'Grant or revoke admin, deactivate accounts',
  },
  {
    href: '/app/admin/projects',
    icon: Folder,
    title: 'Projects',
    description: 'View and delete all projects across the platform',
  },
  {
    href: '/app/admin/robots',
    icon: KeyRound,
    title: 'Robot pairing',
    description: 'Create and revoke bootstrap pairing tokens for robot agents',
  },
];

export default function AdminHomePage() {
  return (
    <div className="px-6 py-10 sm:px-10 lg:px-12 xl:px-16">
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="inline-flex items-center gap-3 font-mono text-[12px] uppercase tracking-[0.22em] text-amber-500">
          <ShieldCheck size={14} />
          Administration
        </p>
        <h1 className="mt-4 font-display text-[40px] font-semibold leading-[1.08] tracking-[-0.018em] text-white sm:text-[48px]">
          Admin panel
        </h1>
        <p className="mt-3 text-[15px] text-ink-300">
          Manage users, projects, and platform settings.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CARDS.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="group flex flex-col gap-3 rounded-lg border border-base-800 bg-base-900/40 p-6 transition-colors hover:border-base-700 hover:bg-base-900/70"
            >
              <card.icon size={22} className="text-amber-500" />
              <div>
                <p className="text-[15px] font-semibold text-white group-hover:text-amber-400 transition-colors">
                  {card.title}
                </p>
                <p className="mt-1 text-[13px] text-ink-300">{card.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </motion.section>
    </div>
  );
}
