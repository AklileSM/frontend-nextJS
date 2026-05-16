'use client';

import {
  endOfMonth,
  format,
  getDay,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { getExplorerDatesSummary, getExplorerDatesSummaryForProject } from '@/services/apiClient';
import { useSelectedDate } from '@/context/SelectedDateContext';

const SCOPE = 'home';
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'] as const;
const PERSIST_KEY = 'sidebar.lastProjectSlug';

type View = 'days' | 'months';
type DateCounts = Record<string, { total: number }>;

// Months that have at least one capture, for highlighting in the month picker.
function activateMonths(counts: DateCounts): Set<string> {
  const set = new Set<string>();
  for (const iso of Object.keys(counts)) {
    set.add(iso.slice(0, 7)); // "yyyy-MM"
  }
  return set;
}

// Explicit initial/animate/exit values (not shared named variants). When this
// component shares a page with other AnimatePresences (e.g. the annotation
// form modal), framer-motion can occasionally leave variant lookups in a
// transient state and a new child mounts stuck at its `initial` — manifests
// as empty day cells / empty months grid after a modal closes.
function enterFrom(direction: number) {
  return { x: direction > 0 ? 24 : -24, opacity: 0 };
}
function exitTo(direction: number) {
  return { x: direction > 0 ? -24 : 24, opacity: 0 };
}
const SLIDE_CENTER = { x: 0, opacity: 1 } as const;

export function MiniCalendar({ projectId }: { projectId?: string }) {
  const { getDateForScope, setDateForScope, filesVersion } = useSelectedDate();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedISO = getDateForScope(SCOPE);
  const selected = selectedISO ? parseISO(selectedISO) : null;

  const projectSlug = useMemo(() => {
    const fromPath = pathname.match(/\/app\/projects\/([^/]+)/)?.[1];
    if (fromPath) return fromPath;
    try { return sessionStorage.getItem(PERSIST_KEY) ?? ''; } catch { return ''; }
  }, [pathname]);

  const onPick = (iso: string) => {
    setDateForScope(SCOPE, iso);
    const next = new URLSearchParams(searchParams.toString());
    next.set('date', iso);
    router.push(`/app/projects/${projectSlug}/files?${next.toString()}`);
  };

  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [view, setView] = useState<View>('days');
  // Track direction for slide animation: 1 = forward (later), -1 = backward (earlier)
  const [direction, setDirection] = useState(1);
  const [counts, setCounts] = useState<DateCounts>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const fetch = projectId
      ? getExplorerDatesSummaryForProject(projectId)
      : getExplorerDatesSummary();
    fetch
      .then((res) => {
        if (cancelled) return;
        const next: DateCounts = {};
        for (const [date, c] of Object.entries(res.dates)) {
          next[date] = { total: c.images + c.videos + c.pointclouds + c.pdfs };
        }
        setCounts(next);
        const dates = Object.keys(next).sort();
        if (dates.length) {
          const latest = parseISO(dates[dates.length - 1]);
          // parseISO returns Invalid Date on a malformed string; using it
          // would seed the cursor with NaN and break every subsequent render.
          if (!Number.isNaN(latest.getTime())) {
            setCursor(new Date(latest.getFullYear(), latest.getMonth(), 1));
          }
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId, filesVersion]);

  const cells = useMemo(() => buildMonthCells(cursor), [cursor]);
  const activeMonths = useMemo(() => activateMonths(counts), [counts]);

  const goMonth = (delta: number) => {
    setDirection(delta);
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));
  };

  const goYear = (delta: number) => {
    setDirection(delta);
    setCursor((c) => new Date(c.getFullYear() + delta, c.getMonth(), 1));
  };

  const pickMonth = (monthIndex: number) => {
    const next = new Date(cursor.getFullYear(), monthIndex, 1);
    setDirection(next > cursor ? 1 : -1);
    setCursor(next);
    setView('days');
  };

  return (
    <div className="px-3 py-3">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-1">
        <button
          type="button"
          onClick={() => view === 'days' ? goMonth(-1) : goYear(-1)}
          aria-label={view === 'days' ? 'Previous month' : 'Previous year'}
          className="inline-flex h-6 w-6 items-center justify-center rounded text-ink-300 transition-colors hover:bg-base-800 hover:text-white"
        >
          <ChevronLeft size={14} />
        </button>

        <button
          type="button"
          onClick={() => setView((v) => v === 'days' ? 'months' : 'days')}
          aria-label={view === 'days' ? 'Pick month and year' : 'Back to day view'}
          className="group flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-200 transition-colors hover:bg-base-800 hover:text-white"
        >
          {view === 'days'
            ? format(cursor, 'MMM yyyy')
            : cursor.getFullYear()}
          <ChevronRight
            size={10}
            className={`text-ink-500 transition-transform duration-150 ${view === 'months' ? 'rotate-90' : '-rotate-90'}`}
          />
        </button>

        <button
          type="button"
          onClick={() => view === 'days' ? goMonth(1) : goYear(1)}
          aria-label={view === 'days' ? 'Next month' : 'Next year'}
          className="inline-flex h-6 w-6 items-center justify-center rounded text-ink-300 transition-colors hover:bg-base-800 hover:text-white"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* ── Animated view area ── */}
      <div className="relative mt-3 overflow-hidden">
        <AnimatePresence initial={false}>
          {view === 'days' ? (
            <motion.div
              key={`days-${format(cursor, 'yyyy-MM')}`}
              initial={enterFrom(direction)}
              animate={SLIDE_CENTER}
              exit={exitTo(direction)}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* Weekday headers */}
              <div className="grid grid-cols-7 gap-y-1 px-0.5">
                {WEEKDAYS.map((d, i) => (
                  <span
                    key={`${d}-${i}`}
                    className="text-center font-mono text-[9px] uppercase tracking-[0.14em] text-ink-400"
                  >
                    {d}
                  </span>
                ))}
              </div>

              {/* Day cells */}
              <div className="mt-1 grid grid-cols-7 gap-y-0.5 px-0.5">
                {cells.map((day, i) => {
                  const iso = format(day, 'yyyy-MM-dd');
                  const inMonth = isSameMonth(day, cursor);
                  const has = counts[iso]?.total ?? 0;
                  const isSelected = selected ? isSameDay(day, selected) : false;
                  return (
                    <button
                      key={`${iso}-${i}`}
                      type="button"
                      onClick={() => onPick(iso)}
                      disabled={!inMonth}
                      aria-label={iso}
                      aria-pressed={isSelected}
                      className={`group relative flex h-7 w-full items-center justify-center rounded text-[11px] transition-colors ${
                        isSelected
                          ? 'bg-amber-500 font-semibold text-base-950'
                          : inMonth
                          ? has > 0
                            ? 'text-white hover:bg-base-800'
                            : 'text-ink-400 hover:bg-base-800/60'
                          : 'cursor-default text-base-700'
                      }`}
                    >
                      {format(day, 'd')}
                      {!isSelected && has > 0 && inMonth && (
                        <motion.span
                          layoutId={`dot-${iso}`}
                          className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-amber-500"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key={`months-${cursor.getFullYear()}`}
              initial={enterFrom(direction)}
              animate={SLIDE_CENTER}
              exit={exitTo(direction)}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="grid grid-cols-3 gap-1 px-0.5 py-1"
            >
              {MONTHS.map((name, idx) => {
                const key = `${cursor.getFullYear()}-${String(idx + 1).padStart(2, '0')}`;
                const hasData = activeMonths.has(key);
                const isCurrent = cursor.getMonth() === idx;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => pickMonth(idx)}
                    className={`relative flex flex-col items-center justify-center rounded py-2.5 text-[11px] font-medium transition-colors ${
                      isCurrent
                        ? 'bg-amber-500 text-base-950'
                        : hasData
                        ? 'text-white hover:bg-base-800'
                        : 'text-ink-400 hover:bg-base-800/60'
                    }`}
                  >
                    {name}
                    {hasData && !isCurrent && (
                      <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-amber-500" />
                    )}
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Footer ── */}
      <div className="mt-3 flex items-center justify-between px-1 font-mono text-[10px] text-ink-400">
        <span>
          {loading
            ? 'Loading…'
            : `${Object.keys(counts).length} captured ${Object.keys(counts).length === 1 ? 'day' : 'days'}`}
        </span>
        {selectedISO && (
          <button
            type="button"
            onClick={() => setDateForScope(SCOPE, null)}
            className="text-ink-300 transition-colors hover:text-white"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

function buildMonthCells(cursor: Date): Date[] {
  const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
  const end = endOfMonth(cursor);
  const cells: Date[] = [];
  let day = start;
  while (cells.length < 42) {
    cells.push(day);
    day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
    if (day > end && getDay(day) === 1) break;
  }
  while (cells.length < 42) {
    cells.push(day);
    day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
  }
  return cells;
}
