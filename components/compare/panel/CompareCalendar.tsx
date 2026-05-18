'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const WEEKDAYS_SHORT = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'] as const;

const calSlideVariants = {
  enterForward:  { x: 20, opacity: 0 },
  enterBackward: { x: -20, opacity: 0 },
  center:        { x: 0,  opacity: 1 },
  exitForward:   { x: -20, opacity: 0 },
  exitBackward:  { x: 20,  opacity: 0 },
};

function activeMonthsFromDates(dates: ReadonlySet<string>): Set<string> {
  const s = new Set<string>();
  for (const iso of dates) s.add(iso.slice(0, 7));
  return s;
}

export function CompareCalendar({
  availableDates,
  onDateSelect,
}: {
  availableDates: ReadonlySet<string>;
  onDateSelect: (date: string) => void;
}) {
  const [cursor, setCursor] = useState<Date>(() => {
    const sorted = [...availableDates].sort();
    return sorted.length > 0
      ? startOfMonth(parseISO(sorted.at(-1)! + 'T00:00:00'))
      : startOfMonth(new Date());
  });
  const [view, setView] = useState<'days' | 'months'>('days');
  const [direction, setDirection] = useState(1);

  const activeMonths = useMemo(() => activeMonthsFromDates(availableDates), [availableDates]);

  const goMonth = (delta: number) => {
    setDirection(delta);
    setCursor((c) => addMonths(c, delta));
  };

  const goYear = (delta: number) => {
    setDirection(delta);
    setCursor((c) => new Date(c.getFullYear() + delta, c.getMonth(), 1));
  };

  const pickMonth = (idx: number) => {
    const next = new Date(cursor.getFullYear(), idx, 1);
    setDirection(next > cursor ? 1 : -1);
    setCursor(next);
    setView('days');
  };

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  return (
    <div className="flex h-full flex-col items-center justify-center p-6">
      <div className="w-full max-w-[300px]">

        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => view === 'days' ? goMonth(-1) : goYear(-1)}
            aria-label={view === 'days' ? 'Previous month' : 'Previous year'}
            className="inline-flex h-7 w-7 items-center justify-center rounded text-ink-400 transition-colors hover:bg-base-800 hover:text-white"
          >
            <ChevronLeft size={15} />
          </button>

          <button
            type="button"
            onClick={() => setView((v) => v === 'days' ? 'months' : 'days')}
            className="flex items-center gap-1.5 rounded px-2 py-1 font-mono text-[13px] font-medium text-white transition-colors hover:bg-base-800"
          >
            {view === 'days' ? format(cursor, 'MMMM yyyy') : cursor.getFullYear()}
            <ChevronRight
              size={11}
              className={`text-ink-500 transition-transform duration-150 ${view === 'months' ? 'rotate-90' : '-rotate-90'}`}
            />
          </button>

          <button
            type="button"
            onClick={() => view === 'days' ? goMonth(1) : goYear(1)}
            aria-label={view === 'days' ? 'Next month' : 'Next year'}
            className="inline-flex h-7 w-7 items-center justify-center rounded text-ink-400 transition-colors hover:bg-base-800 hover:text-white"
          >
            <ChevronRight size={15} />
          </button>
        </div>

        {/* Animated content */}
        <div className="relative mt-4 overflow-hidden">
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            {view === 'days' ? (
              <motion.div
                key={`days-${format(cursor, 'yyyy-MM')}`}
                custom={direction}
                variants={calSlideVariants}
                initial={direction > 0 ? 'enterForward' : 'enterBackward'}
                animate="center"
                exit={direction > 0 ? 'exitForward' : 'exitBackward'}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              >
                {/* Weekday headers */}
                <div className="grid grid-cols-7 gap-y-1">
                  {WEEKDAYS_SHORT.map((d, i) => (
                    <span key={i} className="text-center font-mono text-[10px] uppercase tracking-[0.12em] text-ink-500">
                      {d}
                    </span>
                  ))}
                </div>

                {/* Day cells */}
                <div className="mt-1 grid grid-cols-7 gap-y-0.5">
                  {days.map((day, i) => {
                    const iso = format(day, 'yyyy-MM-dd');
                    const inMonth = isSameMonth(day, cursor);
                    const hasFiles = availableDates.has(iso);
                    return (
                      <button
                        key={i}
                        type="button"
                        disabled={!hasFiles || !inMonth}
                        onClick={() => onDateSelect(iso)}
                        className={`relative flex h-9 w-full items-center justify-center rounded text-[13px] transition-colors ${
                          !inMonth
                            ? 'cursor-default text-base-700'
                            : hasFiles
                            ? 'cursor-pointer font-medium text-white hover:bg-amber-500 hover:text-base-950'
                            : 'cursor-not-allowed text-base-700 line-through opacity-40'
                        }`}
                      >
                        {format(day, 'd')}
                        {hasFiles && inMonth && (
                          <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-amber-500" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key={`months-${cursor.getFullYear()}`}
                custom={direction}
                variants={calSlideVariants}
                initial={direction > 0 ? 'enterForward' : 'enterBackward'}
                animate="center"
                exit={direction > 0 ? 'exitForward' : 'exitBackward'}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                className="grid grid-cols-3 gap-1.5 py-1"
              >
                {MONTH_NAMES.map((name, idx) => {
                  const key = `${cursor.getFullYear()}-${String(idx + 1).padStart(2, '0')}`;
                  const hasData = activeMonths.has(key);
                  // Highlight only if (1) cursor is on today's year and
                  // (2) the month is today's month and (3) that month
                  // actually has data. Previously this was just
                  // `cursor.getMonth() === idx`, which left April lit up
                  // across every year you scrolled to, misleading
                  // because most of those April rows had no captures.
                  const today = new Date();
                  const isCurrent =
                    cursor.getFullYear() === today.getFullYear() &&
                    idx === today.getMonth() &&
                    hasData;
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => pickMonth(idx)}
                      className={`relative flex flex-col items-center justify-center rounded py-3 text-[12px] font-medium transition-colors ${
                        isCurrent
                          ? 'bg-amber-500 text-base-950'
                          : hasData
                          ? 'text-white hover:bg-base-800'
                          : 'cursor-not-allowed text-base-700 opacity-40'
                      }`}
                    >
                      {name}
                      {hasData && !isCurrent && (
                        <span className="absolute bottom-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-amber-500" />
                      )}
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className="mt-4 text-center font-mono text-[11px] text-ink-600">
          {availableDates.size} captured {availableDates.size === 1 ? 'day' : 'days'} · select to browse
        </p>
      </div>
    </div>
  );
}
