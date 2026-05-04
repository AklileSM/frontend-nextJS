'use client';

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

// Section wrapper. Bigger gutters than before, plus a soft 1480px content cap so
// ultra-wide displays don't span edge-to-edge. Per-element max-w-[70ch] continues
// to govern reading length on prose blocks inside.

type Props = {
  id?: string;
  children: ReactNode;
  bordered?: boolean;
  className?: string;
};

export function Section({ id, children, bordered = true, className = '' }: Props) {
  return (
    <section
      id={id}
      className={`px-8 py-28 sm:px-12 lg:px-24 xl:px-32 ${
        bordered ? 'border-t border-base-800' : ''
      } ${className}`}
    >
      <div className="mx-auto max-w-[1480px]">{children}</div>
    </section>
  );
}

export function SectionEyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 font-mono text-[12px] uppercase tracking-[0.22em] text-amber-500">
      <span className="h-px w-6 bg-amber-500/60" />
      {children}
    </span>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  sub,
}: {
  eyebrow: string;
  title: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <motion.header
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-15% 0px' }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className="max-w-[68ch]"
    >
      <SectionEyebrow>{eyebrow}</SectionEyebrow>
      <h2 className="mt-4 font-display text-[40px] font-semibold leading-[1.05] tracking-[-0.018em] text-white sm:text-[48px] lg:text-[54px]">
        {title}
      </h2>
      {sub && (
        <p className="mt-5 text-[17px] leading-[1.7] text-ink-200">{sub}</p>
      )}
    </motion.header>
  );
}

// Lightweight reveal wrapper for child blocks. Used for diagram panels, grids,
// tables — anything that should drift up gently into view as the user scrolls.
export function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-10% 0px' }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
