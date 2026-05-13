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
import type { ApiProjectMember } from '@/types/api';
import { clearAccessToken, getAccessToken } from '@/auth/authSession';

// All API calls use the same-origin /api prefix. Next.js rewrites (next.config.mjs)
// proxy /api/* to the backend at build/run time. This keeps the browser bundle
// free of any internal Docker hostnames.
export const API_BASE = '/api';

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
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (
    response.status === 401 &&
    typeof window !== 'undefined' &&
    !window.location.pathname.startsWith('/login') &&
    !window.location.pathname.startsWith('/register')
  ) {
    clearAccessToken();
    window.location.replace('/login');
  }
  return response;
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

export function getExplorerDatesSummaryForProject(projectId: string): Promise<ExplorerDatesSummaryResponse> {
  return explorerDatesSummaryFromRooms(projectId);
}

export type ApiProjectCreateRequest = {
  name: string;
  slug: string;
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

export function listAdminUsers(): Promise<AdminUser[]> {
  return getJson<AdminUser[]>('/admin/users');
}

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

export function getExplorerByDate(date: string): Promise<ExplorerByDateResponse> {
  return getJson<ExplorerByDateResponse>(`/files/explorer/date/${date}`);
}

export async function getExplorerByDateForProject(
  projectId: string,
  date: string,
): Promise<ExplorerByDateResponse> {
  const [res, rooms] = await Promise.all([
    getJson<ExplorerByDateResponse>(`/files/explorer/date/${date}`),
    listProjectRooms(projectId),
  ]);
  // The API may key rooms by name OR slug — accept either.
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

function sleepAbortable(ms: number, signal?: AbortSignal): Promise<void> {
  if (!signal) return sleep(ms);
  if (signal.aborted) {
    return Promise.reject(new DOMException('Upload cancelled', 'AbortError'));
  }
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      signal.removeEventListener('abort', onAbort);
      reject(new DOMException('Upload cancelled', 'AbortError'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
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
  roomId: string;
  captureDate: string;
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}): Promise<UploadSingleResponse> {
  const token = getAccessToken();
  if (!token) {
    throw new Error('You must be signed in to upload.');
  }

  const initForm = new FormData();
  initForm.append('room_id', params.roomId);
  initForm.append('capture_date', params.captureDate);
  initForm.append('filename', params.file.name);
  initForm.append('file_size', String(params.file.size));
  initForm.append('content_type', params.file.type || 'application/octet-stream');

  if (params.signal?.aborted) {
    throw new DOMException('Upload cancelled', 'AbortError');
  }

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
      if (params.signal?.aborted) {
        throw new DOMException('Upload cancelled', 'AbortError');
      }
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
      await sleepAbortable(500 * 2 ** attempt, params.signal);
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

function uploadViaXhr(params: {
  url: string;
  method: string;
  file: File;
  contentType: string;
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(params.method, params.url, true);
    xhr.setRequestHeader('Content-Type', params.contentType);
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const percent = Math.min(99, Math.round((event.loaded / event.total) * 100));
      params.onProgress?.(percent);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        params.onProgress?.(100);
        resolve();
      } else {
        reject(new Error(`Direct MinIO upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error('Direct MinIO upload failed (network error)'));
    params.signal?.addEventListener(
      'abort',
      () => {
        xhr.abort();
        reject(new DOMException('Upload cancelled', 'AbortError'));
      },
      { once: true },
    );
    xhr.send(params.file);
  });
}

async function uploadPointcloudDirect(params: {
  file: File;
  roomId: string;
  captureDate: string;
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}): Promise<UploadSingleResponse> {
  const token = getAccessToken();
  if (!token) {
    throw new Error('You must be signed in to upload.');
  }

  const initForm = new FormData();
  initForm.append('room_id', params.roomId);
  initForm.append('capture_date', params.captureDate);
  initForm.append('filename', params.file.name);
  initForm.append('file_size', String(params.file.size));
  initForm.append('content_type', params.file.type || 'application/octet-stream');

  const initRes = await fetch(`${API_BASE}/upload/pointcloud/direct-init`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: initForm,
    signal: params.signal,
  });
  if (!initRes.ok) {
    throw new Error(await parseApiError(initRes));
  }
  const initData = (await initRes.json()) as { upload_id: string; upload_url: string; method?: string };

  await uploadViaXhr({
    url: initData.upload_url,
    method: initData.method || 'PUT',
    file: params.file,
    contentType: params.file.type || 'application/octet-stream',
    onProgress: params.onProgress,
    signal: params.signal,
  });

  const doneForm = new FormData();
  doneForm.append('upload_id', initData.upload_id);
  const doneRes = await fetch(`${API_BASE}/upload/pointcloud/direct-complete`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: doneForm,
    signal: params.signal,
  });
  if (!doneRes.ok) {
    throw new Error(await parseApiError(doneRes));
  }
  return doneRes.json() as Promise<UploadSingleResponse>;
}

export async function uploadSingleFile(params: {
  file: File;
  roomId: string;
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
    try {
      return await uploadPointcloudDirect({
        file: params.file,
        roomId: params.roomId,
        captureDate: params.captureDate,
        onProgress: params.onProgress,
        signal: params.signal,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
      return uploadPointcloudInChunks({
        file: params.file,
        roomId: params.roomId,
        captureDate: params.captureDate,
        onProgress: params.onProgress,
        signal: params.signal,
      });
    }
  }

  const form = new FormData();
  form.append('file', params.file);
  form.append('room_id', params.roomId);
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
  return getJson<
    Array<{
      id: string;
      file_id: string;
      annotation_type: string;
      data: Record<string, unknown>;
      created_at: string;
    }>
  >(`/annotations/file/${encodeURIComponent(fileId)}`).then((items) =>
    items.map((item) => normalizeAnnotation(item)),
  );
}

export function createAnnotation(params: {
  fileId: string;
  x: number;
  y: number;
  text: string;
}): Promise<ApiAnnotation> {
  return getJson<{
    id: string;
    file_id: string;
    annotation_type: string;
    data: Record<string, unknown>;
    created_at: string;
  }>('/annotations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      file_id: params.fileId,
      annotation_type: 'point-note',
      data: {
        x: params.x,
        y: params.y,
        text: params.text,
      },
    }),
  }).then((item) => normalizeAnnotation(item, { x: params.x, y: params.y, text: params.text }));
}

export function updateAnnotation(params: {
  annotationId: string;
  x: number;
  y: number;
  text: string;
}): Promise<ApiAnnotation> {
  return getJson<{
    id: string;
    file_id: string;
    annotation_type: string;
    data: Record<string, unknown>;
    created_at: string;
  }>(`/annotations/${encodeURIComponent(params.annotationId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: {
        x: params.x,
        y: params.y,
        text: params.text,
      },
    }),
  }).then((item) => normalizeAnnotation(item, { x: params.x, y: params.y, text: params.text }));
}

export async function deleteAnnotation(annotationId: string): Promise<void> {
  const response = await apiFetch(`/annotations/${encodeURIComponent(annotationId)}`, { method: 'DELETE' }, true);
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
}

function normalizeAnnotation(
  item: {
    id: string;
    file_id: string;
    data: Record<string, unknown>;
    created_at: string;
  },
  fallback?: { x: number; y: number; text: string },
): ApiAnnotation {
  const data = item.data || {};
  const xRaw = data.x;
  const yRaw = data.y;
  const textRaw = data.text;
  const x = typeof xRaw === 'number' ? xRaw : Number(xRaw ?? fallback?.x ?? 0);
  const y = typeof yRaw === 'number' ? yRaw : Number(yRaw ?? fallback?.y ?? 0);
  return {
    id: item.id,
    file_id: item.file_id,
    x: Number.isFinite(x) ? x : (fallback?.x ?? 0),
    y: Number.isFinite(y) ? y : (fallback?.y ?? 0),
    text: typeof textRaw === 'string' ? textRaw : (fallback?.text ?? ''),
    created_at: item.created_at,
  };
}

export function listReports(): Promise<ApiReport[]> {
  return getJson<ApiReport[]>('/reports');
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
  label?: string | null;
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
      label: params.label ?? null,
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
  label?: string | null;
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
        label: params.label ?? null,
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
