'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { jsPDF } from 'jspdf';
import { toast } from 'sonner';
import {
  createComparisonDraft,
  listRooms,
  getExplorerByRoom,
  publishComparisonDrafts,
  updateComparisonDraft,
} from '@/services/apiClient';
import type { ApiMediaFile, ApiRoom, MediaType } from '@/types/api';

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

function flattenFilesByType(
  dates: Record<string, { images: ApiMediaFile[]; videos: ApiMediaFile[]; pointclouds: ApiMediaFile[]; pdfs: ApiMediaFile[] }>,
  mediaType: MediaType,
): Array<{ date: string; file: ApiMediaFile }> {
  const key =
    mediaType === 'image'
      ? 'images'
      : mediaType === 'video'
        ? 'videos'
        : mediaType === 'pointcloud'
          ? 'pointclouds'
          : 'pdfs';
  const out: Array<{ date: string; file: ApiMediaFile }> = [];
  for (const [date, group] of Object.entries(dates)) {
    for (const file of group[key]) out.push({ date, file });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

function SideViewer({ item }: { item: { date: string; file: ApiMediaFile } | null }) {
  if (!item) {
    return <div className="flex h-full items-center justify-center text-[13px] text-ink-400">Select a file</div>;
  }
  const src = item.file.full_src || item.file.src;
  if (item.file.type === 'image') {
    return <img src={src} alt={item.file.file_name} className="h-full w-full object-contain" />;
  }
  if (item.file.type === 'video') {
    return <video src={src} controls className="h-full w-full object-contain" />;
  }
  if (item.file.type === 'pdf') {
    return <iframe src={src} title={item.file.file_name} className="h-full w-full border-0" />;
  }
  return (
    <iframe
      src={`/potree/examples/viewer.html?url=${encodeURIComponent(src)}`}
      title={item.file.file_name}
      className="h-full w-full border-0"
    />
  );
}

export function ComparePanel() {
  const [rooms, setRooms] = useState<ApiRoom[]>([]);
  const [byRoom, setByRoom] = useState<Record<string, Record<string, any>>>({});
  const [mediaType, setMediaType] = useState<MediaType>('image');
  const [leftRoom, setLeftRoom] = useState<string>('');
  const [rightRoom, setRightRoom] = useState<string>('');
  const [leftFileId, setLeftFileId] = useState<string>('');
  const [rightFileId, setRightFileId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [flagsInput, setFlagsInput] = useState('');
  const [draftId, setDraftId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flags = useMemo(
    () =>
      flagsInput
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
    [flagsInput],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await listRooms();
        if (cancelled) return;
        setRooms(r);
        if (r[0]) {
          setLeftRoom(r[0].slug);
          setRightRoom(r[0].slug);
        }
        await Promise.all(
          r.map(async (room) => {
            const res = await getExplorerByRoom(room.slug);
            if (cancelled) return;
            setByRoom((prev) => ({ ...prev, [room.slug]: res.dates || {} }));
          }),
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not load compare data.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const leftItems = useMemo(
    () => flattenFilesByType(byRoom[leftRoom] || {}, mediaType),
    [byRoom, leftRoom, mediaType],
  );
  const rightItems = useMemo(
    () => flattenFilesByType(byRoom[rightRoom] || {}, mediaType),
    [byRoom, rightRoom, mediaType],
  );
  const leftSelected = leftItems.find((x) => x.file.id === leftFileId) || null;
  const rightSelected = rightItems.find((x) => x.file.id === rightFileId) || null;

  const statePayload: CompareState = useMemo(
    () => ({
      leftFileId: leftSelected?.file.id || null,
      rightFileId: rightSelected?.file.id || null,
      leftRoomSlug: leftRoom || null,
      rightRoomSlug: rightRoom || null,
      leftDate: leftSelected?.date || null,
      rightDate: rightSelected?.date || null,
      mediaType,
      notes,
      flags,
    }),
    [leftSelected, rightSelected, leftRoom, rightRoom, mediaType, notes, flags],
  );

  const saveDraftNow = async () => {
    if (!statePayload.leftFileId) return;
    setSaving(true);
    try {
      if (draftId) {
        await updateComparisonDraft({
          draftId,
          fileId: statePayload.leftFileId,
          manualObservations: notes || null,
          flags,
          state: statePayload as unknown as Record<string, unknown>,
        });
      } else {
        const created = await createComparisonDraft({
          fileId: statePayload.leftFileId,
          manualObservations: notes || null,
          flags,
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

  useEffect(() => {
    setDirty(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void saveDraftNow();
    }, 1200);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leftFileId, rightFileId, leftRoom, rightRoom, mediaType, notes, flagsInput]);

  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault();
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);

  useEffect(() => {
    const clickHandler = (event: MouseEvent) => {
      if (!dirty) return;
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const anchor = target.closest('a') as HTMLAnchorElement | null;
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
    if (!draftId || !statePayload.leftFileId) {
      toast.error('Save/select the left file first.');
      return;
    }
    setPublishing(true);
    try {
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text('SiteScope Comparison Report', 14, 18);
      doc.setFontSize(11);
      doc.text(`Left: ${leftSelected?.file.file_name ?? '(none)'}`, 14, 30);
      doc.text(`Right: ${rightSelected?.file.file_name ?? '(none)'}`, 14, 38);
      doc.text(`Type: ${mediaType}`, 14, 46);
      doc.text(`Notes: ${notes || '(none)'}`, 14, 54, { maxWidth: 180 });
      doc.text(`Flags: ${flags.join(', ') || '(none)'}`, 14, 74, { maxWidth: 180 });
      const pdfBlob = doc.output('blob');

      await publishComparisonDrafts({
        pdfBlob,
        fileId: statePayload.leftFileId,
        draftIds: [draftId],
        manualObservations: notes || null,
        flags,
      });
      setDraftId(null);
      setDirty(false);
      toast.success('Comparison PDF published.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not publish comparison report.');
    } finally {
      setPublishing(false);
    }
  };

  const sideControls = (side: Side) => {
    const room = side === 'left' ? leftRoom : rightRoom;
    const items = side === 'left' ? leftItems : rightItems;
    const fileId = side === 'left' ? leftFileId : rightFileId;
    const setRoom = side === 'left' ? setLeftRoom : setRightRoom;
    const setFileId = side === 'left' ? setLeftFileId : setRightFileId;

    return (
      <div className="space-y-2">
        <label className="text-[12px] text-ink-300">{side === 'left' ? 'Left' : 'Right'} room</label>
        <select
          value={room}
          onChange={(e) => {
            setRoom(e.target.value);
            setFileId('');
          }}
          className="w-full rounded-md border border-base-700 bg-base-950/60 px-3 py-2 text-[13px] text-white"
        >
          {rooms.map((r) => (
            <option key={r.id} value={r.slug}>
              {r.name}
            </option>
          ))}
        </select>

        <label className="text-[12px] text-ink-300">{side === 'left' ? 'Left' : 'Right'} file</label>
        <select
          value={fileId}
          onChange={(e) => setFileId(e.target.value)}
          className="w-full rounded-md border border-base-700 bg-base-950/60 px-3 py-2 text-[13px] text-white"
        >
          <option value="">Select file</option>
          {items.map((x) => (
            <option key={x.file.id} value={x.file.id}>
              {x.date} · {x.file.file_name}
            </option>
          ))}
        </select>
      </div>
    );
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between rounded-md border border-base-800 bg-base-900/40 p-4">
        <div>
          <h1 className="font-display text-[28px] text-white">Compare</h1>
          <p className="text-[12px] text-ink-300">Dual viewer comparison with auto-saved drafts</p>
        </div>
        <Link href="/app" className="rounded-md border border-base-700 px-3 py-1.5 text-[13px] text-white">
          Back to app
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">{sideControls('left')}{sideControls('right')}</div>
          <div className="space-y-1">
            <label className="text-[12px] text-ink-300">Media type</label>
            <div className="flex flex-wrap gap-2">
              {(['image', 'video', 'pointcloud', 'pdf'] as MediaType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setMediaType(t)}
                  className={`rounded px-3 py-1.5 text-[12px] ${mediaType === t ? 'bg-amber-500 text-base-950' : 'border border-base-700 text-white'}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="grid h-[62vh] gap-3 rounded-md border border-base-800 bg-base-900/30 p-3 sm:grid-cols-2">
            <div className="overflow-hidden rounded border border-base-800 bg-black/30">
              <SideViewer item={leftSelected} />
            </div>
            <div className="overflow-hidden rounded border border-base-800 bg-black/30">
              <SideViewer item={rightSelected} />
            </div>
          </div>
        </section>

        <aside className="space-y-3 rounded-md border border-base-800 bg-base-900/50 p-4">
          <h3 className="font-display text-[18px] text-white">Comparison Draft</h3>
          <p className="text-[12px] text-ink-300">
            Status: {saving ? 'Autosaving...' : dirty ? 'Unsaved changes' : draftId ? 'Saved' : 'Not saved yet'}
          </p>
          <div className="space-y-1">
            <label className="text-[12px] text-ink-300">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-24 w-full rounded-md border border-base-700 bg-base-950/70 px-3 py-2 text-[13px] text-white"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[12px] text-ink-300">Flags (comma separated)</label>
            <input
              value={flagsInput}
              onChange={(e) => setFlagsInput(e.target.value)}
              className="w-full rounded-md border border-base-700 bg-base-950/70 px-3 py-2 text-[13px] text-white"
              placeholder="difference, quality, issue"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void saveDraftNow()}
              disabled={saving}
              className="rounded-md border border-base-700 px-3 py-2 text-[13px] text-white"
            >
              Save now
            </button>
            <button
              type="button"
              onClick={() => void publish()}
              disabled={!draftId || publishing}
              className="rounded-md bg-amber-500 px-3 py-2 text-[13px] font-medium text-base-950 disabled:opacity-50"
            >
              {publishing ? 'Publishing...' : 'Publish PDF'}
            </button>
          </div>
          {draftId && <p className="font-mono text-[11px] text-ink-400">Draft ID: {draftId}</p>}
        </aside>
      </div>
    </div>
  );
}
