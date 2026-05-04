'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { Floorplan } from '@/components/home/Floorplan';
import { ChartAll } from '@/components/home/ChartAll';
import { ChartLocation } from '@/components/home/ChartLocation';
import { MiniCalendar } from '@/components/layout/MiniCalendar';
import { useAuth } from '@/context/AuthContext';

type Tab = 'rooms' | 'calendar';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'rooms', label: 'Data overview' },
  { id: 'calendar', label: 'Calendar' },
];

export default function AppHome() {
  const { user } = useAuth();
  const [hoveredRoom, setHoveredRoom] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('rooms');

  return (
    <div className="px-6 py-10 sm:px-8 lg:px-12 xl:px-16">
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-[68ch]"
      >
        <p className="inline-flex items-center gap-3 font-mono text-[12px] uppercase tracking-[0.22em] text-amber-500">
          <span className="h-px w-8 bg-amber-500/60" />
          Home · A6-Stern
        </p>
        <h1 className="mt-4 font-display text-[40px] font-semibold leading-[1.08] tracking-[-0.018em] text-white sm:text-[48px]">
          Welcome, {user?.username ?? 'guest'}.
        </h1>
        <p className="mt-3 text-[16px] leading-[1.7] text-ink-200">
          Hover any room on the floorplan to highlight its capture totals on the right. Click a
          room to open its full timeline. Switch the right-panel tab to scrub through capture
          dates on a calendar.
        </p>
      </motion.section>

      <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr] lg:gap-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
        >
          <Floorplan hoveredRoom={hoveredRoom} onHoverChange={setHoveredRoom} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-5"
        >
          <ChartAll />

          <div className="rounded-lg border border-base-800 bg-base-900/30">
            <div role="tablist" className="flex items-stretch border-b border-base-800 px-2">
              {TABS.map((t) => {
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    role="tab"
                    aria-selected={active}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={`relative flex-1 px-3 py-3 text-[13px] font-medium transition-colors ${
                      active ? 'text-white' : 'text-ink-300 hover:text-white'
                    }`}
                  >
                    {t.label}
                    {active && (
                      <motion.span
                        layoutId="home-tab-rail"
                        className="absolute inset-x-3 -bottom-px h-[2px] bg-amber-500"
                      />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="min-h-[320px] p-5">
              <AnimatePresence mode="wait">
                <motion.div
                  key={tab}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                >
                  {tab === 'rooms' ? (
                    <ChartLocation hoveredRoom={hoveredRoom} />
                  ) : (
                    <div className="-mx-2">
                      <MiniCalendar />
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
