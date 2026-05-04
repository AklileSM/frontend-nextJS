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
    <div role="tablist" className="flex items-stretch overflow-x-auto border-b border-base-800">
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
            className={`relative inline-flex items-center gap-2 px-4 py-3 text-[13px] font-medium transition-colors ${
              isActive ? 'text-white' : 'text-ink-300 hover:text-white'
            }`}
          >
            <span>{t.label}</span>
            <span
              className={`rounded-sm px-1.5 py-0.5 font-mono text-[10px] ${
                isActive ? 'bg-amber-500/15 text-amber-500' : 'bg-base-800 text-ink-300'
              }`}
            >
              {count}
            </span>
            {isActive && (
              <motion.span
                layoutId={railId}
                className="absolute inset-x-3 -bottom-px h-[2px] bg-amber-500"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
