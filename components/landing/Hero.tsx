'use client';

import Link from 'next/link';
import { ArrowRight, ArrowDown } from 'lucide-react';
import { motion } from 'framer-motion';
import { PlatformDiagram } from './PlatformDiagram';

export function Hero() {
  return (
    <section className="px-8 pb-20 pt-36 sm:px-12 lg:px-24 lg:pb-28 lg:pt-44 xl:px-32">
      <div className="mx-auto grid max-w-[1480px] grid-cols-1 gap-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start lg:gap-20">
        <div className="max-w-[68ch]">
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="mt-28 inline-flex items-center gap-3 font-mono text-[12px] uppercase tracking-[0.22em] text-ink-300"
          >
            <span className="h-px w-8 bg-amber-500/70" />
            Construction · documentation
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="mt-6 font-display text-[48px] font-semibold leading-[1.04] tracking-[-0.02em] text-white sm:text-[60px] lg:text-[68px] xl:text-[76px]"
          >
            One timeline for every capture taken on your site.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.18 }}
            className="mt-7 text-[18px] leading-[1.7] text-ink-200"
          >
            SiteScope is the documentation layer for indoor construction projects. Photos, 360°
            panoramas, video walkthroughs, pcd renders, and field-report PDFs flow into one
            date-indexed archive keyed to the room they came from, opened in a viewer that
            understands the format, and turned into a defensible PDF whenever someone asks{' '}
            <em className="not-italic text-white">when</em> something happened on site.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.28 }}
            className="mt-10 flex flex-wrap items-center gap-3"
          >
            <Link
              href="/register"
              className="group inline-flex items-center gap-2 rounded-md bg-amber-500 px-5 py-3 text-[14px] font-semibold text-base-950 transition-colors hover:bg-amber-400"
            >
              Get started
              <ArrowRight
                size={15}
                strokeWidth={2.2}
                className="transition-transform duration-200 group-hover:translate-x-0.5"
              />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-md border border-base-700 px-5 py-3 text-[14px] font-medium text-white transition-colors hover:border-ink-300"
            >
              Sign in
            </Link>
            <a
              href="#model"
              className="group inline-flex items-center gap-2 px-1 py-3 text-[14px] text-ink-300 transition-colors hover:text-white"
            >
              How it works
              <motion.span
                animate={{ y: [0, 3, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                className="inline-flex"
              >
                <ArrowDown size={14} strokeWidth={2.2} />
              </motion.span>
            </a>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="w-full"
        >
          
          <div className="rounded-lg border border-base-800 bg-base-900/40 p-6 sm:p-8">
            <PlatformDiagram className="h-auto w-full" />
          </div>
          <p className="mt-5 max-w-[64ch] font-mono text-[12px] leading-[1.7] text-ink-300">
            A capture becomes a file asset keyed by{' '}
            <code className="rounded bg-base-800 px-1.5 py-0.5 text-ink-100">room_slug</code> and{' '}
            <code className="rounded bg-base-800 px-1.5 py-0.5 text-ink-100">capture_date</code>;
            opens in the viewer for its format; produces a draft or a published PDF report.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
