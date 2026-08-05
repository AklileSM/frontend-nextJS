'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Database, Loader2 } from 'lucide-react';
import { getFileAssetDetails } from '@/services/api/files';
import { Modal } from '@/components/ui/Modal';
import type { ApiFileAssetDetails, ApiMediaFile } from '@/types/api';

type JsonRecord = Record<string, unknown>;

type Props = {
  file: ApiMediaFile;
  open: boolean;
  onClose: () => void;
};

const METRIC_LABELS: Record<string, string> = {
  blur_laplacian_var: 'Sharpness (Laplacian variance)',
  mean_luminance: 'Mean luminance',
  rms_contrast: 'RMS contrast',
  clipped_highlight_frac: 'Clipped highlights',
  clipped_shadow_frac: 'Clipped shadows',
  file_bytes: 'Captured file size',
  width: 'Width',
  height: 'Height',
  is_equirectangular: 'Equirectangular image',
  pose_available: 'Capture pose available',
  pose_deviation_m: 'Pose deviation',
  pose_deviation_xy_m: 'Horizontal pose deviation',
  pose_deviation_z_m: 'Vertical pose deviation',
  pose_deviation_deg: 'Heading deviation',
  point_count: 'Point count',
  bbox_extent_m: 'Bounding-box extent',
  bbox_max_extent_m: 'Maximum extent',
  bbox_volume_m3: 'Bounding-box volume',
  intensity_nonzero_frac: 'Non-zero intensity',
  intensity_sampled_points: 'Intensity samples',
};

const IMAGE_GATE_METRICS = [
  'blur_laplacian_var',
  'mean_luminance',
  'clipped_highlight_frac',
  'clipped_shadow_frac',
];

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function humanize(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatBytes(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return 'Not recorded';
  if (value < 1024) return `${value} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let amount = value / 1024;
  let unit = 0;
  while (amount >= 1024 && unit < units.length - 1) {
    amount /= 1024;
    unit += 1;
  }
  return `${amount.toFixed(amount >= 100 ? 0 : amount >= 10 ? 1 : 2)} ${units[unit]}`;
}

function formatMetricValue(key: string, value: unknown): string {
  if (value == null) return 'Not available';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) {
    return value.map((item) => typeof item === 'number' ? item.toFixed(3) : String(item)).join(' × ');
  }
  if (typeof value === 'number') {
    if (key === 'file_bytes') return formatBytes(value);
    if (key.endsWith('_frac')) return `${(value * 100).toFixed(2)}%`;
    if (key.endsWith('_deg')) return `${value.toFixed(2)}°`;
    if (key.endsWith('_m')) return `${value.toFixed(3)} m`;
    if (key.endsWith('_m3')) return `${value.toFixed(3)} m³`;
    if (key === 'point_count' || key === 'intensity_sampled_points' || key === 'width' || key === 'height') {
      return value.toLocaleString();
    }
    return value.toLocaleString(undefined, { maximumFractionDigits: 5 });
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function formatMetadataValue(value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return value.toLocaleString(undefined, { maximumFractionDigits: 6 });
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}

function metricIsFlagged(metric: string, flags: string[]): boolean {
  return flags.some((flag) => flag === metric || flag.startsWith(`${metric}_`));
}

function MetricGrid({ checks, flags, only }: { checks: JsonRecord; flags: string[]; only?: string[] }) {
  const entries = Object.entries(checks).filter(([key]) => !only || only.includes(key));
  if (!entries.length) return null;
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {entries.map(([key, value]) => {
        const unavailable = value == null;
        const flagged = metricIsFlagged(key, flags);
        return (
          <div key={key} className="rounded-md border border-base-800 bg-base-950/55 px-3 py-2.5">
            <div className="flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${flagged ? 'bg-amber-400' : unavailable ? 'bg-base-600' : 'bg-emerald-400'}`} />
              <p className="truncate text-[11px] text-ink-400" title={METRIC_LABELS[key] ?? humanize(key)}>
                {METRIC_LABELS[key] ?? humanize(key)}
              </p>
            </div>
            <p className={`mt-1 break-words font-mono text-[12px] ${flagged ? 'text-amber-200' : unavailable ? 'text-ink-500' : 'text-white'}`}>
              {formatMetricValue(key, value)}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function OverviewRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid gap-1 border-b border-base-800/80 py-2.5 last:border-0 sm:grid-cols-[150px_1fr] sm:gap-4">
      <dt className="text-[11px] text-ink-500">{label}</dt>
      <dd className={`min-w-0 break-words text-[12px] text-ink-100 ${mono ? 'font-mono' : ''}`}>{value}</dd>
    </div>
  );
}

function gatePresentation(gate: JsonRecord | null): { label: string; className: string } {
  if (!gate) return { label: 'Not gated', className: 'bg-base-800 text-ink-300' };
  const mode = String(gate.mode ?? 'observe');
  const passed = gate.passed === true;
  const outcome = String(gate.outcome ?? '');
  if (mode === 'observe') {
    return passed
      ? { label: 'Observed · within limits', className: 'bg-emerald-500/15 text-emerald-300' }
      : { label: 'Observed · warning', className: 'bg-amber-500/15 text-amber-200' };
  }
  if (passed) {
    return {
      label: outcome === 'passed_after_retry' ? 'Passed after retry' : 'Passed first capture',
      className: 'bg-emerald-500/15 text-emerald-300',
    };
  }
  return { label: 'Best attempt uploaded with warning', className: 'bg-amber-500/15 text-amber-200' };
}

function QualityGateAttempts({ gate }: { gate: JsonRecord }) {
  const attempts = Array.isArray(gate.attempts) ? gate.attempts.map(asRecord).filter(Boolean) as JsonRecord[] : [];
  if (!attempts.length) return null;

  return (
    <div className="mt-4 space-y-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">Capture attempts</p>
      {attempts.map((attempt, index) => {
        const attemptGate = asRecord(attempt.gate);
        const attemptQuality = asRecord(attempt.quality);
        const checks = asRecord(attemptQuality?.checks) ?? {};
        const flags = stringArray(attemptGate?.flags);
        const selected = attempt.selected === true;
        const passed = attemptGate?.passed === true;
        const captureError = typeof attempt.capture_error === 'string' ? attempt.capture_error : null;
        return (
          <div key={String(attempt.attempt ?? index + 1)} className={`rounded-md border p-3 ${selected ? 'border-amber-500/50 bg-amber-500/5' : 'border-base-800 bg-base-950/30'}`}>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-white">Capture {String(attempt.attempt ?? index + 1)}</span>
                {selected && <span className="rounded-sm bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-300">Selected</span>}
              </div>
              <span className={`text-[11px] ${captureError || !passed ? 'text-amber-300' : 'text-emerald-300'}`}>
                {captureError ? 'Capture error' : passed ? 'Passed' : 'Flagged'}
              </span>
            </div>
            {captureError ? (
              <p className="break-words text-[11px] text-amber-200">{captureError}</p>
            ) : (
              <MetricGrid checks={checks} flags={flags} only={IMAGE_GATE_METRICS} />
            )}
            {flags.length > 0 && (
              <p className="mt-2 text-[10px] text-amber-200/80">{flags.map(humanize).join(' · ')}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function AssetDetailsModal({ file, open, onClose }: Props) {
  const [details, setDetails] = useState<ApiFileAssetDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDetails(null);
    getFileAssetDetails(file.id)
      .then((result) => {
        if (!cancelled) setDetails(result);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Could not load file details.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, file.id]);

  const metadata = details?.metadata ?? {};
  const robot = asRecord(metadata.robot);
  const quality = asRecord(robot?.quality);
  const checks = asRecord(quality?.checks) ?? {};
  const qualityFlags = stringArray(quality?.advisory_flags);
  const gate = asRecord(robot?.quality_gate);
  const gateBadge = gatePresentation(gate);
  const captureMetadata = useMemo(
    () => robot ? Object.entries(robot).filter(([key]) => key !== 'quality' && key !== 'quality_gate') : [],
    [robot],
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title="Asset details"
      subtitle={details?.display_name ?? file.file_name}
      footer={
        <button type="button" onClick={onClose} className="rounded-md bg-amber-500 px-3.5 py-1.5 text-[13px] font-semibold text-base-950 transition hover:bg-amber-400">
          Close
        </button>
      }
    >
      {loading && (
        <div className="flex min-h-48 items-center justify-center gap-2 text-[13px] text-ink-400">
          <Loader2 size={16} className="animate-spin text-amber-400" />
          Loading stored metadata…
        </div>
      )}

      {!loading && error && (
        <div className="rounded-md border border-red-800/60 bg-red-950/30 p-4">
          <p className="text-[13px] text-red-200">{error}</p>
        </div>
      )}

      {!loading && details && (
        <div className="space-y-6">
          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-display text-[15px] font-semibold text-white">File</h3>
              <span className="rounded-sm bg-base-800 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-300">
                {details.media_type}
              </span>
            </div>
            <dl className="rounded-md border border-base-800 bg-base-950/30 px-4">
              <OverviewRow label="Display name" value={details.display_name} />
              <OverviewRow label="Original name" value={details.original_name} />
              <OverviewRow label="Project" value={details.project_name} />
              <OverviewRow label="Room" value={details.room_name} />
              <OverviewRow label="Capture date" value={details.capture_date} mono />
              <OverviewRow label="Uploaded" value={new Date(details.created_at).toLocaleString()} />
              <OverviewRow label="File size" value={formatBytes(details.file_size)} />
              <OverviewRow label="Content type" value={details.content_type ?? 'Not recorded'} mono />
              <OverviewRow label="Asset ID" value={details.id} mono />
              {details.sha256_hash && <OverviewRow label="SHA-256" value={details.sha256_hash} mono />}
            </dl>
          </section>

          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-[15px] font-semibold text-white">Quality checks</h3>
                <p className="mt-0.5 text-[11px] text-ink-500">
                  {quality ? `Computed by ${String(quality.computed_by ?? 'robot')} · ${String(quality.media ?? details.media_type)}` : 'No automated quality record was stored.'}
                </p>
              </div>
              {quality && <span className={`rounded-sm px-2 py-1 text-[10px] font-semibold ${gateBadge.className}`}>{gateBadge.label}</span>}
            </div>

            {quality ? (
              <>
                <MetricGrid checks={checks} flags={qualityFlags} />
                {qualityFlags.length > 0 && (
                  <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-700/40 bg-amber-500/5 px-3 py-2.5">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-400" />
                    <p className="text-[11px] leading-relaxed text-amber-100">Advisory flags: {qualityFlags.map(humanize).join(' · ')}</p>
                  </div>
                )}
                {qualityFlags.length === 0 && Object.keys(checks).length > 0 && (
                  <div className="mt-3 flex items-center gap-2 text-[11px] text-emerald-300">
                    <CheckCircle2 size={14} /> No advisory flags on the selected asset.
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-md border border-base-800 bg-base-950/30 px-4 py-5 text-[12px] text-ink-500">
                This file predates automated capture-quality measurements or was uploaded manually.
              </div>
            )}

            {gate && (
              <div className="mt-4 rounded-md border border-base-800 bg-base-950/30 p-4">
                <div className="grid gap-3 sm:grid-cols-4">
                  <div><p className="text-[10px] text-ink-500">Mode</p><p className="mt-1 text-[12px] text-white">{humanize(String(gate.mode ?? 'observe'))}</p></div>
                  <div><p className="text-[10px] text-ink-500">Outcome</p><p className="mt-1 text-[12px] text-white">{humanize(String(gate.outcome ?? 'observed'))}</p></div>
                  <div><p className="text-[10px] text-ink-500">Attempts</p><p className="mt-1 text-[12px] text-white">{String(gate.attempt_count ?? 1)} / {String(gate.max_attempts ?? 1)}</p></div>
                  <div><p className="text-[10px] text-ink-500">Selected</p><p className="mt-1 text-[12px] text-white">Capture {String(gate.selected_attempt ?? 1)}</p></div>
                </div>
                <QualityGateAttempts gate={gate} />
              </div>
            )}
          </section>

          {captureMetadata.length > 0 && (
            <section>
              <h3 className="mb-3 font-display text-[15px] font-semibold text-white">Robot capture metadata</h3>
              <dl className="rounded-md border border-base-800 bg-base-950/30 px-4">
                {captureMetadata.map(([key, value]) => (
                  <OverviewRow key={key} label={humanize(key)} value={formatMetadataValue(value)} mono={typeof value !== 'string'} />
                ))}
              </dl>
            </section>
          )}

          <section>
            <details className="group rounded-md border border-base-800 bg-base-950/30">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-[12px] font-medium text-ink-200 transition hover:text-white">
                <Database size={14} className="text-amber-400" />
                All stored metadata
                <span className="ml-auto text-[10px] text-ink-500 group-open:hidden">Show JSON</span>
                <span className="ml-auto hidden text-[10px] text-ink-500 group-open:inline">Hide JSON</span>
              </summary>
              <pre className="max-h-96 overflow-auto border-t border-base-800 p-4 font-mono text-[10px] leading-relaxed text-ink-300">
                {JSON.stringify(metadata, null, 2)}
              </pre>
            </details>
          </section>
        </div>
      )}
    </Modal>
  );
}
