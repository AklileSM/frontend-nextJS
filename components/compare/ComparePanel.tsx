'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { motion } from 'framer-motion';
import { jsPDF } from 'jspdf';
import { toast } from 'sonner';
import {
  ArrowLeft,
  CalendarDays,
  Camera,
  ChevronLeft,
  ChevronRight,
  GitCompareArrows,
  Loader2,
  Trash2,
  X,
} from 'lucide-react';
import {
  createComparisonDraft,
  deleteComparisonDraft,
  getComparisonDraft,
  getExplorerByRoom,
  listComparisonDrafts,
  listProjectRooms,
  listProjects,
  publishComparisonDrafts,
  updateComparisonDraft,
} from '@/services/apiClient';
import type { ApiComparisonDraft, ApiMediaFile, ApiProject, ApiRoom, MediaType } from '@/types/api';

// ── Types ─────────────────────────────────────────────────────────────────────

type Side = 'left' | 'right';

type CompareState = {
  roomSlug: string | null;
  leftFileId: string | null;
  rightFileId: string | null;
  leftDate: string | null;
  rightDate: string | null;
  mediaType: MediaType;
  leftNotes: string;
  rightNotes: string;
  leftFlags: string[];
  rightFlags: string[];
};

type RoomDates = Record<string, {
  images: ApiMediaFile[];
  videos: ApiMediaFile[];
  pointclouds: ApiMediaFile[];
  pdfs: ApiMediaFile[];
}>;

const MEDIA_LABELS: Record<MediaType, string> = {
  image: 'Images',
  video: 'Videos',
  pointcloud: 'Point clouds',
  pdf: 'PDFs',
};

const FLAG_OPTIONS = [
  { id: 'safety', label: 'Safety concern' },
  { id: 'quality', label: 'Quality issue' },
  { id: 'delayed', label: 'Schedule delayed' },
] as const;

// ── CompareDateCalendar ───────────────────────────────────────────────────────

function CompareDateCalendar({
  availableDates,
  selected,
  onSelect,
}: {
  availableDates: ReadonlySet<string>;
  selected: string;
  onSelect: (date: string) => void;
}) {
  const [cursor, setCursor] = useState<Date>(() => {
    if (selected) return startOfMonth(new Date(selected + 'T00:00:00'));
    const sorted = [...availableDates].sort();
    return sorted.length > 0
      ? startOfMonth(new Date(sorted.at(-1)! + 'T00:00:00'))
      : startOfMonth(new Date());
  });

  useEffect(() => {
    if (selected) setCursor(startOfMonth(new Date(selected + 'T00:00:00')));
  }, [selected]);

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setCursor((c) => addMonths(c, -1))}
          className="rounded p-1 text-ink-400 transition-colors hover:bg-base-800 hover:text-white"
        >
          <ChevronLeft size={12} />
        </button>
        <span className="font-mono text-[11px] text-ink-300">{format(cursor, 'MMM yyyy')}</span>
        <button
          type="button"
          onClick={() => setCursor((c) => addMonths(c, 1))}
          className="rounded p-1 text-ink-400 transition-colors hover:bg-base-800 hover:text-white"
        >
          <ChevronRight size={12} />
        </button>
      </div>
      <div className="grid grid-cols-7">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <div key={i} className="py-0.5 text-center font-mono text-[9px] text-ink-600">{d}</div>
        ))}
        {days.map((day, i) => {
          const iso = format(day, 'yyyy-MM-dd');
          const inMonth = isSameMonth(day, cursor);
          const hasFiles = availableDates.has(iso);
          const isSelected = iso === selected;
          return (
            <button
              key={i}
              type="button"
              disabled={!hasFiles || !inMonth}
              onClick={() => onSelect(iso)}
              className={`relative flex h-6 w-full items-center justify-center rounded text-[11px] transition-colors ${
                !inMonth
                  ? 'cursor-default text-ink-800'
                  : isSelected
                  ? 'bg-amber-500 font-semibold text-base-950'
                  : hasFiles
                  ? 'cursor-pointer text-white hover:bg-base-800'
                  : 'cursor-default text-ink-700'
              }`}
            >
              {day.getDate()}
              {hasFiles && !isSelected && inMonth && (
                <span className="absolute bottom-0.5 left-1/2 h-0.5 w-0.5 -translate-x-1/2 rounded-full bg-amber-500" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── CompareThumbnailGrid ──────────────────────────────────────────────────────

function CompareThumbnailGrid({
  files,
  selectedId,
  onSelect,
}: {
  files: ApiMediaFile[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  if (files.length === 0) {
    return <p className="py-2 text-[11px] text-ink-600">No files for this date.</p>;
  }
  return (
    <div className="grid grid-cols-3 gap-1">
      {files.map((f) => {
        const isSelected = f.id === selectedId;
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => onSelect(f.id)}
            title={f.file_name}
            className={`relative aspect-square overflow-hidden rounded border-2 transition-colors ${
              isSelected ? 'border-amber-500' : 'border-transparent hover:border-base-600'
            }`}
          >
            {f.type === 'image' ? (
              <img src={f.src} alt={f.file_name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-base-800 px-1">
                <span className="line-clamp-2 text-center text-[9px] text-ink-400">{f.file_name}</span>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── SideViewer ────────────────────────────────────────────────────────────────

function SideViewer({ file }: { file: ApiMediaFile | null }) {
  if (!file) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <GitCompareArrows size={22} className="text-base-700" />
        <p className="text-[12px] text-ink-500">Pick a date and file</p>
      </div>
    );
  }
  const src = file.full_src || file.src;
  if (file.type === 'image') return <img src={src} alt={file.file_name} className="h-full w-full object-contain" />;
  if (file.type === 'video') return <video src={src} controls className="h-full w-full object-contain" />;
  if (file.type === 'pdf') return <iframe src={src} title={file.file_name} className="h-full w-full border-0" />;
  return <iframe src={`/potree/examples/viewer.html?url=${encodeURIComponent(src)}`} title={file.file_name} className="h-full w-full border-0" />;
}

// ── FlagCheckboxes ────────────────────────────────────────────────────────────

function FlagCheckboxes({
  values,
  onChange,
}: {
  values: ReadonlySet<string>;
  onChange: (next: Set<string>) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {FLAG_OPTIONS.map(({ id, label }) => {
        const checked = values.has(id);
        return (
          <button
            key={id}
            type="button"
            onClick={() => {
              const next = new Set(values);
              checked ? next.delete(id) : next.add(id);
              onChange(next);
            }}
            className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
              checked
                ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40'
                : 'border border-base-700 text-ink-400 hover:border-base-600 hover:text-white'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ── SnapshotModal ─────────────────────────────────────────────────────────────

function SnapshotModal({
  leftFile,
  rightFile,
  onClose,
}: {
  leftFile: ApiMediaFile | null;
  rightFile: ApiMediaFile | null;
  onClose: () => void;
}) {
  const download = (file: ApiMediaFile) => {
    const a = document.createElement('a');
    a.href = file.full_src || file.src;
    a.download = file.file_name;
    a.target = '_blank';
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="w-full max-w-4xl space-y-4 rounded-xl border border-base-700 bg-base-900 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[18px] font-semibold text-white">Snapshots</h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-ink-400 hover:text-white">
            <X size={16} />
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {([['Left', leftFile], ['Right', rightFile]] as [string, ApiMediaFile | null][]).map(([side, file]) => (
            <div key={side} className="space-y-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-amber-500">{side}</p>
              {file ? (
                <>
                  {file.type === 'image' ? (
                    <img
                      src={file.full_src || file.src}
                      alt={file.file_name}
                      className="max-h-[40vh] w-full rounded-lg bg-black/30 object-contain"
                    />
                  ) : (
                    <div className="flex h-32 items-center justify-center rounded-lg bg-base-800 text-[12px] text-ink-400">
                      {file.file_name}
                    </div>
                  )}
                  <p className="truncate text-[11px] text-ink-500">{file.file_name}</p>
                  <button
                    type="button"
                    onClick={() => download(file)}
                    className="rounded-md border border-base-700 px-3 py-1.5 text-[12px] text-white transition-colors hover:bg-base-800"
                  >
                    Download
                  </button>
                </>
              ) : (
                <p className="text-[12px] text-ink-500">No file selected.</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── ManageDraftsModal ─────────────────────────────────────────────────────────

function ManageDraftsModal({
  onClose,
  project,
}: {
  onClose: () => void;
  project: ApiProject | null;
}) {
  const [drafts, setDrafts] = useState<ApiComparisonDraft[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listComparisonDrafts()
      .then((ds) => {
        if (cancelled) return;
        setDrafts(ds);
        setSelected(new Set(ds.map((d) => d.id)));
      })
      .catch(() => toast.error('Could not load drafts.'))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await deleteComparisonDraft(id);
      setDrafts((prev) => prev.filter((d) => d.id !== id));
      setSelected((prev) => { const s = new Set(prev); s.delete(id); return s; });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete draft.');
    } finally {
      setDeleting(null);
    }
  };

  const handlePublish = async () => {
    if (selected.size === 0) return;
    const draftIds = [...selected];
    const first = drafts.find((d) => draftIds.includes(d.id));
    if (!first) return;
    setPublishing(true);
    try {
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text('SiteScope Consolidated Comparison Report', 14, 18);
      doc.setFontSize(11);
      doc.text(`Project: ${project?.name ?? '—'}`, 14, 28);
      doc.text(`Drafts included: ${draftIds.length}`, 14, 36);
      let y = 46;
      for (const id of draftIds) {
        const d = drafts.find((x) => x.id === id);
        if (!d) continue;
        doc.text(
          `• ${d.label ?? id.slice(0, 8)} — ${new Date(d.created_at).toLocaleDateString()}`,
          14, y, { maxWidth: 180 },
        );
        y += 8;
      }
      const pdfBlob = doc.output('blob');
      await publishComparisonDrafts({ pdfBlob, fileId: first.file_id, draftIds });
      toast.success('Consolidated comparison PDF published.');
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not publish.');
    } finally {
      setPublishing(false);
    }
  };

  const toggleAll = () => {
    setSelected(selected.size === drafts.length ? new Set() : new Set(drafts.map((d) => d.id)));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg space-y-4 rounded-xl border border-base-700 bg-base-900 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[18px] font-semibold text-white">Manage drafts</h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-ink-400 hover:text-white">
            <X size={16} />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 size={18} className="animate-spin text-ink-500" />
          </div>
        ) : drafts.length === 0 ? (
          <p className="text-[13px] text-ink-400">No saved drafts.</p>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleAll}
                className="text-[11px] text-ink-400 transition-colors hover:text-white"
              >
                {selected.size === drafts.length ? 'Deselect all' : 'Select all'}
              </button>
              <span className="text-[11px] text-ink-600">·</span>
              <span className="text-[11px] text-ink-500">{selected.size} of {drafts.length} selected</span>
            </div>
            <ul className="max-h-[40vh] space-y-1.5 overflow-y-auto">
              {drafts.map((d) => (
                <li key={d.id} className="flex items-center gap-2 rounded-lg border border-base-800 p-3">
                  <input
                    type="checkbox"
                    checked={selected.has(d.id)}
                    onChange={(e) => {
                      setSelected((prev) => {
                        const s = new Set(prev);
                        e.target.checked ? s.add(d.id) : s.delete(d.id);
                        return s;
                      });
                    }}
                    className="accent-amber-500"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] text-white">{d.label ?? 'Untitled draft'}</p>
                    <p className="text-[11px] text-ink-500">{new Date(d.created_at).toLocaleDateString()}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDelete(d.id)}
                    disabled={deleting === d.id}
                    className="rounded p-1 text-ink-600 transition-colors hover:text-red-400 disabled:opacity-50"
                  >
                    {deleting === d.id
                      ? <Loader2 size={12} className="animate-spin" />
                      : <Trash2 size={12} />}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-base-700 px-3 py-2 text-[13px] font-medium text-white transition-colors hover:bg-base-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handlePublish()}
            disabled={selected.size === 0 || publishing}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-[13px] font-semibold text-base-950 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {publishing ? <Loader2 size={13} className="animate-spin" /> : null}
            {publishing
              ? 'Publishing…'
              : `Publish${selected.size > 0 ? ` ${selected.size}` : ''} PDF`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ComparePanel ──────────────────────────────────────────────────────────────

export function ComparePanel() {
  const searchParams = useSearchParams();

  const paramSlug = searchParams.get('project');
  const storageSlug = (() => { try { return sessionStorage.getItem('sidebar.lastProjectSlug'); } catch { return null; } })();
  const projectSlug = paramSlug ?? storageSlug ?? null;

  const [project, setProject] = useState<ApiProject | null>(null);
  const [rooms, setRooms] = useState<ApiRoom[]>([]);
  const [loadingProject, setLoadingProject] = useState(true);

  const [byRoom, setByRoom] = useState<Record<string, RoomDates>>({});
  const [loadingRoom, setLoadingRoom] = useState(false);

  const [roomSlug, setRoomSlug] = useState('');
  const [mediaType, setMediaType] = useState<MediaType>('image');
  const [leftDate, setLeftDate] = useState('');
  const [rightDate, setRightDate] = useState('');
  const [leftFileId, setLeftFileId] = useState('');
  const [rightFileId, setRightFileId] = useState('');
  const [leftNotes, setLeftNotes] = useState('');
  const [rightNotes, setRightNotes] = useState('');
  const [leftFlags, setLeftFlags] = useState<Set<string>>(new Set());
  const [rightFlags, setRightFlags] = useState<Set<string>>(new Set());

  const [showSnapshotModal, setShowSnapshotModal] = useState(false);
  const [showManageDrafts, setShowManageDrafts] = useState(false);

  const [draftId, setDraftId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [hydratingDraft, setHydratingDraft] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load project + rooms
  useEffect(() => {
    if (!projectSlug) { setLoadingProject(false); return; }
    let cancelled = false;
    setLoadingProject(true);
    void (async () => {
      try {
        const projects = await listProjects();
        if (cancelled) return;
        const found = projects.find((p) => p.slug === projectSlug) ?? null;
        setProject(found);
        if (!found) return;
        const rs = await listProjectRooms(found.id);
        if (cancelled) return;
        setRooms(rs);
        if (rs[0]) setRoomSlug(rs[0].slug);
      } catch (err) {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Could not load project data.');
      } finally {
        if (!cancelled) setLoadingProject(false);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectSlug]);

  // Lazy-load room files when roomSlug changes
  useEffect(() => {
    if (!roomSlug || byRoom[roomSlug]) return;
    let cancelled = false;
    setLoadingRoom(true);
    getExplorerByRoom(roomSlug)
      .then((res) => {
        if (!cancelled) setByRoom((prev) => ({ ...prev, [roomSlug]: res.dates || {} }));
      })
      .catch((err) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Could not load room files.');
      })
      .finally(() => { if (!cancelled) setLoadingRoom(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomSlug]);

  // Hydrate from ?draft= URL param
  useEffect(() => {
    const id = searchParams.get('draft');
    if (!id) return;
    let cancelled = false;
    setHydratingDraft(true);
    void (async () => {
      try {
        const d = await getComparisonDraft(id);
        if (cancelled) return;
        // backward-compat: old state used leftRoomSlug/rightRoomSlug
        const st = (d.state_json || {}) as Partial<CompareState & { leftRoomSlug?: string }>;
        setDraftId(d.id);
        setMediaType((st.mediaType as MediaType) || 'image');
        const slug = st.roomSlug ?? st.leftRoomSlug ?? '';
        if (slug) setRoomSlug(slug);
        setLeftDate(st.leftDate || '');
        setRightDate(st.rightDate || '');
        setLeftFileId(st.leftFileId || '');
        setRightFileId(st.rightFileId || '');
        setLeftNotes(st.leftNotes ?? d.manual_observations ?? '');
        setRightNotes(st.rightNotes ?? '');
        setLeftFlags(new Set(st.leftFlags ?? d.flags ?? []));
        setRightFlags(new Set(st.rightFlags ?? []));
        setDirty(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not load comparison draft.');
      } finally {
        if (!cancelled) setHydratingDraft(false);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Derived data
  const roomDates = byRoom[roomSlug] ?? {};
  const mediaKey = (
    mediaType === 'image' ? 'images'
    : mediaType === 'video' ? 'videos'
    : mediaType === 'pointcloud' ? 'pointclouds'
    : 'pdfs'
  ) as 'images' | 'videos' | 'pointclouds' | 'pdfs';

  const availableDates = useMemo<ReadonlySet<string>>(
    () => new Set(
      Object.entries(roomDates)
        .filter(([, g]) => g[mediaKey].length > 0)
        .map(([d]) => d),
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [roomDates, mediaKey],
  );

  const leftFiles = useMemo(
    () => (leftDate && roomDates[leftDate] ? roomDates[leftDate][mediaKey] : []),
    [leftDate, roomDates, mediaKey],
  );
  const rightFiles = useMemo(
    () => (rightDate && roomDates[rightDate] ? roomDates[rightDate][mediaKey] : []),
    [rightDate, roomDates, mediaKey],
  );

  const leftFile = leftFiles.find((f) => f.id === leftFileId) ?? null;
  const rightFile = rightFiles.find((f) => f.id === rightFileId) ?? null;
  const roomName = rooms.find((r) => r.slug === roomSlug)?.name ?? roomSlug;

  const draftLabel = useMemo(() => {
    if (!roomName) return null;
    const l = leftDate ? leftDate.slice(5) : '?';
    const r = rightDate ? rightDate.slice(5) : '?';
    return `${roomName}: ${l} vs ${r}`;
  }, [roomName, leftDate, rightDate]);

  const statePayload: CompareState = useMemo(() => ({
    roomSlug: roomSlug || null,
    leftFileId: leftFile?.id ?? null,
    rightFileId: rightFile?.id ?? null,
    leftDate: leftDate || null,
    rightDate: rightDate || null,
    mediaType,
    leftNotes,
    rightNotes,
    leftFlags: [...leftFlags],
    rightFlags: [...rightFlags],
  }), [roomSlug, leftFile, rightFile, leftDate, rightDate, mediaType, leftNotes, rightNotes, leftFlags, rightFlags]);

  const saveDraftNow = async () => {
    if (!statePayload.leftFileId) return;
    setSaving(true);
    const combinedNotes = [leftNotes, rightNotes].filter(Boolean).join('\n\n---\n\n') || null;
    const combinedFlags = [...new Set([...leftFlags, ...rightFlags])];
    try {
      if (draftId) {
        await updateComparisonDraft({
          draftId,
          fileId: statePayload.leftFileId,
          label: draftLabel,
          manualObservations: combinedNotes,
          flags: combinedFlags,
          state: statePayload as unknown as Record<string, unknown>,
        });
      } else {
        const created = await createComparisonDraft({
          fileId: statePayload.leftFileId,
          label: draftLabel,
          manualObservations: combinedNotes,
          flags: combinedFlags,
          state: statePayload as unknown as Record<string, unknown>,
        });
        setDraftId(created.id);
      }
      setDirty(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save comparison draft.');
    } finally {
      setSaving(false);
    }
  };

  // Auto-save debounce
  useEffect(() => {
    setDirty(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { void saveDraftNow(); }, 1200);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leftFileId, rightFileId, roomSlug, mediaType, leftNotes, rightNotes, leftFlags, rightFlags]);

  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);

  useEffect(() => {
    const clickHandler = (event: MouseEvent) => {
      if (!dirty) return;
      const anchor = (event.target as HTMLElement | null)?.closest('a') as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute('href') || '';
      if (!href.startsWith('/')) return;
      if (window.confirm('You have unsaved comparison changes. Leave this page?')) return;
      event.preventDefault();
      event.stopPropagation();
    };
    document.addEventListener('click', clickHandler, true);
    return () => document.removeEventListener('click', clickHandler, true);
  }, [dirty]);

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!loadingProject && !project) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-16 text-center">
        <GitCompareArrows size={28} className="text-ink-500" />
        <p className="font-display text-[18px] font-semibold text-white">No project selected</p>
        <p className="max-w-[36ch] text-[13px] leading-relaxed text-ink-400">
          Open a project first, then click Compare to scope the viewer to that project&apos;s rooms.
        </p>
        <Link
          href="/projects"
          className="mt-2 rounded-md bg-amber-500 px-4 py-2 text-[13px] font-semibold text-base-950 hover:bg-amber-400"
        >
          Go to projects
        </Link>
      </div>
    );
  }

  const draftStatus = hydratingDraft
    ? 'Loading draft…'
    : saving ? 'Autosaving…'
    : dirty ? 'Unsaved changes'
    : draftId ? 'Saved'
    : 'Not saved yet';

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-base-800 bg-base-900/40 px-5 py-4"
      >
        <div>
          <p className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-amber-500">
            <GitCompareArrows size={11} />
            {project?.name ?? '—'}
          </p>
          <h1 className="mt-1 font-display text-[24px] font-semibold leading-tight tracking-[-0.015em] text-white">
            Compare
          </h1>
        </div>
        <Link
          href={project ? `/app/projects/${project.slug}` : '/projects'}
          className="inline-flex items-center gap-1.5 rounded-md border border-base-700 bg-base-900 px-3 py-1.5 text-[12px] font-medium text-ink-200 transition-colors hover:border-base-600 hover:bg-base-800 hover:text-white"
        >
          <ArrowLeft size={12} />
          Back to {project?.name ?? 'projects'}
        </Link>
      </motion.div>

      {loadingProject ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={20} className="animate-spin text-ink-500" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* ── Main area ── */}
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-4"
          >
            {/* Room picker */}
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-base-800 bg-base-900/40 px-4 py-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">Room</span>
              <select
                value={roomSlug}
                onChange={(e) => {
                  setRoomSlug(e.target.value);
                  setLeftDate('');
                  setRightDate('');
                  setLeftFileId('');
                  setRightFileId('');
                }}
                className="rounded-lg border border-base-700 bg-base-950/60 px-3 py-1.5 text-[13px] text-white transition-colors focus:border-base-600 focus:outline-none"
              >
                {rooms.map((r) => (
                  <option key={r.id} value={r.slug}>{r.name}</option>
                ))}
              </select>
              {loadingRoom && <Loader2 size={13} className="animate-spin text-ink-400" />}
            </div>

            {/* Per-side date calendar + thumbnail picker */}
            <div className="grid gap-3 sm:grid-cols-2">
              {(['left', 'right'] as Side[]).map((side) => {
                const date = side === 'left' ? leftDate : rightDate;
                const setDate = side === 'left' ? setLeftDate : setRightDate;
                const fileId = side === 'left' ? leftFileId : rightFileId;
                const setFileId = side === 'left' ? setLeftFileId : setRightFileId;
                const files = side === 'left' ? leftFiles : rightFiles;

                return (
                  <div key={side} className="space-y-3 rounded-xl border border-base-800 bg-base-900/40 p-4">
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-500">
                      {side === 'left' ? 'Left panel' : 'Right panel'}
                    </p>

                    <div>
                      <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-ink-400">
                        <CalendarDays size={10} />
                        Date
                      </label>
                      <CompareDateCalendar
                        availableDates={availableDates}
                        selected={date}
                        onSelect={(d) => { setDate(d); setFileId(''); }}
                      />
                    </div>

                    {date && (
                      <div>
                        <label className="mb-1.5 block text-[11px] font-medium text-ink-400">File</label>
                        <CompareThumbnailGrid
                          files={files}
                          selectedId={fileId}
                          onSelect={setFileId}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Media type tabs + snapshot button */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-base-800 bg-base-900/40 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">Type</span>
                {(Object.entries(MEDIA_LABELS) as [MediaType, string][]).map(([t, label]) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => { setMediaType(t); setLeftFileId(''); setRightFileId(''); }}
                    className={`rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ${
                      mediaType === t
                        ? 'bg-amber-500 text-base-950'
                        : 'border border-base-700 text-ink-300 hover:border-base-600 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setShowSnapshotModal(true)}
                disabled={!leftFile && !rightFile}
                className="inline-flex items-center gap-1.5 rounded-md border border-base-700 px-3 py-1.5 text-[12px] font-medium text-ink-300 transition-colors hover:border-base-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Camera size={13} />
                Snapshot both
              </button>
            </div>

            {/* Dual viewer */}
            <div className="grid h-[55vh] gap-3 rounded-xl border border-base-800 bg-base-900/20 p-3 sm:grid-cols-2">
              <div className="overflow-hidden rounded-lg border border-base-800 bg-black/30">
                <SideViewer file={leftFile} />
              </div>
              <div className="overflow-hidden rounded-lg border border-base-800 bg-black/30">
                <SideViewer file={rightFile} />
              </div>
            </div>
          </motion.section>

          {/* ── Draft sidebar ── */}
          <motion.aside
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-4 rounded-xl border border-base-800 bg-base-900/40 p-5"
          >
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-500">Draft</p>
              <h2 className="mt-1 font-display text-[18px] font-semibold text-white">Field notes</h2>
              <p className="mt-0.5 font-mono text-[11px] text-ink-500">{draftStatus}</p>
            </div>

            {/* Left side notes + flags */}
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-ink-400">Left observations</label>
              <textarea
                value={leftNotes}
                onChange={(e) => setLeftNotes(e.target.value)}
                rows={4}
                placeholder="Notes on the left capture…"
                className="w-full rounded-lg border border-base-700 bg-base-950/60 px-3 py-2.5 text-[13px] text-white placeholder-ink-600 transition-colors focus:border-base-600 focus:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-[11px] font-medium text-ink-400">Left flags</label>
              <FlagCheckboxes values={leftFlags} onChange={setLeftFlags} />
            </div>

            <div className="border-t border-base-800" />

            {/* Right side notes + flags */}
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-ink-400">Right observations</label>
              <textarea
                value={rightNotes}
                onChange={(e) => setRightNotes(e.target.value)}
                rows={4}
                placeholder="Notes on the right capture…"
                className="w-full rounded-lg border border-base-700 bg-base-950/60 px-3 py-2.5 text-[13px] text-white placeholder-ink-600 transition-colors focus:border-base-600 focus:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-[11px] font-medium text-ink-400">Right flags</label>
              <FlagCheckboxes values={rightFlags} onChange={setRightFlags} />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => void saveDraftNow()}
                disabled={saving}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-base-700 px-3 py-2 text-[13px] font-medium text-white transition-colors hover:border-base-600 hover:bg-base-800 disabled:opacity-50"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : null}
                {saving ? 'Saving…' : 'Save draft'}
              </button>
              <button
                type="button"
                onClick={() => setShowManageDrafts(true)}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-[13px] font-semibold text-base-950 transition-colors hover:bg-amber-400"
              >
                Publish PDF
              </button>
            </div>

            {draftId && (
              <p className="font-mono text-[10px] text-ink-600">Draft · {draftId.slice(0, 8)}…</p>
            )}
          </motion.aside>
        </div>
      )}

      {showSnapshotModal && (
        <SnapshotModal
          leftFile={leftFile}
          rightFile={rightFile}
          onClose={() => setShowSnapshotModal(false)}
        />
      )}

      {showManageDrafts && (
        <ManageDraftsModal
          onClose={() => setShowManageDrafts(false)}
          project={project}
        />
      )}
    </div>
  );
}
