'use client';

import { motion } from 'framer-motion';
import { useParams, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, Calendar, FileDown, Filter, Upload, X } from 'lucide-react';
import Link from 'next/link';
import {
  bulkDeleteFiles,
  bulkDownloadFiles,
  deleteFileAsset,
  getExplorerByDate,
  listProjects,
  listRooms,
} from '@/services/apiClient';
import { useAuth } from '@/context/AuthContext';
import { useSelectedDate } from '@/context/SelectedDateContext';
import { useMyProjectRole } from '@/hooks/useMyProjectRole';
import { RoomFilterMenu } from '@/components/explorer/RoomFilterMenu';
import { QualityCsvExportModal } from '@/components/explorer/QualityCsvExportModal';
import { BulkActionBar } from '@/components/explorer/BulkActionBar';
import { MediaTabs, type MediaTab } from '@/components/explorer/MediaTabs';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { UploadTour } from '@/components/onboarding/UploadTour';
import type {
  ApiMediaFile,
  ApiProject,
  ApiRoom,
  ExplorerByDateResponse,
} from '@/types/api';
import { RoomSection } from './_components/RoomSection';
import { Uploader } from './_components/Uploader';
import { Skeleton } from './_components/Skeleton';
import { emptyGroup, filesForTab, pickGroup, TYPE_TO_TAB } from './_components/helpers';

export const dynamic = 'force-dynamic';

export default function FileExplorerPage() {
  const { slug } = useParams<{ slug: string }>();
  const params = useSearchParams();
  const { user } = useAuth();
  const { bumpFilesVersion } = useSelectedDate();

  const [project, setProject] = useState<ApiProject | null>(null);
  const [rooms, setRooms] = useState<ApiRoom[]>([]);
  const [response, setResponse] = useState<ExplorerByDateResponse | null>(null);
  const [tab, setTab] = useState<MediaTab>('images');
  const [pendingDelete, setPendingDelete] = useState<ApiMediaFile | null>(null);
  const [showUploader, setShowUploader] = useState(false);
  const [showQualityExport, setShowQualityExport] = useState(false);
  const [demoActive, setDemoActive] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [roomFilter, setRoomFilter] = useState<Set<string> | null>(null);
  const [visibleCount, setVisibleCount] = useState(10);
  const [hiddenFileIds, setHiddenFileIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkConfirmDelete, setBulkConfirmDelete] = useState(false);
  // Anchor for shift-range selection — the last file the user clicked.
  // Stored in a ref so re-renders don't reset it.
  const selectionAnchorRef = useRef<string | null>(null);
  const knownPendingRef = useRef<Set<string>>(new Set());
  const deleteControllers = useRef<Map<string, { controller: AbortController; done: boolean }>>(new Map());

  const date = params.get('date') ?? '';
  const isAdmin = user?.is_admin ?? false;
  const { canUpload, canDelete: roleCanDelete } = useMyProjectRole(project?.id);
  const canDelete = isAdmin || roleCanDelete;

  useEffect(() => {
    let cancelled = false;
    Promise.all([listProjects(), listRooms()]).then(([ps, rs]) => {
      if (cancelled) return;
      const p = ps.find((x) => x.slug === slug);
      setProject(p ?? null);
      setRooms(p ? rs.filter((r) => r.project_id === p.id) : []);
    });
    return () => { cancelled = true; };
  }, [slug]);

  // Clear stale data on date/project change. Skipped on poll-triggered reloads
  // so the existing thumbnails stay mounted and don't re-animate every tick.
  useEffect(() => {
    setResponse(null);
  }, [date, project]);

  useEffect(() => {
    if (!project || !date) return;
    let cancelled = false;
    getExplorerByDate(date, slug).then((r) => { if (!cancelled) setResponse(r); });
    return () => { cancelled = true; };
  }, [date, project, reloadToken]);

  useEffect(() => { setRoomFilter(null); setVisibleCount(10); }, [date]);

  // Clear selection whenever the user changes context — tab switch, date
  // change, or new project. Stale selections from a hidden tab would be
  // invisible but still in scope for bulk actions, which is surprising.
  useEffect(() => {
    setSelectedIds(new Set());
    selectionAnchorRef.current = null;
  }, [tab, date, project, roomFilter]);


  const roomsWithFiles = useMemo(() => {
    if (!response) return [] as ApiRoom[];
    return rooms.filter((room) => {
      const group = pickGroup(response.rooms, room);
      if (!group) return false;
      return group.images.length + group.videos.length + group.pointclouds.length + group.pdfs.length > 0;
    });
  }, [rooms, response]);

  const effectiveSelected = useMemo(
    () => roomFilter ?? new Set<string>(roomsWithFiles.map((r) => r.slug)),
    [roomFilter, roomsWithFiles],
  );

  const visibleRooms = useMemo(
    () => roomsWithFiles.filter((r) => effectiveSelected.has(r.slug)),
    [roomsWithFiles, effectiveSelected],
  );

  const counts = useMemo(() => {
    const result: Record<MediaTab, number> = { images: 0, videos: 0, pointclouds: 0, pdfs: 0 };
    if (!response) return result;
    for (const room of visibleRooms) {
      const group = pickGroup(response.rooms, room);
      if (!group) continue;
      result.images += group.images.length;
      result.videos += group.videos.length;
      result.pointclouds += group.pointclouds.length;
      result.pdfs += group.pdfs.length;
    }
    return result;
  }, [response, visibleRooms]);

  // Flat, ordered list of every file currently rendered on this page, used
  // as the index space for shift-range selection.
  const flatVisibleFiles = useMemo<ApiMediaFile[]>(() => {
    if (!response) return [];
    const out: ApiMediaFile[] = [];
    for (const room of visibleRooms.slice(0, visibleCount)) {
      const group = pickGroup(response.rooms, room);
      if (!group) continue;
      for (const f of filesForTab(group, tab)) {
        if (!hiddenFileIds.has(f.id)) out.push(f);
      }
    }
    return out;
  }, [response, visibleRooms, visibleCount, tab, hiddenFileIds]);

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
            // Range select extends the selection rather than replacing it,
            // mirroring how every desktop file manager behaves.
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
      // Optimistically remove the affected rows so the user doesn't see them
      // until the next reload — same trick the single-file delete uses.
      setHiddenFileIds((prev) => new Set([...prev, ...ids]));
      clearSelection();
      setReloadToken((t) => t + 1);
      bumpFilesVersion();
      const msg = result.skipped > 0
        ? `Deleted ${result.affected} · skipped ${result.skipped}.`
        : `Deleted ${result.affected} file${result.affected === 1 ? '' : 's'}.`;
      toast.success(msg);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Bulk delete failed.');
    } finally {
      setBulkBusy(false);
      setBulkConfirmDelete(false);
    }
  }, [selectedIds, bumpFilesVersion, clearSelection]);

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


  useEffect(() => {
    if (!response) return;
    const allClouds = visibleRooms.flatMap((room) => pickGroup(response.rooms, room)?.pointclouds ?? []);
    // Toast newly-completed conversions
    for (const f of allClouds) {
      if (knownPendingRef.current.has(f.id) && f.conversion_status === 'done') {
        toast.success(`${f.file_name} is ready to view`);
        knownPendingRef.current.delete(f.id);
      }
    }
    // Track pending ones for next poll
    for (const f of allClouds) {
      if (
        f.conversion_status === 'uploading' ||
        f.conversion_status === 'pending' ||
        f.conversion_status === 'processing'
      ) {
        knownPendingRef.current.add(f.id);
      }
    }
    const hasPending = allClouds.some(
      (f) =>
        f.conversion_status === 'uploading' ||
        f.conversion_status === 'pending' ||
        f.conversion_status === 'processing',
    );
    if (!hasPending) return;
    const id = setInterval(() => setReloadToken((t) => t + 1), 5000);
    return () => clearInterval(id);
  }, [response, visibleRooms]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!pendingDelete) return;
    const file = pendingDelete;
    setPendingDelete(null);

    // Optimistically hide the file immediately.
    setHiddenFileIds((prev) => new Set([...prev, file.id]));

    // Start the API call right away so the delete persists even if the user
    // navigates away. The abort controller lets undo cancel it while in-flight.
    const controller = new AbortController();
    const entry = { controller, done: false };
    deleteControllers.current.set(file.id, entry);

    toast.success(`${file.file_name} deleted.`, {
      duration: 5000,
      action: {
        label: 'Undo',
        onClick: () => {
          const e = deleteControllers.current.get(file.id);
          if (!e || e.done) return; // API already responded, too late to undo
          e.controller.abort();
          deleteControllers.current.delete(file.id);
          setHiddenFileIds((prev) => { const n = new Set(prev); n.delete(file.id); return n; });
        },
      },
    });

    try {
      await deleteFileAsset(file.id, controller.signal);
      entry.done = true;
      deleteControllers.current.delete(file.id);
      setHiddenFileIds((prev) => { const n = new Set(prev); n.delete(file.id); return n; });
      setReloadToken((t) => t + 1);
      bumpFilesVersion();
    } catch (err) {
      deleteControllers.current.delete(file.id);
      if (controller.signal.aborted) {
        // User hit Undo before the request completed — restore the file.
        return;
      }
      entry.done = true;
      setHiddenFileIds((prev) => { const n = new Set(prev); n.delete(file.id); return n; });
      toast.error(err instanceof Error ? err.message : 'Delete failed.');
    }
  }, [pendingDelete, bumpFilesVersion]);

  if (!project) {
    return (
      <div className="px-6 py-10 sm:px-8 lg:px-12 xl:px-16">
        <div className="h-8 w-40 animate-pulse rounded bg-base-800" />
      </div>
    );
  }

  return (
    <div className="px-6 py-10 sm:px-8 lg:px-12 xl:px-16">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-wrap items-end justify-between gap-4"
      >
        <div>
          <Link
            href={`/app/projects/${slug}`}
            className="inline-flex items-center gap-1.5 font-mono text-[11px] text-ink-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={11} />
            {project.name}
          </Link>
          <p className="mt-3 font-mono text-[12px] uppercase tracking-[0.22em] text-amber-500">
            File explorer
          </p>
          <h1 className="mt-1 font-display text-[36px] font-semibold leading-[1.08] tracking-[-0.018em] text-white sm:text-[44px]">
            {project.name}
          </h1>
          <p className="mt-2 font-mono text-[12px] text-ink-300">
            grouped by room · {visibleRooms.length} of {roomsWithFiles.length} rooms · {date}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <RoomFilterMenu
            rooms={roomsWithFiles}
            selected={effectiveSelected}
            onChange={setRoomFilter}
          />
          <button
            type="button"
            onClick={() => setShowQualityExport(true)}
            className="inline-flex items-center gap-2 rounded-md border border-base-700 bg-base-900/40 px-3 py-1.5 text-[13px] font-medium text-ink-200 transition-colors hover:border-ink-400 hover:text-white"
          >
            <FileDown size={14} />
            Export CSV
          </button>
          {canUpload && (
            <button
              type="button"
              data-tour="upload-button"
              onClick={() => setShowUploader((v) => !v)}
              className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                showUploader
                  ? 'border border-base-700 bg-base-900/40 text-white hover:border-ink-300'
                  : 'bg-amber-500 text-base-950 hover:bg-amber-400'
              }`}
            >
              {showUploader ? <X size={14} /> : <Upload size={14} />}
              {showUploader ? 'Close uploader' : 'Upload'}
            </button>
          )}
        </div>
      </motion.section>

      {canUpload && (
        // Always mounted while the user has upload permission so in-flight
        // uploads survive a manual "Close uploader" — the panel collapses to
        // height:0 instead of being unmounted. The Uploader's auto-close on
        // batch completion calls back into setShowUploader.
        <motion.div
          initial={false}
          animate={{ opacity: showUploader ? 1 : 0, height: showUploader ? 'auto' : 0 }}
          transition={{ duration: 0.2 }}
          className="mt-6 overflow-hidden"
          aria-hidden={!showUploader}
        >
          <Uploader
            rooms={rooms}
            captureDate={date}
            onUploaded={(type) => {
              setReloadToken((t) => t + 1);
              setTab(TYPE_TO_TAB[type]);
            }}
            onClose={() => setShowUploader(false)}
            visible={showUploader}
            demoMode={{
              active: demoActive,
              onAttemptUpload: () => setDemoActive(false),
              onCancel: () => setDemoActive(false),
            }}
          />
        </motion.div>
      )}

      <div className="mt-8">
        <MediaTabs active={tab} counts={counts} onChange={setTab} railId="file-explorer-tab" />
      </div>

      <div className="mt-6 space-y-10">
        {!response && <Skeleton />}
        {response && visibleRooms.length === 0 && (
          roomsWithFiles.length === 0
            ? <EmptyState icon={Calendar} title="No captures for this date" body="Try a different date from the sidebar calendar." />
            : <EmptyState icon={Filter} title="No rooms selected" body="Open the room filter to choose which rooms to show." />
        )}
        {response &&
          visibleRooms.slice(0, visibleCount).map((room) => {
            const group = pickGroup(response.rooms, room) ?? emptyGroup();
            const files = filesForTab(group, tab).filter((f) => !hiddenFileIds.has(f.id));
            if (!files.length) return null;
            return (
              <RoomSection
                key={room.id}
                roomName={room.name}
                roomSlug={room.slug}
                projectSlug={slug}
                date={date}
                group={group}
                files={files}
                canDelete={canDelete}
                onDelete={setPendingDelete}
                batchActive={selectedIds.size > 0}
                selectedIds={selectedIds}
                onToggleSelect={canDelete ? onToggleSelect : undefined}
              />
            );
          })}
        {response && visibleRooms.length > visibleCount && (
          <div className="flex justify-center pt-2">
            <button
              type="button"
              onClick={() => setVisibleCount((n) => n + 10)}
              className="rounded-md border border-base-700 px-5 py-2 text-[13px] text-ink-300 transition-colors hover:border-ink-400 hover:text-white"
            >
              Load {Math.min(10, visibleRooms.length - visibleCount)} more rooms
              <span className="ml-1.5 font-mono text-[11px] text-ink-500">
                ({visibleCount} of {visibleRooms.length})
              </span>
            </button>
          </div>
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

      {showQualityExport && (
        <QualityCsvExportModal
          projectName={project.name}
          projectSlug={project.slug}
          rooms={rooms}
          currentDate={date}
          defaultRoomSlugs={Array.from(effectiveSelected)}
          defaultMediaTypes={
            tab === 'images' ? ['image'] : tab === 'pointclouds' ? ['pointcloud'] : ['image', 'pointcloud']
          }
          onClose={() => setShowQualityExport(false)}
        />
      )}

      <ConfirmDialog
        open={bulkConfirmDelete}
        title={`Delete ${selectedIds.size} file${selectedIds.size === 1 ? '' : 's'}?`}
        body="The selected files will be permanently removed. This cannot be undone."
        confirmLabel={`Delete ${selectedIds.size}`}
        danger
        onConfirm={runBulkDelete}
        onCancel={() => setBulkConfirmDelete(false)}
      />

      {canDelete && (
        <BulkActionBar
          count={selectedIds.size}
          busy={bulkBusy}
          onDelete={() => setBulkConfirmDelete(true)}
          onDownload={runBulkDownload}
          onClear={clearSelection}
        />
      )}

      {canUpload && (
        <UploadTour
          uploaderOpen={showUploader}
          onOpenUploader={() => setShowUploader(true)}
          onActivateDemo={() => { setShowUploader(true); setDemoActive(true); }}
          onDeactivateDemo={() => setDemoActive(false)}
        />
      )}
    </div>
  );
}
