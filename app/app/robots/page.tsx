'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import type { MouseEvent, PointerEvent, WheelEvent } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Bot, Check, ChevronDown, Loader2, MapPin, Plus, RefreshCcw, RotateCcw, Send, Trash2, XCircle, ZoomIn, ZoomOut } from 'lucide-react';
import { toast } from 'sonner';
import {
  cancelRobotMission,
  createRobotCapturePoint,
  createRobotMission,
  deleteRobotCapturePoint,
  deleteRobotMission,
  getRobotMap,
  getRobotTelemetry,
  listRobotCapturePoints,
  listProjects,
  listRobotMissions,
  listRobots,
  uploadRobotMap,
  updateRobotCapturePoint,
} from '@/services/apiClient';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Modal } from '@/components/ui/Modal';
import { MoreMenu } from '@/components/ui/MoreMenu';
import type { ApiProject, ApiRobotCapturePoint, ApiRobotMap, ApiRobotMission, ApiRobotSummary, ApiRobotTelemetry } from '@/types/api';

export const dynamic = 'force-dynamic';

const STATUS_STYLES: Record<string, string> = {
  queued: 'bg-base-800 text-amber-300',
  dispatched: 'bg-cyan-500/10 text-cyan-300',
  running: 'bg-blue-500/10 text-blue-300',
  succeeded: 'bg-emerald-500/10 text-emerald-300',
  failed: 'bg-red-500/10 text-red-300',
  cancelled: 'bg-base-700 text-ink-300',
  pending: 'bg-base-800 text-ink-300',
};

type CaptureOutput = 'image' | 'pointcloud';
type MissionProgressStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped' | 'cancelled';

type MissionProgressEvent = {
  id: string;
  label: string;
  status: MissionProgressStatus;
  phase?: string;
  detail?: string | null;
  waypoint_index?: number;
  waypoint_name?: string;
  room_slug?: string | null;
  media_type?: string;
  started_at_utc?: string;
  completed_at_utc?: string;
  updated_at_utc?: string;
};

const CAPTURE_OUTPUT_OPTIONS: Array<{ value: CaptureOutput; label: string }> = [
  { value: 'image', label: 'Image' },
  { value: 'pointcloud', label: 'PCD' },
];

const PROGRESS_STATUS_LABELS: Record<MissionProgressStatus, string> = {
  pending: 'Pending',
  running: 'Running',
  succeeded: '',
  failed: 'Failed',
  skipped: 'Skipped',
  cancelled: 'Cancelled',
};

const PROGRESS_DOT_STYLES: Record<MissionProgressStatus, string> = {
  pending: 'border-base-700 bg-base-900',
  running: 'border-amber-300 bg-amber-400',
  succeeded: 'border-emerald-300 bg-emerald-400',
  failed: 'border-red-300 bg-red-400',
  skipped: 'border-base-600 bg-base-700',
  cancelled: 'border-base-600 bg-base-700',
};

const PROGRESS_BADGE_STYLES: Record<MissionProgressStatus, string> = {
  pending: 'border-base-800 bg-base-950 text-ink-400',
  running: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  succeeded: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  failed: 'border-red-500/30 bg-red-500/10 text-red-200',
  skipped: 'border-base-800 bg-base-950 text-ink-400',
  cancelled: 'border-base-800 bg-base-950 text-ink-400',
};

const PROGRESS_TEXT_STYLES: Record<MissionProgressStatus, string> = {
  pending: 'text-ink-500',
  running: 'text-amber-100',
  succeeded: 'text-white',
  failed: 'text-red-100',
  skipped: 'text-ink-500',
  cancelled: 'text-ink-500',
};

const PROGRESS_DETAIL_STYLES: Record<MissionProgressStatus, string> = {
  pending: 'text-ink-500',
  running: 'text-amber-200/80',
  succeeded: 'text-ink-300',
  failed: 'text-red-200',
  skipped: 'text-ink-500',
  cancelled: 'text-ink-500',
};

const TELEMETRY_STALE_SECONDS = 6;
const TELEMETRY_TRAIL_LIMIT = 160;

type MapMarker = {
  x: number;
  y: number;
  yaw?: number | null;
};

type TelemetryTrailPoint = {
  x: number;
  y: number;
  z: number;
  yaw: number | null;
  received_at_utc: string;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatCaptureOutputs(outputs: CaptureOutput[]): string {
  if (outputs.includes('image') && outputs.includes('pointcloud')) return 'Image + PCD';
  if (outputs.includes('pointcloud')) return 'PCD only';
  return 'Image only';
}

function formatLastSeen(value: string | null): string {
  if (!value) return 'Never';
  return new Date(value).toLocaleString();
}

function canCancelMission(status: string): boolean {
  return ['queued', 'dispatched', 'running'].includes(status);
}

function canDeleteMission(status: string): boolean {
  return ['queued', 'dispatched', 'running', 'cancelled', 'failed', 'succeeded'].includes(status);
}

function missionFailureMessage(mission: ApiRobotMission): string | null {
  const stepError = mission.steps.find((step) => step.error_message)?.error_message;
  if (stepError) return stepError;
  const resultError = mission.result?.['error'];
  return typeof resultError === 'string' && resultError.trim() ? resultError : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeProgressStatus(value: unknown): MissionProgressStatus {
  const status = typeof value === 'string' ? value.toLowerCase() : '';
  if (status === 'running') return 'running';
  if (status === 'succeeded' || status === 'success' || status === 'done') return 'succeeded';
  if (status === 'failed' || status === 'error') return 'failed';
  if (status === 'skipped') return 'skipped';
  if (status === 'cancelled' || status === 'canceled') return 'cancelled';
  return 'pending';
}

function normalizeProgressEvent(value: unknown, index: number): MissionProgressEvent | null {
  if (!isRecord(value)) return null;
  const label = typeof value.label === 'string' && value.label.trim()
    ? value.label
    : null;
  if (!label) return null;
  const detail = typeof value.detail === 'string' && value.detail.trim() ? value.detail : null;
  return {
    id: typeof value.id === 'string' && value.id.trim() ? value.id : `progress-${index}`,
    label,
    status: normalizeProgressStatus(value.status),
    phase: typeof value.phase === 'string' ? value.phase : undefined,
    detail,
    waypoint_index: typeof value.waypoint_index === 'number' ? value.waypoint_index : undefined,
    waypoint_name: typeof value.waypoint_name === 'string' ? value.waypoint_name : undefined,
    room_slug: typeof value.room_slug === 'string' ? value.room_slug : null,
    media_type: typeof value.media_type === 'string' ? value.media_type : undefined,
    started_at_utc: typeof value.started_at_utc === 'string' ? value.started_at_utc : undefined,
    completed_at_utc: typeof value.completed_at_utc === 'string' ? value.completed_at_utc : undefined,
    updated_at_utc: typeof value.updated_at_utc === 'string' ? value.updated_at_utc : undefined,
  };
}

function taskQueuedStatus(mission: ApiRobotMission): MissionProgressStatus {
  if (mission.status === 'queued' || mission.status === 'dispatched') return 'running';
  if (mission.status === 'cancelled') return 'cancelled';
  return 'succeeded';
}

function fallbackProgressEvents(mission: ApiRobotMission): MissionProgressEvent[] {
  const events: MissionProgressEvent[] = [];
  if (mission.started_at) {
    events.push({
      id: 'task:started',
      label: 'Task started',
      status: mission.status === 'running' ? 'succeeded' : normalizeProgressStatus(mission.status),
      started_at_utc: mission.started_at,
      completed_at_utc: mission.started_at,
    });
  }
  mission.steps.forEach((step) => {
    events.push({
      id: `step:${step.id}`,
      label: `Going to ${step.waypoint_name}`,
      status: normalizeProgressStatus(step.status),
      detail: step.error_message ?? step.navigation_result ?? null,
      waypoint_index: step.sequence_index,
      waypoint_name: step.waypoint_name,
      room_slug: step.room_slug,
      started_at_utc: step.started_at ?? undefined,
      completed_at_utc: step.completed_at ?? undefined,
    });
  });
  if (mission.completed_at) {
    events.push({
      id: mission.status === 'failed' ? 'task:failed' : 'task:completed',
      label: mission.status === 'failed' ? 'Task failed' : 'Task completed',
      status: normalizeProgressStatus(mission.status),
      detail: missionFailureMessage(mission),
      completed_at_utc: mission.completed_at,
    });
  }
  return events;
}

function missionProgressEvents(mission: ApiRobotMission): MissionProgressEvent[] {
  const queuedEvent: MissionProgressEvent = {
    id: 'task:queued',
    label: 'Task queued',
    status: taskQueuedStatus(mission),
    started_at_utc: mission.created_at,
    completed_at_utc: mission.status === 'queued' || mission.status === 'dispatched' ? undefined : mission.created_at,
  };
  const rawEvents = mission.result?.['progress_events'];
  const progressEvents = Array.isArray(rawEvents)
    ? rawEvents
      .map((event, index) => normalizeProgressEvent(event, index))
      .filter((event): event is MissionProgressEvent => Boolean(event))
    : [];
  return [queuedEvent, ...(progressEvents.length > 0 ? progressEvents : fallbackProgressEvents(mission))];
}

function formatProgressTime(event: MissionProgressEvent): string | null {
  const value = event.completed_at_utc ?? event.updated_at_utc ?? event.started_at_utc;
  if (!value) return null;
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function progressBadgeLabel(status: MissionProgressStatus): string | null {
  if (status === 'succeeded') return null;
  return PROGRESS_STATUS_LABELS[status];
}

function MissionProgressTimeline({ mission }: { mission: ApiRobotMission }) {
  const events = missionProgressEvents(mission);
  const latestEvent = events[events.length - 1];
  const latestBadgeLabel = latestEvent ? progressBadgeLabel(latestEvent.status) : null;
  const [open, setOpen] = useState(() => ['queued', 'dispatched', 'running'].includes(mission.status));
  return (
    <div className="mt-4 rounded-2xl border border-base-800 bg-base-950/45">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-base-900/60"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-400">Progress</p>
          {latestEvent ? (
            <p className={`mt-1 truncate text-[13px] ${PROGRESS_TEXT_STYLES[latestEvent.status]}`}>
              {latestEvent.label}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {latestEvent && latestBadgeLabel ? (
            <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase ${PROGRESS_BADGE_STYLES[latestEvent.status]}`}>
              {latestBadgeLabel}
            </span>
          ) : null}
          <ChevronDown
            size={15}
            className={`text-ink-400 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </div>
      </button>
      {open ? (
        <ol className="border-t border-base-800 px-4 py-4">
          {events.map((event, index) => {
            const time = formatProgressTime(event);
            const isLast = index === events.length - 1;
            const badgeLabel = progressBadgeLabel(event.status);
            const muted = event.status === 'pending' || event.status === 'skipped' || event.status === 'cancelled';
            return (
              <li key={`${event.id}-${index}`} className={`relative flex gap-3 ${muted ? 'opacity-50' : ''} ${isLast ? '' : 'pb-4'}`}>
                {!isLast ? (
                  <span className="absolute left-[7px] top-4 h-full w-px bg-base-800" />
                ) : null}
                <span className={`relative mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-2 ${PROGRESS_DOT_STYLES[event.status]}`}>
                  {event.status === 'running' ? (
                    <span className="absolute -inset-1 rounded-full bg-amber-400/25 animate-ping" />
                  ) : null}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className={`min-w-0 text-[13px] ${PROGRESS_TEXT_STYLES[event.status]}`}>{event.label}</p>
                    {badgeLabel ? (
                      <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase ${PROGRESS_BADGE_STYLES[event.status]}`}>
                        {badgeLabel}
                      </span>
                    ) : null}
                  </div>
                  {(event.detail || time) ? (
                    <div className={`mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] ${PROGRESS_DETAIL_STYLES[event.status]}`}>
                      {event.detail ? <span className="min-w-0 break-words">{event.detail}</span> : null}
                      {time ? <span className="font-mono">{time}</span> : null}
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      ) : null}
    </div>
  );
}

function normalizedToMapPose(robotMap: ApiRobotMap, marker: { x: number; y: number }): { x: number; y: number } {
  const pixelX = marker.x * robotMap.width;
  const pixelY = marker.y * robotMap.height;
  const localX = pixelX * robotMap.resolution;
  const localY = (robotMap.height - pixelY) * robotMap.resolution;
  const cos = Math.cos(robotMap.origin_yaw);
  const sin = Math.sin(robotMap.origin_yaw);
  return {
    x: robotMap.origin_x + localX * cos - localY * sin,
    y: robotMap.origin_y + localX * sin + localY * cos,
  };
}

function mapPoseToNormalized(robotMap: ApiRobotMap, pose: { x: number; y: number; yaw?: number | null }): MapMarker {
  const dx = pose.x - robotMap.origin_x;
  const dy = pose.y - robotMap.origin_y;
  const cos = Math.cos(robotMap.origin_yaw);
  const sin = Math.sin(robotMap.origin_yaw);
  const localX = dx * cos + dy * sin;
  const localY = -dx * sin + dy * cos;
  const pixelX = localX / robotMap.resolution;
  const pixelY = robotMap.height - localY / robotMap.resolution;
  return {
    x: pixelX / robotMap.width,
    y: pixelY / robotMap.height,
    yaw: pose.yaw === null || pose.yaw === undefined ? null : pose.yaw - robotMap.origin_yaw,
  };
}

function visibleMarker(marker: MapMarker | null): marker is MapMarker {
  return Boolean(marker && marker.x >= 0 && marker.x <= 1 && marker.y >= 0 && marker.y <= 1);
}

function markersToPolyline(markers: MapMarker[]): string {
  return markers
    .filter(visibleMarker)
    .map((marker) => `${(marker.x * 100).toFixed(3)},${(marker.y * 100).toFixed(3)}`)
    .join(' ');
}

function parseUtcTimestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const normalized = /(?:z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : `${value}Z`;
  const timestamp = new Date(normalized).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function timestampAgeSeconds(value: string | null | undefined, nowMs: number): number | null {
  const timestamp = parseUtcTimestamp(value);
  if (timestamp === null) return null;
  return Math.max(0, (nowMs - timestamp) / 1000);
}

function formatTelemetryAge(ageSeconds: number | null): string {
  if (ageSeconds === null) return 'No update';
  if (ageSeconds < 1) return 'Just now';
  if (ageSeconds < 60) return `${Math.round(ageSeconds)}s ago`;
  return `${Math.round(ageSeconds / 60)}m ago`;
}

function radiansToDegrees(value: number): number {
  return Math.round((value * 180) / Math.PI);
}

export default function RobotMissionsPage() {
  const [robots, setRobots] = useState<ApiRobotSummary[]>([]);
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [capturePoints, setCapturePoints] = useState<ApiRobotCapturePoint[]>([]);
  const [robotMap, setRobotMap] = useState<ApiRobotMap | null>(null);
  const [robotMapError, setRobotMapError] = useState<string | null>(null);
  const [missions, setMissions] = useState<ApiRobotMission[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, startRefresh] = useTransition();
  const [submitting, startSubmit] = useTransition();
  const [pendingAction, setPendingAction] = useState<{ type: 'cancel' | 'delete'; mission: ApiRobotMission } | null>(null);
  const mapDragRef = useRef<{ pointerId: number; startX: number; startY: number; panX: number; panY: number; moved: boolean } | null>(null);
  const captureOutputMenuRef = useRef<HTMLDivElement>(null);

  const [robotId, setRobotId] = useState('');
  const [projectSlug, setProjectSlug] = useState('');
  const [selectedCapturePointIds, setSelectedCapturePointIds] = useState<string[]>([]);
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const [mapZoom, setMapZoom] = useState(1);
  const [mapPan, setMapPan] = useState({ x: 0, y: 0 });
  const [addingCapturePoint, setAddingCapturePoint] = useState(false);
  const [newPointName, setNewPointName] = useState('');
  const [newPointMapX, setNewPointMapX] = useState('');
  const [newPointMapY, setNewPointMapY] = useState('');
  const [newPointYaw, setNewPointYaw] = useState('0');
  const [newPointMapMarker, setNewPointMapMarker] = useState<{ x: number; y: number } | null>(null);
  const [newPointFacingMarker, setNewPointFacingMarker] = useState<{ x: number; y: number } | null>(null);
  const [newPointYawLocked, setNewPointYawLocked] = useState(false);
  const [capturePointPickerId, setCapturePointPickerId] = useState('');
  const [renamingCapturePoint, setRenamingCapturePoint] = useState<ApiRobotCapturePoint | null>(null);
  const [renameCapturePointName, setRenameCapturePointName] = useState('');
  const [savingCapturePointRename, setSavingCapturePointRename] = useState(false);
  const [captureOutputs, setCaptureOutputs] = useState<CaptureOutput[]>(['image']);
  const [captureOutputMenuOpen, setCaptureOutputMenuOpen] = useState(false);
  const [robotMapYamlFile, setRobotMapYamlFile] = useState<File | null>(null);
  const [robotMapImageFile, setRobotMapImageFile] = useState<File | null>(null);
  const [uploadingRobotMap, setUploadingRobotMap] = useState(false);
  const [continueOnFailure, setContinueOnFailure] = useState(false);
  const [robotTelemetry, setRobotTelemetry] = useState<ApiRobotTelemetry | null>(null);
  const [robotTelemetryError, setRobotTelemetryError] = useState<string | null>(null);
  const [telemetryTrail, setTelemetryTrail] = useState<TelemetryTrailPoint[]>([]);
  const [telemetryNow, setTelemetryNow] = useState(() => Date.now());

  const refresh = useCallback(async () => {
    const [robotsData, projectsData, missionsData] = await Promise.all([
      listRobots(),
      listProjects(),
      listRobotMissions({ limit: 25 }),
    ]);
    setRobots(robotsData);
    setProjects(projectsData);
    setMissions(missionsData);
    setRobotId((current) => current || robotsData[0]?.username || '');
    setProjectSlug((current) => current || projectsData[0]?.slug || '');
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    refresh()
      .catch((err) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Failed to load robot tasks');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      startRefresh(() => {
        refresh().catch(() => undefined);
      });
    }, 10000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (!captureOutputMenuOpen) return undefined;
    const onPointerDown = (event: globalThis.PointerEvent) => {
      if (captureOutputMenuRef.current && !captureOutputMenuRef.current.contains(event.target as Node)) {
        setCaptureOutputMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCaptureOutputMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [captureOutputMenuOpen]);

  useEffect(() => {
    setRobotTelemetry(null);
    setRobotTelemetryError(null);
    setTelemetryTrail([]);
  }, [projectSlug, robotId]);

  useEffect(() => {
    if (!robotId) {
      setRobotTelemetry(null);
      setRobotTelemetryError(null);
      setTelemetryTrail([]);
      return undefined;
    }

    let cancelled = false;
    const loadTelemetry = async () => {
      setTelemetryNow(Date.now());
      try {
        const telemetry = await getRobotTelemetry(robotId);
        if (cancelled) return;
        setRobotTelemetry(telemetry);
        setRobotTelemetryError(null);
        const receivedAt = telemetry.received_at_utc || telemetry.reported_at_utc || `${telemetry.pose.x}:${telemetry.pose.y}`;
        setTelemetryTrail((current) => {
          const previous = current[current.length - 1];
          if (previous?.received_at_utc === receivedAt) return current;
          const next = [
            ...current,
            {
              ...telemetry.pose,
              yaw: telemetry.pose.yaw ?? null,
              received_at_utc: receivedAt,
            },
          ];
          return next.slice(-TELEMETRY_TRAIL_LIMIT);
        });
      } catch (err) {
        if (!cancelled) {
          setRobotTelemetryError(err instanceof Error ? err.message : 'Live telemetry unavailable');
        }
      }
    };

    loadTelemetry();
    const timer = window.setInterval(() => {
      loadTelemetry().catch(() => undefined);
    }, 200);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [robotId]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.slug === projectSlug) ?? null,
    [projectSlug, projects],
  );
  const selectedCapturePoints = useMemo(
    () => selectedCapturePointIds
      .map((id) => capturePoints.find((point) => point.id === id))
      .filter((point): point is ApiRobotCapturePoint => Boolean(point)),
    [capturePoints, selectedCapturePointIds],
  );
  const availableCapturePoints = useMemo(
    () => capturePoints.filter((point) => !selectedCapturePointIds.includes(point.id)),
    [capturePoints, selectedCapturePointIds],
  );
  const pendingMission = pendingAction?.mission ?? null;
  const pendingActionType = pendingAction?.type ?? null;
  const telemetryAge = robotTelemetry
    ? timestampAgeSeconds(robotTelemetry.received_at_utc ?? robotTelemetry.reported_at_utc, telemetryNow)
    : null;
  const telemetryFresh = telemetryAge !== null && telemetryAge <= TELEMETRY_STALE_SECONDS;
  const telemetryStatus = robotTelemetry ? (telemetryFresh ? 'Live' : 'Stale') : 'Waiting';
  const telemetryStatusStyle = robotTelemetry
    ? telemetryFresh
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
      : 'border-amber-500/30 bg-amber-500/10 text-amber-200'
    : 'border-base-800 bg-base-950 text-ink-400';
  const liveRobotMarker = useMemo(
    () => (robotMap && robotTelemetry ? mapPoseToNormalized(robotMap, robotTelemetry.pose) : null),
    [robotMap, robotTelemetry],
  );
  const goalMarker = useMemo(
    () => (robotMap && robotTelemetry?.goal ? mapPoseToNormalized(robotMap, robotTelemetry.goal) : null),
    [robotMap, robotTelemetry],
  );
  const trailMarkers = useMemo(
    () => (robotMap ? telemetryTrail.map((point) => mapPoseToNormalized(robotMap, point)) : []),
    [robotMap, telemetryTrail],
  );
  const globalPathMarkers = useMemo(
    () => (robotMap && robotTelemetry ? robotTelemetry.global_path.map((point) => mapPoseToNormalized(robotMap, point)) : []),
    [robotMap, robotTelemetry],
  );
  const localPathMarkers = useMemo(
    () => (robotMap && robotTelemetry ? robotTelemetry.local_path.map((point) => mapPoseToNormalized(robotMap, point)) : []),
    [robotMap, robotTelemetry],
  );
  const trailPolyline = useMemo(() => markersToPolyline(trailMarkers), [trailMarkers]);
  const globalPathPolyline = useMemo(() => markersToPolyline(globalPathMarkers), [globalPathMarkers]);
  const localPathPolyline = useMemo(() => markersToPolyline(localPathMarkers), [localPathMarkers]);

  const refreshCapturePoints = useCallback(async (projectId: string) => {
    const points = await listRobotCapturePoints(projectId);
    setCapturePoints(points);
    setSelectedCapturePointIds((current) => current.filter((id) => points.some((point) => point.id === id)));
  }, []);

  useEffect(() => {
    if (!selectedProject) {
      setCapturePoints([]);
      setSelectedCapturePointIds([]);
      setRobotMap(null);
      setAddingCapturePoint(false);
      return;
    }
    refreshCapturePoints(selectedProject.id).catch((err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to load capture points');
    });
    getRobotMap(selectedProject.id)
      .then((map) => {
        setRobotMap(map);
        setRobotMapError(null);
      })
      .catch((err) => {
        setRobotMap(null);
        setRobotMapError(err instanceof Error ? err.message : 'Robot map is not available');
      });
  }, [refreshCapturePoints, selectedProject]);

  const handleUploadRobotMap = useCallback(() => {
    if (!selectedProject) {
      toast.error('Select a project first');
      return;
    }
    if (!robotMapYamlFile || !robotMapImageFile) {
      toast.error('Choose both the map YAML and map image');
      return;
    }
    setUploadingRobotMap(true);
    uploadRobotMap(selectedProject.id, robotMapYamlFile, robotMapImageFile)
      .then((map) => {
        setRobotMap(map);
        setRobotMapError(null);
        setRobotMapYamlFile(null);
        setRobotMapImageFile(null);
        toast.success('Robot map uploaded');
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : 'Failed to upload robot map');
      })
      .finally(() => setUploadingRobotMap(false));
  }, [robotMapImageFile, robotMapYamlFile, selectedProject]);

  const handleCancelCapturePoint = useCallback(() => {
    setAddingCapturePoint(false);
    setNewPointName('');
    setNewPointMapX('');
    setNewPointMapY('');
    setNewPointYaw('0');
    setNewPointMapMarker(null);
    setNewPointFacingMarker(null);
    setNewPointYawLocked(false);
  }, []);

  const resetMapView = useCallback(() => {
    setMapZoom(1);
    setMapPan({ x: 0, y: 0 });
  }, []);

  const openMapModal = useCallback(() => {
    setMapModalOpen(true);
    resetMapView();
  }, [resetMapView]);

  const closeMapModal = useCallback(() => {
    if (addingCapturePoint) handleCancelCapturePoint();
    setMapModalOpen(false);
  }, [addingCapturePoint, handleCancelCapturePoint]);

  const beginAddCapturePoint = useCallback(() => {
    if (!robotMap) {
      toast.error('Upload a robot map before adding capture points');
      return;
    }
    setAddingCapturePoint(true);
    setNewPointName('');
    setNewPointMapX('');
    setNewPointMapY('');
    setNewPointYaw('0');
    setNewPointMapMarker(null);
    setNewPointFacingMarker(null);
    setNewPointYawLocked(false);
    setMapModalOpen(true);
    resetMapView();
  }, [resetMapView, robotMap]);

  const handleMapZoomIn = useCallback(() => {
    setMapZoom((current) => Math.min(5, Number((current + 0.25).toFixed(2))));
  }, []);

  const handleMapZoomOut = useCallback(() => {
    setMapZoom((current) => Math.max(0.5, Number((current - 0.25).toFixed(2))));
  }, []);

  const handleMapWheel = useCallback((event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const direction = event.deltaY > 0 ? -1 : 1;
    setMapZoom((current) => {
      const next = current + direction * 0.15;
      return Math.min(5, Math.max(0.5, Number(next.toFixed(2))));
    });
  }, []);

  const getMapMarkerFromElement = useCallback((element: HTMLDivElement, clientX: number, clientY: number) => {
    const rect = element.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)),
    };
  }, []);

  const getMapMarkerFromEvent = useCallback((event: MouseEvent<HTMLDivElement>) => {
    return getMapMarkerFromElement(event.currentTarget, event.clientX, event.clientY);
  }, [getMapMarkerFromElement]);

  const setNewPointPoseFromMarkers = useCallback((position: { x: number; y: number }, facing?: { x: number; y: number } | null, lockYaw = false) => {
    if (!robotMap) return;
    const mapPosition = normalizedToMapPose(robotMap, position);
    setNewPointMapMarker(position);
    setNewPointMapX(mapPosition.x.toFixed(3));
    setNewPointMapY(mapPosition.y.toFixed(3));

    if (facing) {
      const mapFacing = normalizedToMapPose(robotMap, facing);
      const yaw = Math.atan2(mapFacing.y - mapPosition.y, mapFacing.x - mapPosition.x);
      setNewPointFacingMarker(facing);
      setNewPointYaw(yaw.toFixed(4));
      if (lockYaw) setNewPointYawLocked(true);
    }
  }, [robotMap]);

  const handleRobotMapMouseMove = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (!robotMap || !addingCapturePoint || !newPointMapMarker || newPointYawLocked) return;
    if (mapDragRef.current?.moved) return;
    setNewPointPoseFromMarkers(newPointMapMarker, getMapMarkerFromEvent(event));
  }, [addingCapturePoint, getMapMarkerFromEvent, newPointMapMarker, newPointYawLocked, robotMap, setNewPointPoseFromMarkers]);

  const handleMapSelectionClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (!addingCapturePoint || !robotMap) return;
    const marker = getMapMarkerFromEvent(event);
    if (!newPointMapMarker) {
      setNewPointPoseFromMarkers(marker, null);
      setNewPointYawLocked(false);
      return;
    }
    setNewPointPoseFromMarkers(newPointMapMarker, marker, true);
  }, [addingCapturePoint, getMapMarkerFromEvent, newPointMapMarker, robotMap, setNewPointPoseFromMarkers]);

  const handleMapPointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (addingCapturePoint) {
      mapDragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        panX: mapPan.x,
        panY: mapPan.y,
        moved: false,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    mapDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      panX: mapPan.x,
      panY: mapPan.y,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [addingCapturePoint, mapPan.x, mapPan.y]);

  const handleMapPointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const drag = mapDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.moved = true;
    if (addingCapturePoint) return;
    setMapPan({ x: drag.panX + dx, y: drag.panY + dy });
  }, [addingCapturePoint]);

  const handleMapPointerUp = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const drag = mapDragRef.current;
    if (drag?.pointerId === event.pointerId) {
      if (addingCapturePoint && robotMap) {
        const marker = getMapMarkerFromElement(event.currentTarget, event.clientX, event.clientY);
        if (!newPointMapMarker) {
          setNewPointPoseFromMarkers(marker, null);
          setNewPointYawLocked(false);
        } else {
          setNewPointPoseFromMarkers(newPointMapMarker, marker, true);
        }
      }
      window.setTimeout(() => {
        mapDragRef.current = null;
      }, 0);
    }
  }, [addingCapturePoint, getMapMarkerFromElement, newPointMapMarker, robotMap, setNewPointPoseFromMarkers]);

  const handleCreateCapturePoint = useCallback(() => {
    if (!selectedProject) {
      toast.error('Select a project first');
      return;
    }
    const mapX = Number(newPointMapX);
    const mapY = Number(newPointMapY);
    const yaw = Number(newPointYaw || 0);
    if (!newPointName.trim()) {
      toast.error('Name the capture point');
      return;
    }
    if (!newPointMapMarker || !newPointFacingMarker || !newPointYawLocked) {
      toast.error('Place the point and choose its facing direction on the map');
      return;
    }
    if (!Number.isFinite(mapX) || !Number.isFinite(mapY) || !Number.isFinite(yaw)) {
      toast.error('Capture point pose could not be read');
      return;
    }
    createRobotCapturePoint(selectedProject.id, {
      name: newPointName.trim(),
      room_slug: null,
      map_x: mapX,
      map_y: mapY,
      yaw,
      floorplan_x: newPointMapMarker?.x ?? null,
      floorplan_y: newPointMapMarker?.y ?? null,
      source: newPointMapMarker ? 'robot_map_click' : 'manual',
    })
      .then((point) => {
        toast.success(`Saved capture point ${point.name}`);
        handleCancelCapturePoint();
        setMapModalOpen(false);
        return refreshCapturePoints(selectedProject.id);
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : 'Failed to save capture point');
      });
  }, [
    newPointMapX,
    newPointMapY,
    newPointMapMarker,
    newPointName,
    newPointYaw,
    newPointFacingMarker,
    newPointYawLocked,
    handleCancelCapturePoint,
    refreshCapturePoints,
    selectedProject,
  ]);

  const addCapturePointToTask = useCallback((pointId: string) => {
    if (!pointId) return;
    setSelectedCapturePointIds((current) => (
      current.includes(pointId) ? current : [...current, pointId]
    ));
    setCapturePointPickerId('');
  }, []);

  const removeCapturePointFromTask = useCallback((pointId: string) => {
    setSelectedCapturePointIds((current) => current.filter((id) => id !== pointId));
  }, []);

  const beginRenameCapturePoint = useCallback((point: ApiRobotCapturePoint) => {
    setRenamingCapturePoint(point);
    setRenameCapturePointName(point.name);
  }, []);

  const closeRenameCapturePoint = useCallback(() => {
    if (savingCapturePointRename) return;
    setRenamingCapturePoint(null);
    setRenameCapturePointName('');
  }, [savingCapturePointRename]);

  const handleRenameCapturePoint = useCallback(() => {
    if (!selectedProject || !renamingCapturePoint) return;
    const nextName = renameCapturePointName.trim();
    if (!nextName) {
      toast.error('Name the capture point');
      return;
    }
    if (nextName === renamingCapturePoint.name) {
      closeRenameCapturePoint();
      return;
    }

    setSavingCapturePointRename(true);
    updateRobotCapturePoint(selectedProject.id, renamingCapturePoint.id, { name: nextName })
      .then((updated) => {
        setCapturePoints((current) => current.map((point) => (point.id === updated.id ? updated : point)));
        toast.success(`Renamed capture point ${updated.name}`);
        setRenamingCapturePoint(null);
        setRenameCapturePointName('');
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : 'Failed to rename capture point');
      })
      .finally(() => setSavingCapturePointRename(false));
  }, [closeRenameCapturePoint, renameCapturePointName, renamingCapturePoint, selectedProject]);

  const handleDeleteCapturePoint = useCallback((point: ApiRobotCapturePoint) => {
    if (!selectedProject) return;
    deleteRobotCapturePoint(selectedProject.id, point.id)
      .then(() => {
        toast.success(`Deleted capture point ${point.name}`);
        setSelectedCapturePointIds((current) => current.filter((id) => id !== point.id));
        return refreshCapturePoints(selectedProject.id);
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Failed to delete capture point'));
  }, [refreshCapturePoints, selectedProject]);

  const toggleCaptureOutput = useCallback((output: CaptureOutput) => {
    setCaptureOutputs((current) => {
      if (current.includes(output)) {
        if (current.length === 1) return current;
        return current.filter((item) => item !== output);
      }
      return [...current, output];
    });
  }, []);

  const handleSubmit = useCallback(() => {
    if (!robotId || !projectSlug) {
      toast.error('Select a robot and project first');
      return;
    }
    if (selectedCapturePointIds.length === 0) {
      toast.error('Select at least one capture point');
      return;
    }
    if (captureOutputs.length === 0) {
      toast.error('Select at least one capture type');
      return;
    }

    startSubmit(() => {
      createRobotMission({
        robot_id: robotId,
        project_slug: projectSlug,
        capture_point_ids: selectedCapturePointIds,
        capture_mode: captureOutputs.includes('image') ? 'panorama' : 'pointcloud',
        capture_date: todayIso(),
        retry_policy: { continue_on_failure: continueOnFailure },
        robot_meta: {
          capture_outputs: captureOutputs,
        },
      })
        .then((mission) => {
          toast.success(`Queued task ${mission.id.slice(0, 8)}`);
          return refresh();
        })
        .catch((err) => {
          toast.error(err instanceof Error ? err.message : 'Failed to create task');
        });
    });
  }, [captureOutputs, continueOnFailure, projectSlug, refresh, robotId, selectedCapturePointIds]);

  const runPendingAction = useCallback(async () => {
    if (!pendingAction) return;

    if (pendingAction.type === 'cancel') {
      await cancelRobotMission(pendingAction.mission.id);
      toast.success(`Cancelled task ${pendingAction.mission.id.slice(0, 8)}`);
    } else {
      await deleteRobotMission(pendingAction.mission.id);
      toast.success(`Deleted task ${pendingAction.mission.id.slice(0, 8)}`);
    }

    setPendingAction(null);
    await refresh();
  }, [pendingAction, refresh]);

  return (
    <div className="px-6 py-10 sm:px-10 lg:px-12 xl:px-16">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"
      >
        <div>
          <p className="font-mono text-[12px] uppercase tracking-[0.22em] text-amber-500">
            Operations · Robots
          </p>
          <h1 className="mt-3 font-display text-[36px] font-semibold tracking-tight text-white">
            Task control
          </h1>
          <p className="mt-2 max-w-2xl text-[14px] text-ink-300">
            Queue waypoint tasks, watch robot heartbeat, and inspect task progress without using Swagger or SSH.
          </p>
        </div>
        <button
          type="button"
          onClick={() => startRefresh(() => { refresh().catch(() => undefined); })}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded border border-base-700 px-3 py-2 text-[12px] text-white transition hover:border-ink-400 disabled:opacity-50"
        >
          {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
          Refresh
        </button>
        <Link
          href="/app/robots/pairing"
          className="inline-flex items-center gap-2 rounded border border-base-700 px-3 py-2 text-[12px] text-white transition hover:border-ink-400"
        >
          <Bot size={14} />
          Pair robot
        </Link>
      </motion.section>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-32 animate-pulse rounded-2xl border border-base-800 bg-base-900/50" />
          ))
        ) : (
          robots.map((robot) => (
            <div
              key={robot.robot_id}
              className="rounded-2xl border border-base-800 bg-base-900/65 p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-[18px] text-white">{robot.username}</p>
                  <p className="mt-1 font-mono text-[11px] text-ink-400">{robot.robot_id}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 font-mono text-[10px] uppercase ${STATUS_STYLES[robot.status ?? 'pending'] ?? 'bg-base-800 text-ink-300'}`}>
                  {robot.status ?? 'unknown'}
                </span>
              </div>
              <dl className="mt-4 space-y-2 text-[12px] text-ink-300">
                <div className="flex justify-between gap-3">
                  <dt>Current task</dt>
                  <dd className="font-mono text-[11px] text-white">{robot.current_mission_id ?? '—'}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>Hostname</dt>
                  <dd className="font-mono text-[11px] text-white">{robot.hostname ?? '—'}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>Last seen</dt>
                  <dd className="text-right text-white">{formatLastSeen(robot.last_seen_at)}</dd>
                </div>
              </dl>
            </div>
          ))
        )}
      </div>

      <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(320px,420px)_1fr]">
        <section className="rounded-3xl border border-base-800 bg-base-900/60 p-6">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-300">
              <Bot size={18} />
            </div>
            <div>
              <h2 className="font-display text-[24px] text-white">Queue a task</h2>
              <p className="text-[13px] text-ink-300">Select saved capture points for the robot to visit.</p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.16em] text-ink-400">Robot</span>
              <select
                value={robotId}
                onChange={(event) => setRobotId(event.target.value)}
                className="w-full rounded-xl border border-base-700 bg-base-950 px-3 py-2.5 text-[14px] text-white outline-none transition focus:border-amber-500"
              >
                <option value="">Select robot</option>
                {robots.map((robot) => (
                  <option key={robot.robot_id} value={robot.username}>
                    {robot.username}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.16em] text-ink-400">Project</span>
              <select
                value={projectSlug}
                onChange={(event) => setProjectSlug(event.target.value)}
                className="w-full rounded-xl border border-base-700 bg-base-950 px-3 py-2.5 text-[14px] text-white outline-none transition focus:border-amber-500"
              >
                <option value="">Select project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.slug}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="rounded-2xl border border-base-800 bg-base-950/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-400">Capture points</p>
                <span className="text-[12px] text-ink-500">{selectedCapturePoints.length} selected</span>
              </div>
              {capturePoints.length > 0 ? (
                <label className="mt-3 block">
                  <span className="sr-only">Add capture point to task</span>
                  <select
                    value={capturePointPickerId}
                    onChange={(event) => {
                      const pointId = event.target.value;
                      setCapturePointPickerId(pointId);
                      addCapturePointToTask(pointId);
                    }}
                    disabled={availableCapturePoints.length === 0}
                    className="w-full rounded-xl border border-base-700 bg-base-950 px-3 py-2.5 text-[14px] text-white outline-none transition focus:border-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <option value="">
                      {availableCapturePoints.length > 0 ? 'Choose capture point' : 'All capture points selected'}
                    </option>
                    {availableCapturePoints.map((point) => (
                      <option key={point.id} value={point.id}>
                        {point.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <div className="mt-3 rounded-xl border border-dashed border-base-700 px-3 py-5 text-center text-[13px] text-ink-400">
                  No capture points saved for this project.
                </div>
              )}

              <div className="mt-3 space-y-2">
                {selectedCapturePoints.length > 0 ? selectedCapturePoints.map((point) => (
                  <div
                    key={point.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/60 bg-amber-500/10 px-3 py-2"
                  >
                    <span className="min-w-0 flex-1 truncate text-[13px] text-white" title={point.name}>
                      {point.name}
                    </span>
                    <MoreMenu
                      items={[
                        { label: 'Remove from task', onClick: () => removeCapturePointFromTask(point.id) },
                        { label: 'Rename', onClick: () => beginRenameCapturePoint(point) },
                        { label: 'Delete', danger: true, onClick: () => handleDeleteCapturePoint(point) },
                      ]}
                    />
                  </div>
                )) : capturePoints.length > 0 ? (
                  <div className="rounded-xl border border-dashed border-base-700 px-3 py-5 text-center text-[13px] text-ink-400">
                    No capture points selected.
                  </div>
                ) : null}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={beginAddCapturePoint}
                  className="inline-flex items-center gap-2 rounded-xl border border-amber-500/40 px-3 py-2 text-[12px] text-amber-200 transition hover:bg-amber-500/10"
                >
                  <Plus size={13} />
                  Add capture point
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-base-800 bg-base-950/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <MapPin size={14} className="text-amber-300" />
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-400">Robot map</p>
                </div>
                {robotMap ? (
                  <button
                    type="button"
                    onClick={openMapModal}
                    className="inline-flex items-center gap-2 rounded-lg border border-base-700 px-2.5 py-1.5 text-[12px] text-ink-200 transition hover:border-ink-400"
                  >
                    <ZoomIn size={13} />
                    Open
                  </button>
                ) : null}
              </div>

              {robotMap ? (
                <button
                  type="button"
                  onClick={openMapModal}
                  className="relative mt-3 block w-full overflow-hidden rounded-xl border border-base-800 bg-base-900 text-left"
                  style={{ aspectRatio: `${robotMap.width} / ${robotMap.height}` }}
                >
                  <img src={robotMap.image_url} alt="" className="h-full w-full" />
                  {capturePoints.map((point) => (
                    point.floorplan_x !== null && point.floorplan_y !== null ? (
                      <span
                        key={point.id}
                        className="group absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-base-950 bg-emerald-400 shadow"
                        style={{ left: `${point.floorplan_x * 100}%`, top: `${point.floorplan_y * 100}%` }}
                        title={point.name}
                      >
                        <span className="pointer-events-none absolute left-1/2 bottom-full z-20 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md border border-base-700 bg-base-950 px-2 py-1 text-[11px] text-white opacity-0 shadow-lg shadow-black/40 transition-opacity group-hover:opacity-100">
                          {point.name}
                        </span>
                      </span>
                    ) : null
                  ))}
                  <div className="absolute bottom-2 left-2 rounded bg-base-950/80 px-2 py-1 font-mono text-[10px] text-ink-300">
                    {robotMap.resolution} m/px · {robotMap.frame}
                  </div>
                </button>
              ) : (
                <div className="mt-3 rounded-xl border border-dashed border-base-700 bg-base-900/50 px-3 py-4">
                  <p className="text-center text-[13px] text-ink-300">
                    {robotMapError || 'No robot map uploaded for this project.'}
                  </p>
                  <div className="mt-4 grid gap-3">
                    <label className="block">
                      <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">Map YAML</span>
                      <input
                        type="file"
                        accept=".yaml,.yml,text/yaml,text/plain"
                        onChange={(event) => setRobotMapYamlFile(event.target.files?.[0] ?? null)}
                        className="block w-full text-[12px] text-ink-300 file:mr-3 file:rounded-lg file:border-0 file:bg-base-800 file:px-3 file:py-2 file:text-[12px] file:text-white"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">Map image</span>
                      <input
                        type="file"
                        accept=".pgm,.png,.jpg,.jpeg,.webp,image/*"
                        onChange={(event) => setRobotMapImageFile(event.target.files?.[0] ?? null)}
                        className="block w-full text-[12px] text-ink-300 file:mr-3 file:rounded-lg file:border-0 file:bg-base-800 file:px-3 file:py-2 file:text-[12px] file:text-white"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={handleUploadRobotMap}
                      disabled={uploadingRobotMap}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-500/40 px-3 py-2.5 text-[13px] text-amber-200 transition hover:bg-amber-500/10 disabled:opacity-50"
                    >
                      {uploadingRobotMap ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
                      Upload robot map
                    </button>
                  </div>
                </div>
              )}

            </div>

            <div className="rounded-2xl border border-base-800 bg-base-950/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-400">Capture type</p>
                <span className="text-[12px] text-ink-500">{formatCaptureOutputs(captureOutputs)}</span>
              </div>
              <div ref={captureOutputMenuRef} className="relative mt-3">
                <button
                  type="button"
                  onClick={() => setCaptureOutputMenuOpen((current) => !current)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-base-700 bg-base-950 px-3 py-2.5 text-left text-[14px] text-white outline-none transition hover:border-ink-400 focus:border-amber-500"
                  aria-haspopup="menu"
                  aria-expanded={captureOutputMenuOpen}
                >
                  <span>{formatCaptureOutputs(captureOutputs)}</span>
                  <ChevronDown
                    size={15}
                    className={`text-ink-400 transition-transform ${captureOutputMenuOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {captureOutputMenuOpen ? (
                  <div className="absolute left-0 right-0 top-full z-40 mt-2 rounded-xl border border-base-700 bg-base-900 p-2 shadow-xl shadow-black/40">
                    {CAPTURE_OUTPUT_OPTIONS.map((option) => {
                      const checked = captureOutputs.includes(option.value);
                      return (
                        <label
                          key={option.value}
                          className="flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] text-ink-200 transition hover:bg-base-800 hover:text-white"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={checked && captureOutputs.length === 1}
                            onChange={() => toggleCaptureOutput(option.value)}
                            className="h-4 w-4 rounded border-base-700 bg-base-950 text-amber-500 disabled:opacity-60"
                          />
                          {option.label}
                        </label>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </div>

            <label className="flex items-center gap-3 rounded-2xl border border-base-800 bg-base-950/70 px-3 py-3 text-[13px] text-ink-200">
              <input
                type="checkbox"
                checked={continueOnFailure}
                onChange={(event) => setContinueOnFailure(event.target.checked)}
                className="h-4 w-4 rounded border-base-700 bg-base-950 text-amber-500"
              />
              Continue to later waypoints if one stop fails
            </label>

            <div className="rounded-2xl border border-base-800 bg-base-950/60 p-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-400">Task preview</p>
              <div className="mt-3 inline-flex rounded-full border border-base-700 bg-base-900 px-2.5 py-1 font-mono text-[11px] text-amber-200">
                {formatCaptureOutputs(captureOutputs)}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedCapturePoints.length > 0 ? selectedCapturePoints.map((point) => (
                  <span
                    key={point.id}
                    className="rounded-full border border-base-700 bg-base-900 px-2.5 py-1 font-mono text-[11px] text-white"
                  >
                    {point.name}
                  </span>
                )) : (
                  <span className="text-[13px] text-ink-400">No capture points selected.</span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 px-4 py-3 text-[14px] font-medium text-base-950 transition hover:bg-amber-400 disabled:opacity-60"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              Queue task
            </button>
          </div>
        </section>

        <section className="rounded-3xl border border-base-800 bg-base-900/45 p-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-[24px] text-white">Recent tasks</h2>
              <p className="mt-1 text-[13px] text-ink-300">Latest queued and completed robot tasks from the backend.</p>
            </div>
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-500">
              {missions.length} loaded
            </span>
          </div>

          <div className="mt-6 rounded-2xl border border-base-800 bg-base-950/60 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-400">Live movement</p>
                <p className="mt-1 text-[13px] text-ink-300">
                  {robotId || 'No robot selected'} {robotTelemetry?.frame ? `· ${robotTelemetry.frame}` : ''}
                </p>
              </div>
              <span className={`rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase ${telemetryStatusStyle}`}>
                {telemetryStatus}
              </span>
            </div>

            {robotMap ? (
              <div
                className="relative mt-4 overflow-hidden rounded-2xl border border-base-800 bg-base-950"
                style={{ aspectRatio: `${robotMap.width} / ${robotMap.height}` }}
              >
                <img
                  src={robotMap.image_url}
                  alt=""
                  draggable={false}
                  className="h-full w-full select-none opacity-85"
                />
                <svg
                  className="pointer-events-none absolute inset-0 h-full w-full"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                >
                  {globalPathPolyline ? (
                    <polyline
                      points={globalPathPolyline}
                      fill="none"
                      stroke="rgb(34 211 238)"
                      strokeWidth="0.45"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                      opacity="0.75"
                    />
                  ) : null}
                  {localPathPolyline ? (
                    <polyline
                      points={localPathPolyline}
                      fill="none"
                      stroke="rgb(251 191 36)"
                      strokeWidth="0.55"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                      opacity="0.85"
                    />
                  ) : null}
                  {trailPolyline ? (
                    <polyline
                      points={trailPolyline}
                      fill="none"
                      stroke="rgb(255 255 255)"
                      strokeWidth="0.35"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                      opacity="0.8"
                    />
                  ) : null}
                </svg>

                {capturePoints.map((point) => (
                  point.floorplan_x !== null && point.floorplan_y !== null ? (
                    <span
                      key={point.id}
                      className="absolute z-10 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-base-950 bg-emerald-400/80 shadow"
                      style={{ left: `${point.floorplan_x * 100}%`, top: `${point.floorplan_y * 100}%` }}
                      title={point.name}
                    />
                  ) : null
                ))}

                {visibleMarker(goalMarker) ? (
                  <span
                    className="absolute z-20 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-cyan-200 bg-cyan-400/20 shadow-lg shadow-cyan-500/20"
                    style={{ left: `${goalMarker.x * 100}%`, top: `${goalMarker.y * 100}%` }}
                    title="Current goal"
                  />
                ) : null}

                {visibleMarker(liveRobotMarker) ? (
                  <span
                    className={`absolute z-30 h-7 w-7 rounded-full border-2 bg-base-950/90 shadow-xl ${telemetryFresh ? 'border-amber-300 shadow-amber-500/30' : 'border-base-500 shadow-black/40'}`}
                    style={{
                      left: `${liveRobotMarker.x * 100}%`,
                      top: `${liveRobotMarker.y * 100}%`,
                      transform: `translate(-50%, -50%) rotate(${-(liveRobotMarker.yaw ?? 0)}rad)`,
                    }}
                    title="Robot pose"
                  >
                    <span
                      className={`absolute left-1/2 top-1/2 h-0 w-0 border-y-[5px] border-l-[11px] border-y-transparent ${telemetryFresh ? 'border-l-amber-300' : 'border-l-ink-400'}`}
                      style={{ transform: 'translate(-35%, -50%)' }}
                    />
                    <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
                  </span>
                ) : null}

                {robotTelemetry && !visibleMarker(liveRobotMarker) ? (
                  <div className="absolute right-2 top-2 rounded-lg border border-amber-500/30 bg-base-950/85 px-2 py-1 font-mono text-[10px] uppercase text-amber-200">
                    Pose outside map
                  </div>
                ) : null}

                <div className="absolute bottom-2 left-2 flex max-w-[calc(100%-1rem)] flex-wrap gap-2 rounded-lg bg-base-950/85 px-2 py-1 font-mono text-[10px] text-ink-300">
                  <span className="text-cyan-200">Global</span>
                  <span className="text-amber-200">Local</span>
                  <span className="text-white">Trail</span>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-base-700 bg-base-900/50 px-3 py-6 text-center text-[13px] text-ink-400">
                Upload a robot map to render live movement.
              </div>
            )}

            <dl className="mt-4 grid gap-3 text-[12px] text-ink-300 sm:grid-cols-2 xl:grid-cols-4">
              <div>
                <dt className="font-mono uppercase tracking-[0.14em] text-ink-500">Pose</dt>
                <dd className="mt-1 font-mono text-white">
                  {robotTelemetry
                    ? `${robotTelemetry.pose.x.toFixed(2)}, ${robotTelemetry.pose.y.toFixed(2)}`
                    : '—'}
                </dd>
              </div>
              <div>
                <dt className="font-mono uppercase tracking-[0.14em] text-ink-500">Heading</dt>
                <dd className="mt-1 font-mono text-white">
                  {robotTelemetry?.pose.yaw !== null && robotTelemetry?.pose.yaw !== undefined
                    ? `${radiansToDegrees(robotTelemetry.pose.yaw)} deg`
                    : '—'}
                </dd>
              </div>
              <div>
                <dt className="font-mono uppercase tracking-[0.14em] text-ink-500">Velocity</dt>
                <dd className="mt-1 font-mono text-white">
                  {robotTelemetry?.velocity
                    ? `${robotTelemetry.velocity.linear_x.toFixed(2)} m/s · ${radiansToDegrees(robotTelemetry.velocity.angular_z)} deg/s`
                    : '—'}
                </dd>
              </div>
              <div>
                <dt className="font-mono uppercase tracking-[0.14em] text-ink-500">Updated</dt>
                <dd className="mt-1 font-mono text-white">{formatTelemetryAge(telemetryAge)}</dd>
              </div>
            </dl>

            {robotTelemetryError ? (
              <p className="mt-3 text-[12px] text-amber-200">
                {robotTelemetry ? `Telemetry warning: ${robotTelemetryError}` : robotTelemetryError}
              </p>
            ) : null}
          </div>

          <div className="mt-6 space-y-4">
            {loading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-32 animate-pulse rounded-2xl border border-base-800 bg-base-900/60" />
              ))
            ) : missions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-base-700 px-4 py-10 text-center text-[14px] text-ink-400">
                No tasks yet.
              </div>
            ) : (
              missions.map((mission) => (
                <article
                  key={mission.id}
                  className="rounded-2xl border border-base-800 bg-base-900/70 p-5"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2.5 py-1 font-mono text-[10px] uppercase ${STATUS_STYLES[mission.status] ?? 'bg-base-800 text-ink-300'}`}>
                          {mission.status}
                        </span>
                        <span className="font-mono text-[11px] text-ink-400">{mission.id}</span>
                      </div>
                      <h3 className="mt-3 font-display text-[20px] text-white">
                        {mission.robot_id} → {mission.project_slug}
                      </h3>
                      <p className="mt-1 text-[13px] text-ink-300">
                        {mission.waypoints.length} waypoint{mission.waypoints.length === 1 ? '' : 's'}
                      </p>
                    </div>
                    <dl className="grid gap-2 text-[12px] text-ink-300 sm:grid-cols-2 lg:text-right">
                      <div>
                        <dt className="font-mono uppercase tracking-[0.14em] text-ink-500">Created</dt>
                        <dd className="mt-1 text-white">{new Date(mission.created_at).toLocaleString()}</dd>
                      </div>
                      <div>
                        <dt className="font-mono uppercase tracking-[0.14em] text-ink-500">Completed</dt>
                        <dd className="mt-1 text-white">{mission.completed_at ? new Date(mission.completed_at).toLocaleString() : '—'}</dd>
                      </div>
                    </dl>
                  </div>

                  <MissionProgressTimeline mission={mission} />

                  <div className="mt-4 flex flex-wrap gap-2">
                    {canCancelMission(mission.status) && (
                      <button
                        type="button"
                        onClick={() => setPendingAction({ type: 'cancel', mission })}
                        className="inline-flex items-center gap-2 rounded-xl border border-amber-600/40 px-3 py-2 text-[12px] text-amber-200 transition hover:bg-amber-500/10"
                      >
                        <XCircle size={13} />
                        Cancel
                      </button>
                    )}
                    {canDeleteMission(mission.status) && (
                      <button
                        type="button"
                        onClick={() => setPendingAction({ type: 'delete', mission })}
                        className="inline-flex items-center gap-2 rounded-xl border border-red-700/40 px-3 py-2 text-[12px] text-red-200 transition hover:bg-red-500/10"
                      >
                        <Trash2 size={13} />
                        Delete
                      </button>
                    )}
                  </div>

                  {missionFailureMessage(mission) && (
                    <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-3 text-[12px] text-red-200">
                      {missionFailureMessage(mission)}
                    </div>
                  )}
                </article>
              ))
            )}
          </div>
        </section>
      </div>

      <Modal
        open={mapModalOpen}
        onClose={closeMapModal}
        title={addingCapturePoint ? 'Add capture point' : 'Robot map'}
        subtitle={addingCapturePoint ? 'Click to place the point, then point the arrow toward the robot facing direction.' : 'Drag to pan and use the controls to zoom.'}
        size="2xl"
        bodyClassName="flex-1 overflow-hidden p-0"
      >
        {robotMap ? (
          <div className="flex h-[72vh] flex-col bg-base-950">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-base-800 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleMapZoomOut}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-base-700 text-ink-200 transition hover:border-ink-400"
                  title="Zoom out"
                >
                  <ZoomOut size={14} />
                </button>
                <span className="min-w-14 rounded-lg border border-base-800 bg-base-900 px-2 py-1 text-center font-mono text-[11px] text-ink-200">
                  {Math.round(mapZoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={handleMapZoomIn}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-base-700 text-ink-200 transition hover:border-ink-400"
                  title="Zoom in"
                >
                  <ZoomIn size={14} />
                </button>
                <button
                  type="button"
                  onClick={resetMapView}
                  className="inline-flex items-center gap-2 rounded-lg border border-base-700 px-2.5 py-1.5 text-[12px] text-ink-200 transition hover:border-ink-400"
                >
                  <RotateCcw size={13} />
                  Reset
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[12px] text-ink-300">
                {addingCapturePoint ? (
                  <>
                    <span className="rounded-lg border border-base-800 bg-base-900 px-2 py-1">
                      {newPointMapMarker ? 'Position selected' : 'Click to place point'}
                    </span>
                    <span className="rounded-lg border border-base-800 bg-base-900 px-2 py-1">
                      {newPointYawLocked ? `Facing ${radiansToDegrees(Number(newPointYaw || 0))} deg` : 'Click to lock facing'}
                    </span>
                  </>
                ) : (
                  <span className="rounded-lg border border-base-800 bg-base-900 px-2 py-1">
                    {capturePoints.length} capture point{capturePoints.length === 1 ? '' : 's'}
                  </span>
                )}
              </div>
            </div>

            {addingCapturePoint ? (
              <div className="grid gap-3 border-b border-base-800 bg-amber-500/5 px-4 py-3 lg:grid-cols-[1fr_auto]">
                <input
                  type="text"
                  value={newPointName}
                  onChange={(event) => setNewPointName(event.target.value)}
                  placeholder="Capture point name"
                  className="w-full rounded-xl border border-base-700 bg-base-950 px-3 py-2 text-[14px] text-white outline-none transition focus:border-amber-500"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleCreateCapturePoint}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-500/40 px-3 py-2 text-[13px] text-amber-200 transition hover:bg-amber-500/10"
                  >
                    <Check size={14} />
                    Save capture point
                  </button>
                  <button
                    type="button"
                    onClick={closeMapModal}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-base-700 px-3 py-2 text-[13px] text-ink-200 transition hover:border-ink-400"
                  >
                    <XCircle size={14} />
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}

            <div
              className="relative flex-1 overflow-hidden bg-base-950"
              onWheel={handleMapWheel}
            >
              <div
                role={addingCapturePoint ? 'button' : undefined}
                tabIndex={addingCapturePoint ? 0 : undefined}
                onClick={handleMapSelectionClick}
                onMouseMove={handleRobotMapMouseMove}
                onPointerDown={handleMapPointerDown}
                onPointerMove={handleMapPointerMove}
                onPointerUp={handleMapPointerUp}
                onPointerCancel={handleMapPointerUp}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') event.preventDefault();
                }}
                className={`absolute left-1/2 top-1/2 overflow-hidden border border-base-800 bg-base-900 shadow-2xl shadow-black/40 ${addingCapturePoint ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`}
                style={{
                  width: 'min(100%, 840px)',
                  aspectRatio: `${robotMap.width} / ${robotMap.height}`,
                  transform: `translate(calc(-50% + ${mapPan.x}px), calc(-50% + ${mapPan.y}px)) scale(${mapZoom})`,
                  transformOrigin: 'center center',
                }}
              >
                <img
                  src={robotMap.image_url}
                  alt=""
                  draggable={false}
                  className="h-full w-full select-none"
                />
                {capturePoints.map((point) => (
                  point.floorplan_x !== null && point.floorplan_y !== null ? (
                    <span
                      key={point.id}
                      className="group absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-base-950 bg-emerald-400 shadow"
                      style={{ left: `${point.floorplan_x * 100}%`, top: `${point.floorplan_y * 100}%` }}
                      title={point.name}
                    >
                      <span className="pointer-events-none absolute left-1/2 bottom-full z-20 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md border border-base-700 bg-base-950 px-2 py-1 text-[11px] text-white opacity-0 shadow-lg shadow-black/40 transition-opacity group-hover:opacity-100">
                        {point.name}
                      </span>
                    </span>
                  ) : null
                ))}
                {newPointMapMarker ? (
                  <>
                    {newPointFacingMarker ? (
                      <svg
                        className="pointer-events-none absolute inset-0 h-full w-full"
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                      >
                        <defs>
                          <marker
                            id="capture-point-arrowhead"
                            markerWidth="4"
                            markerHeight="4"
                            refX="3.6"
                            refY="2"
                            orient="auto"
                            markerUnits="strokeWidth"
                          >
                            <path d="M0,0 L4,2 L0,4 Z" fill="rgb(251 191 36)" />
                          </marker>
                        </defs>
                        <line
                          x1={newPointMapMarker.x * 100}
                          y1={newPointMapMarker.y * 100}
                          x2={newPointFacingMarker.x * 100}
                          y2={newPointFacingMarker.y * 100}
                          stroke="rgb(251 191 36)"
                          strokeWidth="0.45"
                          strokeLinecap="round"
                          markerEnd="url(#capture-point-arrowhead)"
                        />
                      </svg>
                    ) : null}
                    <span
                      className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-base-950 bg-amber-400 shadow"
                      style={{ left: `${newPointMapMarker.x * 100}%`, top: `${newPointMapMarker.y * 100}%` }}
                    />
                  </>
                ) : null}
                <div className="absolute bottom-2 left-2 rounded bg-base-950/80 px-2 py-1 font-mono text-[10px] text-ink-300">
                  {robotMap.resolution} m/px · {robotMap.frame}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={!!renamingCapturePoint}
        onClose={closeRenameCapturePoint}
        title="Rename capture point"
        subtitle={renamingCapturePoint?.name ?? undefined}
        size="sm"
      >
        <div className="space-y-4">
          <label className="block">
            <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.16em] text-ink-400">Name</span>
            <input
              type="text"
              value={renameCapturePointName}
              onChange={(event) => setRenameCapturePointName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleRenameCapturePoint();
              }}
              className="w-full rounded-xl border border-base-700 bg-base-950 px-3 py-2.5 text-[14px] text-white outline-none transition focus:border-amber-500"
              autoFocus
            />
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={closeRenameCapturePoint}
              disabled={savingCapturePointRename}
              className="rounded-xl border border-base-700 px-3 py-2 text-[13px] text-ink-200 transition hover:border-ink-400 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleRenameCapturePoint}
              disabled={savingCapturePointRename}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-3 py-2 text-[13px] font-medium text-base-950 transition hover:bg-amber-400 disabled:opacity-60"
            >
              {savingCapturePointRename ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Save
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!pendingAction}
        title={
          pendingActionType === 'delete'
            ? 'Delete this task?'
            : 'Cancel this task?'
        }
        body={
          pendingActionType === 'delete' ? (
            <>
              <code className="rounded bg-base-800 px-1.5 py-0.5 font-mono text-[12px] text-ink-100">
                {pendingMission?.id}
              </code>{' '}
              will be removed from the task queue and history. If the robot is already executing it, later status updates from the robot may be ignored because the task row will no longer exist.
            </>
          ) : (
            <>
              <code className="rounded bg-base-800 px-1.5 py-0.5 font-mono text-[12px] text-ink-100">
                {pendingMission?.id}
              </code>{' '}
              will be marked cancelled. Running steps will stop being tracked, and queued steps will be cancelled.
            </>
          )
        }
        confirmLabel={pendingActionType === 'delete' ? 'Delete task' : 'Cancel task'}
        danger={pendingActionType === 'delete'}
        onConfirm={runPendingAction}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
}
