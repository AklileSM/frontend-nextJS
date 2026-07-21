import type {
  ApiProject,
  ApiRobotCapturePoint,
  ApiRobotCommand,
  ApiRobotMap,
  ApiRobotMission,
  ApiRobotPairingToken,
  ApiRobotPresence,
  ApiRobotSummary,
  ApiRobotTelemetry,
} from '@/types/api';
import { getAccessToken } from '@/auth/authSession';
import { API_BASE, apiFetch, getJson, parseApiError } from './core';

export type ApiRobotMissionCreateRequest = {
  robot_id: string;
  project_slug: string;
  waypoints?: unknown[];
  capture_point_ids?: string[];
  room_slug_map?: Record<string, string>;
  capture_mode?: string;
  capture_date: string;
  retry_policy?: Record<string, unknown>;
  robot_meta?: Record<string, unknown>;
};

export type ApiRobotCapturePointCreateRequest = {
  name: string;
  room_slug?: string | null;
  map_x: number;
  map_y: number;
  yaw?: number;
  floorplan_x?: number | null;
  floorplan_y?: number | null;
  source?: string;
  metadata?: Record<string, unknown>;
};

export type ApiRobotCapturePointUpdateRequest = Partial<ApiRobotCapturePointCreateRequest>;

export type ApiRobotPairingTokenCreateRequest = {
  robot_id: string;
  robot_password: string;
  default_project_slug?: string | null;
  note?: string | null;
  expires_in_hours?: number;
};

export type ApiRobotMissionListParams = {
  robotId?: string;
  projectSlug?: string;
  status?: string;
  limit?: number;
};

export function listRobots(): Promise<ApiRobotSummary[]> {
  return getJson<ApiRobotSummary[]>('/robots');
}

export function getRobotStatus(robotId: string): Promise<ApiRobotPresence> {
  return getJson<ApiRobotPresence>(`/robots/${encodeURIComponent(robotId)}/status`);
}

export function getRobotTelemetry(robotId: string): Promise<ApiRobotTelemetry> {
  return getJson<ApiRobotTelemetry>(`/robots/${encodeURIComponent(robotId)}/telemetry`);
}

export type RobotTelemetryWebSocketHandlers = {
  onOpen?: () => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
};

function robotTelemetryWebSocketUrl(robotId: string): string {
  const token = getAccessToken();
  if (!token) {
    throw new Error('Not authenticated');
  }
  if (typeof window === 'undefined') {
    throw new Error('Robot telemetry WebSocket is only available in the browser');
  }

  const configuredBase = process.env.NEXT_PUBLIC_ROBOT_TELEMETRY_WS_URL?.replace(/\/$/, '');
  const base = configuredBase
    ?? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}${API_BASE}`;
  const url = new URL(`${base}/robots/${encodeURIComponent(robotId)}/telemetry/ws`);
  url.searchParams.set('token', token);
  return url.toString();
}

export function openRobotTelemetryWebSocket(
  robotId: string,
  onTelemetry: (telemetry: ApiRobotTelemetry) => void,
  handlers: RobotTelemetryWebSocketHandlers = {},
): WebSocket {
  const socket = new WebSocket(robotTelemetryWebSocketUrl(robotId));
  socket.onopen = () => handlers.onOpen?.();
  socket.onerror = (event) => handlers.onError?.(event);
  socket.onclose = (event) => handlers.onClose?.(event);
  socket.onmessage = (event) => {
    try {
      const payload = JSON.parse(String(event.data)) as Partial<ApiRobotTelemetry> & { type?: string };
      if (payload.type === 'keepalive' || !payload.pose) return;
      onTelemetry(payload as ApiRobotTelemetry);
    } catch {
      // Ignore malformed telemetry frames so one bad frame does not kill the live view.
    }
  };
  return socket;
}

export async function streamRobotTelemetry(
  robotId: string,
  onTelemetry: (telemetry: ApiRobotTelemetry) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await apiFetch(`/robots/${encodeURIComponent(robotId)}/telemetry/stream`, {
    method: 'GET',
    headers: { Accept: 'application/x-ndjson' },
    signal,
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  if (!response.body) {
    throw new Error('Robot telemetry stream is not available');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      lines.forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        onTelemetry(JSON.parse(trimmed) as ApiRobotTelemetry);
      });
    }

    buffer += decoder.decode();
    const trimmed = buffer.trim();
    if (trimmed) onTelemetry(JSON.parse(trimmed) as ApiRobotTelemetry);
  } finally {
    reader.releaseLock();
  }
}

export function getRobotMap(projectId: string): Promise<ApiRobotMap> {
  return getJson<ApiRobotMap>(`/projects/${encodeURIComponent(projectId)}/robot-map`);
}

export async function uploadRobotMap(
  projectId: string,
  yamlFile: File,
  imageFile: File,
): Promise<ApiRobotMap> {
  const form = new FormData();
  form.append('yaml_file', yamlFile);
  form.append('image_file', imageFile);
  const response = await apiFetch(`/projects/${encodeURIComponent(projectId)}/robot-map`, {
    method: 'POST',
    body: form,
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return response.json() as Promise<ApiRobotMap>;
}

export async function deleteRobotMap(projectId: string): Promise<void> {
  const response = await apiFetch(`/projects/${encodeURIComponent(projectId)}/robot-map`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
}

export function listRobotMissions(params?: ApiRobotMissionListParams): Promise<ApiRobotMission[]> {
  const search = new URLSearchParams();
  if (params?.robotId) search.set('robot_id', params.robotId);
  if (params?.projectSlug) search.set('project_slug', params.projectSlug);
  if (params?.status) search.set('status', params.status);
  if (params?.limit) search.set('limit', String(params.limit));
  const qs = search.toString();
  return getJson<ApiRobotMission[]>(`/robot/missions${qs ? `?${qs}` : ''}`);
}

export function createRobotMission(body: ApiRobotMissionCreateRequest): Promise<ApiRobotMission> {
  return getJson<ApiRobotMission>('/robot/missions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function listRobotCapturePoints(projectId: string): Promise<ApiRobotCapturePoint[]> {
  return getJson<ApiRobotCapturePoint[]>(
    `/projects/${encodeURIComponent(projectId)}/robot-capture-points`,
  );
}

export function createRobotCapturePoint(
  projectId: string,
  body: ApiRobotCapturePointCreateRequest,
): Promise<ApiRobotCapturePoint> {
  return getJson<ApiRobotCapturePoint>(
    `/projects/${encodeURIComponent(projectId)}/robot-capture-points`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
}

export function updateRobotCapturePoint(
  projectId: string,
  pointId: string,
  body: ApiRobotCapturePointUpdateRequest,
): Promise<ApiRobotCapturePoint> {
  return getJson<ApiRobotCapturePoint>(
    `/projects/${encodeURIComponent(projectId)}/robot-capture-points/${encodeURIComponent(pointId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
}

export async function deleteRobotCapturePoint(projectId: string, pointId: string): Promise<void> {
  const response = await apiFetch(
    `/projects/${encodeURIComponent(projectId)}/robot-capture-points/${encodeURIComponent(pointId)}`,
    { method: 'DELETE' },
  );
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
}

export function cancelRobotMission(missionId: string): Promise<ApiRobotMission> {
  return getJson<ApiRobotMission>(`/robot/missions/${encodeURIComponent(missionId)}/cancel`, {
    method: 'POST',
  });
}

/** Queue a connect/disconnect for a robot. The on-site agent picks it up and drives the panel. */
export function createRobotCommand(
  robotId: string,
  kind: 'connect' | 'disconnect',
): Promise<ApiRobotCommand> {
  return getJson<ApiRobotCommand>('/robot/commands', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ robot_id: robotId, kind }),
  });
}

/** Cancel an in-flight connect/disconnect. Safe to call on a finished command (returns it as-is). */
export function cancelRobotCommand(commandId: string): Promise<ApiRobotCommand> {
  return getJson<ApiRobotCommand>(`/robot/commands/${encodeURIComponent(commandId)}/cancel`, {
    method: 'POST',
  });
}

/** The most recent lifecycle command for a robot, or null if it has never had one. */
export async function getLatestRobotCommand(robotId: string): Promise<ApiRobotCommand | null> {
  const response = await apiFetch(
    `/robots/${encodeURIComponent(robotId)}/commands/latest`,
    { method: 'GET' },
  );
  if (response.status === 204) return null;
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return response.json() as Promise<ApiRobotCommand>;
}

export async function deleteRobotMission(missionId: string): Promise<void> {
  const response = await apiFetch(`/robot/missions/${encodeURIComponent(missionId)}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
}

export function listRobotPairingTokens(): Promise<ApiRobotPairingToken[]> {
  return getJson<ApiRobotPairingToken[]>('/robot-pairings');
}

export function listPairableProjects(): Promise<ApiProject[]> {
  return getJson<ApiProject[]>('/robot-pairings/projects');
}

export function createRobotPairingToken(
  body: ApiRobotPairingTokenCreateRequest,
): Promise<ApiRobotPairingToken> {
  return getJson<ApiRobotPairingToken>('/robot-pairings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function revokeRobotPairingToken(pairingId: string): Promise<ApiRobotPairingToken> {
  return getJson<ApiRobotPairingToken>(`/robot-pairings/${encodeURIComponent(pairingId)}/revoke`, {
    method: 'POST',
  });
}
