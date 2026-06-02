/** File explorer, search, bulk operations, and pointcloud conversion controls.
 *  Upload routes live in `./upload`. */
import type {
  ApiBulkActionResult,
  ApiConversionStatus,
  ApiMyUpload,
  ApiRoomMediaGroup,
  DateMediaCounts,
  ExplorerByDateResponse,
  ExplorerByRoomResponse,
  ExplorerDatesSummaryResponse,
} from '@/types/api';
import { apiFetch, getJson, parseApiError } from './core';
import { listProjectRooms, listRooms } from './rooms';

// ---------------------------------------------------------------------------
// Explorer (by date / by room / dates summary)
// ---------------------------------------------------------------------------

export function getExplorerByDate(
  date: string,
  projectSlug?: string,
): Promise<ExplorerByDateResponse> {
  // When a project slug is supplied the backend scopes + membership-gates the
  // result server-side; without it the route returns all projects' captures.
  const qs = projectSlug ? `?project_slug=${encodeURIComponent(projectSlug)}` : '';
  return getJson<ExplorerByDateResponse>(`/files/explorer/date/${date}${qs}`);
}

export async function getExplorerByDateForProject(
  projectId: string,
  date: string,
  projectSlug?: string,
): Promise<ExplorerByDateResponse> {
  // Preferred: scope + membership-gate server-side, so no other project's file
  // metadata is sent over the wire. Falls back to the legacy global-fetch +
  // client-side room filter only when the caller doesn't have the slug.
  if (projectSlug) {
    return getExplorerByDate(date, projectSlug);
  }
  const [res, rooms] = await Promise.all([
    getExplorerByDate(date),
    listProjectRooms(projectId),
  ]);
  // The API may key rooms by name OR slug, accept either.
  const projectKeys = new Set<string>();
  for (const r of rooms) {
    projectKeys.add(r.slug);
    projectKeys.add(r.name);
  }
  const filtered: Record<string, typeof res.rooms[string]> = {};
  for (const [key, group] of Object.entries(res.rooms)) {
    if (projectKeys.has(key)) filtered[key] = group;
  }
  return { ...res, rooms: filtered };
}

export function getExplorerByRoom(roomSlug: string): Promise<ExplorerByRoomResponse> {
  return getJson<ExplorerByRoomResponse>(`/files/explorer/room/${roomSlug}`);
}

function addRoomGroupsToDateCounts(
  acc: Record<string, DateMediaCounts>,
  dates: Record<string, ApiRoomMediaGroup>,
): void {
  for (const [day, group] of Object.entries(dates)) {
    const cur = acc[day] ?? { images: 0, videos: 0, pointclouds: 0, pdfs: 0 };
    cur.images += group.images?.length ?? 0;
    cur.videos += group.videos?.length ?? 0;
    cur.pointclouds += group.pointclouds?.length ?? 0;
    cur.pdfs += group.pdfs?.length ?? 0;
    acc[day] = cur;
  }
}

async function explorerDatesSummaryFromRooms(projectId?: string): Promise<ExplorerDatesSummaryResponse> {
  const rooms = await listRooms();
  const target = projectId ? rooms.filter((r) => r.project_id === projectId) : rooms;
  const byDate: Record<string, DateMediaCounts> = {};
  await Promise.all(
    target.map((room) =>
      getExplorerByRoom(room.slug).then((res) => {
        addRoomGroupsToDateCounts(byDate, res.dates ?? {});
      }),
    ),
  );
  return { dates: byDate };
}

export function getExplorerDatesSummaryForProject(
  projectId: string,
): Promise<ExplorerDatesSummaryResponse> {
  return explorerDatesSummaryFromRooms(projectId);
}

/**
 * Returns per-date media counts for the date-picker calendar.
 *
 * Tries the dedicated `/files/explorer/dates` endpoint first (single fast
 * query). If the backend returns 404 (older deployments that lack this route),
 * falls back to fetching each room individually and aggregating client-side.
 */
export async function getExplorerDatesSummary(): Promise<ExplorerDatesSummaryResponse> {
  const response = await apiFetch('/files/explorer/dates', undefined, true);
  if (response.ok) {
    return response.json() as Promise<ExplorerDatesSummaryResponse>;
  }
  if (response.status === 404) {
    return explorerDatesSummaryFromRooms();
  }
  throw new Error(await parseApiError(response));
}

// ---------------------------------------------------------------------------
// Delete + bulk operations
// ---------------------------------------------------------------------------

export async function deleteFileAsset(fileId: string, signal?: AbortSignal): Promise<void> {
  const response = await apiFetch(`/files/${fileId}`, { method: 'DELETE', signal }, true);
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
}

export async function bulkDeleteFiles(ids: string[]): Promise<ApiBulkActionResult> {
  const response = await apiFetch('/files/bulk-delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  }, true);
  if (!response.ok) throw new Error(await parseApiError(response));
  return response.json() as Promise<ApiBulkActionResult>;
}

export async function bulkDownloadFiles(
  ids: string[],
): Promise<{ blob: Blob; affected: number; skipped: number }> {
  const response = await apiFetch('/files/bulk-download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  }, true);
  if (!response.ok) throw new Error(await parseApiError(response));
  const blob = await response.blob();
  return {
    blob,
    affected: Number(response.headers.get('X-Bulk-Affected') ?? 0),
    skipped: Number(response.headers.get('X-Bulk-Skipped') ?? 0),
  };
}

// ---------------------------------------------------------------------------
// Pointcloud conversion controls
// ---------------------------------------------------------------------------

export function getConversionStatus(fileId: string): Promise<ApiConversionStatus> {
  return getJson<ApiConversionStatus>(`/files/${fileId}/conversion-status`);
}

export async function retryPointcloudConversion(fileId: string): Promise<void> {
  const response = await apiFetch(`/files/${fileId}/retry-conversion`, { method: 'POST' }, true);
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
}

// ---------------------------------------------------------------------------
// My-uploads and search
// ---------------------------------------------------------------------------

export function listMyUploads(opts?: {
  projectSlug?: string;
  mediaType?: 'image' | 'video' | 'pointcloud' | 'pdf';
}): Promise<ApiMyUpload[]> {
  const params = new URLSearchParams();
  if (opts?.projectSlug) params.set('project_slug', opts.projectSlug);
  if (opts?.mediaType) params.set('media_type', opts.mediaType);
  const qs = params.toString();
  return getJson<ApiMyUpload[]>(`/files/my-uploads${qs ? `?${qs}` : ''}`);
}

export function searchFiles(
  q: string,
  projectSlug: string,
  signal?: AbortSignal,
): Promise<ApiMyUpload[]> {
  const params = new URLSearchParams({ q, project_slug: projectSlug });
  return getJson<ApiMyUpload[]>(`/files/search?${params.toString()}`, { signal });
}
