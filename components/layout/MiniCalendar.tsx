'use client';

import {
  addMonths,
  endOfMonth,
  format,
  getDay,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { getExplorerDatesSummary, getExplorerDatesSummaryForProject } from '@/services/apiClient';
import { useSelectedDate } from '@/context/SelectedDateContext';

const SCOPE = 'home';
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;
const PERSIST_KEY = 'sidebar.lastProjectSlug';

type DateCounts = Record<string, { total: number }>;

export function MiniCalendar({ projectId }: { projectId?: string }) {
  const { getDateForScope, setDateForScope } = useSelectedDate();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedISO = getDateForScope(SCOPE);
  const selected = selectedISO ? parseISO(selectedISO) : null;

  // Derive the project slug to use for navigation: URL path wins, then
  // the persisted sidebar slug (covers viewer pages, /app home, etc.).
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
    // Start at the current month; demo data in October 2024 will still be
    // reachable via the prev-month button.
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
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
        // Jump to the most recent month that has data, so the user sees dots
        // immediately rather than an empty grid.
        const dates = Object.keys(next).sort();
        if (dates.length) {
          const latest = parseISO(dates[dates.length - 1]);
          setCursor(new Date(latest.getFullYear(), latest.getMonth(), 1));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [projectId]);

  const cells = useMemo(() => buildMonthCells(cursor), [cursor]);

  return (
    <div className="px-3 py-3">
      <div className="flex items-center justify-between px-1">
        <button
          type="button"
          onClick={() => setCursor((c) => addMonths(c, -1))}
          aria-label="Previous month"
          className="inline-flex h-6 w-6 items-center justify-center rounded text-ink-300 transition-colors hover:bg-base-800 hover:text-white"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-200">
          {format(cursor, 'MMM yyyy')}
        </span>
        <button
          type="button"
          onClick={() => setCursor((c) => addMonths(c, 1))}
          aria-label="Next month"
          className="inline-flex h-6 w-6 items-center justify-center rounded text-ink-300 transition-colors hover:bg-base-800 hover:text-white"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-y-1 px-0.5">
        {WEEKDAYS.map((d, i) => (
          <span
            key={`${d}-${i}`}
            className="text-center font-mono text-[9px] uppercase tracking-[0.14em] text-ink-400"
          >
            {d}
          </span>
        ))}
      </div>

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
