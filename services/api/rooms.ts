/** Room CRUD. Public-list endpoint is used by the explorer to enumerate
 *  rooms across all projects without auth round-trips. */
import type { ApiRoom } from '@/types/api';
import { apiFetch, getJson, parseApiError } from './core';

/** Fetches all rooms. Retries once on any network or server error. */
export async function listRooms(): Promise<ApiRoom[]> {
  try {
    return await getJson<ApiRoom[]>('/rooms');
  } catch {
    return getJson<ApiRoom[]>('/rooms');
  }
}

export function listProjectRooms(projectId: string): Promise<ApiRoom[]> {
  return getJson<ApiRoom[]>(`/projects/${projectId}/rooms`);
}

export function createRoom(
  projectId: string,
  body: { name: string; slug: string; sort_order?: number },
): Promise<ApiRoom> {
  return getJson<ApiRoom>(`/projects/${projectId}/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function updateRoom(
  projectId: string,
  roomId: string,
  patch: Partial<Pick<ApiRoom, 'name' | 'slug' | 'sort_order' | 'floor_plan_coordinates'>>,
): Promise<ApiRoom> {
  return getJson<ApiRoom>(`/projects/${projectId}/rooms/${roomId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
}

export async function deleteRoom(projectId: string, roomId: string): Promise<void> {
  const response = await apiFetch(`/projects/${projectId}/rooms/${roomId}`, { method: 'DELETE' }, true);
  if (!response.ok) throw new Error(await parseApiError(response));
}
