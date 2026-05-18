'use client';

/** Small reusable atoms for the sidebar: a top-level NavLink (with the
 *  animated active-state amber rail) and a section header label. */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';

export function SectionLabel({
  children,
  expanded,
  className = '',
}: {
  children: React.ReactNode;
  expanded: boolean;
  className?: string;
}) {
  if (!expanded) return null;
  return (
    <p className={`mb-2 mt-5 px-3 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-400 ${className}`}>
      {children}
    </p>
  );
}

export function NavLink({
  href,
  icon,
  label,
  expanded,
  isActive,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  expanded: boolean;
  isActive?: boolean;
}) {
  const pathname = usePathname();
  const active = isActive ?? pathname === href;
  return (
    <Link
      href={href}
      className={`group relative flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] transition-colors ${
        active ? 'bg-base-800/70 text-white' : 'text-ink-200 hover:bg-base-800/50 hover:text-white'
      } ${expanded ? '' : 'lg:justify-center'}`}
    >
      {active && (
        <motion.span
          layoutId="active-rail"
          className="absolute inset-y-1 left-0 w-[2px] rounded-r-sm bg-amber-500"
        />
      )}
      <span className="shrink-0 text-ink-300 group-hover:text-white">{icon}</span>
      <span className={expanded ? 'inline' : 'lg:hidden'}>{label}</span>
    </Link>
  );
}
