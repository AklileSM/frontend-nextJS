/** Admin-only endpoints: user management and the platform-wide project list. */
import type { AdminUser, ApiProject } from '@/types/api';
import { apiFetch, getJson, parseApiError } from './core';

export function listAdminUsers(): Promise<AdminUser[]> {
  return getJson<AdminUser[]>('/admin/users');
}

/** Used by the project member picker, not admin-gated despite the path. */
export function searchUsers(q: string): Promise<AdminUser[]> {
  return getJson<AdminUser[]>(`/admin/user-search?q=${encodeURIComponent(q)}`);
}

export function updateAdminUser(
  userId: string,
  patch: Partial<Pick<AdminUser, 'is_admin' | 'is_active' | 'email'>>,
): Promise<AdminUser> {
  return getJson<AdminUser>(`/admin/users/${userId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
}

export function listAdminProjects(): Promise<ApiProject[]> {
  return getJson<ApiProject[]>('/admin/projects');
}

export async function deleteAdminProject(projectId: string): Promise<void> {
  const response = await apiFetch(`/admin/projects/${projectId}`, { method: 'DELETE' }, true);
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
}
