'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Database, FileDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import {
  fetchQualityExportCsv,
  getQualityExportEstimate,
  type QualityExportAttemptScope,
  type QualityExportFilters,
  type QualityExportMediaType,
} from '@/services/api/files';
import type { ApiQualityExportEstimate, ApiRoom } from '@/types/api';

type ExportScope = 'current' | 'range' | 'all';

type Props = {
  projectName: string;
  projectSlug: string;
  rooms: ApiRoom[];
  currentDate: string;
  defaultRoomSlugs: string[];
  defaultMediaTypes: QualityExportMediaType[];
  onClose: () => void;
};

type WritableDownload = WritableStream<Uint8Array> & {
  abort(reason?: unknown): Promise<void>;
  close(): Promise<void>;
  write(data: Blob | Uint8Array): Promise<void>;
};

type DownloadFileHandle = {
  createWritable(): Promise<WritableDownload>;
};

type FilePickerWindow = Window & {
  showSaveFilePicker?: (options: {
    suggestedName: string;
    types: Array<{ description: string; accept: Record<string, string[]> }>;
  }) => Promise<DownloadFileHandle>;
};

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function ChoiceCard({
  checked,
  title,
  detail,
  onClick,
}: {
  checked: boolean;
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onClick}
      className={`rounded-md border p-3 text-left transition ${
        checked
          ? 'border-amber-500/60 bg-amber-500/5'
          : 'border-base-800 bg-base-950/30 hover:border-base-700'
      }`}
    >
      <span className="flex items-center gap-2 text-[12px] font-medium text-white">
        <span className={`inline-flex h-4 w-4 items-center justify-center rounded-full border ${checked ? 'border-amber-400 bg-amber-400 text-base-950' : 'border-base-600'}`}>
          {checked && <Check size={10} strokeWidth={3} />}
        </span>
        {title}
      </span>
      <span className="mt-1.5 block pl-6 text-[10px] leading-relaxed text-ink-500">{detail}</span>
    </button>
  );
}

function ToggleRow({
  checked,
  label,
  detail,
  onChange,
}: {
  checked: boolean;
  label: string;
  detail?: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-base-800 bg-base-950/30 px-3 py-2.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-3.5 w-3.5 accent-amber-500"
      />
      <span>
        <span className="block text-[11px] text-ink-100">{label}</span>
        {detail && <span className="mt-0.5 block text-[10px] leading-relaxed text-ink-500">{detail}</span>}
      </span>
    </label>
  );
}

export function QualityCsvExportModal({
  projectName,
  projectSlug,
  rooms,
  currentDate,
  defaultRoomSlugs,
  defaultMediaTypes,
  onClose,
}: Props) {
  const initialScope: ExportScope = currentDate ? 'current' : 'range';
  const validDefaultRooms = defaultRoomSlugs.filter((slug) => rooms.some((room) => room.slug === slug));
  const validDefaultMedia = defaultMediaTypes.filter(
    (value): value is QualityExportMediaType => value === 'image' || value === 'pointcloud',
  );

  const [scope, setScope] = useState<ExportScope>(initialScope);
  const [dateFrom, setDateFrom] = useState(currentDate);
  const [dateTo, setDateTo] = useState(currentDate);
  const [selectedRooms, setSelectedRooms] = useState<Set<string>>(
    () => new Set(validDefaultRooms.length ? validDefaultRooms : rooms.map((room) => room.slug)),
  );
  const [mediaTypes, setMediaTypes] = useState<Set<QualityExportMediaType>>(
    () => new Set(validDefaultMedia.length ? validDefaultMedia : ['image', 'pointcloud']),
  );
  const [attemptScope, setAttemptScope] = useState<QualityExportAttemptScope>('all');
  const [estimate, setEstimate] = useState<ApiQualityExportEstimate | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const allRoomsSelected = rooms.length > 0 && selectedRooms.size === rooms.length;
  const invalidDateRange = scope === 'range' && (!dateFrom || !dateTo || dateFrom > dateTo);
  const valid = selectedRooms.size > 0 && mediaTypes.size > 0 && !invalidDateRange && (scope !== 'current' || !!currentDate);

  const filters = useMemo<QualityExportFilters>(() => ({
    projectSlug,
    dateFrom: scope === 'all' ? undefined : scope === 'current' ? currentDate : dateFrom,
    dateTo: scope === 'all' ? undefined : scope === 'current' ? currentDate : dateTo,
    // Omitting the room parameters means all rooms and keeps large-project URLs short.
    roomSlugs: allRoomsSelected ? [] : Array.from(selectedRooms).sort(),
    mediaTypes: Array.from(mediaTypes).sort() as QualityExportMediaType[],
    attemptScope,
  }), [projectSlug, scope, currentDate, dateFrom, dateTo, allRoomsSelected, selectedRooms, mediaTypes, attemptScope]);

  useEffect(() => {
    if (!valid) {
      setEstimate(null);
      setEstimateError(null);
      setEstimating(false);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setEstimating(true);
      setEstimateError(null);
      getQualityExportEstimate(filters, controller.signal)
        .then(setEstimate)
        .catch((reason: unknown) => {
          if (reason instanceof DOMException && reason.name === 'AbortError') return;
          setEstimate(null);
          setEstimateError(reason instanceof Error ? reason.message : 'Could not estimate this export.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setEstimating(false);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [filters, valid]);

  const setMedia = (media: QualityExportMediaType, checked: boolean) => {
    setMediaTypes((current) => {
      const next = new Set(current);
      if (checked) next.add(media);
      else next.delete(media);
      return next;
    });
  };

  const setRoom = (roomSlug: string, checked: boolean) => {
    setSelectedRooms((current) => {
      const next = new Set(current);
      if (checked) next.add(roomSlug);
      else next.delete(roomSlug);
      return next;
    });
  };

  const handleDownload = async () => {
    if (!estimate || estimate.row_count === 0 || !valid) return;
    setDownloading(true);
    let writable: WritableDownload | null = null;
    try {
      const picker = (window as FilePickerWindow).showSaveFilePicker;
      if (picker) {
        const handle = await picker.call(window, {
          suggestedName: estimate.filename,
          types: [{ description: 'CSV file', accept: { 'text/csv': ['.csv'] } }],
        });
        writable = await handle.createWritable();
      }

      const response = await fetchQualityExportCsv(filters);
      if (writable) {
        if (response.body) {
          await response.body.pipeTo(writable);
          writable = null;
        } else {
          await writable.write(await response.blob());
          await writable.close();
          writable = null;
        }
      } else {
        downloadBlob(await response.blob(), estimate.filename);
      }
      toast.success(`Quality CSV downloaded · approximately ${estimate.row_count.toLocaleString()} row${estimate.row_count === 1 ? '' : 's'}.`);
      onClose();
    } catch (reason) {
      if (writable) {
        try { await writable.abort(reason); } catch { /* best effort */ }
      }
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      toast.error(reason instanceof Error ? reason.message : 'Quality CSV export failed.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Export quality data"
      subtitle={projectName}
      busy={downloading}
      busyMessage="Exporting quality CSV…"
      busySubMessage="Large exports are streamed directly to disk when your browser supports it."
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={downloading}
            className="rounded-md border border-base-700 px-3.5 py-1.5 text-[12px] font-medium text-ink-200 transition hover:border-base-600 hover:text-white disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={!valid || estimating || !estimate || estimate.row_count === 0 || downloading}
            className="inline-flex items-center gap-2 rounded-md bg-amber-500 px-3.5 py-1.5 text-[12px] font-semibold text-base-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {downloading ? <Loader2 size={13} className="animate-spin" /> : <FileDown size={13} />}
            Download CSV
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <section>
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">Date scope</p>
          <div role="radiogroup" className="grid gap-2 sm:grid-cols-3">
            <ChoiceCard
              checked={scope === 'current'}
              title="Current date"
              detail={currentDate || 'No current date selected'}
              onClick={() => setScope('current')}
            />
            <ChoiceCard
              checked={scope === 'range'}
              title="Date range"
              detail="Choose an experiment period."
              onClick={() => setScope('range')}
            />
            <ChoiceCard
              checked={scope === 'all'}
              title="All project dates"
              detail="Explicit full-history export."
              onClick={() => setScope('all')}
            />
          </div>
          {scope === 'range' && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-[10px] text-ink-500">
                From
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(event) => setDateFrom(event.target.value)}
                  className="mt-1 block w-full rounded-md border border-base-700 bg-base-950 px-3 py-2 text-[12px] text-white outline-none focus:border-amber-500"
                />
              </label>
              <label className="text-[10px] text-ink-500">
                To
                <input
                  type="date"
                  value={dateTo}
                  onChange={(event) => setDateTo(event.target.value)}
                  className="mt-1 block w-full rounded-md border border-base-700 bg-base-950 px-3 py-2 text-[12px] text-white outline-none focus:border-amber-500"
                />
              </label>
            </div>
          )}
          {scope === 'all' && (
            <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-700/40 bg-amber-500/5 px-3 py-2.5">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-400" />
              <p className="text-[10px] leading-relaxed text-amber-100">This scans every matching robot capture across the project. Check the estimate below before downloading.</p>
            </div>
          )}
          {invalidDateRange && <p className="mt-2 text-[10px] text-red-300">Choose a valid start and end date.</p>}
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">Rooms</p>
            <div className="flex items-center gap-2 text-[10px]">
              <button type="button" onClick={() => setSelectedRooms(new Set(rooms.map((room) => room.slug)))} className="text-amber-400 hover:text-amber-300">All</button>
              <span className="text-base-700">·</span>
              <button type="button" onClick={() => setSelectedRooms(new Set())} className="text-ink-500 hover:text-white">Clear</button>
            </div>
          </div>
          <div className="grid max-h-40 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
            {rooms.map((room) => (
              <ToggleRow
                key={room.id}
                checked={selectedRooms.has(room.slug)}
                label={room.name}
                onChange={(checked) => setRoom(room.slug, checked)}
              />
            ))}
          </div>
          {selectedRooms.size === 0 && <p className="mt-2 text-[10px] text-red-300">Select at least one room.</p>}
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">Media</p>
            <div className="space-y-2">
              <ToggleRow checked={mediaTypes.has('image')} label="Images" detail="Appearance, gate and pose metrics" onChange={(checked) => setMedia('image', checked)} />
              <ToggleRow checked={mediaTypes.has('pointcloud')} label="Point clouds" detail="Count, extent and intensity metrics" onChange={(checked) => setMedia('pointcloud', checked)} />
            </div>
            {mediaTypes.size === 0 && <p className="mt-2 text-[10px] text-red-300">Select at least one media type.</p>}
          </div>
          <div>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">Capture attempts</p>
            <div role="radiogroup" className="space-y-2">
              <ChoiceCard checked={attemptScope === 'all'} title="All attempts" detail="Includes rejected and failed recaptures." onClick={() => setAttemptScope('all')} />
              <ChoiceCard checked={attemptScope === 'selected'} title="Selected only" detail="One uploaded result per asset." onClick={() => setAttemptScope('selected')} />
            </div>
          </div>
        </section>

        <section className="rounded-md border border-base-800 bg-base-950/40 p-3.5">
          <div className="flex items-center gap-2">
            <Database size={14} className="text-amber-400" />
            <p className="text-[11px] font-medium text-white">Export estimate</p>
            {estimating && <Loader2 size={12} className="ml-auto animate-spin text-ink-400" />}
          </div>
          {estimate && !estimating && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div><p className="text-[10px] text-ink-500">Robot assets</p><p className="mt-0.5 font-mono text-[14px] text-white">{estimate.asset_count.toLocaleString()}</p></div>
              <div><p className="text-[10px] text-ink-500">CSV rows</p><p className="mt-0.5 font-mono text-[14px] text-white">{estimate.row_count.toLocaleString()}</p></div>
            </div>
          )}
          {estimate && estimate.row_count === 0 && !estimating && <p className="mt-2 text-[10px] text-ink-500">No robot quality records match these filters.</p>}
          {estimate && estimate.row_count >= 100_000 && !estimating && (
            <p className="mt-2 text-[10px] leading-relaxed text-amber-200">This is a large export. Narrow the filters if you do not need the full selection.</p>
          )}
          {estimateError && <p className="mt-2 text-[10px] text-red-300">{estimateError}</p>}
        </section>
      </div>
    </Modal>
  );
}
