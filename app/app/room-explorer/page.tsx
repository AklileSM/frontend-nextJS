'use client';

import { motion } from 'framer-motion';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import {
  bulkDeleteFiles,
  bulkDownloadFiles,
  deleteFileAsset,
  getExplorerByRoom,
  listProjects,
  listRooms,
} from '@/services/apiClient';
import { useAuth } from '@/context/AuthContext';
import { BulkActionBar } from '@/components/explorer/BulkActionBar';
import { FileGrid } from '@/components/explorer/FileGrid';
import { MediaTabs, type MediaTab } from '@/components/explorer/MediaTabs';
import { DateFilterMenu } from '@/components/explorer/DateFilterMenu';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Calendar, Filter } from 'lucide-react';
import type {
  ApiMediaFile,
  ApiProject,
  ApiRoom,
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

  const [allRooms, setAllRooms] = useState<ApiRoom[]>([]);
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [response, setResponse] = useState<ExplorerByRoomResponse | null>(null);
  const [tab, setTab] = useState<MediaTab>('images');
  const [pendingDelete, setPendingDelete] = useState<ApiMediaFile | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [hiddenFileIds, setHiddenFileIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkConfirmDelete, setBulkConfirmDelete] = useState(false);
  const selectionAnchorRef = useRef<string | null>(null);
  const cancelDeleteRefs = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  // null = "default", treat as all dates checked. Once the user touches the
  // filter we store the explicit selection so empty (none-selected) is honored.
  const [dateFilter, setDateFilter] = useState<Set<string> | null>(null);
  const knownPendingRef = useRef<Set<string>>(new Set());
  const savedFilterRef = useRef<Set<string> | null>(null);
  const dateFilterRef = useRef<Set<string> | null>(null);
  // Keep dateFilterRef current so room-change effect always captures the latest value.
  dateFilterRef.current = dateFilter;

  const queryRoom = params.get('room');
  // ?date= is honored as a deeplink seed for the filter (e.g. from the sidebar
  // calendar), it initializes the filter to that single date.
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

  // Load rooms + projects for project-slug derivation and fallback room selection.
  useEffect(() => {
    let cancelled = false;
    Promise.all([listRooms(), listProjects()]).then(([rs, ps]) => {
      if (cancelled) return;
      setAllRooms(rs);
      setProjects(ps);
      // Fallback: pick first room when no ?room= param and nothing in localStorage.
      if (!activeSlug && rs.length) setActiveSlug(rs[0].slug);
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist last room
  useEffect(() => {
    if (!activeSlug) return;
    try {
      localStorage.setItem(LAST_ROOM_KEY, activeSlug);
    } catch {
      /* ignore */
    }
  }, [activeSlug]);

  // Clear stale data immediately on room change so we don't briefly render
  // the previous room's files under the new header.
  useEffect(() => {
    setResponse(null);
  }, [activeSlug]);

  // Load files for the active room. On poll-triggered reloads (reloadToken bump)
  // we leave the existing response in place until the new data arrives, that
  // keeps the thumbnails mounted, avoiding the framer-motion re-animation blink.
  useEffect(() => {
    if (!activeSlug) return;
    let cancelled = false;
    getExplorerByRoom(activeSlug).then((r) => {
      if (!cancelled) setResponse(r);
    });
    return () => {
      cancelled = true;
    };
  }, [activeSlug, reloadToken]);

  // When the room changes, stash the current filter (to restore applicable dates
  // after the new room loads) and reset to "show all" until data arrives.
  useEffect(() => {
    savedFilterRef.current = dateFilterRef.current;
    setDateFilter(null);
  }, [activeSlug]);

  // All dates the active room has files for, newest first.
  const allDates = useMemo(() => {
    if (!response) return [] as string[];
    return Object.keys(response.dates).sort((a, b) => b.localeCompare(a));
  }, [response]);

  // If a `?date=` deeplink is present and the date exists for this room, seed
  // the filter to just that date. We track the last (room|date) signature
  // we've applied so:
  //   - Clicking another date in the sidebar (URL changes, same page) re-seeds.
  //   - Manually toggling the filter inside the page doesn't get clobbered on
  //     the next render, because the signature is unchanged.
  // The previous one-shot boolean only ever seeded on initial mount, meaning
  // every subsequent sidebar date click silently no-op'd while staying on
  // /app/room-explorer.
  const lastSeededRef = useRef<string | null>(null);
  useEffect(() => {
    if (!response || !seedDate || !activeSlug) return;
    if (!allDates.includes(seedDate)) return;
    const sig = `${activeSlug}|${seedDate}`;
    if (lastSeededRef.current === sig) return;
    setDateFilter(new Set([seedDate]));
    lastSeededRef.current = sig;
  }, [response, seedDate, allDates, activeSlug]);

  // After a room switch, restore whichever saved dates still exist in the new room.
  useEffect(() => {
    if (!savedFilterRef.current || !allDates.length) return;
    const applicable = new Set([...savedFilterRef.current].filter((d) => allDates.includes(d)));
    savedFilterRef.current = null;
    if (applicable.size > 0) setDateFilter(applicable);
  }, [allDates]);

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

  const projectSlug = useMemo(() => {
    if (!activeSlug || !allRooms.length || !projects.length) return '';
    const room = allRooms.find((r) => r.slug === activeSlug);
    return projects.find((p) => p.id === room?.project_id)?.slug ?? '';
  }, [activeSlug, allRooms, projects]);

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

  // Auto-refresh while any point cloud in view is pending/processing; toast on completion.
  useEffect(() => {
    if (!response) return;
    const allClouds = datesEntries.flatMap(([, group]) => group.pointclouds);
    for (const f of allClouds) {
      if (knownPendingRef.current.has(f.id) && f.conversion_status === 'done') {
        toast.success(`${f.file_name} is ready to view`);
        knownPendingRef.current.delete(f.id);
      }
    }
    for (const f of allClouds) {
      if (
        f.conversion_status === 'uploading' ||
        f.conversion_status === 'pending' ||
        f.conversion_status === 'processing'
      ) {
        knownPendingRef.current.add(f.id);
      }
    }
    const hasPendingConversion = allClouds.some(
      (f) =>
        f.conversion_status === 'uploading' ||
        f.conversion_status === 'pending' ||
        f.conversion_status === 'processing',
    );
    if (!hasPendingConversion) return;
    const id = setInterval(() => setReloadToken((t) => t + 1), 5000);
    return () => clearInterval(id);
  }, [response, datesEntries]);

  // Clear selection on tab / room / date-filter change, stale selections in
  // an off-screen tab are confusing once you bulk-act on them.
  useEffect(() => {
    setSelectedIds(new Set());
    selectionAnchorRef.current = null;
  }, [tab, activeSlug, dateFilter]);


  // Flat, ordered list of files currently rendered (active tab × visible
  // dates, in render order). Backs shift-range selection.
  const flatVisibleFiles = useMemo<ApiMediaFile[]>(() => {
    const out: ApiMediaFile[] = [];
    for (const [, group] of datesEntries) {
      for (const f of group[tab]) {
        if (!hiddenFileIds.has(f.id)) out.push(f);
      }
    }
    return out;
  }, [datesEntries, tab, hiddenFileIds]);

  const onToggleSelect = useCallback(
    (file: ApiMediaFile, opts: { range: boolean }) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (opts.range && selectionAnchorRef.current) {
          const ids = flatVisibleFiles.map((f) => f.id);
          const a = ids.indexOf(selectionAnchorRef.current);
          const b = ids.indexOf(file.id);
          if (a >= 0 && b >= 0) {
            const [lo, hi] = a < b ? [a, b] : [b, a];
            for (let i = lo; i <= hi; i++) next.add(ids[i]);
            return next;
          }
        }
        if (next.has(file.id)) next.delete(file.id);
        else next.add(file.id);
        selectionAnchorRef.current = file.id;
        return next;
      });
    },
    [flatVisibleFiles],
  );

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    selectionAnchorRef.current = null;
  }, []);

  const runBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    setBulkBusy(true);
    try {
      const result = await bulkDeleteFiles(ids);
      setHiddenFileIds((prev) => new Set([...prev, ...ids]));
      clearSelection();
      setReloadToken((t) => t + 1);
      toast.success(
        result.skipped > 0
          ? `Deleted ${result.affected} · skipped ${result.skipped}.`
          : `Deleted ${result.affected} file${result.affected === 1 ? '' : 's'}.`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Bulk delete failed.');
    } finally {
      setBulkBusy(false);
      setBulkConfirmDelete(false);
    }
  }, [selectedIds, clearSelection]);

  const runBulkDownload = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    setBulkBusy(true);
    try {
      const { blob, affected, skipped } = await bulkDownloadFiles(ids);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `files-${affected}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      if (skipped > 0) {
        toast.warning(`Downloaded ${affected} · skipped ${skipped} (not downloadable).`);
      } else {
        toast.success(`Zip ready (${affected} file${affected === 1 ? '' : 's'}).`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Bulk download failed.');
    } finally {
      setBulkBusy(false);
    }
  }, [selectedIds]);


  const handleDeleteConfirm = useCallback(async () => {
    if (!pendingDelete) return;
    const file = pendingDelete;
    setPendingDelete(null);

    setHiddenFileIds((prev) => new Set([...prev, file.id]));

    const timerId = setTimeout(async () => {
      cancelDeleteRefs.current.delete(file.id);
      try {
        await deleteFileAsset(file.id);
        setHiddenFileIds((prev) => { const n = new Set(prev); n.delete(file.id); return n; });
        setReloadToken((t) => t + 1);
      } catch (err) {
        setHiddenFileIds((prev) => { const n = new Set(prev); n.delete(file.id); return n; });
        toast.error(err instanceof Error ? err.message : 'Delete failed.');
      }
    }, 5000);
    cancelDeleteRefs.current.set(file.id, timerId);

    toast.success(`${file.file_name} deleted.`, {
      duration: 5000,
      action: {
        label: 'Undo',
        onClick: () => {
          clearTimeout(cancelDeleteRefs.current.get(file.id));
          cancelDeleteRefs.current.delete(file.id);
          setHiddenFileIds((prev) => { const n = new Set(prev); n.delete(file.id); return n; });
        },
      },
    });
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
          <p className="font-mono text-[12px] uppercase tracking-[0.22em] text-amber-500">
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
            const files = group[tab].filter((f) => !hiddenFileIds.has(f.id));
            if (!files.length) return null;
            return (
              <DateSection
                key={date}
                date={date}
                group={group}
                roomSlug={activeSlug ?? ''}
                projectSlug={projectSlug}
                files={files}
                isAdmin={user?.is_admin ?? false}
                onDelete={setPendingDelete}
                batchActive={selectedIds.size > 0}
                selectedIds={selectedIds}
                onToggleSelect={user?.is_admin ? onToggleSelect : undefined}
              />
            );
          })}
        {response && datesEntries.length === 0 && (
          allDates.length === 0
            ? <EmptyState icon={Calendar} title="No captures yet" body="This room has no files filed yet." />
            : <EmptyState icon={Filter} title="No dates selected" body="Open the date filter to choose which captures to show." />
        )}
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete this file?"
        body={
          <>
            <code className="rounded bg-base-800 px-1.5 py-0.5 font-mono text-[12px] text-ink-100">
              {pendingDelete?.file_name}
            </code>{' '}
            will be removed from the project. Any reports already published from this file remain available.
          </>
        }
        confirmLabel="Delete file"
        danger
        onConfirm={handleDeleteConfirm}
        onCancel={() => setPendingDelete(null)}
      />

      <ConfirmDialog
        open={bulkConfirmDelete}
        title={`Delete ${selectedIds.size} file${selectedIds.size === 1 ? '' : 's'}?`}
        body="The selected files will be permanently removed. This cannot be undone."
        confirmLabel={`Delete ${selectedIds.size}`}
        danger
        onConfirm={runBulkDelete}
        onCancel={() => setBulkConfirmDelete(false)}
      />

      {user?.is_admin && (
        <BulkActionBar
          count={selectedIds.size}
          busy={bulkBusy}
          onDelete={() => setBulkConfirmDelete(true)}
          onDownload={runBulkDownload}
          onClear={clearSelection}
        />
      )}
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

const TYPE_PILLS = [
  { key: 'images' as const,      label: 'IMG', bg: 'bg-amber-500/10',   text: 'text-amber-400'  },
  { key: 'videos' as const,      label: 'VID', bg: 'bg-steel-500/10',   text: 'text-steel-400'  },
  { key: 'pointclouds' as const, label: 'PCD', bg: 'bg-violet-500/10',  text: 'text-violet-400' },
  { key: 'pdfs' as const,        label: 'PDF', bg: 'bg-base-700/50',    text: 'text-ink-300'    },
] as const;

function DateSection({
  date,
  group,
  roomSlug,
  projectSlug,
  files,
  isAdmin,
  onDelete,
  batchActive,
  selectedIds,
  onToggleSelect,
}: {
  date: string;
  group: ApiRoomMediaGroup;
  roomSlug: string;
  projectSlug: string;
  files: ApiMediaFile[];
  isAdmin: boolean;
  onDelete: (file: ApiMediaFile) => void;
  batchActive?: boolean;
  selectedIds?: ReadonlySet<string>;
  onToggleSelect?: (file: ApiMediaFile, opts: { range: boolean }) => void;
}) {
  return (
    <section>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-[20px] font-semibold tracking-tight text-white">
            {format(parseISO(date), 'EEE, MMM d, yyyy')}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {TYPE_PILLS.map(({ key, label, bg, text }) => {
              const count = group[key].length;
              if (!count) return null;
              return (
                <span
                  key={key}
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[10px] font-medium ${bg} ${text}`}
                >
                  <span className="tabular-nums">{count}</span>
                  <span className="opacity-70">{label}</span>
                </span>
              );
            })}
          </div>
        </div>
      </div>
      <FileGrid
        files={files}
        roomSlug={roomSlug}
        projectSlug={projectSlug}
        date={date}
        origin="room"
        isAdmin={isAdmin}
        onDelete={onDelete}
        batchActive={batchActive}
        selectedIds={selectedIds}
        onToggleSelect={onToggleSelect}
      />
    </section>
  );
}
