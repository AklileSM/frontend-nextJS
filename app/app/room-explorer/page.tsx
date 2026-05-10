'use client';

import { motion } from 'framer-motion';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { deleteFileAsset, getExplorerByRoom, listRooms } from '@/services/apiClient';
import { useAuth } from '@/context/AuthContext';
import { FileGrid } from '@/components/explorer/FileGrid';
import { MediaTabs, type MediaTab } from '@/components/explorer/MediaTabs';
import { DateFilterMenu } from '@/components/explorer/DateFilterMenu';
import { DeleteConfirm } from '@/components/explorer/DeleteConfirm';
import type {
  ApiMediaFile,
  ApiRoomMediaGroup,
  ExplorerByRoomResponse,
} from '@/types/api';

export const dynamic = 'force-dynamic';

const LAST_ROOM_KEY = 'a6.lastRoom';

export default function RoomExplorerPage() {
  return (
    <Suspense
      fallback={
        <div className="px-6 py-10 sm:px-8 lg:px-12">
          <div className="h-9 w-64 animate-pulse rounded bg-base-800" />
        </div>
      }
    >
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const params = useSearchParams();
  const { user } = useAuth();

  const [response, setResponse] = useState<ExplorerByRoomResponse | null>(null);
  const [tab, setTab] = useState<MediaTab>('images');
  const [pendingDelete, setPendingDelete] = useState<ApiMediaFile | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  // null = "default" — treat as all dates checked. Once the user touches the
  // filter we store the explicit selection so empty (none-selected) is honored.
  const [dateFilter, setDateFilter] = useState<Set<string> | null>(null);

  const queryRoom = params.get('room');
  // ?date= is honored as a deeplink seed for the filter (e.g. from the sidebar
  // calendar) — it initializes the filter to that single date.
  const seedDate = params.get('date');

  // Resolve current room slug: query param wins, otherwise localStorage, then first room.
  const [activeSlug, setActiveSlug] = useState<string | null>(queryRoom);
  useEffect(() => {
    if (queryRoom) {
      setActiveSlug(queryRoom);
      return;
    }
    try {
      const stored = localStorage.getItem(LAST_ROOM_KEY);
      if (stored) setActiveSlug(stored);
    } catch {
      /* ignore */
    }
  }, [queryRoom]);

  // First-load fallback — pick the first A6-Stern room when no `?room=` param
  // and nothing was stored in localStorage. The sidebar handles room switching
  // from then on.
  useEffect(() => {
    if (activeSlug) return;
    let cancelled = false;
    listRooms().then((rs) => {
      if (cancelled) return;
      const a6 = rs.filter((r) => r.project_id === 'p-a6');
      if (a6.length) setActiveSlug(a6[0].slug);
    });
    return () => {
      cancelled = true;
    };
  }, [activeSlug]);

  // Persist last room
  useEffect(() => {
    if (!activeSlug) return;
    try {
      localStorage.setItem(LAST_ROOM_KEY, activeSlug);
    } catch {
      /* ignore */
    }
  }, [activeSlug]);

  // Load files for the active room
  useEffect(() => {
    if (!activeSlug) return;
    let cancelled = false;
    setResponse(null);
    getExplorerByRoom(activeSlug).then((r) => {
      if (!cancelled) setResponse(r);
    });
    return () => {
      cancelled = true;
    };
  }, [activeSlug, reloadToken]);

  // Reset the date filter whenever the active room changes — the set of
  // available dates is different for each room.
  useEffect(() => {
    setDateFilter(null);
  }, [activeSlug]);

  // All dates the active room has files for, newest first.
  const allDates = useMemo(() => {
    if (!response) return [] as string[];
    return Object.keys(response.dates).sort((a, b) => b.localeCompare(a));
  }, [response]);

  // If a `?date=` deeplink is present and the date exists for this room, seed
  // the filter to just that date the first time we have data. Once the user
  // explicitly toggles the filter we never overwrite their selection.
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    if (!response || !seedDate) return;
    if (!allDates.includes(seedDate)) return;
    setDateFilter(new Set([seedDate]));
    seededRef.current = true;
  }, [response, seedDate, allDates]);

  const effectiveSelected = useMemo(
    () => dateFilter ?? new Set<string>(allDates),
    [dateFilter, allDates],
  );

  const datesEntries = useMemo(() => {
    if (!response) return [] as Array<[string, ApiRoomMediaGroup]>;
    return allDates
      .filter((d) => effectiveSelected.has(d))
      .map((d) => [d, response.dates[d]] as [string, ApiRoomMediaGroup]);
  }, [response, allDates, effectiveSelected]);

  const counts = useMemo(() => {
    const result: Record<MediaTab, number> = { images: 0, videos: 0, pointclouds: 0, pdfs: 0 };
    for (const [, group] of datesEntries) {
      result.images += group.images.length;
      result.videos += group.videos.length;
      result.pointclouds += group.pointclouds.length;
      result.pdfs += group.pdfs.length;
    }
    return result;
  }, [datesEntries]);

  // Auto-refresh while any point cloud in view is pending/processing conversion.
  useEffect(() => {
    if (!response) return;
    const hasPendingConversion = datesEntries.some(([, group]) =>
      group.pointclouds.some(
        (f) => f.conversion_status === 'pending' || f.conversion_status === 'processing',
      ),
    );
    if (!hasPendingConversion) return;
    const id = setInterval(() => setReloadToken((t) => t + 1), 5000);
    return () => clearInterval(id);
  }, [response, datesEntries]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!pendingDelete) return;
    try {
      await deleteFileAsset(pendingDelete.id);
      toast.success(`Deleted ${pendingDelete.file_name}.`);
      setPendingDelete(null);
      setReloadToken((t) => t + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed.');
    }
  }, [pendingDelete]);

  return (
    <div className="px-6 py-10 sm:px-8 lg:px-12 xl:px-16">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-wrap items-end justify-between gap-4"
      >
        <div>
          <p className="inline-flex items-center gap-3 font-mono text-[12px] uppercase tracking-[0.22em] text-amber-500">
            <span className="h-px w-8 bg-amber-500/60" />
            Room explorer
          </p>
          <h1 className="mt-3 font-display text-[36px] font-semibold leading-[1.08] tracking-[-0.018em] text-white sm:text-[44px]">
            {response?.room_name ?? activeSlug ?? '—'}
          </h1>
          <p className="mt-2 font-mono text-[12px] text-ink-300">
            grouped by date · {datesEntries.length} of {allDates.length} dates
          </p>
        </div>

        <DateFilterMenu dates={allDates} selected={effectiveSelected} onChange={setDateFilter} />
      </motion.section>

      <div className="mt-8">
        <MediaTabs active={tab} counts={counts} onChange={setTab} railId="room-explorer-tab" />
      </div>

      <div className="mt-6 space-y-10">
        {!response && <Skeleton />}
        {response &&
          datesEntries.map(([date, group]) => {
            const files = group[tab];
            const total =
              group.images.length + group.videos.length + group.pointclouds.length + group.pdfs.length;
            return (
              <DateSection
                key={date}
                date={date}
                roomSlug={activeSlug ?? ''}
                files={files}
                total={total}
                isAdmin={user?.is_admin ?? false}
                onDelete={setPendingDelete}
              />
            );
          })}
        {response && datesEntries.length === 0 && (
          <div className="rounded-md border border-dashed border-base-700 bg-base-900/30 px-4 py-10 text-center text-[13px] text-ink-300">
            {allDates.length === 0
              ? 'No captures filed for this room.'
              : 'No dates selected — open the filter to choose which dates to show.'}
          </div>
        )}
      </div>

      <DeleteConfirm
        file={pendingDelete}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i}>
          <div className="h-5 w-40 animate-pulse rounded bg-base-800" />
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, j) => (
              <div key={j} className="aspect-[4/3] animate-pulse rounded-md bg-base-800/60" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function DateSection({
  date,
  roomSlug,
  files,
  total,
  isAdmin,
  onDelete,
}: {
  date: string;
  roomSlug: string;
  files: ApiMediaFile[];
  total: number;
  isAdmin: boolean;
  onDelete: (file: ApiMediaFile) => void;
}) {
  return (
    <section>
      <div className="mb-3 flex items-end justify-between">
        <div>
          <h2 className="font-display text-[20px] font-semibold tracking-tight text-white">
            {format(parseISO(date), 'EEE, MMM d, yyyy')}
          </h2>
          <p className="mt-0.5 font-mono text-[11px] text-ink-300">{total} captures · {date}</p>
        </div>
      </div>
      <FileGrid
        files={files}
        roomSlug={roomSlug}
        date={date}
        origin="room"
        isAdmin={isAdmin}
        onDelete={onDelete}
      />
    </section>
  );
}
