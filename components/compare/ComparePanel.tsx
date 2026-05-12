'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { jsPDF } from 'jspdf';
import { toast } from 'sonner';
import { ArrowLeft, GitCompareArrows, Loader2 } from 'lucide-react';
import {
  createComparisonDraft,
  getComparisonDraft,
  getExplorerByRoom,
  listProjectRooms,
  listProjects,
  publishComparisonDrafts,
  updateComparisonDraft,
} from '@/services/apiClient';
import type { ApiMediaFile, ApiProject, ApiRoom, MediaType } from '@/types/api';

type Side = 'left' | 'right';

type CompareState = {
  leftFileId: string | null;
  rightFileId: string | null;
  leftRoomSlug: string | null;
  rightRoomSlug: string | null;
  leftDate: string | null;
  rightDate: string | null;
  mediaType: MediaType;
  notes: string;
  flags: string[];
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

function flattenByType(dates: RoomDates, mediaType: MediaType): Array<{ date: string; file: ApiMediaFile }> {
  const key = mediaType === 'image' ? 'images' : mediaType === 'video' ? 'videos' : mediaType === 'pointcloud' ? 'pointclouds' : 'pdfs';
  const out: Array<{ date: string; file: ApiMediaFile }> = [];
  for (const [date, group] of Object.entries(dates)) {
    for (const file of group[key]) out.push({ date, file });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

function SideViewer({ item }: { item: { date: string; file: ApiMediaFile } | null }) {
  if (!item) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <GitCompareArrows size={22} className="text-base-700" />
        <p className="text-[12px] text-ink-500">Select a room and file</p>
      </div>
    );
  }
  const src = item.file.full_src || item.file.src;
  if (item.file.type === 'image') return <img src={src} alt={item.file.file_name} className="h-full w-full object-contain" />;
  if (item.file.type === 'video') return <video src={src} controls className="h-full w-full object-contain" />;
  if (item.file.type === 'pdf') return <iframe src={src} title={item.file.file_name} className="h-full w-full border-0" />;
  return <iframe src={`/potree/examples/viewer.html?url=${encodeURIComponent(src)}`} title={item.file.file_name} className="h-full w-full border-0" />;
}

export function ComparePanel() {
  const searchParams = useSearchParams();

  // Resolve current project —  ?project= param wins, then sessionStorage fallback
  const paramSlug = searchParams.get('project');
  const storageSlug = (() => { try { return sessionStorage.getItem('sidebar.lastProjectSlug'); } catch { return null; } })();
  const projectSlug = paramSlug ?? storageSlug ?? null;

  const [project, setProject] = useState<ApiProject | null>(null);
  const [rooms, setRooms] = useState<ApiRoom[]>([]);
  const [loadingProject, setLoadingProject] = useState(true);

  // Lazy-loaded file data per room slug
  const [byRoom, setByRoom] = useState<Record<string, RoomDates>>({});
  const [loadingRoom, setLoadingRoom] = useState<Record<Side, boolean>>({ left: false, right: false });

  const [mediaType, setMediaType] = useState<MediaType>('image');
  const [leftRoom, setLeftRoom] = useState('');
  const [rightRoom, setRightRoom] = useState('');
  const [leftFileId, setLeftFileId] = useState('');
  const [rightFileId, setRightFileId] = useState('');
  const [notes, setNotes] = useState('');
  const [flagsInput, setFlagsInput] = useState('');
  const [draftId, setDraftId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [hydratingDraft, setHydratingDraft] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flags = useMemo(
    () => flagsInput.split(',').map((x) => x.trim()).filter(Boolean),
    [flagsInput],
  );

  // Load project + its rooms
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
        if (rs[0]) { setLeftRoom(rs[0].slug); setRightRoom(rs[0].slug); }
      } catch (err) {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Could not load project data.');
      } finally {
        if (!cancelled) setLoadingProject(false);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectSlug]);

  // Fetch files for a room lazily when selected
  const ensureRoomLoaded = async (slug: string, side: Side) => {
    if (!slug || byRoom[slug]) return;
    setLoadingRoom((prev) => ({ ...prev, [side]: true }));
    try {
      const res = await getExplorerByRoom(slug);
      setByRoom((prev) => ({ ...prev, [slug]: res.dates || {} }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not load room files.');
    } finally {
      setLoadingRoom((prev) => ({ ...prev, [side]: false }));
    }
  };

  // Load left room files when leftRoom changes
  useEffect(() => { void ensureRoomLoaded(leftRoom, 'left'); }, [leftRoom]);
  // Load right room files when rightRoom changes
  useEffect(() => { void ensureRoomLoaded(rightRoom, 'right'); }, [rightRoom]);

  // Hydrate from draft ID in URL
  useEffect(() => {
    const id = searchParams.get('draft');
    if (!id) return;
    let cancelled = false;
    setHydratingDraft(true);
    void (async () => {
      try {
        const d = await getComparisonDraft(id);
        if (cancelled) return;
        const st = (d.state_json || {}) as Partial<CompareState>;
        setDraftId(d.id);
        setMediaType((st.mediaType as MediaType) || 'image');
        if (st.leftRoomSlug) setLeftRoom(st.leftRoomSlug);
        if (st.rightRoomSlug) setRightRoom(st.rightRoomSlug);
        setLeftFileId(st.leftFileId || '');
        setRightFileId(st.rightFileId || '');
        setNotes(d.manual_observations || st.notes || '');
        setFlagsInput((d.flags || st.flags || []).join(', '));
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

  const leftItems = useMemo(() => flattenByType(byRoom[leftRoom] || {}, mediaType), [byRoom, leftRoom, mediaType]);
  const rightItems = useMemo(() => flattenByType(byRoom[rightRoom] || {}, mediaType), [byRoom, rightRoom, mediaType]);
  const leftSelected = leftItems.find((x) => x.file.id === leftFileId) || null;
  const rightSelected = rightItems.find((x) => x.file.id === rightFileId) || null;

  const statePayload: CompareState = useMemo(() => ({
    leftFileId: leftSelected?.file.id || null,
    rightFileId: rightSelected?.file.id || null,
    leftRoomSlug: leftRoom || null,
    rightRoomSlug: rightRoom || null,
    leftDate: leftSelected?.date || null,
    rightDate: rightSelected?.date || null,
    mediaType,
    notes,
    flags,
  }), [leftSelected, rightSelected, leftRoom, rightRoom, mediaType, notes, flags]);

  const saveDraftNow = async () => {
    if (!statePayload.leftFileId) return;
    setSaving(true);
    try {
      if (draftId) {
        await updateComparisonDraft({ draftId, fileId: statePayload.leftFileId, manualObservations: notes || null, flags, state: statePayload as unknown as Record<string, unknown> });
      } else {
        const created = await createComparisonDraft({ fileId: statePayload.leftFileId, manualObservations: notes || null, flags, state: statePayload as unknown as Record<string, unknown> });
        setDraftId(created.id);
      }
      setDirty(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save comparison draft.');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    setDirty(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { void saveDraftNow(); }, 1200);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leftFileId, rightFileId, leftRoom, rightRoom, mediaType, notes, flagsInput]);

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

  const publish = async () => {
    if (!draftId || !statePayload.leftFileId) { toast.error('Save/select the left file first.'); return; }
    setPublishing(true);
    try {
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text('SiteScope Comparison Report', 14, 18);
      doc.setFontSize(11);
      doc.text(`Project: ${project?.name ?? '—'}`, 14, 28);
      doc.text(`Left: ${leftSelected?.file.file_name ?? '(none)'}  [${leftSelected?.date ?? ''}]`, 14, 36);
      doc.text(`Right: ${rightSelected?.file.file_name ?? '(none)'}  [${rightSelected?.date ?? ''}]`, 14, 44);
      doc.text(`Type: ${mediaType}`, 14, 52);
      doc.text(`Notes: ${notes || '(none)'}`, 14, 60, { maxWidth: 180 });
      doc.text(`Flags: ${flags.join(', ') || '(none)'}`, 14, 78, { maxWidth: 180 });
      const pdfBlob = doc.output('blob');
      await publishComparisonDrafts({ pdfBlob, fileId: statePayload.leftFileId, draftIds: [draftId], manualObservations: notes || null, flags });
      setDraftId(null);
      setDirty(false);
      toast.success('Comparison PDF published.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not publish comparison report.');
    } finally {
      setPublishing(false);
    }
  };

  // ── No project resolved ──────────────────────────────────────────────────
  if (!loadingProject && !project) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-16 text-center">
        <GitCompareArrows size={28} className="text-ink-500" />
        <p className="font-display text-[18px] font-semibold text-white">No project selected</p>
        <p className="max-w-[36ch] text-[13px] leading-relaxed text-ink-400">
          Open a project first, then click Compare to scope the viewer to that project's rooms.
        </p>
        <Link href="/projects" className="mt-2 rounded-md bg-amber-500 px-4 py-2 text-[13px] font-semibold text-base-950 hover:bg-amber-400">
          Go to projects
        </Link>
      </div>
    );
  }

  const sideControls = (side: Side) => {
    const room = side === 'left' ? leftRoom : rightRoom;
    const items = side === 'left' ? leftItems : rightItems;
    const fileId = side === 'left' ? leftFileId : rightFileId;
    const setRoom = side === 'left' ? setLeftRoom : setRightRoom;
    const setFileId = side === 'left' ? setLeftFileId : setRightFileId;
    const isLoadingRoom = loadingRoom[side];
    const label = side === 'left' ? 'Left' : 'Right';

    return (
      <div className="space-y-3 rounded-xl border border-base-800 bg-base-900/40 p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-500">{label} panel</p>

        <div className="space-y-1">
          <label className="block text-[11px] font-medium text-ink-400">Room</label>
          <select
            value={room}
            onChange={(e) => { setRoom(e.target.value); setFileId(''); }}
            className="w-full rounded-lg border border-base-700 bg-base-950/60 px-3 py-2 text-[13px] text-white transition-colors focus:border-base-600 focus:outline-none"
          >
            {rooms.map((r) => (
              <option key={r.id} value={r.slug}>{r.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="block text-[11px] font-medium text-ink-400">File</label>
          <div className="relative">
            <select
              value={fileId}
              onChange={(e) => setFileId(e.target.value)}
              disabled={isLoadingRoom}
              className="w-full rounded-lg border border-base-700 bg-base-950/60 px-3 py-2 text-[13px] text-white transition-colors focus:border-base-600 focus:outline-none disabled:opacity-50"
            >
              <option value="">{isLoadingRoom ? 'Loading…' : items.length === 0 ? 'No files in this room' : 'Select file'}</option>
              {items.map((x) => (
                <option key={x.file.id} value={x.file.id}>
                  {x.date} · {x.file.file_name}
                </option>
              ))}
            </select>
            {isLoadingRoom && (
              <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-ink-400" />
            )}
          </div>
        </div>
      </div>
    );
  };

  const draftStatus = hydratingDraft ? 'Loading draft…' : saving ? 'Autosaving…' : dirty ? 'Unsaved changes' : draftId ? 'Saved' : 'Not saved yet';

  return (
    <div className="space-y-4 p-4">
      {/* ── Header ── */}
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
          {/* ── Main viewer area ── */}
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-4"
          >
            {/* Side controls */}
            <div className="grid gap-3 sm:grid-cols-2">
              {sideControls('left')}
              {sideControls('right')}
            </div>

            {/* Media type selector */}
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-base-800 bg-base-900/40 px-4 py-3">
              <span className="mr-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">Type</span>
              {(Object.entries(MEDIA_LABELS) as [MediaType, string][]).map(([t, label]) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setMediaType(t)}
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

            {/* Dual viewer */}
            <div className="grid h-[60vh] gap-3 rounded-xl border border-base-800 bg-base-900/20 p-3 sm:grid-cols-2">
              <div className="overflow-hidden rounded-lg border border-base-800 bg-black/30">
                <SideViewer item={leftSelected} />
              </div>
              <div className="overflow-hidden rounded-lg border border-base-800 bg-black/30">
                <SideViewer item={rightSelected} />
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

            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-ink-400">Observations</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={6}
                placeholder="Describe what you observe comparing these two captures…"
                className="w-full rounded-lg border border-base-700 bg-base-950/60 px-3 py-2.5 text-[13px] text-white placeholder-ink-600 transition-colors focus:border-base-600 focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-ink-400">Flags <span className="text-ink-600">(comma separated)</span></label>
              <input
                value={flagsInput}
                onChange={(e) => setFlagsInput(e.target.value)}
                placeholder="difference, quality, structural"
                className="w-full rounded-lg border border-base-700 bg-base-950/60 px-3 py-2 text-[13px] text-white placeholder-ink-600 transition-colors focus:border-base-600 focus:outline-none"
              />
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
                onClick={() => void publish()}
                disabled={!draftId || publishing}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-[13px] font-semibold text-base-950 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {publishing ? <Loader2 size={13} className="animate-spin" /> : null}
                {publishing ? 'Publishing…' : 'Publish PDF'}
              </button>
            </div>

            {draftId && (
              <p className="font-mono text-[10px] text-ink-600">
                Draft · {draftId.slice(0, 8)}…
              </p>
            )}
          </motion.aside>
        </div>
      )}
    </div>
  );
}
