// MOCK apiClient — Phase 0 through Phase 10.
//
// Same exported names and signatures as the eventual real client (see
// `frontend/src/services/apiClient.ts` for the live shapes). Every function returns
// hardcoded sample data from `mockData.ts` and resolves immediately. No fetch, no
// tokens, no proxy. Phase 11 swaps this file for the real implementation.
//
// Mutating endpoints (upload, delete, draft save, publish, annotation create) update
// the in-memory stores so flows can be exercised end-to-end against the mock.

import {
  makeMockId,
  mockAdminUser,
  mockAnnotations,
  mockCaptureDates,
  mockComparisonDrafts,
  mockProjects,
  mockReports,
  mockRoomFiles,
  mockRooms,
  mockViewerDrafts,
} from './mockData';
import type {
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
  Role,
  UploadSingleResponse,
} from '@/types/api';

// Mock auth heuristics (see apiLogin / apiRegister): username "fail" throws so
// the error path is demoable; usernames "admin" / "manager" / "viewer" return
// that role; anything else defaults to admin.
function roleFromUsername(username: string): Role {
  const lower = username.trim().toLowerCase();
  if (lower === 'manager' || lower === 'viewer') return lower;
  return 'admin';
}

export const API_BASE = '/api';

// Tiny pause so loading states are visible in the UI.
const wait = (ms = 80) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// --- Auth ---------------------------------------------------------------

export async function apiLogin(username: string, _password: string): Promise<ApiTokenResponse> {
  await wait(220);
  if (username.trim().toLowerCase() === 'fail') {
    throw new Error('Invalid username or password.');
  }
  const role = roleFromUsername(username);
  return {
    access_token: 'mock-access-token',
    token_type: 'bearer',
    user: { ...mockAdminUser, username, role },
  };
}

export async function apiRegister(
  username: string,
  _password: string,
  email?: string,
): Promise<ApiTokenResponse> {
  await wait(220);
  if (username.trim().toLowerCase() === 'fail') {
    throw new Error('Could not create that account. Try another username.');
  }
  const role = roleFromUsername(username);
  return {
    access_token: 'mock-access-token',
    token_type: 'bearer',
    user: { ...mockAdminUser, username, email: email?.trim() || null, role },
  };
}

export async function apiFetchCurrentUser(): Promise<ApiTokenResponse['user']> {
  await wait();
  return mockAdminUser;
}

// --- Projects / Rooms ---------------------------------------------------

export async function listProjects(): Promise<ApiProject[]> {
  await wait();
  return mockProjects;
}

export async function listRooms(): Promise<ApiRoom[]> {
  await wait();
  return mockRooms;
}

// --- Explorer -----------------------------------------------------------

export async function getExplorerByDate(date: string): Promise<ExplorerByDateResponse> {
  await wait();
  const rooms: Record<string, ApiRoomMediaGroup> = {};
  for (const room of mockRooms) {
    const group = mockRoomFiles[room.slug]?.[date];
    if (group) rooms[room.name] = group;
  }
  return { date, rooms };
}

export async function getExplorerByRoom(roomSlug: string): Promise<ExplorerByRoomResponse> {
  await wait();
  const room = mockRooms.find((r) => r.slug === roomSlug);
  return {
    room: roomSlug,
    room_name: room?.name ?? roomSlug,
    dates: mockRoomFiles[roomSlug] ?? {},
  };
}

export async function getExplorerDatesSummary(): Promise<ExplorerDatesSummaryResponse> {
  await wait();
  const dates: Record<string, DateMediaCounts> = {};
  for (const date of mockCaptureDates) {
    const counts: DateMediaCounts = { images: 0, videos: 0, pointclouds: 0, pdfs: 0 };
    for (const room of mockRooms) {
      const group = mockRoomFiles[room.slug]?.[date];
      if (!group) continue;
      counts.images += group.images.length;
      counts.videos += group.videos.length;
      counts.pointclouds += group.pointclouds.length;
      counts.pdfs += group.pdfs.length;
    }
    dates[date] = counts;
  }
  return { dates };
}

// --- AI -----------------------------------------------------------------

export async function analyzeImage(imageUrl: string, _fileId?: string): Promise<string> {
  await wait(400);
  return `Mock AI analysis for ${imageUrl}: walls show fresh paint application; minor surface irregularities visible near the lower-left corner; floor protection in place; lighting adequate for documentation.`;
}

// --- Files / Conversion -------------------------------------------------

export async function deleteFileAsset(fileId: string): Promise<void> {
  await wait();
  for (const roomSlug of Object.keys(mockRoomFiles)) {
    const byDate = mockRoomFiles[roomSlug];
    for (const date of Object.keys(byDate)) {
      const g = byDate[date];
      g.images = g.images.filter((f) => f.id !== fileId);
      g.videos = g.videos.filter((f) => f.id !== fileId);
      g.pointclouds = g.pointclouds.filter((f) => f.id !== fileId);
      g.pdfs = g.pdfs.filter((f) => f.id !== fileId);
    }
  }
}

export async function getConversionStatus(_fileId: string): Promise<ApiConversionStatus> {
  await wait();
  return { status: 'ready' };
}

export async function retryPointcloudConversion(_fileId: string): Promise<void> {
  await wait();
}

export async function listMyUploads(): Promise<ApiMyUpload[]> {
  await wait();
  return [];
}

// --- Upload -------------------------------------------------------------

export async function uploadSingleFile(params: {
  file: File;
  roomSlug: string;
  mediaType: 'image' | 'video' | 'pointcloud' | 'pdf';
  captureDate: string;
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}): Promise<UploadSingleResponse> {
  for (let p = 0; p <= 100; p += 20) {
    if (params.signal?.aborted) {
      throw new DOMException('Upload cancelled', 'AbortError');
    }
    params.onProgress?.(p);
    await wait(60);
  }
  const id = makeMockId('f');
  const newFile = {
    id,
    file_name: params.file.name,
    type: params.mediaType,
    src: `/mock/${id}/${params.file.name}`,
    full_src: `/mock/${id}/${params.file.name}`,
    capture_date: params.captureDate,
    uploaded_by_user_id: mockAdminUser.id,
    conversion_status: params.mediaType === 'pointcloud' ? 'ready' : null,
  };
  const room = (mockRoomFiles[params.roomSlug] ??= {});
  const group = (room[params.captureDate] ??= {
    images: [],
    videos: [],
    pointclouds: [],
    pdfs: [],
  });
  if (params.mediaType === 'image') group.images.push(newFile);
  else if (params.mediaType === 'video') group.videos.push(newFile);
  else if (params.mediaType === 'pointcloud') group.pointclouds.push(newFile);
  else group.pdfs.push(newFile);
  return {
    id,
    room: params.roomSlug,
    media_type: params.mediaType,
    file_name: params.file.name,
    capture_date: params.captureDate,
  };
}

// --- Annotations --------------------------------------------------------

export async function listAnnotations(fileId: string): Promise<ApiAnnotation[]> {
  await wait();
  return mockAnnotations.filter((a) => a.file_id === fileId);
}

export async function createAnnotation(params: {
  fileId: string;
  x: number;
  y: number;
  text: string;
}): Promise<ApiAnnotation> {
  await wait();
  const a: ApiAnnotation = {
    id: makeMockId('a'),
    file_id: params.fileId,
    x: params.x,
    y: params.y,
    text: params.text,
    created_at: new Date().toISOString(),
  };
  mockAnnotations.push(a);
  return a;
}

// --- Reports ------------------------------------------------------------

export async function listReports(): Promise<ApiReport[]> {
  await wait();
  return [...mockReports].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function deleteReport(reportId: string): Promise<void> {
  await wait();
  const idx = mockReports.findIndex((r) => r.id === reportId);
  if (idx >= 0) mockReports.splice(idx, 1);
}

export async function createReportWithPdf(params: {
  pdfBlob: Blob;
  fileId: string;
  filename?: string;
  aiDescription?: string | null;
  manualObservations?: string | null;
  flags?: string[];
}): Promise<void> {
  await wait();
  mockReports.push({
    id: makeMockId('rep'),
    file_id: params.fileId,
    ai_description: params.aiDescription ?? null,
    manual_observations: params.manualObservations ?? null,
    flags: params.flags ?? [],
    screenshots: [],
    created_by: mockAdminUser.id,
    pdf_url: `/mock/reports/${params.filename ?? 'report.pdf'}`,
    created_at: new Date().toISOString(),
  });
}

// --- Viewer drafts ------------------------------------------------------

export async function listViewerFieldDrafts(): Promise<ApiViewerFieldDraft[]> {
  await wait();
  return mockViewerDrafts.map(({ state_json: _ignored, ...rest }) => rest);
}

export async function getViewerFieldDraft(draftId: string): Promise<ApiViewerFieldDraftDetail> {
  await wait();
  const d = mockViewerDrafts.find((x) => x.id === draftId);
  if (!d) throw new Error('Draft not found');
  return d;
}

export async function deleteViewerFieldDraft(draftId: string): Promise<void> {
  await wait();
  const idx = mockViewerDrafts.findIndex((x) => x.id === draftId);
  if (idx >= 0) mockViewerDrafts.splice(idx, 1);
}

export async function createViewerFieldDraft(params: {
  fileId: string;
  viewerKind: string;
  manualObservations?: string | null;
  flags?: string[];
  state: Record<string, unknown>;
}): Promise<ApiViewerFieldDraftDetail> {
  await wait();
  const d: ApiViewerFieldDraftDetail = {
    id: makeMockId('vd'),
    file_id: params.fileId,
    viewer_kind: params.viewerKind,
    label: null,
    manual_observations: params.manualObservations ?? null,
    flags: params.flags ?? [],
    created_at: new Date().toISOString(),
    state_json: params.state,
  };
  mockViewerDrafts.push(d);
  return d;
}

export async function updateViewerFieldDraft(params: {
  draftId: string;
  fileId?: string;
  viewerKind?: string;
  manualObservations?: string | null;
  flags?: string[];
  state: Record<string, unknown>;
}): Promise<ApiViewerFieldDraftDetail> {
  await wait();
  const d = mockViewerDrafts.find((x) => x.id === params.draftId);
  if (!d) throw new Error('Draft not found');
  if (params.fileId) d.file_id = params.fileId;
  if (params.viewerKind) d.viewer_kind = params.viewerKind;
  d.manual_observations = params.manualObservations ?? null;
  d.flags = params.flags ?? [];
  d.state_json = params.state;
  return d;
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
  await wait();
  const idx = mockViewerDrafts.findIndex((x) => x.id === params.draftId);
  if (idx >= 0) mockViewerDrafts.splice(idx, 1);
  const report: ApiReport = {
    id: makeMockId('rep'),
    file_id: params.fileId,
    ai_description: params.aiDescription ?? null,
    manual_observations: params.manualObservations ?? null,
    flags: params.flags ?? [],
    screenshots: [],
    created_by: mockAdminUser.id,
    pdf_url: `/mock/reports/${params.filename ?? 'report.pdf'}`,
    created_at: new Date().toISOString(),
  };
  mockReports.push(report);
  return report;
}

// --- Comparison drafts --------------------------------------------------

export async function listComparisonDrafts(): Promise<ApiComparisonDraft[]> {
  await wait();
  return mockComparisonDrafts.map(({ state_json: _ignored, ...rest }) => rest);
}

export async function getComparisonDraft(draftId: string): Promise<ApiComparisonDraftDetail> {
  await wait();
  const d = mockComparisonDrafts.find((x) => x.id === draftId);
  if (!d) throw new Error('Draft not found');
  return d;
}

export async function deleteComparisonDraft(draftId: string): Promise<void> {
  await wait();
  const idx = mockComparisonDrafts.findIndex((x) => x.id === draftId);
  if (idx >= 0) mockComparisonDrafts.splice(idx, 1);
}

export async function createComparisonDraft(params: {
  fileId: string;
  manualObservations?: string | null;
  flags?: string[];
  state: Record<string, unknown>;
}): Promise<ApiComparisonDraftDetail> {
  await wait();
  const d: ApiComparisonDraftDetail = {
    id: makeMockId('cd'),
    file_id: params.fileId,
    label: null,
    manual_observations: params.manualObservations ?? null,
    flags: params.flags ?? [],
    pdf_url: null,
    created_at: new Date().toISOString(),
    state_json: params.state,
  };
  mockComparisonDrafts.push(d);
  return d;
}

export async function updateComparisonDraft(params: {
  draftId: string;
  fileId?: string;
  manualObservations?: string | null;
  flags?: string[];
  state: Record<string, unknown>;
}): Promise<ApiComparisonDraftDetail> {
  await wait();
  const d = mockComparisonDrafts.find((x) => x.id === params.draftId);
  if (!d) throw new Error('Draft not found');
  if (params.fileId) d.file_id = params.fileId;
  d.manual_observations = params.manualObservations ?? null;
  d.flags = params.flags ?? [];
  d.state_json = params.state;
  return d;
}

export async function publishComparisonDrafts(params: {
  pdfBlob: Blob;
  fileId: string;
  draftIds: string[];
  filename?: string;
  manualObservations?: string | null;
  flags?: string[];
}): Promise<ApiReport> {
  await wait();
  for (const id of params.draftIds) {
    const idx = mockComparisonDrafts.findIndex((x) => x.id === id);
    if (idx >= 0) mockComparisonDrafts.splice(idx, 1);
  }
  const report: ApiReport = {
    id: makeMockId('rep'),
    file_id: params.fileId,
    ai_description: null,
    manual_observations: params.manualObservations ?? null,
    flags: params.flags ?? [],
    screenshots: [],
    created_by: mockAdminUser.id,
    pdf_url: `/mock/reports/${params.filename ?? 'comparison.pdf'}`,
    created_at: new Date().toISOString(),
  };
  mockReports.push(report);
  return report;
}
