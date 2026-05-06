'use client';

import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { LogOut, User as UserIcon, ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';

// Avatar button + dropdown menu. Click outside or ESC closes.

function getInitials(name: string): string {
  const parts = name.split(/[\s._-]/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

const roleStyle: Record<string, string> = {
  admin: 'bg-amber-500/15 text-amber-500',
  viewer: 'bg-base-800 text-ink-200',
};

export function ProfileMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!user) return null;
  const initials = getInitials(user.username);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="group inline-flex items-center gap-2 rounded-md border border-base-700 bg-base-900/40 py-1 pl-1 pr-2.5 transition-colors hover:border-ink-300"
      >
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-[5px] bg-amber-500 font-display text-[12px] font-bold text-base-950">
          {initials}
        </span>
        <span className="hidden text-[13px] font-medium text-white sm:block">
          {user.username}
        </span>
        <ChevronDown
          size={14}
          className={`text-ink-300 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformOrigin: 'top right' }}
            className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-md border border-base-700 bg-base-900 shadow-2xl shadow-black/50"
          >
            <div className="flex items-start gap-3 border-b border-base-800 px-4 py-4">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-amber-500 font-display text-[14px] font-bold text-base-950">
                {initials}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-semibold text-white">
                  {user.username}
                </div>
                <div className="truncate text-[12px] text-ink-300">
                  {user.email ?? '—'}
                </div>
                <div
                  className={`mt-1.5 inline-flex items-center rounded-sm px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] ${
                    user.is_admin ? roleStyle.admin : roleStyle.viewer
                  }`}
                >
                  {user.is_admin ? 'admin' : 'member'}
                </div>
              </div>
            </div>

            <ul className="p-1">
              <li>
                <Link
                  href="/app/profile"
                  onClick={() => setOpen(false)}
                  role="menuitem"
                  className="flex items-center gap-3 rounded-sm px-3 py-2.5 text-[13px] text-ink-200 transition-colors hover:bg-base-800 hover:text-white"
                >
                  <UserIcon size={14} />
                  Profile
                  <span className="ml-auto font-mono text-[10px] text-ink-400">reports · drafts</span>
                </Link>
              </li>
            </ul>

            <div className="border-t border-base-800 p-1">
              <button
                type="button"
                onClick={() => {
                  logout();
                  setOpen(false);
                }}
                role="menuitem"
                className="flex w-full items-center gap-3 rounded-sm px-3 py-2.5 text-[13px] text-ink-200 transition-colors hover:bg-base-800 hover:text-white"
              >
                <LogOut size={14} />
                Sign out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
