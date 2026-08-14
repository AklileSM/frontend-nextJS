'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, CircleHelp, Loader2 } from 'lucide-react';
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

type MetricHelpContent = {
  description: string;
  interpretation: string;
  threshold: string;
  thresholdType: 'gate' | 'advisory' | 'informational';
};

// Keep these values aligned with robot/capture_quality.py::ADVISORY_THRESHOLDS.
// Existing quality records do not store the thresholds that evaluated them, so
// this UI documents the schema-1 limits currently used by the robot.
const METRIC_HELP: Record<string, MetricHelpContent> = {
  blur_laplacian_var: {
    description: 'Variance of a four-neighbour Laplacian on the normalized grayscale image. It measures the amount of fine edge detail.',
    interpretation: 'Higher values generally mean a sharper image; very smooth scenes can also produce a low value.',
    threshold: 'Pass: at least 60.',
    thresholdType: 'gate',
  },
  mean_luminance: {
    description: 'Average grayscale brightness on a scale from 0 (black) to 255 (white).',
    interpretation: 'Very low values indicate underexposure; very high values indicate overexposure.',
    threshold: 'Pass: 25 to 235, inclusive.',
    thresholdType: 'gate',
  },
  rms_contrast: {
    description: 'Standard deviation of grayscale pixel values, reported on the 0–255 brightness scale.',
    interpretation: 'Higher values indicate more tonal variation. It does not by itself prove that an image is good or bad.',
    threshold: 'No automated threshold.',
    thresholdType: 'informational',
  },
  clipped_highlight_frac: {
    description: 'Percentage of evaluated pixels with brightness at or above 250 out of 255, where bright detail is likely lost.',
    interpretation: 'Lower is better.',
    threshold: 'Pass: no more than 15%.',
    thresholdType: 'gate',
  },
  clipped_shadow_frac: {
    description: 'Percentage of evaluated pixels with brightness at or below 5 out of 255, where dark detail is likely lost.',
    interpretation: 'Lower is better.',
    threshold: 'Pass: no more than 25%.',
    thresholdType: 'gate',
  },
  file_bytes: {
    description: 'Size of the captured file stored on disk.',
    interpretation: 'Useful for detecting unusual files, but file size depends on compression and scene detail.',
    threshold: 'No automated threshold.',
    thresholdType: 'informational',
  },
  width: {
    description: 'Horizontal pixel count of the decoded image.',
    interpretation: 'Records image resolution; it is not used to accept or reject a capture.',
    threshold: 'No automated threshold.',
    thresholdType: 'informational',
  },
  height: {
    description: 'Vertical pixel count of the decoded image.',
    interpretation: 'Records image resolution; it is not used to accept or reject a capture.',
    threshold: 'No automated threshold.',
    thresholdType: 'informational',
  },
  is_equirectangular: {
    description: 'Whether the image aspect ratio matches a 2:1 equirectangular panorama.',
    interpretation: 'When true, image statistics use only the middle 50% of the panorama height to reduce pole distortion.',
    threshold: 'Detected when |width / height − 2.0| is below 0.04.',
    thresholdType: 'informational',
  },
  pose_available: {
    description: 'Whether a localized robot pose was recorded when the asset was captured.',
    interpretation: 'A pose is required to calculate waypoint position and heading deviation.',
    threshold: 'No automated threshold.',
    thresholdType: 'informational',
  },
  pose_deviation_m: {
    description: 'Three-dimensional distance between the commanded waypoint and the recorded capture pose.',
    interpretation: 'Lower means the robot captured closer to the requested position.',
    threshold: 'Advisory limit: no more than 0.35 m. This does not trigger image recapture.',
    thresholdType: 'advisory',
  },
  pose_deviation_xy_m: {
    description: 'Horizontal distance in the map plane between the commanded waypoint and the recorded capture pose.',
    interpretation: 'Lower means better horizontal repeatability.',
    threshold: 'No separate threshold; the 0.35 m advisory limit applies to total pose deviation.',
    thresholdType: 'informational',
  },
  pose_deviation_z_m: {
    description: 'Signed vertical difference between the commanded waypoint and the recorded capture pose.',
    interpretation: 'A value closer to zero means better vertical repeatability.',
    threshold: 'No separate threshold; the 0.35 m advisory limit applies to total pose deviation.',
    thresholdType: 'informational',
  },
  pose_deviation_deg: {
    description: 'Smallest absolute yaw-angle difference between the commanded heading and the recorded capture heading.',
    interpretation: 'Lower means the camera faced closer to the requested direction.',
    threshold: 'Advisory limit: no more than 15°. This does not trigger image recapture.',
    thresholdType: 'advisory',
  },
  point_count: {
    description: 'Total number of points stored in the LAS or LAZ point cloud.',
    interpretation: 'Very low counts can indicate an incomplete or empty scan.',
    threshold: 'Advisory minimum: 50,000 points.',
    thresholdType: 'advisory',
  },
  bbox_extent_m: {
    description: 'Point-cloud span along its X, Y, and Z axes, calculated as maximum minus minimum coordinate.',
    interpretation: 'Shows the physical area covered by the scan.',
    threshold: 'No separate threshold.',
    thresholdType: 'informational',
  },
  bbox_max_extent_m: {
    description: 'Largest of the point cloud’s X, Y, and Z bounding-box spans.',
    interpretation: 'A very small value can indicate that the cloud covers almost no scene.',
    threshold: 'Advisory minimum: 1.0 m.',
    thresholdType: 'advisory',
  },
  bbox_volume_m3: {
    description: 'Volume of the axis-aligned point-cloud bounding box: X span × Y span × Z span.',
    interpretation: 'Summarizes spatial coverage but can be affected strongly by outliers.',
    threshold: 'No automated threshold.',
    thresholdType: 'informational',
  },
  intensity_nonzero_frac: {
    description: 'Percentage of sampled point-cloud returns whose recorded intensity is not zero.',
    interpretation: 'A low value can indicate missing intensity data; it does not necessarily mean the geometry is invalid.',
    threshold: 'No automated threshold.',
    thresholdType: 'informational',
  },
  intensity_sampled_points: {
    description: 'Number of points inspected when calculating the non-zero intensity percentage.',
    interpretation: 'The robot samples at most 200,000 points to limit memory and processing cost.',
    threshold: 'No automated threshold.',
    thresholdType: 'informational',
  },
};

const IMAGE_GATE_METRICS = [
  'blur_laplacian_var',
  'mean_luminance',
  'clipped_highlight_frac',
  'clipped_shadow_frac',
];

const ROBOT_METADATA_FIELDS = [
  { key: 'capture_outputs', label: 'Capture output' },
  { key: 'source', label: 'Source' },
  { key: 'scheduled_for', label: 'Scheduled for' },
  { key: 'agent_robot_id', label: 'Agent robot ID' },
  { key: 'target_waypoint_pose', label: 'Target waypoint pose' },
  { key: 'navigation_result', label: 'Navigation result' },
  { key: 'waypoint_index', label: 'Waypoint index' },
  { key: 'waypoint_count', label: 'Waypoint count' },
  { key: 'sensor', label: 'Sensor' },
  { key: 'captured_at', label: 'Captured at' },
  { key: 'pose', label: 'Pose' },
] as const;

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

function MetricHelp({ metric, label }: { metric: string; label: string }) {
  const help = METRIC_HELP[metric] ?? {
    description: `${label} is stored capture metadata.`,
    interpretation: 'No additional interpretation has been defined for this metric.',
    threshold: 'No automated threshold.',
    thresholdType: 'informational' as const,
  };
  const thresholdClass = help.thresholdType === 'gate'
    ? 'text-emerald-300'
    : help.thresholdType === 'advisory'
      ? 'text-amber-300'
      : 'text-ink-300';

  return (
    <span className="group relative inline-flex shrink-0">
      <button
        type="button"
        aria-label={`Explain ${label}`}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-ink-500 outline-none transition hover:bg-base-800 hover:text-amber-300 focus-visible:ring-1 focus-visible:ring-amber-400 focus-visible:text-amber-300"
      >
        <CircleHelp size={12} />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-50 mt-1.5 hidden w-64 -translate-x-1/2 rounded-md border border-base-700 bg-base-900 p-3 text-left shadow-xl shadow-black/50 group-hover:block group-focus-within:block"
      >
        <span className="block text-[11px] font-medium leading-relaxed text-ink-100">{help.description}</span>
        <span className="mt-1.5 block text-[10px] leading-relaxed text-ink-400">{help.interpretation}</span>
        <span className={`mt-2 block border-t border-base-700 pt-2 text-[10px] font-semibold leading-relaxed ${thresholdClass}`}>
          {help.thresholdType === 'gate' ? 'Image gate · ' : help.thresholdType === 'advisory' ? 'Advisory only · ' : ''}{help.threshold}
        </span>
      </span>
    </span>
  );
}

function MetricGrid({ checks, flags, only }: { checks: JsonRecord; flags: string[]; only?: string[] }) {
  const entries = Object.entries(checks).filter(([key]) => !only || only.includes(key));
  if (!entries.length) return null;
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {entries.map(([key, value]) => {
        const unavailable = value == null;
        const flagged = metricIsFlagged(key, flags);
        const label = METRIC_LABELS[key] ?? humanize(key);
        return (
          <div key={key} className="relative rounded-md border border-base-800 bg-base-950/55 px-3 py-2.5">
            <div className="flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${flagged ? 'bg-amber-400' : unavailable ? 'bg-base-600' : 'bg-emerald-400'}`} />
              <p className="min-w-0 truncate text-[11px] text-ink-400" title={label}>
                {label}
              </p>
              <MetricHelp metric={key} label={label} />
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
    () => robot
      ? ROBOT_METADATA_FIELDS.flatMap(({ key, label }) => (
        Object.prototype.hasOwnProperty.call(robot, key)
          ? [{ key, label, value: robot[key] }]
          : []
      ))
      : [],
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
              <OverviewRow label="Project" value={details.project_name} />
              <OverviewRow label="Room" value={details.room_name} />
              <OverviewRow label="Capture date" value={details.capture_date} mono />
              <OverviewRow label="Uploaded" value={new Date(details.created_at).toLocaleString()} />
              <OverviewRow label="File size" value={formatBytes(details.file_size)} />
              <OverviewRow label="Content type" value={details.content_type ?? 'Not recorded'} mono />
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
                {captureMetadata.map(({ key, label, value }) => (
                  <OverviewRow key={key} label={label} value={formatMetadataValue(value)} mono={typeof value !== 'string'} />
                ))}
              </dl>
            </section>
          )}
        </div>
      )}
    </Modal>
  );
}
