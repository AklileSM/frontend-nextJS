'use client';

import { motion } from 'framer-motion';
import { useParams, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Upload, X } from 'lucide-react';
import {
  deleteFileAsset,
  getExplorerByDate,
  listProjects,
  listRooms,
} from '@/services/apiClient';
import { useAuth } from '@/context/AuthContext';
import { RoomFilterMenu } from '@/components/explorer/RoomFilterMenu';
import { FileGrid } from '@/components/explorer/FileGrid';
import { MediaTabs, type MediaTab } from '@/components/explorer/MediaTabs';
import { UploadZone } from '@/components/explorer/UploadZone';
import { DeleteConfirm } from '@/components/explorer/DeleteConfirm';
import { mockCaptureDates } from '@/services/mockData';
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

  const [project, setProject] = useState<ApiProject | null>(null);
  const [rooms, setRooms] = useState<ApiRoom[]>([]);
  const [response, setResponse] = useState<ExplorerByDateResponse | null>(null);
  const [tab, setTab] = useState<MediaTab>('images');
  const [pendingDelete, setPendingDelete] = useState<ApiMediaFile | null>(null);
  const [showUploader, setShowUploader] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  // null = "default" — treat as all rooms checked. Once the user touches the
  // filter we store the explicit selection so empty (none-selected) is honored.
  const [roomFilter, setRoomFilter] = useState<Set<string> | null>(null);

  const date = params.get('date') ?? mockCaptureDates[mockCaptureDates.length - 1];
  const isAdmin = user?.is_admin ?? false;
  const canUpload = isAdmin;

  // Load project metadata + rooms once
  useEffect(() => {
    let cancelled = false;
    Promise.all([listProjects(), listRooms()]).then(([ps, rs]) => {
      if (cancelled) return;
      const p = ps.find((x) => x.slug === slug);
      setProject(p ?? null);
      setRooms(p ? rs.filter((r) => r.project_id === p.id) : []);
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Load files for date whenever the date or reload token changes
  useEffect(() => {
    if (!project) return;
    let cancelled = false;
    setResponse(null);
    getExplorerByDate(date).then((r) => {
      if (!cancelled) setResponse(r);
    });
    return () => {
      cancelled = true;
    };
  }, [date, project, reloadToken]);

  // Reset the room filter to "all" whenever the active date changes — the set
  // of rooms with files on the new date is different.
  useEffect(() => {
    setRoomFilter(null);
  }, [date]);

  // Rooms that actually have at least one file on the active date.
  const roomsWithFiles = useMemo(() => {
    if (!response) return [] as ApiRoom[];
    return rooms.filter((room) => {
      const group = pickGroup(response.rooms, room);
      if (!group) return false;
      return (
        group.images.length + group.videos.length + group.pointclouds.length + group.pdfs.length > 0
      );
    });
  }, [rooms, response]);

  // Effective selection — null means "everything in roomsWithFiles".
  const effectiveSelected = useMemo(
    () =>
      roomFilter ??
      new Set<string>(roomsWithFiles.map((r) => r.slug)),
    [roomFilter, roomsWithFiles],
  );

  const visibleRooms = useMemo(
    () => roomsWithFiles.filter((r) => effectiveSelected.has(r.slug)),
    [roomsWithFiles, effectiveSelected],
  );

  // Aggregated counts for the tab bar — only counts visible rooms so the badge
  // numbers track the filter.
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
          <p className="inline-flex items-center gap-3 font-mono text-[12px] uppercase tracking-[0.22em] text-amber-500">
            <span className="h-px w-8 bg-amber-500/60" />
            File explorer
          </p>
          <h1 className="mt-3 font-display text-[36px] font-semibold leading-[1.08] tracking-[-0.018em] text-white sm:text-[44px]">
            {project?.name ?? slug}
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
            onUploaded={() => setReloadToken((t) => t + 1)}
          />
        </motion.div>
      )}

      <div className="mt-8">
        <MediaTabs active={tab} counts={counts} onChange={setTab} railId="file-explorer-tab" />
      </div>

      <div className="mt-6 space-y-10">
        {!response && <Skeleton />}
        {response && visibleRooms.length === 0 && (
          <div className="rounded-md border border-dashed border-base-700 bg-base-900/30 px-4 py-10 text-center text-[13px] text-ink-300">
            {roomsWithFiles.length === 0
              ? 'No captures filed for this date.'
              : 'No rooms selected — open the filter to choose which rooms to show.'}
          </div>
        )}
        {response &&
          visibleRooms.map((room) => {
            const group = pickGroup(response.rooms, room) ?? emptyGroup();
            const files = filesForTab(group, tab);
            const total =
              group.images.length + group.videos.length + group.pointclouds.length + group.pdfs.length;
            return (
              <RoomSection
                key={room.id}
                roomName={room.name}
                roomSlug={room.slug}
                date={date}
                files={files}
                total={total}
                isAdmin={isAdmin}
                onDelete={setPendingDelete}
              />
            );
          })}
      </div>

      <DeleteConfirm
        file={pendingDelete}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

function pickGroup(
  rooms: Record<string, ApiRoomMediaGroup>,
  room: ApiRoom,
): ApiRoomMediaGroup | null {
  // The mock client keys explorer-by-date by room display name; tolerate either form.
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

function RoomSection({
  roomName,
  roomSlug,
  date,
  files,
  total,
  isAdmin,
  onDelete,
}: {
  roomName: string;
  roomSlug: string;
  date: string;
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
            {roomName}
          </h2>
          <p className="mt-0.5 font-mono text-[11px] text-ink-300">
            {total} captures · {roomSlug}
          </p>
        </div>
      </div>
      <FileGrid
        files={files}
        roomSlug={roomSlug}
        date={date}
        origin="project"
        isAdmin={isAdmin}
        onDelete={onDelete}
      />
    </section>
  );
}

function Uploader({
  rooms,
  captureDate,
  onUploaded,
}: {
  rooms: ApiRoom[];
  captureDate: string;
  onUploaded: () => void;
}) {
  const [roomSlug, setRoomSlug] = useState(rooms[0]?.slug ?? '');
  useEffect(() => {
    if (!roomSlug && rooms.length) setRoomSlug(rooms[0].slug);
  }, [roomSlug, rooms]);

  if (!rooms.length || !roomSlug) return null;

  return (
    <div className="rounded-lg border border-base-800 bg-base-900/30 p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-300">
          Target room
        </span>
        <select
          value={roomSlug}
          onChange={(e) => setRoomSlug(e.target.value)}
          className="rounded-md border border-base-700 bg-base-950 px-2.5 py-1.5 text-[13px] text-white outline-none focus:border-amber-500"
        >
          {rooms.map((r) => (
            <option key={r.id} value={r.slug}>
              {r.name}
            </option>
          ))}
        </select>
      </div>
      <UploadZone roomSlug={roomSlug} captureDate={captureDate} onUploaded={onUploaded} />
    </div>
  );
}
