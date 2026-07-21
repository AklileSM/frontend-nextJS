import type { ApiRobotMission, ApiRobotMissionStep } from '@/types/api';
import { parseUtcTimestamp } from './robotMap';

export const ACTIVE_MISSION_STATUSES = ['queued', 'dispatched', 'running'];
export const MISSION_LIST_LIMIT = 25;
/* A running capture polls fast, so it fetches only the newest few missions and splices them over
 * the cached list. The full list is worth re-pulling on the slow idle poll, not every 2 seconds. */
export const ACTIVE_MISSION_POLL_LIMIT = 5;
export const ACTIVE_POLL_MS = 2000;
export const IDLE_POLL_MS = 30000;

export type CaptureOutput = 'image' | 'pointcloud';
export type MissionProgressStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped' | 'cancelled';

export type MissionProgressEvent = {
  id: string;
  label: string;
  status: MissionProgressStatus;
  detail?: string | null;
  at?: string;
};

export function isActiveMissionStatus(status: string): boolean {
  return ACTIVE_MISSION_STATUSES.includes(status);
}

export function canCancelMission(status: string): boolean {
  return isActiveMissionStatus(status);
}

export function canDeleteMission(status: string): boolean {
  return ['queued', 'dispatched', 'running', 'cancelled', 'failed', 'succeeded'].includes(status);
}

/* Splice the newest missions from a fast poll over the cached list so the longer history
 * survives between full refreshes. Relies on the API's created_at DESC ordering, and trims to
 * the same limit a full fetch would return so the two cannot drift apart. */
export function mergeMissions(current: ApiRobotMission[], fresh: ApiRobotMission[]): ApiRobotMission[] {
  const freshById = new Map(fresh.map((mission) => [mission.id, mission]));
  const known = new Set(current.map((mission) => mission.id));
  return [
    ...fresh.filter((mission) => !known.has(mission.id)),
    ...current.map((mission) => freshById.get(mission.id) ?? mission),
  ].slice(0, MISSION_LIST_LIMIT);
}

export function orderedSteps(mission: ApiRobotMission): ApiRobotMissionStep[] {
  return [...mission.steps].sort((a, b) => a.sequence_index - b.sequence_index);
}

/** The stops a capture visits, by name — what "3 waypoints" should have said all along. */
export function routeStopNames(mission: ApiRobotMission): string[] {
  return orderedSteps(mission).map((step) => step.waypoint_name);
}

export function routeSummary(mission: ApiRobotMission, max = 2): string {
  const names = routeStopNames(mission);
  if (names.length === 0) return 'No stops';
  if (names.length <= max) return names.join(', ');
  return `${names.slice(0, max).join(', ')} +${names.length - max} more`;
}

/** Where the robot is up to, in words. Null when the capture is not running. */
export function activeStepSummary(mission: ApiRobotMission): string | null {
  if (!isActiveMissionStatus(mission.status)) return null;
  const steps = orderedSteps(mission);
  if (steps.length === 0) return 'Starting';
  const runningIndex = steps.findIndex((step) => step.status === 'running');
  if (runningIndex >= 0) {
    return `Capturing ${steps[runningIndex].waypoint_name} · ${runningIndex + 1} of ${steps.length}`;
  }
  const done = steps.filter((step) => step.status === 'succeeded').length;
  if (done === 0) return `Starting · 0 of ${steps.length}`;
  return `${done} of ${steps.length} captured`;
}

/* Mission timestamps are naive UTC (the API strips tzinfo), so they must be parsed as UTC
 * rather than handed to `new Date` — which would read them as local time. */
export function formatMissionTime(value: string | null | undefined): string {
  const timestamp = parseUtcTimestamp(value);
  if (timestamp === null) return '—';
  const at = new Date(timestamp);
  const time = at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const isToday = at.toDateString() === new Date().toDateString();
  if (isToday) return `Today ${time}`;
  return `${at.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`;
}

/** A capture's human identity, replacing the raw mission UUID. */
export function missionLabel(mission: ApiRobotMission): string {
  return `${formatMissionTime(mission.created_at)} · ${routeSummary(mission)}`;
}

export function missionFailureMessage(mission: ApiRobotMission): string | null {
  const stepError = orderedSteps(mission).find((step) => step.error_message)?.error_message;
  if (stepError) return stepError;
  const resultError = mission.result?.['error'];
  return typeof resultError === 'string' && resultError.trim() ? resultError : null;
}

export function captureOutputsOf(mission: ApiRobotMission): CaptureOutput[] {
  const raw = mission.robot_meta?.['capture_outputs'];
  const outputs = Array.isArray(raw)
    ? raw.filter((value): value is CaptureOutput => value === 'image' || value === 'pointcloud')
    : [];
  if (outputs.length > 0) return outputs;
  return mission.capture_mode === 'pointcloud' ? ['pointcloud'] : ['image'];
}

/** "PCD" is as much jargon as Swagger is; users get Photo and 3D scan. */
export function formatCaptureOutputs(outputs: CaptureOutput[]): string {
  const photo = outputs.includes('image');
  const scan = outputs.includes('pointcloud');
  if (photo && scan) return 'Photo + 3D scan';
  if (scan) return '3D scan';
  return 'Photo';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function normalizeProgressStatus(value: unknown): MissionProgressStatus {
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
  const label = typeof value.label === 'string' && value.label.trim() ? value.label : null;
  if (!label) return null;
  const detail = typeof value.detail === 'string' && value.detail.trim() ? value.detail : null;
  const at = [value.completed_at_utc, value.updated_at_utc, value.started_at_utc]
    .find((candidate): candidate is string => typeof candidate === 'string');
  return {
    id: typeof value.id === 'string' && value.id.trim() ? value.id : `progress-${index}`,
    label,
    status: normalizeProgressStatus(value.status),
    detail,
    at,
  };
}

function stepsAsProgressEvents(mission: ApiRobotMission): MissionProgressEvent[] {
  return orderedSteps(mission).map((step) => {
    const status = normalizeProgressStatus(step.status);
    const label = status === 'succeeded'
      ? `${step.waypoint_name} — captured`
      : status === 'running'
        ? `${step.waypoint_name} — capturing now`
        : status === 'failed'
          ? `${step.waypoint_name} — could not capture`
          : `${step.waypoint_name} — waiting`;
    return {
      id: `step:${step.id}`,
      label,
      status,
      /* navigation_result is robot-internal; only a real error is worth showing. */
      detail: step.error_message,
      at: step.completed_at ?? step.started_at ?? undefined,
    };
  });
}

/** Normalize a raw progress_events array (e.g. from a connect command) into render-ready events. */
export function normalizeProgressEvents(raw: unknown): MissionProgressEvent[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((event, index) => normalizeProgressEvent(event, index))
    .filter((event): event is MissionProgressEvent => Boolean(event));
}

export function missionProgressEvents(mission: ApiRobotMission): MissionProgressEvent[] {
  const queued: MissionProgressEvent = {
    id: 'task:queued',
    label: 'Capture requested',
    status: mission.status === 'queued' || mission.status === 'dispatched'
      ? 'running'
      : mission.status === 'cancelled'
        ? 'cancelled'
        : 'succeeded',
    at: mission.created_at,
  };

  const raw = mission.result?.['progress_events'];
  const fromResult = Array.isArray(raw)
    ? raw
      .map((event, index) => normalizeProgressEvent(event, index))
      .filter((event): event is MissionProgressEvent => Boolean(event))
    : [];

  const body = fromResult.length > 0 ? fromResult : stepsAsProgressEvents(mission);

  const closing: MissionProgressEvent[] = mission.completed_at
    ? [{
      id: mission.status === 'failed' ? 'task:failed' : 'task:completed',
      label: mission.status === 'failed' ? 'Capture failed' : 'Capture complete',
      status: normalizeProgressStatus(mission.status),
      detail: missionFailureMessage(mission),
      at: mission.completed_at,
    }]
    : [];

  return [queued, ...body, ...closing];
}
