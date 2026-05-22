/** Projects, members, floorplan, and activity feed. Room CRUD lives in `./rooms`. */
import { getAccessToken } from '@/auth/authSession';
import type {
  ApiProject,
  ApiProjectActivityEntry,
  ApiProjectMember,
} from '@/types/api';
import { API_BASE, apiFetch, getJson, parseApiError } from './core';

export type ApiProjectCreateRequest = {
  name: string;
  description?: string | null;
  location?: string | null;
};

export function listProjects(): Promise<ApiProject[]> {
  return getJson<ApiProject[]>('/projects');
}

export function createProject(body: ApiProjectCreateRequest): Promise<ApiProject> {
  return getJson<ApiProject>('/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function getProject(projectId: string): Promise<ApiProject> {
  return getJson<ApiProject>(`/projects/${projectId}`);
}

export function updateProject(
  projectId: string,
  patch: Partial<Pick<ApiProject, 'name' | 'description' | 'location' | 'status'>>,
): Promise<ApiProject> {
  return getJson<ApiProject>(`/projects/${projectId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
}

export async function deleteProject(projectId: string): Promise<void> {
  const response = await apiFetch(`/projects/${projectId}`, { method: 'DELETE' }, true);
  if (!response.ok) throw new Error(await parseApiError(response));
}

export function getProjectActivity(
  projectSlug: string,
  opts?: { limit?: number },
): Promise<ApiProjectActivityEntry[]> {
  const params = new URLSearchParams();
  if (opts?.limit) params.set('limit', String(opts.limit));
  const qs = params.toString();
  return getJson<ApiProjectActivityEntry[]>(
    `/projects/by-slug/${encodeURIComponent(projectSlug)}/activity${qs ? `?${qs}` : ''}`,
  );
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

export function listProjectMembers(projectId: string): Promise<ApiProjectMember[]> {
  return getJson<ApiProjectMember[]>(`/projects/${projectId}/members`);
}

export function inviteProjectMember(
  projectId: string,
  body: { user_id: string; role: 'owner' | 'editor' | 'viewer' },
): Promise<ApiProjectMember> {
  return getJson<ApiProjectMember>(`/projects/${projectId}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function updateProjectMember(
  projectId: string,
  userId: string,
  patch: { role: 'owner' | 'editor' | 'viewer' },
): Promise<ApiProjectMember> {
  return getJson<ApiProjectMember>(`/projects/${projectId}/members/${userId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
}

export async function removeProjectMember(projectId: string, userId: string): Promise<void> {
  const response = await apiFetch(`/projects/${projectId}/members/${userId}`, { method: 'DELETE' }, true);
  if (!response.ok) throw new Error(await parseApiError(response));
}

// ---------------------------------------------------------------------------
// Floorplan
// ---------------------------------------------------------------------------

export async function uploadProjectFloorplan(
  projectId: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<ApiProject> {
  const token = getAccessToken();
  if (!token) throw new Error('You must be signed in to upload a floorplan.');

  return new Promise<ApiProject>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append('file', file);

    xhr.open('POST', `${API_BASE}/projects/${projectId}/floorplan`, true);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || !onProgress) return;
      onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve(JSON.parse(xhr.responseText) as ApiProject);
      } else {
        try {
          const j = JSON.parse(xhr.responseText) as { detail?: string };
          reject(new Error(typeof j.detail === 'string' ? j.detail : `Upload failed (${xhr.status})`));
        } catch {
          reject(new Error(`Upload failed (${xhr.status})`));
        }
      }
    };
    xhr.onerror = () => reject(new Error('Floorplan upload failed (network error)'));
    xhr.send(form);
  });
}

export function deleteProjectFloorplan(projectId: string): Promise<ApiProject> {
  return getJson<ApiProject>(`/projects/${projectId}/floorplan`, { method: 'DELETE' });
}
