import type {
  ApiRobotMission,
  ApiRobotPresence,
  ApiRobotSummary,
} from '@/types/api';
import { apiFetch, getJson, parseApiError } from './core';

export type ApiRobotMissionCreateRequest = {
  robot_id: string;
  project_slug: string;
  waypoints: string[];
  room_slug_map?: Record<string, string>;
  capture_mode?: string;
  capture_date: string;
  retry_policy?: Record<string, unknown>;
  robot_meta?: Record<string, unknown>;
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

export function cancelRobotMission(missionId: string): Promise<ApiRobotMission> {
  return getJson<ApiRobotMission>(`/robot/missions/${encodeURIComponent(missionId)}/cancel`, {
    method: 'POST',
  });
}

export async function deleteRobotMission(missionId: string): Promise<void> {
  const response = await apiFetch(`/robot/missions/${encodeURIComponent(missionId)}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
}
