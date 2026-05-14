'use client';

import { motion } from 'framer-motion';
import { useParams, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Upload, X, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import {
  deleteFileAsset,
  getExplorerByDate,
  listProjects,
  listRooms,
} from '@/services/apiClient';
import { useAuth } from '@/context/AuthContext';
import { useSelectedDate } from '@/context/SelectedDateContext';
import { useMyProjectRole } from '@/hooks/useMyProjectRole';
import { RoomFilterMenu } from '@/components/explorer/RoomFilterMenu';
import { FileGrid } from '@/components/explorer/FileGrid';
import { MediaTabs, type MediaTab } from '@/components/explorer/MediaTabs';
import { UploadZone } from '@/components/explorer/UploadZone';
import { DeleteConfirm } from '@/components/explorer/DeleteConfirm';
import { EmptyState } from '@/components/ui/EmptyState';
import { Calendar, Filter } from 'lucide-react';
import type {
  ApiMediaFile,
  ApiProject,
  ApiRoom,
  ApiRoomMediaGroup,
  ExplorerByDateResponse,
} from '@/types/api';

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
  const [reloadToken, setReloadToken] = useState(0);
  const [roomFilter, setRoomFilter] = useState<Set<string> | null>(null);
  const [visibleCount, setVisibleCount] = useState(10);
  const [hiddenFileIds, setHiddenFileIds] = useState<Set<string>>(new Set());
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

  useEffect(() => {
    if (!project || !date) return;
    let cancelled = false;
    setResponse(null);
    getExplorerByDate(date).then((r) => { if (!cancelled) setResponse(r); });
    return () => { cancelled = true; };
  }, [date, project, reloadToken]);

  useEffect(() => { setRoomFilter(null); setVisibleCount(10); }, [date]);

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
      if (f.conversion_status === 'pending' || f.conversion_status === 'processing') {
        knownPendingRef.current.add(f.id);
      }
    }
    const hasPending = allClouds.some(
      (f) => f.conversion_status === 'pending' || f.conversion_status === 'processing',
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
          if (!e || e.done) return; // API already responded — too late to undo
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
          {canUpload && (
            <button
              type="button"
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

      {canUpload && showUploader && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
          className="mt-6 overflow-hidden"
        >
          <Uploader
            rooms={rooms}
            captureDate={date}
            onUploaded={(type) => {
              setReloadToken((t) => t + 1);
              setTab(TYPE_TO_TAB[type]);
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

      <DeleteConfirm
        file={pendingDelete}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

function pickGroup(rooms: Record<string, ApiRoomMediaGroup>, room: ApiRoom): ApiRoomMediaGroup | null {
  return rooms[room.name] ?? rooms[room.slug] ?? null;
}

function emptyGroup(): ApiRoomMediaGroup {
  return { images: [], videos: [], pointclouds: [], pdfs: [] };
}

function filesForTab(group: ApiRoomMediaGroup, tab: MediaTab): ApiMediaFile[] {
  return group[tab];
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
  { key: 'images' as const,      label: 'IMG', bg: 'bg-amber-500/10',  text: 'text-amber-400'  },
  { key: 'videos' as const,      label: 'VID', bg: 'bg-steel-500/10',  text: 'text-steel-400'  },
  { key: 'pointclouds' as const, label: 'PCD', bg: 'bg-violet-500/10', text: 'text-violet-400' },
  { key: 'pdfs' as const,        label: 'PDF', bg: 'bg-base-700/50',   text: 'text-ink-300'    },
] as const;

function RoomSection({
  roomName, roomSlug, projectSlug, date, group, files, canDelete, onDelete,
}: {
  roomName: string; roomSlug: string; projectSlug: string; date: string;
  group: ApiRoomMediaGroup; files: ApiMediaFile[]; canDelete: boolean; onDelete: (f: ApiMediaFile) => void;
}) {
  return (
    <section>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-[20px] font-semibold tracking-tight text-white">{roomName}</h2>
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
        origin="project"
        isAdmin={canDelete}
        onDelete={onDelete}
      />
    </section>
  );
}

const TYPE_TO_TAB: Record<ApiMediaFile['type'], MediaTab> = {
  image: 'images',
  video: 'videos',
  pointcloud: 'pointclouds',
  pdf: 'pdfs',
};

function Uploader({ rooms, captureDate, onUploaded }: { rooms: ApiRoom[]; captureDate: string; onUploaded: (type: ApiMediaFile['type']) => void }) {
  const [roomId, setRoomId] = useState(rooms[0]?.id ?? '');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [uploadDate, setUploadDate] = useState(captureDate);

  useEffect(() => {
    if (!roomId && rooms.length) setRoomId(rooms[0].id);
  }, [roomId, rooms]);

  useEffect(() => { setUploadDate(captureDate); }, [captureDate]);

  const selectedRoom = rooms.find((r) => r.id === roomId);
  const filtered = query
    ? rooms.filter((r) => r.name.toLowerCase().includes(query.toLowerCase()))
    : rooms;

  if (!rooms.length || !roomId || !selectedRoom) return null;

  return (
    <div className="rounded-lg border border-base-800 bg-base-900/30 p-5">
      <div className="mb-4 flex flex-wrap items-center gap-4">
        {/* Room combobox */}
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-300">Room</span>
          <div className="relative">
            <input
              type="text"
              value={open ? query : selectedRoom.name}
              onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
              onFocus={() => { setQuery(''); setOpen(true); }}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              placeholder="Search rooms…"
              className="w-44 rounded-md border border-base-700 bg-base-950 px-2.5 py-1.5 text-[13px] text-white outline-none focus:border-amber-500"
            />
            {open && filtered.length > 0 && (
              <ul className="absolute left-0 top-full z-20 mt-1 max-h-52 w-44 overflow-y-auto rounded-md border border-base-700 bg-base-900 py-1 shadow-xl">
                {filtered.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onMouseDown={() => { setRoomId(r.id); setQuery(''); setOpen(false); }}
                      className={`w-full px-3 py-1.5 text-left text-[13px] transition-colors hover:bg-base-800 ${r.id === roomId ? 'text-amber-400' : 'text-white'}`}
                    >
                      {r.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Capture date override */}
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-300">Date</span>
          <input
            type="date"
            value={uploadDate}
            onChange={(e) => setUploadDate(e.target.value)}
            className="rounded-md border border-base-700 bg-base-950 px-2.5 py-1.5 text-[13px] text-white outline-none focus:border-amber-500"
          />
        </div>
      </div>
      <UploadZone roomId={roomId} roomSlug={selectedRoom.slug} captureDate={uploadDate} onUploaded={onUploaded} />
    </div>
  );
}
