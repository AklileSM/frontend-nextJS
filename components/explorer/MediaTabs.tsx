'use client';

import { motion } from 'framer-motion';

export type MediaTab = 'images' | 'videos' | 'pointclouds' | 'pdfs';

const TABS: Array<{ id: MediaTab; label: string }> = [
  { id: 'images', label: 'Images' },
  { id: 'videos', label: 'Videos' },
  { id: 'pointclouds', label: 'Point clouds' },
  { id: 'pdfs', label: 'PDFs' },
];

type Props = {
  active: MediaTab;
  counts: Record<MediaTab, number>;
  onChange: (tab: MediaTab) => void;
  railId?: string;
};

export function MediaTabs({ active, counts, onChange, railId = 'media-tab-rail' }: Props) {
  return (
    <div
      role="tablist"
      className="inline-flex items-center gap-0.5 rounded-xl border border-base-800 bg-base-800/50 p-1"
    >
      {TABS.map((t) => {
        const isActive = active === t.id;
        const count = counts[t.id];
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={isActive}
            type="button"
            onClick={() => onChange(t.id)}
            className={`relative flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
              isActive ? 'text-white' : 'text-ink-400 hover:text-white'
            }`}
          >
            {isActive && (
              <motion.span
                layoutId={railId}
                className="absolute inset-0 rounded-lg bg-base-950 shadow-sm shadow-black/40"
              />
            )}
            <span className="relative">{t.label}</span>
            <span
              className={`relative rounded px-1.5 py-0.5 font-mono text-[10px] ${
                isActive ? 'bg-amber-500/15 text-amber-500' : 'bg-base-700/50 text-ink-500'
              }`}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
