/** Published reports, viewer drafts, and comparison drafts.
 *
 *  Reports are creator-scoped, every list/get/delete call filters by the
 *  current user on the backend. PDFs are generated client-side and uploaded
 *  as finished blobs to the `with-pdf` / `publish` endpoints. */
import { getAccessToken } from '@/auth/authSession';
import type {
  ApiComparisonDraft,
  ApiComparisonDraftDetail,
  ApiReport,
  ApiViewerFieldDraft,
  ApiViewerFieldDraftDetail,
} from '@/types/api';
import { API_BASE, apiFetch, getJson, parseApiError } from './core';

// ---------------------------------------------------------------------------
// Published reports
// ---------------------------------------------------------------------------

export function listReports(opts?: { projectSlug?: string }): Promise<ApiReport[]> {
  const qs = opts?.projectSlug ? `?project_slug=${encodeURIComponent(opts.projectSlug)}` : '';
  return getJson<ApiReport[]>(`/reports${qs}`);
}

export async function deleteReport(reportId: string): Promise<void> {
  const response = await apiFetch(`/reports/${encodeURIComponent(reportId)}`, { method: 'DELETE' }, true);
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
}

/** Create a published Report directly from a PDF blob, no draft involved. */
export async function createReportWithPdf(params: {
  pdfBlob: Blob;
  fileId: string;
  filename?: string;
  label?: string | null;
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
  if (params.label != null && params.label !== '') {
    form.append('label', params.label);
  }
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

// ---------------------------------------------------------------------------
// Viewer drafts (one file → one report)
// ---------------------------------------------------------------------------

export function listViewerFieldDrafts(opts?: { projectSlug?: string }): Promise<ApiViewerFieldDraft[]> {
  const qs = opts?.projectSlug ? `?project_slug=${encodeURIComponent(opts.projectSlug)}` : '';
  return getJson<ApiViewerFieldDraft[]>(`/reports/viewer-drafts${qs}`);
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
  label?: string | null;
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
      label: params.label ?? null,
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
  label?: string | null;
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
      label: params.label ?? null,
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
  label?: string | null;
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
  if (params.label != null && params.label !== '') {
    form.append('label', params.label);
  }
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

// ---------------------------------------------------------------------------
// Comparison drafts (N drafts → one consolidated report)
// ---------------------------------------------------------------------------

export function listComparisonDrafts(opts?: { projectSlug?: string }): Promise<ApiComparisonDraft[]> {
  const qs = opts?.projectSlug ? `?project_slug=${encodeURIComponent(opts.projectSlug)}` : '';
  return getJson<ApiComparisonDraft[]>(`/reports/comparison-drafts${qs}`);
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
