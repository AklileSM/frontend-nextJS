'use client';

import { motion } from 'framer-motion';

type Tab<T extends string> = {
  id: T;
  label: string;
};

type Props<T extends string> = {
  tabs: readonly Tab<T>[];
  active: T;
  onChange: (id: T) => void;
  railId: string;
  size?: 'sm' | 'md';
};

export function Tabs<T extends string>({ tabs, active, onChange, railId, size = 'md' }: Props<T>) {
  const textSize = size === 'sm' ? 'text-[12px]' : 'text-[13px]';
  const padding = size === 'sm' ? 'px-3 py-2' : 'px-4 py-2.5';

  return (
    <div className="flex gap-0 border-b border-base-800">
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`relative ${padding} ${textSize} font-medium transition-colors ${
              isActive ? 'text-white' : 'text-ink-400 hover:text-white'
            }`}
          >
            {tab.label}
            {isActive && (
              <motion.span
                layoutId={railId}
                className="absolute inset-x-0 -bottom-px h-[2px] bg-amber-500"
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
