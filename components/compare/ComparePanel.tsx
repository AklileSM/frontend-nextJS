'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
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
import { PDFDocument } from 'pdf-lib';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Box,
  CalendarDays,
  Camera,
  ChevronLeft,
  ChevronRight,
  FileText,
  GitCompareArrows,
  Image as ImageIcon,
  Link2,
  Link2Off,
  Loader2,
  Trash2,
  Video as VideoIcon,
  X,
} from 'lucide-react';
import { MediaTabs, type MediaTab } from '@/components/explorer/MediaTabs';
import Compare360Viewer, { type CameraSyncState } from './Compare360Viewer';
import {
  API_BASE,
  createComparisonDraft,
  deleteComparisonDraft,
  getComparisonDraft,
  getExplorerByDate,
  getExplorerDatesSummaryForProject,
  listComparisonDrafts,
  listProjects,
  publishComparisonDrafts,
  updateComparisonDraft,
} from '@/services/apiClient';
import { getAccessToken } from '@/auth/authSession';
import {
  buildCompareDraftPdfBlob,
  isCompareDraftStateV1,
  type CompareDraftSideV1,
  type CompareDraftStateV1,
} from '@/lib/compareDraftPdfFromState';
import { flagsFromObservationBooleans } from '@/lib/observationReportFlags';
import type { ApiComparisonDraft, ApiMediaFile, ApiProject, ApiRoomMediaGroup } from '@/types/api';

// ── Types ─────────────────────────────────────────────────────────────────────

type Side = 'left' | 'right';
type PanelState = 'calendar' | 'explorer' | 'viewer360' | 'viewerPCD';

type FileSelection = {
  fileUrl: string;
  fileId: string;
  displayFileName: string;
  roomSlug: string;
  roomLabel: string;
  captureDate: string;
  mediaType: string;
  isPCD: boolean;
};

type ScreenshotNotes = { images: string[]; text: string };
type SideFlags = { safety: boolean; quality: boolean; delayed: boolean };
type NoticeState = { title: string; message: string; variant: 'info' | 'error' };

// ── Helpers ───────────────────────────────────────────────────────────────────

function draftSavedDayKeyLocal(iso: string): string {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return '';
  const y = t.getFullYear();
  const m = String(t.getMonth() + 1).padStart(2, '0');
  const d = String(t.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatLocalDayMedium(dateKey: string): string {
  const [y, mo, day] = dateKey.split('-').map(Number);
  if (!y || !mo || !day) return dateKey;
  return new Date(y, mo - 1, day).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

function isPCDUrl(url: string): boolean {
  return /\.(glb|obj|e57|las|laz|ply)(\?|$)/i.test(url.split('?')[0]);
}

// ── CompareCalendar ───────────────────────────────────────────────────────────

function CompareCalendar({
  availableDates,
  onDateSelect,
}: {
  availableDates: ReadonlySet<string>;
  onDateSelect: (date: string) => void;
}) {
  const [cursor, setCursor] = useState<Date>(() => {
    const sorted = [...availableDates].sort();
    return sorted.length > 0
      ? startOfMonth(new Date(sorted.at(-1)! + 'T00:00:00'))
      : startOfMonth(new Date());
  });

  const monthStart = startOfMonth(cursor);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  return (
    <div className="flex h-full flex-col items-center justify-center p-6">
      <div className="w-full max-w-[280px] space-y-3">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setCursor((c) => addMonths(c, -1))}
            className="rounded p-1.5 text-ink-400 transition-colors hover:bg-base-800 hover:text-white"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="font-mono text-[13px] font-medium text-white">{format(cursor, 'MMMM yyyy')}</span>
          <button
            type="button"
            onClick={() => setCursor((c) => addMonths(c, 1))}
            className="rounded p-1.5 text-ink-400 transition-colors hover:bg-base-800 hover:text-white"
          >
            <ChevronRight size={14} />
          </button>
        </div>
        <div className="grid grid-cols-7 text-center">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <div key={i} className="py-1 font-mono text-[10px] text-ink-600">{d}</div>
          ))}
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
                className={`relative flex h-8 w-full items-center justify-center rounded text-[12px] transition-colors ${
                  !inMonth
                    ? 'cursor-default text-ink-800'
                    : hasFiles
                    ? 'cursor-pointer text-white hover:bg-amber-500 hover:text-base-950'
                    : 'cursor-default text-ink-700'
                }`}
              >
                {day.getDate()}
                {hasFiles && inMonth && (
                  <span className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-amber-500" />
                )}
              </button>
            );
          })}
        </div>
        <p className="text-center font-mono text-[11px] text-ink-600">Select a date to browse files</p>
      </div>
    </div>
  );
}

// ── Type metadata for picker thumbnails ──────────────────────────────────────

const PICKER_TYPE_META: Record<string, {
  label: string;
  gradient: string;
  tint: string;
  Icon: typeof ImageIcon;
}> = {
  image:      { label: 'IMG', gradient: 'from-amber-500/20 via-amber-500/5 to-base-900',   tint: 'text-amber-500',  Icon: ImageIcon  },
  video:      { label: 'VID', gradient: 'from-steel-500/25 via-steel-500/5 to-base-900',   tint: 'text-steel-400',  Icon: VideoIcon  },
  pointcloud: { label: 'PCD', gradient: 'from-violet-500/25 via-violet-500/5 to-base-900', tint: 'text-violet-300', Icon: Box        },
  pdf:        { label: 'PDF', gradient: 'from-base-700/60 via-base-800 to-base-900',        tint: 'text-ink-200',    Icon: FileText   },
};

// ── PickerThumbnail ───────────────────────────────────────────────────────────

function PickerThumbnail({
  file,
  disabled,
  index = 0,
  onPick,
}: {
  file: ApiMediaFile;
  disabled: boolean;
  index?: number;
  onPick: () => void;
}) {
  const [thumbFailed, setThumbFailed] = useState(false);
  const meta = PICKER_TYPE_META[file.type] ?? PICKER_TYPE_META.image;
  const showThumb = !thumbFailed && (file.type === 'image' || file.type === 'video' || file.type === 'pdf') && !!file.src;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.36), ease: [0.22, 1, 0.36, 1] }}
      whileHover={!disabled ? { y: -3 } : {}}
      onClick={!disabled ? onPick : undefined}
      className={`group relative overflow-hidden rounded-lg border transition-colors ${
        disabled
          ? 'cursor-not-allowed border-amber-500/50 opacity-50'
          : 'cursor-pointer border-base-800 hover:border-amber-500/40'
      }`}
    >
      <div className={`relative aspect-[4/3] bg-gradient-to-br ${meta.gradient}`}>

        {/* Real thumbnail */}
        {showThumb && (
          <img
            src={file.src}
            alt={file.file_name}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
            onError={() => setThumbFailed(true)}
          />
        )}

        {/* Icon fallback */}
        {!showThumb && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5">
            <meta.Icon size={36} strokeWidth={1.25} className={meta.tint} />
            <span className={`font-mono text-[9px] font-semibold uppercase tracking-[0.2em] opacity-60 ${meta.tint}`}>
              {meta.label}
            </span>
          </div>
        )}

        {/* PCD dot scatter */}
        {file.type === 'pointcloud' && (
          <span className="pointer-events-none absolute inset-3 grid grid-cols-8 gap-1 opacity-50">
            {Array.from({ length: 24 }).map((_, i) => (
              <span
                key={i}
                className="block h-0.5 w-0.5 rounded-full bg-amber-500/60"
                style={{ opacity: 0.3 + ((i * 13) % 7) * 0.1 }}
              />
            ))}
          </span>
        )}

        {/* Type badge — only when showing a real thumbnail */}
        {showThumb && (
          <span className="absolute right-1.5 top-1.5 rounded-sm bg-base-950/80 px-1.5 py-0.5 font-mono text-[9px] font-medium tracking-widest text-ink-200">
            {meta.label}
          </span>
        )}

        {/* IN USE badge */}
        {disabled && (
          <span className="absolute left-2 top-2 rounded-sm bg-amber-500/20 px-1.5 py-0.5 font-mono text-[9px] font-medium tracking-widest text-amber-400">
            IN USE
          </span>
        )}

        {/* Bottom info overlay */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-base-950/95 via-base-950/50 to-transparent px-2.5 pb-2.5 pt-8">
          <p className="truncate text-[11px] font-medium leading-snug text-white" title={file.file_name}>
            {file.file_name}
          </p>
          <p className="mt-0.5 font-mono text-[9px] text-ink-400">{file.capture_date}</p>
        </div>

      </div>
    </motion.div>
  );
}

// ── PanelFileExplorer ─────────────────────────────────────────────────────────

function PanelFileExplorer({
  selectedDate,
  disabledFileUrl,
  onFileSelect,
  onBackToCalendar,
  tabRailId,
}: {
  selectedDate: string;
  disabledFileUrl: string | null;
  onFileSelect: (sel: FileSelection) => void;
  onBackToCalendar: () => void;
  tabRailId: string;
}) {
  const [activeTab, setActiveTab] = useState<MediaTab>('images');
  const [selectedRoomSlug, setSelectedRoomSlug] = useState<string | null>(null);
  const [roomsForDate, setRoomsForDate] = useState<Record<string, ApiRoomMediaGroup>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset selections on date change
  useEffect(() => {
    setSelectedRoomSlug(null);
    setActiveTab('images');
  }, [selectedDate]);

  useEffect(() => {
    if (!selectedDate) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getExplorerByDate(selectedDate)
      .then((res) => { if (!cancelled) setRoomsForDate(res.rooms || {}); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load files.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [selectedDate]);

  const roomSlugs = Object.keys(roomsForDate);

  const tabCounts = useMemo((): Record<MediaTab, number> => {
    const result = { images: 0, videos: 0, pointclouds: 0, pdfs: 0 };
    const entries = selectedRoomSlug
      ? (roomsForDate[selectedRoomSlug] ? [[selectedRoomSlug, roomsForDate[selectedRoomSlug]] as const] : [])
      : (Object.entries(roomsForDate) as [string, ApiRoomMediaGroup][]);
    for (const [, m] of entries) {
      result.images      += m.images?.length ?? 0;
      result.videos      += m.videos?.length ?? 0;
      result.pointclouds += m.pointclouds?.length ?? 0;
      result.pdfs        += m.pdfs?.length ?? 0;
    }
    return result;
  }, [roomsForDate, selectedRoomSlug]);

  const displayedFiles = useMemo((): ApiMediaFile[] => {
    const slugs = selectedRoomSlug ? [selectedRoomSlug] : Object.keys(roomsForDate);
    return slugs.flatMap((slug) => roomsForDate[slug]?.[activeTab] ?? []);
  }, [roomsForDate, selectedRoomSlug, activeTab]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-base-800 px-4 py-3">
        <span className="font-mono text-[13px] font-medium text-white">{selectedDate}</span>
        <button
          type="button"
          onClick={onBackToCalendar}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-ink-400 transition-colors hover:bg-base-800 hover:text-white"
        >
          <CalendarDays size={11} />
          Calendar
        </button>
      </div>

      {/* Room chips */}
      {roomSlugs.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto border-b border-base-800 px-3 py-2 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedRoomSlug(null)}
            className={`shrink-0 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
              selectedRoomSlug === null
                ? 'bg-amber-500/15 text-amber-400'
                : 'text-ink-400 hover:bg-base-800 hover:text-white'
            }`}
          >
            All
          </button>
          {roomSlugs.map((slug) => (
            <button
              key={slug}
              type="button"
              onClick={() => setSelectedRoomSlug(slug === selectedRoomSlug ? null : slug)}
              className={`shrink-0 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                selectedRoomSlug === slug
                  ? 'bg-amber-500/15 text-amber-400'
                  : 'text-ink-400 hover:bg-base-800 hover:text-white'
              }`}
            >
              {slug}
            </button>
          ))}
        </div>
      )}

      {/* Media tabs */}
      <div className="border-b border-base-800 px-3 py-3">
        <MediaTabs
          active={activeTab}
          counts={tabCounts}
          onChange={setActiveTab}
          railId={tabRailId}
        />
      </div>

      {/* File grid */}
      <div className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 size={18} className="animate-spin text-ink-500" />
          </div>
        ) : error ? (
          <p className="py-4 text-center text-[12px] text-red-400">{error}</p>
        ) : displayedFiles.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <p className="text-[12px] font-medium text-ink-400">No {activeTab} here</p>
            <p className="text-[11px] text-ink-600">
              {roomSlugs.length === 0 ? 'No files for this date.' : 'Try a different room or media type.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {displayedFiles.map((file, i) => {
              const url = file.full_src || file.src;
              const isDisabled = url === disabledFileUrl;
              const isPcd = file.type === 'pointcloud' || isPCDUrl(url);
              const roomSlug = selectedRoomSlug ?? roomSlugs.find(
                (s) => roomsForDate[s]?.[activeTab]?.some((f) => f.id === file.id)
              ) ?? '';
              return (
                <PickerThumbnail
                  key={file.id}
                  file={file}
                  disabled={isDisabled}
                  index={i}
                  onPick={() => {
                    if (file.type === 'pdf') {
                      window.open(url, '_blank', 'noopener,noreferrer');
                      return;
                    }
                    onFileSelect({
                      fileUrl: url,
                      fileId: file.id,
                      displayFileName: file.file_name,
                      roomSlug,
                      roomLabel: roomSlug,
                      captureDate: file.capture_date,
                      mediaType: file.type,
                      isPCD: isPcd,
                    });
                  }}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── ComparePanel ──────────────────────────────────────────────────────────────

export function ComparePanel() {
  const searchParams = useSearchParams();
  const paramSlug = searchParams.get('project');
  const storageSlug = (() => {
    try { return sessionStorage.getItem('sidebar.lastProjectSlug'); } catch { return null; }
  })();
  const projectSlug = paramSlug ?? storageSlug ?? null;

  // Project + dates
  const [project, setProject] = useState<ApiProject | null>(null);
  const [loadingProject, setLoadingProject] = useState(true);
  const [availableDates, setAvailableDates] = useState<ReadonlySet<string>>(new Set());

  // Per-side panel state machine
  const [leftPanel, setLeftPanel] = useState<PanelState>('calendar');
  const [rightPanel, setRightPanel] = useState<PanelState>('calendar');
  const [leftSelectedDate, setLeftSelectedDate] = useState<string | null>(null);
  const [rightSelectedDate, setRightSelectedDate] = useState<string | null>(null);
  const [leftFile, setLeftFile] = useState<FileSelection | null>(null);
  const [rightFile, setRightFile] = useState<FileSelection | null>(null);

  // Camera sync
  const [isSynchronized, setIsSynchronized] = useState(false);
  const [lockLeader, setLockLeader] = useState<Side | null>(null);
  const [sharedCameraState, setSharedCameraState] = useState<CameraSyncState | null>(null);
  const [lastLeftCameraState, setLastLeftCameraState] = useState<CameraSyncState | null>(null);
  const [lastRightCameraState, setLastRightCameraState] = useState<CameraSyncState | null>(null);

  // Screenshot callbacks — stored via setState(() => fn) so functions are not called as lazy initializers
  const [leftTakeScreenshot, setLeftTakeScreenshot] = useState<(() => string | null) | null>(null);
  const [rightTakeScreenshot, setRightTakeScreenshot] = useState<(() => string | null) | null>(null);

  // Screenshot modal
  const [isScreenshotModalOpen, setIsScreenshotModalOpen] = useState(false);
  const [leftScreenshot, setLeftScreenshot] = useState<string | null>(null);
  const [rightScreenshot, setRightScreenshot] = useState<string | null>(null);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  // Bottom section (progressive disclosure)
  const [isBottomSectionVisible, setIsBottomSectionVisible] = useState(false);
  const [leftNotes, setLeftNotes] = useState('');
  const [rightNotes, setRightNotes] = useState('');
  const [leftAnnex, setLeftAnnex] = useState<ScreenshotNotes>({ images: [], text: '' });
  const [rightAnnex, setRightAnnex] = useState<ScreenshotNotes>({ images: [], text: '' });
  const [leftFlags, setLeftFlags] = useState<SideFlags>({ safety: false, quality: false, delayed: false });
  const [rightFlags, setRightFlags] = useState<SideFlags>({ safety: false, quality: false, delayed: false });

  // Draft
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [comparisonDrafts, setComparisonDrafts] = useState<ApiComparisonDraft[]>([]);
  const [saveDraftBusy, setSaveDraftBusy] = useState(false);

  // Publish modal
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [publishSelectedIds, setPublishSelectedIds] = useState<string[]>([]);
  const [publishFilterDateKeys, setPublishFilterDateKeys] = useState<string[]>([]);
  const [publishBusy, setPublishBusy] = useState(false);
  const [publishModalLoading, setPublishModalLoading] = useState(false);

  // Dialogs
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [isBackModalOpen, setIsBackModalOpen] = useState(false);

  // Load project + available dates
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
        const summary = await getExplorerDatesSummaryForProject(found.id);
        if (cancelled) return;
        setAvailableDates(new Set(Object.keys(summary.dates)));
      } catch (e) {
        if (!cancelled) toast.error(e instanceof Error ? e.message : 'Could not load project.');
      } finally {
        if (!cancelled) setLoadingProject(false);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectSlug]);

  // Load drafts list on mount
  useEffect(() => {
    listComparisonDrafts().then(setComparisonDrafts).catch(() => {});
  }, []);

  // Hydrate from ?draft= URL param
  useEffect(() => {
    const draftQueryId = searchParams.get('draft');
    if (!draftQueryId) { setEditingDraftId(null); return; }
    let cancelled = false;

    void (async () => {
      try {
        const d = await getComparisonDraft(draftQueryId);
        if (cancelled) return;
        const raw = d.state_json;
        if (!isCompareDraftStateV1(raw)) {
          setNotice({
            title: 'Draft unavailable',
            message: 'This draft has no saved comparison session. Start a new comparison.',
            variant: 'info',
          });
          setEditingDraftId(null);
          return;
        }
        const s = raw;
        setLeftNotes(s.leftNotes);
        setRightNotes(s.rightNotes);
        setLeftAnnex({ ...s.leftAnnex });
        setRightAnnex({ ...s.rightAnnex });
        setLeftFlags({ ...s.leftFlags });
        setRightFlags({ ...s.rightFlags });

        const applySide = (side: CompareDraftSideV1 | null, which: Side) => {
          if (!side) return;
          const url = side.fileUrl || `${API_BASE}/files/${side.fileId}/content`;
          const usePcd = side.viewerKind === 'pcd' || side.mediaType === 'pointcloud' || isPCDUrl(url);
          const sel: FileSelection = {
            fileUrl: url,
            fileId: side.fileId,
            displayFileName: side.displayFileName,
            roomSlug: side.roomLabel,
            roomLabel: side.roomLabel,
            captureDate: side.captureDate,
            mediaType: side.mediaType ?? (usePcd ? 'pointcloud' : 'image'),
            isPCD: usePcd,
          };
          if (which === 'left') {
            setLeftSelectedDate(side.captureDate.slice(0, 10) || null);
            setLeftFile(sel);
            setLeftPanel(usePcd ? 'viewerPCD' : 'viewer360');
          } else {
            setRightSelectedDate(side.captureDate.slice(0, 10) || null);
            setRightFile(sel);
            setRightPanel(usePcd ? 'viewerPCD' : 'viewer360');
          }
        };
        applySide(s.left, 'left');
        applySide(s.right, 'right');
        setIsBottomSectionVisible(true);
        setEditingDraftId(d.id);
      } catch (e) {
        if (!cancelled) {
          setNotice({
            title: 'Error',
            message: e instanceof Error ? e.message : 'Could not load comparison draft.',
            variant: 'error',
          });
        }
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Camera sync
  const toggleSynchronization = () => {
    setIsSynchronized((prev) => {
      const next = !prev;
      if (next) {
        const seed = lastLeftCameraState ?? lastRightCameraState;
        if (seed) {
          setSharedCameraState({ ...seed, source: lastLeftCameraState ? 'left' : 'right', seq: seed.seq + 1 });
          setLockLeader(lastLeftCameraState ? 'left' : 'right');
        }
      } else {
        setLockLeader(null);
      }
      return next;
    });
  };

  const handleCameraStateChange = useCallback(
    (side: Side, state: { position: [number, number, number]; target: [number, number, number] }) => {
      const full: CameraSyncState = { ...state, source: side, seq: Date.now() };
      if (side === 'left') setLastLeftCameraState(full);
      else setLastRightCameraState(full);
      if (!isSynchronized) return;
      if (lockLeader && lockLeader !== side) return;
      if (!lockLeader) setLockLeader(side);
      setSharedCameraState(full);
    },
    [isSynchronized, lockLeader],
  );

  const handleLeftScreenshotAssignment = useCallback((fn: () => string | null) => {
    setLeftTakeScreenshot(() => fn);
  }, []);

  const handleRightScreenshotAssignment = useCallback((fn: () => string | null) => {
    setRightTakeScreenshot(() => fn);
  }, []);

  // File selection with room validation
  const handleFileSelect = (side: Side, sel: FileSelection) => {
    const other = side === 'left' ? rightFile : leftFile;
    if (sel.fileUrl === other?.fileUrl) {
      setNotice({ title: 'Cannot select', message: 'This file is already selected for the other view.', variant: 'info' });
      return;
    }
    if (other && other.roomSlug !== sel.roomSlug) {
      setNotice({ title: 'Cannot compare', message: 'Please select files from the same room.', variant: 'info' });
      return;
    }
    if (side === 'left') {
      setLeftFile(sel);
      setLeftPanel(sel.isPCD ? 'viewerPCD' : 'viewer360');
    } else {
      setRightFile(sel);
      setRightPanel(sel.isPCD ? 'viewerPCD' : 'viewer360');
    }
  };

  const handleCloseViewer = (side: Side) => {
    if (side === 'left') {
      setLeftFile(null);
      setLeftPanel(leftSelectedDate ? 'explorer' : 'calendar');
    } else {
      setRightFile(null);
      setRightPanel(rightSelectedDate ? 'explorer' : 'calendar');
    }
  };

  // Snapshot & Compare
  const handleSnapshot = () => {
    setIsBottomSectionVisible(true);
    const leftImg = leftTakeScreenshot?.();
    const rightImg = rightTakeScreenshot?.();
    if (leftImg && rightImg) {
      setLeftScreenshot(leftImg);
      setRightScreenshot(rightImg);
      setIsScreenshotModalOpen(true);
    }
    if (leftImg) setLeftAnnex((p) => ({ ...p, images: [...p.images, leftImg] }));
    if (rightImg) setRightAnnex((p) => ({ ...p, images: [...p.images, rightImg] }));
  };

  // Build draft state snapshot
  const buildCompareDraftState = (): CompareDraftStateV1 => ({
    version: 1,
    left: leftFile
      ? {
          captureDate: leftFile.captureDate,
          fileId: leftFile.fileId,
          fileUrl: leftFile.fileUrl,
          displayFileName: leftFile.displayFileName,
          roomLabel: leftFile.roomLabel,
          mediaType: leftFile.mediaType,
          viewerKind: leftFile.isPCD ? 'pcd' : '360',
        }
      : null,
    right: rightFile
      ? {
          captureDate: rightFile.captureDate,
          fileId: rightFile.fileId,
          fileUrl: rightFile.fileUrl,
          displayFileName: rightFile.displayFileName,
          roomLabel: rightFile.roomLabel,
          mediaType: rightFile.mediaType,
          viewerKind: rightFile.isPCD ? 'pcd' : '360',
        }
      : null,
    leftNotes,
    rightNotes,
    leftAnnex: { ...leftAnnex },
    rightAnnex: { ...rightAnnex },
    leftFlags,
    rightFlags,
  });

  const saveComparisonDraft = async () => {
    const primaryFileId = leftFile?.fileId ?? rightFile?.fileId;
    if (!primaryFileId) { toast.error('Select at least one file before saving.'); return; }
    setSaveDraftBusy(true);
    try {
      const state = buildCompareDraftState();
      const mergedNotes = [leftNotes, rightNotes].filter(Boolean).join('\n\n');
      const annexNotes = [leftAnnex.text, rightAnnex.text].filter(Boolean).join('\n\n');
      const manualObservations = [mergedNotes, annexNotes].filter(Boolean).join('\n\n') || null;
      const flags = flagsFromObservationBooleans(
        leftFlags.safety || rightFlags.safety,
        leftFlags.quality || rightFlags.quality,
        leftFlags.delayed || rightFlags.delayed,
      );
      if (editingDraftId) {
        const updated = await updateComparisonDraft({
          draftId: editingDraftId,
          fileId: primaryFileId,
          manualObservations,
          flags,
          state: state as unknown as Record<string, unknown>,
        });
        setComparisonDrafts((prev) => prev.map((x) => x.id === updated.id ? { ...x, ...updated } : x));
        setEditingDraftId(null);
        toast.success('Comparison draft updated.');
      } else {
        const draft = await createComparisonDraft({
          fileId: primaryFileId,
          manualObservations,
          flags,
          state: state as unknown as Record<string, unknown>,
        });
        setComparisonDrafts((prev) => [...prev, draft]);
        toast.success('Comparison draft saved.');
      }
      setLeftNotes('');
      setRightNotes('');
      setLeftAnnex({ images: [], text: '' });
      setRightAnnex({ images: [], text: '' });
      setLeftFlags({ safety: false, quality: false, delayed: false });
      setRightFlags({ safety: false, quality: false, delayed: false });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save comparison draft.');
    } finally {
      setSaveDraftBusy(false);
    }
  };

  // Publish helpers
  const publishAvailableDateKeys = useMemo(() => {
    const set = new Set<string>();
    for (const d of comparisonDrafts) { const k = draftSavedDayKeyLocal(d.created_at); if (k) set.add(k); }
    return [...set].sort();
  }, [comparisonDrafts]);

  const publishVisibleDrafts = useMemo(() => {
    if (!publishFilterDateKeys.length) return [];
    const allow = new Set(publishFilterDateKeys);
    return comparisonDrafts.filter((d) => allow.has(draftSavedDayKeyLocal(d.created_at)));
  }, [comparisonDrafts, publishFilterDateKeys]);

  const openPublishModal = async () => {
    setPublishModalLoading(true);
    try {
      const drafts = await listComparisonDrafts();
      setComparisonDrafts(drafts);
      const dayKeys = [...new Set(drafts.map((d) => draftSavedDayKeyLocal(d.created_at)).filter(Boolean))].sort();
      setPublishFilterDateKeys(dayKeys);
      setPublishSelectedIds(drafts.map((d) => d.id));
      setIsPublishModalOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not load comparison drafts.');
    } finally {
      setPublishModalLoading(false);
    }
  };

  const publishReportsWithIds = async (draftIds: string[]) => {
    const idSet = new Set(draftIds);
    const ordered = comparisonDrafts.filter((d) => idSet.has(d.id));
    if (!ordered.length) throw new Error('No matching drafts to publish.');
    const token = getAccessToken() ?? '';
    const consolidatedPdf = await PDFDocument.create();
    for (const draft of ordered) {
      let bytes: ArrayBuffer;
      if (draft.pdf_url) {
        const res = await fetch(draft.pdf_url, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error(`Failed to load draft PDF (${res.status})`);
        bytes = await res.arrayBuffer();
      } else {
        const detail = await getComparisonDraft(draft.id);
        const raw = detail.state_json;
        if (!isCompareDraftStateV1(raw)) {
          throw new Error(`Draft "${draft.label?.trim() || draft.id.slice(0, 8) + '…'}" has no saved comparison data.`);
        }
        const blob = buildCompareDraftPdfBlob(raw, {
          projectName: project?.name ?? 'Project',
          preparedBy: 'Inspector',
          issueDate: new Date(draft.created_at),
        });
        bytes = await blob.arrayBuffer();
      }
      const existing = await PDFDocument.load(bytes);
      const copied = await consolidatedPdf.copyPages(existing, existing.getPageIndices());
      copied.forEach((p) => consolidatedPdf.addPage(p));
    }
    const pdfBytes = await consolidatedPdf.save();
    const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
    const primaryFileId = ordered[0]?.file_id ?? leftFile?.fileId ?? rightFile?.fileId ?? comparisonDrafts[0]?.file_id;
    if (!primaryFileId) throw new Error('Cannot publish without a file reference.');
    await publishComparisonDrafts({ pdfBlob: blob, fileId: primaryFileId, draftIds: ordered.map((d) => d.id), filename: 'Consolidated_Comparison_Report.pdf', manualObservations: null, flags: [] });
    setComparisonDrafts((prev) => prev.filter((d) => !idSet.has(d.id)));
    setPublishSelectedIds([]);
    setIsPublishModalOpen(false);
    if (editingDraftId && idSet.has(editingDraftId)) setEditingDraftId(null);
    toast.success('Published consolidated comparison report.');
  };

  const handlePublishConfirm = async () => {
    if (!publishSelectedIds.length) { toast.error('Select at least one draft.'); return; }
    setPublishBusy(true);
    try { await publishReportsWithIds(publishSelectedIds); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Publish failed.'); }
    finally { setPublishBusy(false); }
  };

  // Empty state
  if (!loadingProject && !project) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-16 text-center">
        <GitCompareArrows size={28} className="text-ink-500" />
        <p className="font-display text-[18px] font-semibold text-white">No project selected</p>
        <p className="max-w-[36ch] text-[13px] leading-relaxed text-ink-400">
          Open a project first, then click Compare to scope the viewer.
        </p>
        <Link href="/projects" className="mt-2 rounded-md bg-amber-500 px-4 py-2 text-[13px] font-semibold text-base-950 hover:bg-amber-400">
          Go to projects
        </Link>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-base-800 bg-base-900/40 px-5 py-4">
        <div>
          <p className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-amber-500">
            <GitCompareArrows size={11} />
            {project?.name ?? '—'}
          </p>
          <h1 className="mt-1 font-display text-[24px] font-semibold leading-tight tracking-[-0.015em] text-white">
            Compare View
          </h1>
          {editingDraftId && (
            <p className="mt-0.5 text-[12px] text-amber-400">
              Editing draft:{' '}
              <span className="font-medium">
                {comparisonDrafts.find((d) => d.id === editingDraftId)?.label?.trim() || `${editingDraftId.slice(0, 8)}…`}
              </span>
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setIsBackModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md border border-base-700 bg-base-900 px-3 py-1.5 text-[12px] font-medium text-ink-200 transition-colors hover:border-base-600 hover:bg-base-800 hover:text-white"
        >
          <ArrowLeft size={12} />
          Back
        </button>
      </div>

      {loadingProject ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={20} className="animate-spin text-ink-500" />
        </div>
      ) : (
        <>
          {/* Dual panels */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {(['left', 'right'] as Side[]).map((side) => {
              const panel = side === 'left' ? leftPanel : rightPanel;
              const selectedDate = side === 'left' ? leftSelectedDate : rightSelectedDate;
              const file = side === 'left' ? leftFile : rightFile;
              const otherFile = side === 'left' ? rightFile : leftFile;

              return (
                <div
                  key={side}
                  className="flex h-[70vh] flex-col overflow-hidden rounded-xl border border-base-800 bg-base-900"
                >
                  {panel === 'calendar' && (
                    <CompareCalendar
                      availableDates={availableDates}
                      onDateSelect={(date) => {
                        if (side === 'left') { setLeftSelectedDate(date); setLeftPanel('explorer'); }
                        else { setRightSelectedDate(date); setRightPanel('explorer'); }
                      }}
                    />
                  )}

                  {panel === 'explorer' && selectedDate && (
                    <PanelFileExplorer
                      selectedDate={selectedDate}
                      disabledFileUrl={otherFile?.fileUrl ?? null}
                      onFileSelect={(sel) => handleFileSelect(side, sel)}
                      onBackToCalendar={() => {
                        if (side === 'left') setLeftPanel('calendar');
                        else setRightPanel('calendar');
                      }}
                      tabRailId={`compare-${side}-tab`}
                    />
                  )}

                  {panel === 'viewer360' && file && (
                    <Compare360Viewer
                      viewerSide={side}
                      imageUrl={file.fileUrl}
                      displayFileName={file.displayFileName}
                      roomLabel={file.roomLabel}
                      captureDate={file.captureDate}
                      onClose={() => handleCloseViewer(side)}
                      sharedCameraState={sharedCameraState}
                      onCameraStateChange={handleCameraStateChange}
                      isSynchronized={isSynchronized}
                      onTakeScreenshot={
                        side === 'left' ? handleLeftScreenshotAssignment : handleRightScreenshotAssignment
                      }
                    />
                  )}

                  {panel === 'viewerPCD' && file && (
                    <div className="relative h-full w-full">
                      <iframe
                        src={`/potree/examples/viewer.html?url=${encodeURIComponent(file.fileUrl)}`}
                        title={file.displayFileName}
                        className="h-full w-full border-0"
                      />
                      <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-lg border border-base-700 bg-base-900/90 px-3 py-2 text-center backdrop-blur-sm">
                        <p className="max-w-[200px] truncate text-[12px] font-medium text-white">{file.displayFileName}</p>
                        {(file.roomLabel || file.captureDate) && (
                          <p className="mt-0.5 text-[11px] text-ink-400">
                            {file.roomLabel}{file.roomLabel && file.captureDate ? ' · ' : ''}{file.captureDate}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCloseViewer(side)}
                        className="absolute left-3 top-3 z-10 rounded-full border border-base-700 bg-base-900/90 p-1.5 text-ink-300 backdrop-blur-sm transition-colors hover:text-white"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Camera lock + Snapshot button */}
          <div className="flex items-center justify-between rounded-xl border border-base-800 bg-base-900/40 px-4 py-3">
            <button
              type="button"
              onClick={toggleSynchronization}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors ${
                isSynchronized
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                  : 'border-base-700 text-ink-400 hover:border-base-600 hover:text-white'
              }`}
            >
              {isSynchronized ? <Link2 size={13} /> : <Link2Off size={13} />}
              {isSynchronized ? 'Views locked' : 'Lock views'}
            </button>

            <button
              type="button"
              onClick={handleSnapshot}
              disabled={leftPanel !== 'viewer360' && rightPanel !== 'viewer360'}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-[13px] font-semibold text-base-950 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Camera size={14} />
              {isBottomSectionVisible ? 'Snapshot' : 'Snapshot & Compare'}
            </button>
          </div>

          {/* Bottom section */}
          {isBottomSectionVisible && (
            <div className="space-y-5 rounded-xl border border-base-800 bg-base-900/40 p-5">
              {/* Notes */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {(['left', 'right'] as Side[]).map((side) => (
                  <div key={side} className="space-y-1.5">
                    <label className="block font-mono text-[10px] uppercase tracking-[0.18em] text-amber-500">
                      {side} view notes
                    </label>
                    <textarea
                      value={side === 'left' ? leftNotes : rightNotes}
                      onChange={(e) =>
                        side === 'left' ? setLeftNotes(e.target.value) : setRightNotes(e.target.value)
                      }
                      rows={4}
                      placeholder={`Add notes for the ${side} view here…`}
                      className="w-full rounded-lg border border-base-700 bg-base-950/60 px-3 py-2.5 text-[13px] text-white placeholder-ink-600 focus:border-base-600 focus:outline-none"
                    />
                  </div>
                ))}
              </div>

              {/* Annex screenshots */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {(['left', 'right'] as Side[]).map((side) => {
                  const annex = side === 'left' ? leftAnnex : rightAnnex;
                  const setAnnex = side === 'left' ? setLeftAnnex : setRightAnnex;
                  return (
                    <div key={side} className="space-y-2">
                      <label className="block text-[11px] font-medium text-ink-400">
                        {side === 'left' ? 'Left' : 'Right'} screenshot notes
                      </label>
                      <div className="rounded-lg border border-base-700 bg-base-950/40 p-3">
                        {annex.images.length > 0 && (
                          <div className="mb-3 flex flex-wrap gap-2">
                            {annex.images.map((img, idx) => (
                              <div key={idx} className="group relative">
                                <img
                                  src={img}
                                  alt={`Screenshot ${idx + 1}`}
                                  className="h-20 w-auto cursor-pointer rounded-md object-cover"
                                  onClick={() => setExpandedImage(img)}
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    setAnnex((p) => ({ ...p, images: p.images.filter((_, i) => i !== idx) }))
                                  }
                                  className="absolute right-0.5 top-0.5 hidden rounded-full bg-base-950/80 p-0.5 text-ink-300 group-hover:flex"
                                >
                                  <X size={10} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <textarea
                          rows={3}
                          placeholder={`Comments for the ${side} screenshot…`}
                          value={annex.text}
                          onChange={(e) => setAnnex((p) => ({ ...p, text: e.target.value }))}
                          className="w-full rounded-lg border border-base-700 bg-base-950/60 px-3 py-2 text-[12px] text-white placeholder-ink-600 focus:border-base-600 focus:outline-none"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Flags */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {(['left', 'right'] as Side[]).map((side) => {
                  const flags = side === 'left' ? leftFlags : rightFlags;
                  const setFlags = side === 'left' ? setLeftFlags : setRightFlags;
                  return (
                    <div key={side} className="space-y-2">
                      <label className="block text-[11px] font-medium text-ink-400">
                        {side === 'left' ? 'Left' : 'Right'} view flags
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {(
                          [
                            ['safety', 'Safety Issue'],
                            ['quality', 'Quality Issue'],
                            ['delayed', 'Delayed'],
                          ] as [keyof SideFlags, string][]
                        ).map(([key, label]) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setFlags((p) => ({ ...p, [key]: !p[key] }))}
                            className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                              flags[key]
                                ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40'
                                : 'border border-base-700 text-ink-400 hover:border-base-600 hover:text-white'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Action buttons */}
              <div className="flex justify-end gap-3 border-t border-base-800 pt-4">
                <button
                  type="button"
                  disabled={saveDraftBusy || publishModalLoading || publishBusy}
                  onClick={() => void saveComparisonDraft()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-base-700 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:border-base-600 hover:bg-base-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saveDraftBusy ? <Loader2 size={13} className="animate-spin" /> : null}
                  {saveDraftBusy ? (editingDraftId ? 'Updating…' : 'Saving…') : 'Save'}
                </button>
                <button
                  type="button"
                  disabled={publishModalLoading || saveDraftBusy || publishBusy}
                  onClick={() => void openPublishModal()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-[13px] font-semibold text-base-950 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {publishModalLoading ? <Loader2 size={13} className="animate-spin" /> : null}
                  {publishModalLoading ? 'Loading…' : 'Generate Report'}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Screenshot modal ───────────────────────────────────────────────── */}
      {isScreenshotModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setIsScreenshotModalOpen(false)}
        >
          <div
            className="w-full max-w-3xl space-y-4 rounded-xl border border-base-700 bg-base-900 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-[18px] font-semibold text-white">Snapshots</h2>
              <button type="button" onClick={() => setIsScreenshotModalOpen(false)} className="rounded p-1 text-ink-400 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {([['Left', leftScreenshot], ['Right', rightScreenshot]] as [string, string | null][]).map(([label, img]) => (
                <div key={label} className="space-y-2">
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-amber-500">{label}</p>
                  {img ? (
                    <>
                      <img
                        src={img}
                        alt={`${label} snapshot`}
                        className="max-h-[40vh] w-full cursor-pointer rounded-lg bg-black/30 object-contain"
                        onClick={() => setExpandedImage(img)}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const a = document.createElement('a');
                          a.href = img;
                          a.download = `${label.toLowerCase()}_snapshot.png`;
                          a.click();
                        }}
                        className="rounded-md border border-base-700 px-3 py-1.5 text-[12px] text-white transition-colors hover:bg-base-800"
                      >
                        Download
                      </button>
                    </>
                  ) : (
                    <p className="text-[12px] text-ink-500">No snapshot for this side.</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Expanded image ─────────────────────────────────────────────────── */}
      {expandedImage && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setExpandedImage(null)}
        >
          <img src={expandedImage} alt="Expanded" className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain" />
          <button
            type="button"
            onClick={() => setExpandedImage(null)}
            className="absolute right-6 top-6 rounded-full border border-base-700 bg-base-900/90 p-2 text-ink-300 transition-colors hover:text-white"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── Publish modal ──────────────────────────────────────────────────── */}
      {isPublishModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true">
          <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-base-700 bg-base-900">
            {publishBusy && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-base-900/95 backdrop-blur-sm">
                <Loader2 size={28} className="animate-spin text-amber-400" />
                <div className="text-center">
                  <p className="font-semibold text-white">Building your report</p>
                  <p className="mt-1 text-[12px] text-ink-400">Merging PDFs and uploading…</p>
                </div>
              </div>
            )}
            <div className="flex items-start justify-between gap-4 border-b border-base-800 px-6 py-5">
              <div>
                <h2 className="font-display text-[18px] font-semibold text-white">Publish consolidated report</h2>
                <p className="mt-1 text-[12px] text-ink-400">
                  Merge selected drafts into one PDF. Published drafts are removed from your list.
                </p>
              </div>
              <button type="button" disabled={publishBusy} onClick={() => setIsPublishModalOpen(false)} className="rounded p-1 text-ink-400 hover:text-white disabled:opacity-40">
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {comparisonDrafts.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-base-700 py-12 text-center">
                  <GitCompareArrows size={32} className="mb-3 text-ink-600" />
                  <p className="text-[13px] font-medium text-ink-400">No comparison drafts</p>
                  <p className="mt-1 text-[11px] text-ink-600">Save a comparison first, then return here to publish.</p>
                </div>
              ) : (
                <>
                  {/* Date filter chips */}
                  <div className="mb-4 rounded-xl border border-base-800 bg-base-800/40 px-3 py-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">Draft saved on</p>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          disabled={publishBusy}
                          onClick={() => setPublishFilterDateKeys([...publishAvailableDateKeys])}
                          className="rounded-full border border-base-700 bg-base-900 px-2 py-0.5 text-[10px] text-ink-300 transition-colors hover:text-white disabled:opacity-40"
                        >
                          All dates
                        </button>
                        <button
                          type="button"
                          disabled={publishBusy}
                          onClick={() => setPublishFilterDateKeys([])}
                          className="rounded-full border border-base-700 bg-base-900 px-2 py-0.5 text-[10px] text-ink-300 transition-colors hover:text-white disabled:opacity-40"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {publishAvailableDateKeys.map((key) => {
                        const checked = publishFilterDateKeys.includes(key);
                        return (
                          <button
                            key={key}
                            type="button"
                            disabled={publishBusy}
                            onClick={() =>
                              setPublishFilterDateKeys((prev) =>
                                prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key].sort(),
                              )
                            }
                            className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                              checked
                                ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                                : 'border-base-700 text-ink-400 hover:border-base-600 hover:text-white'
                            } disabled:opacity-40`}
                          >
                            {formatLocalDayMedium(key)}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Select / clear all */}
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={publishBusy || publishVisibleDrafts.length === 0}
                      onClick={() => setPublishSelectedIds(publishVisibleDrafts.map((d) => d.id))}
                      className="rounded-full border border-base-700 px-3 py-1 text-[11px] text-ink-400 transition-colors hover:text-white disabled:opacity-40"
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      disabled={publishBusy}
                      onClick={() => setPublishSelectedIds([])}
                      className="rounded-full border border-base-700 px-3 py-1 text-[11px] text-ink-400 transition-colors hover:text-white disabled:opacity-40"
                    >
                      Clear
                    </button>
                    {publishVisibleDrafts.length > 0 && (
                      <span className="text-[11px] text-ink-600">
                        {publishSelectedIds.length} of {publishVisibleDrafts.length} selected
                      </span>
                    )}
                  </div>

                  {publishVisibleDrafts.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-amber-800/40 bg-amber-900/10 py-8 text-center">
                      <p className="text-[13px] font-medium text-amber-400">No drafts match the selected dates</p>
                      <p className="mt-1 text-[11px] text-amber-500/80">Select at least one date to see drafts.</p>
                    </div>
                  ) : (
                    <ul className="space-y-1.5">
                      {publishVisibleDrafts.map((d) => (
                        <li
                          key={d.id}
                          className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                            publishSelectedIds.includes(d.id) ? 'border-amber-500/30 bg-amber-500/5' : 'border-base-800'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={publishSelectedIds.includes(d.id)}
                            disabled={publishBusy}
                            onChange={() =>
                              setPublishSelectedIds((prev) =>
                                prev.includes(d.id) ? prev.filter((x) => x !== d.id) : [...prev, d.id],
                              )
                            }
                            className="accent-amber-500"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[12px] text-white">{d.label ?? 'Untitled draft'}</p>
                            <p className="text-[11px] text-ink-500">{formatLocalDayMedium(draftSavedDayKeyLocal(d.created_at))}</p>
                          </div>
                          <button
                            type="button"
                            disabled={publishBusy}
                            onClick={async () => {
                              try {
                                await deleteComparisonDraft(d.id);
                                setComparisonDrafts((p) => p.filter((x) => x.id !== d.id));
                                setPublishSelectedIds((p) => p.filter((x) => x !== d.id));
                              } catch (e) {
                                toast.error(e instanceof Error ? e.message : 'Could not delete draft.');
                              }
                            }}
                            className="rounded p-1 text-ink-600 transition-colors hover:text-red-400 disabled:opacity-40"
                          >
                            <Trash2 size={13} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>

            <div className="flex gap-2 border-t border-base-800 px-6 py-4">
              <button
                type="button"
                disabled={publishBusy}
                onClick={() => setIsPublishModalOpen(false)}
                className="flex-1 rounded-lg border border-base-700 px-3 py-2 text-[13px] font-medium text-white transition-colors hover:bg-base-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={publishSelectedIds.length === 0 || publishBusy}
                onClick={() => void handlePublishConfirm()}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-[13px] font-semibold text-base-950 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {publishBusy ? <Loader2 size={13} className="animate-spin" /> : null}
                {publishBusy
                  ? 'Publishing…'
                  : `Publish${publishSelectedIds.length > 0 ? ` ${publishSelectedIds.length}` : ''} PDF`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Notice dialog ──────────────────────────────────────────────────── */}
      {notice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setNotice(null)}
        >
          <div
            className="w-full max-w-sm space-y-3 rounded-xl border border-base-700 bg-base-900 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={`font-display text-[16px] font-semibold ${notice.variant === 'error' ? 'text-red-400' : 'text-white'}`}>
                  {notice.title}
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-400">{notice.message}</p>
              </div>
              <button type="button" onClick={() => setNotice(null)} className="rounded p-1 text-ink-500 hover:text-white">
                <X size={14} />
              </button>
            </div>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="w-full rounded-lg bg-base-800 px-3 py-2 text-[13px] font-medium text-white transition-colors hover:bg-base-700"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* ── Back confirmation modal ────────────────────────────────────────── */}
      {isBackModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setIsBackModalOpen(false)}
        >
          <div
            className="w-full max-w-sm space-y-4 rounded-xl border border-base-700 bg-base-900 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-display text-[16px] font-semibold text-white">Leave Compare?</p>
            <p className="text-[13px] text-ink-400">Unsaved changes will be lost. Are you sure you want to leave?</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsBackModalOpen(false)}
                className="flex-1 rounded-lg border border-base-700 px-3 py-2 text-[13px] text-white hover:bg-base-800"
              >
                Stay
              </button>
              <Link
                href={project ? `/app/projects/${project.slug}` : '/projects'}
                className="flex-1 rounded-lg bg-base-800 px-3 py-2 text-center text-[13px] font-medium text-white transition-colors hover:bg-base-700"
              >
                Leave
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
