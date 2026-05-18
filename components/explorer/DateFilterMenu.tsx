'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, Filter } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useEffect, useRef, useState } from 'react';

type Props = {
  dates: string[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
};

// Multi-select dropdown that filters which capture dates are visible on the room
// explorer. `dates` should already be limited to dates the active room has files
// for, selecting/deselecting only affects which sections render below.
export function DateFilterMenu({ dates, selected, onChange }: Props) {
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

  const total = dates.length;
  const checked = dates.filter((d) => selected.has(d)).length;
  const allOn = total > 0 && checked === total;
  const noneOn = checked === 0;

  const label =
    total === 0
      ? 'No dates'
      : allOn
      ? `All dates · ${total}`
      : noneOn
      ? `No dates shown`
      : `${checked} of ${total} dates`;

  const toggle = (iso: string) => {
    const next = new Set(selected);
    if (next.has(iso)) next.delete(iso);
    else next.add(iso);
    onChange(next);
  };

  const selectAll = () => onChange(new Set(dates));
  const selectNone = () => onChange(new Set());

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-md border border-base-700 bg-base-900/40 px-3 py-1.5 text-[13px] font-medium text-white transition-colors hover:border-ink-300"
      >
        <Filter size={14} className="text-amber-500" />
        <span>{label}</span>
        <ChevronDown
          size={14}
          className={`text-ink-300 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformOrigin: 'top right' }}
            className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-md border border-base-700 bg-base-900 shadow-2xl shadow-black/50"
          >
            <div className="flex items-center justify-between border-b border-base-800 px-3 py-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-300">
                Filter dates
              </span>
              <div className="flex items-center gap-1 text-[11px]">
                <button
                  type="button"
                  onClick={selectAll}
                  disabled={allOn || total === 0}
                  className="rounded-sm px-1.5 py-0.5 text-ink-200 transition-colors hover:bg-base-800 hover:text-white disabled:cursor-not-allowed disabled:text-ink-400 disabled:hover:bg-transparent"
                >
                  Select all
                </button>
                <span className="text-base-700">·</span>
                <button
                  type="button"
                  onClick={selectNone}
                  disabled={noneOn || total === 0}
                  className="rounded-sm px-1.5 py-0.5 text-ink-200 transition-colors hover:bg-base-800 hover:text-white disabled:cursor-not-allowed disabled:text-ink-400 disabled:hover:bg-transparent"
                >
                  Select none
                </button>
              </div>
            </div>

            <ul role="listbox" aria-multiselectable="true" className="max-h-72 overflow-auto p-1">
              {total === 0 && (
                <li className="px-3 py-2.5 text-[12px] text-ink-300">
                  No capture dates for this room.
                </li>
              )}
              {dates.map((iso) => {
                const isOn = selected.has(iso);
                return (
                  <li key={iso}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isOn}
                      onClick={() => toggle(iso)}
                      className="flex w-full items-center gap-3 rounded-sm px-2 py-2 text-[13px] text-ink-200 transition-colors hover:bg-base-800 hover:text-white"
                    >
                      <span
                        aria-hidden
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border transition-colors ${
                          isOn
                            ? 'border-amber-500 bg-amber-500 text-base-950'
                            : 'border-base-700 bg-base-950'
                        }`}
                      >
                        {isOn && <Check size={11} strokeWidth={3} />}
                      </span>
                      <span className="flex-1 text-left">{format(parseISO(iso), 'EEE, MMM d, yyyy')}</span>
                      <span className="font-mono text-[10px] text-ink-400">{iso}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
