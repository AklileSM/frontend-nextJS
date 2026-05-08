import type {
  AdminUser,
  ApiAnnotation,
  ApiComparisonDraft,
  ApiComparisonDraftDetail,
  ApiConversionStatus,
  ApiMyUpload,
  ApiProject,
  ApiReport,
  ApiRoom,
  ApiRoomMediaGroup,
  ApiTokenResponse,
  ApiViewerFieldDraft,
  ApiViewerFieldDraftDetail,
  DateMediaCounts,
  ExplorerByDateResponse,
  ExplorerByRoomResponse,
  ExplorerDatesSummaryResponse,
  UploadSingleResponse,
} from '@/types/api';
import type {
  ApiProjectMember,
} from '@/types/api';

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

const ACCESS_TOKEN_KEY = 'a6_access_token';

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function getAccessToken(): string | null {
  if (!canUseStorage()) return null;
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string): void {
  if (!canUseStorage()) return;
  window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearAccessToken(): void {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
}

async function parseApiError(response: Response): Promise<string> {
  try {
    const j = (await response.json()) as { detail?: unknown };
    const d = j.detail;
    if (typeof d === 'string') return d;
    if (Array.isArray(d)) {
      return d
        .map((x: { msg?: string }) => x?.msg)
        .filter(Boolean)
        .join(', ');
    }
  } catch {
    // ignore invalid JSON error payloads
  }
  return `Request failed: ${response.status}`;
}

async function apiFetch(path: string, init?: RequestInit, withAuth = true): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (withAuth) {
    const token = getAccessToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(`${API_BASE}${path}`, { ...init, headers });
}

async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(path, init, true);
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return response.json() as Promise<T>;
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

async function explorerDatesSummaryFromRooms(): Promise<ExplorerDatesSummaryResponse> {
  const rooms = await listRooms();
  const byDate: Record<string, DateMediaCounts> = {};
  await Promise.all(
    rooms.map((room) =>
      getExplorerByRoom(room.slug).then((res) => {
        addRoomGroupsToDateCounts(byDate, res.dates ?? {});
      }),
    ),
  );
  return { dates: byDate };
}

export type ApiProjectCreateRequest = {
  name: string;
  slug: string;
  description?: string | null;
  location?: string | null;
};

export function listProjects(): Promise<ApiProject[]> {
  return getJson<ApiProject[]>('/projects/');
}

export function createProject(body: ApiProjectCreateRequest): Promise<ApiProject> {
  return getJson<ApiProject>('/projects/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function listAdminUsers(): Promise<AdminUser[]> {
  return getJson<AdminUser[]>('/admin/users');
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

export async function listRooms(): Promise<ApiRoom[]> {
  try {
    return await getJson<ApiRoom[]>('/rooms/');
  } catch {
    return getJson<ApiRoom[]>('/rooms');
  }
}

export function getExplorerByDate(date: string): Promise<ExplorerByDateResponse> {
  return getJson<ExplorerByDateResponse>(`/files/explorer/date/${date}`);
}

export function getExplorerByRoom(roomSlug: string): Promise<ExplorerByRoomResponse> {
  return getJson<ExplorerByRoomResponse>(`/files/explorer/room/${roomSlug}`);
}

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

async function analyzeImageOnce(
  imageUrl: string,
  fileId?: string,
): Promise<{ status: 202 } | { status: 200; description: string }> {
  const raw = await apiFetch('/ai/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_url: imageUrl, file_id: fileId ?? null }),
  });

  if (raw.status === 202) {
    return { status: 202 };
  }
  if (!raw.ok) {
    throw new Error(await parseApiError(raw));
  }

  const data = (await raw.json()) as { description?: string };
  if (!data.description) {
    throw new Error('No description returned from analysis.');
  }
  return { status: 200, description: data.description };
}

const AI_POLL_INTERVAL_MS = 2000;
const AI_POLL_MAX_ATTEMPTS = 30;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function analyzeImage(imageUrl: string, fileId?: string): Promise<string> {
  for (let attempt = 0; attempt < AI_POLL_MAX_ATTEMPTS; attempt++) {
    const result = await analyzeImageOnce(imageUrl, fileId);
    if (result.status === 200) return result.description;
    await sleep(AI_POLL_INTERVAL_MS);
  }
  throw new Error('AI analysis timed out. Please try again later.');
}

export async function deleteFileAsset(fileId: string): Promise<void> {
  const response = await apiFetch(`/files/${fileId}`, { method: 'DELETE' }, true);
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
}

export function getConversionStatus(fileId: string): Promise<ApiConversionStatus> {
  return getJson<ApiConversionStatus>(`/files/${fileId}/conversion-status`);
}

export async function retryPointcloudConversion(fileId: string): Promise<void> {
  const response = await apiFetch(`/files/${fileId}/retry-conversion`, { method: 'POST' }, true);
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
}

export function listMyUploads(): Promise<ApiMyUpload[]> {
  return getJson<ApiMyUpload[]>('/files/my-uploads');
}

const POINTCLOUD_CHUNK_SIZE = 64 * 1024 * 1024;
const POINTCLOUD_UPLOAD_CONCURRENCY = 5;
const POINTCLOUD_CHUNK_MAX_RETRIES = 3;

async function uploadPointcloudInChunks(params: {
  file: File;
  roomSlug: string;
  mediaType: 'image' | 'video' | 'pointcloud' | 'pdf';
  captureDate: string;
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}): Promise<UploadSingleResponse> {
  const token = getAccessToken();
  if (!token) {
    throw new Error('You must be signed in to upload.');
  }

  const initForm = new FormData();
  initForm.append('room_slug', params.roomSlug);
  initForm.append('capture_date', params.captureDate);
  initForm.append('filename', params.file.name);
  initForm.append('file_size', String(params.file.size));
  initForm.append('content_type', params.file.type || 'application/octet-stream');

  const initRes = await fetch(`${API_BASE}/upload/pointcloud/init`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: initForm,
    signal: params.signal,
  });
  if (!initRes.ok) {
    throw new Error(await parseApiError(initRes));
  }

  const initData = (await initRes.json()) as { upload_id: string; chunk_size?: number };
  const uploadId = initData.upload_id;
  const chunkSize = initData.chunk_size && initData.chunk_size > 0 ? initData.chunk_size : POINTCLOUD_CHUNK_SIZE;
  const totalChunks = Math.ceil(params.file.size / chunkSize);
  let uploadedBytes = 0;
  params.onProgress?.(0);

  const getNextChunkIndex = (() => {
    let i = 0;
    return () => (i < totalChunks ? i++ : null);
  })();

  const uploadOneChunkWithRetry = async (chunkIndex: number): Promise<void> => {
    let attempt = 0;
    while (attempt <= POINTCLOUD_CHUNK_MAX_RETRIES) {
      const start = chunkIndex * chunkSize;
      const end = Math.min(start + chunkSize, params.file.size);
      const blob = params.file.slice(start, end);
      const chunkForm = new FormData();
      chunkForm.append('upload_id', uploadId);
      chunkForm.append('chunk_index', String(chunkIndex));
      chunkForm.append('chunk', blob, params.file.name);

      const chunkRes = await fetch(`${API_BASE}/upload/pointcloud/chunk`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: chunkForm,
        signal: params.signal,
      });
      if (chunkRes.ok) {
        uploadedBytes += end - start;
        const percent = Math.min(99, Math.round((uploadedBytes / params.file.size) * 100));
        params.onProgress?.(percent);
        return;
      }

      const err = await parseApiError(chunkRes);
      if (attempt >= POINTCLOUD_CHUNK_MAX_RETRIES) {
        throw new Error(`Chunk ${chunkIndex + 1}/${totalChunks} failed: ${err}`);
      }
      await sleep(500 * 2 ** attempt);
      attempt += 1;
    }
  };

  const workers = Array.from(
    { length: Math.min(POINTCLOUD_UPLOAD_CONCURRENCY, totalChunks) },
    async () => {
      while (true) {
        const chunkIndex = getNextChunkIndex();
        if (chunkIndex === null) return;
        await uploadOneChunkWithRetry(chunkIndex);
      }
    },
  );
  for (const worker of workers) await worker;

  const doneForm = new FormData();
  doneForm.append('upload_id', uploadId);
  doneForm.append('total_chunks', String(totalChunks));
  const doneRes = await fetch(`${API_BASE}/upload/pointcloud/complete`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: doneForm,
    signal: params.signal,
  });
  if (!doneRes.ok) {
    throw new Error(await parseApiError(doneRes));
  }
  params.onProgress?.(100);
  return doneRes.json() as Promise<UploadSingleResponse>;
}

export async function uploadSingleFile(params: {
  file: File;
  roomSlug: string;
  mediaType: 'image' | 'video' | 'pointcloud' | 'pdf';
  captureDate: string;
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}): Promise<UploadSingleResponse> {
  const token = getAccessToken();
  if (!token) {
    throw new Error('You must be signed in to upload.');
  }

  if (params.mediaType === 'pointcloud') {
    return uploadPointcloudInChunks(params);
  }

  const form = new FormData();
  form.append('file', params.file);
  form.append('room_slug', params.roomSlug);
  form.append('media_type', params.mediaType);
  form.append('capture_date', params.captureDate);

  const response = await fetch(`${API_BASE}/upload/single`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
    signal: params.signal,
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return response.json() as Promise<UploadSingleResponse>;
}

export function listAnnotations(fileId: string): Promise<ApiAnnotation[]> {
  return getJson<ApiAnnotation[]>(`/annotations/file/${encodeURIComponent(fileId)}`);
}

export function createAnnotation(params: {
  fileId: string;
  x: number;
  y: number;
  text: string;
}): Promise<ApiAnnotation> {
  return getJson<ApiAnnotation>('/annotations/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      file_id: params.fileId,
      x: params.x,
      y: params.y,
      text: params.text,
    }),
  });
}

export function listReports(): Promise<ApiReport[]> {
  return getJson<ApiReport[]>('/reports/');
}

export async function deleteReport(reportId: string): Promise<void> {
  const response = await apiFetch(`/reports/${encodeURIComponent(reportId)}`, { method: 'DELETE' }, true);
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
}

export async function createReportWithPdf(params: {
  pdfBlob: Blob;
  fileId: string;
  filename?: string;
  aiDescription?: string | null;
  manualObservations?: string | null;
  flags?: string[];
}): Promise<void> {
  const token = getAccessToken();
  if (!token) {
    throw new Error('Sign in to store reports on the server.');
  }
  const form = new FormData();
  form.append('file', params.pdfBlob, params.filename ?? 'report.pdf');
  form.append('file_id', params.fileId);
  if (params.aiDescription != null && params.aiDescription !== '') {
    form.append('ai_description', params.aiDescription);
  }
  if (params.manualObservations != null && params.manualObservations !== '') {
    form.append('manual_observations', params.manualObservations);
  }
  form.append('flags_json', JSON.stringify(params.flags ?? []));
  const response = await fetch(`${API_BASE}/reports/with-pdf`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
}

export function listViewerFieldDrafts(): Promise<ApiViewerFieldDraft[]> {
  return getJson<ApiViewerFieldDraft[]>('/reports/viewer-drafts');
}

export function getViewerFieldDraft(draftId: string): Promise<ApiViewerFieldDraftDetail> {
  return getJson<ApiViewerFieldDraftDetail>(`/reports/viewer-drafts/${encodeURIComponent(draftId)}`);
}

export async function deleteViewerFieldDraft(draftId: string): Promise<void> {
  const response = await apiFetch(`/reports/viewer-drafts/${encodeURIComponent(draftId)}`, { method: 'DELETE' }, true);
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
}

export async function createViewerFieldDraft(params: {
  fileId: string;
  viewerKind: string;
  manualObservations?: string | null;
  flags?: string[];
  state: Record<string, unknown>;
}): Promise<ApiViewerFieldDraftDetail> {
  const token = getAccessToken();
  if (!token) {
    throw new Error('Sign in to save report drafts.');
  }
  const response = await fetch(`${API_BASE}/reports/viewer-drafts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      file_id: params.fileId,
      viewer_kind: params.viewerKind,
      manual_observations: params.manualObservations ?? null,
      flags: params.flags ?? [],
      state: params.state,
    }),
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return response.json() as Promise<ApiViewerFieldDraftDetail>;
}

export async function updateViewerFieldDraft(params: {
  draftId: string;
  fileId?: string;
  viewerKind?: string;
  manualObservations?: string | null;
  flags?: string[];
  state: Record<string, unknown>;
}): Promise<ApiViewerFieldDraftDetail> {
  const token = getAccessToken();
  if (!token) {
    throw new Error('Sign in to update report drafts.');
  }
  const response = await fetch(`${API_BASE}/reports/viewer-drafts/${encodeURIComponent(params.draftId)}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      file_id: params.fileId ?? null,
      viewer_kind: params.viewerKind ?? null,
      manual_observations: params.manualObservations ?? null,
      flags: params.flags ?? [],
      state: params.state,
    }),
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return response.json() as Promise<ApiViewerFieldDraftDetail>;
}

export async function publishViewerFieldDraft(params: {
  draftId: string;
  pdfBlob: Blob;
  fileId: string;
  filename?: string;
  aiDescription?: string | null;
  manualObservations?: string | null;
  flags?: string[];
}): Promise<ApiReport> {
  const token = getAccessToken();
  if (!token) {
    throw new Error('Sign in to publish reports.');
  }
  const form = new FormData();
  form.append('file', params.pdfBlob, params.filename ?? 'report.pdf');
  form.append('file_id', params.fileId);
  if (params.aiDescription != null && params.aiDescription !== '') {
    form.append('ai_description', params.aiDescription);
  }
  if (params.manualObservations != null && params.manualObservations !== '') {
    form.append('manual_observations', params.manualObservations);
  }
  form.append('flags_json', JSON.stringify(params.flags ?? []));

  const response = await fetch(
    `${API_BASE}/reports/viewer-drafts/${encodeURIComponent(params.draftId)}/publish`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    },
  );
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return response.json() as Promise<ApiReport>;
}

export function listComparisonDrafts(): Promise<ApiComparisonDraft[]> {
  return getJson<ApiComparisonDraft[]>('/reports/comparison-drafts');
}

export function getComparisonDraft(draftId: string): Promise<ApiComparisonDraftDetail> {
  return getJson<ApiComparisonDraftDetail>(`/reports/comparison-drafts/${encodeURIComponent(draftId)}`);
}

export async function deleteComparisonDraft(draftId: string): Promise<void> {
  const response = await apiFetch(`/reports/comparison-drafts/${encodeURIComponent(draftId)}`, { method: 'DELETE' }, true);
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
}

export async function createComparisonDraft(params: {
  fileId: string;
  manualObservations?: string | null;
  flags?: string[];
  state: Record<string, unknown>;
}): Promise<ApiComparisonDraftDetail> {
  const token = getAccessToken();
  if (!token) {
    throw new Error('Sign in to store comparison drafts.');
  }
  const response = await fetch(`${API_BASE}/reports/comparison-drafts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      file_id: params.fileId,
      manual_observations: params.manualObservations ?? null,
      flags: params.flags ?? [],
      state: params.state,
    }),
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return response.json() as Promise<ApiComparisonDraftDetail>;
}

export async function updateComparisonDraft(params: {
  draftId: string;
  fileId?: string;
  manualObservations?: string | null;
  flags?: string[];
  state: Record<string, unknown>;
}): Promise<ApiComparisonDraftDetail> {
  const token = getAccessToken();
  if (!token) {
    throw new Error('Sign in to update comparison drafts.');
  }
  const response = await fetch(
    `${API_BASE}/reports/comparison-drafts/${encodeURIComponent(params.draftId)}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file_id: params.fileId ?? null,
        manual_observations: params.manualObservations ?? null,
        flags: params.flags ?? [],
        state: params.state,
      }),
    },
  );
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return response.json() as Promise<ApiComparisonDraftDetail>;
}

export async function publishComparisonDrafts(params: {
  pdfBlob: Blob;
  fileId: string;
  draftIds: string[];
  filename?: string;
  manualObservations?: string | null;
  flags?: string[];
}): Promise<ApiReport> {
  const token = getAccessToken();
  if (!token) {
    throw new Error('Sign in to publish comparison reports.');
  }
  const form = new FormData();
  form.append('file', params.pdfBlob, params.filename ?? 'comparison-consolidated.pdf');
  form.append('file_id', params.fileId);
  form.append('draft_ids_json', JSON.stringify(params.draftIds));
  if (params.manualObservations != null && params.manualObservations !== '') {
    form.append('manual_observations', params.manualObservations);
  }
  form.append('flags_json', JSON.stringify(params.flags ?? []));
  const response = await fetch(`${API_BASE}/reports/comparison-drafts/publish`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return response.json() as Promise<ApiReport>;
}

export async function apiLogin(username: string, password: string): Promise<ApiTokenResponse> {
  const response = await apiFetch(
    '/auth/login',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    },
    false,
  );
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return response.json() as Promise<ApiTokenResponse>;
}

export async function apiRegister(
  username: string,
  password: string,
  email?: string,
): Promise<ApiTokenResponse> {
  const response = await apiFetch(
    '/auth/register',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        password,
        email: email?.trim() || null,
      }),
    },
    false,
  );
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return response.json() as Promise<ApiTokenResponse>;
}

export async function apiFetchCurrentUser(): Promise<ApiTokenResponse['user']> {
  const response = await apiFetch('/auth/me', { method: 'GET' }, true);
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return response.json() as Promise<ApiTokenResponse['user']>;
}

export function listProjectMembers(projectId: string): Promise<ApiProjectMember[]> {
  return getJson<ApiProjectMember[]>(`/projects/${projectId}/members`);
}
