/** Annotations: CRUD + attachment upload/delete.
 *  The backend stores opaque JSON in `Annotation.data`; the frontend pulls
 *  out `{x, y, text}` and normalizes the flag/linked-annotation fields. */
import type { ApiAnnotation } from '@/types/api';
import { apiFetch, getJson, parseApiError } from './core';

type RawAnnotation = {
  id: string;
  file_id: string;
  annotation_type: string;
  data: Record<string, unknown>;
  flag?: string | null;
  linked_annotation_id?: string | null;
  attachment_url?: string | null;
  created_by_user_id?: string | null;
  created_at: string;
};

function normalizeAnnotation(
  item: RawAnnotation,
  fallback?: { x: number; y: number; text: string },
): ApiAnnotation {
  const data = item.data || {};
  const xRaw = data.x;
  const yRaw = data.y;
  const textRaw = data.text;
  const x = typeof xRaw === 'number' ? xRaw : Number(xRaw ?? fallback?.x ?? 0);
  const y = typeof yRaw === 'number' ? yRaw : Number(yRaw ?? fallback?.y ?? 0);
  const flag = item.flag;
  return {
    id: item.id,
    file_id: item.file_id,
    x: Number.isFinite(x) ? x : (fallback?.x ?? 0),
    y: Number.isFinite(y) ? y : (fallback?.y ?? 0),
    text: typeof textRaw === 'string' ? textRaw : (fallback?.text ?? ''),
    flag:
      flag === 'safety' || flag === 'quality' || flag === 'delayed'
        ? flag
        : null,
    linked_annotation_id: item.linked_annotation_id ?? null,
    attachment_url: item.attachment_url ?? null,
    created_by_user_id: item.created_by_user_id ?? null,
    created_at: item.created_at,
  };
}

export function listAnnotations(fileId: string): Promise<ApiAnnotation[]> {
  return getJson<RawAnnotation[]>(`/annotations/file/${encodeURIComponent(fileId)}`).then((items) =>
    items.map((item) => normalizeAnnotation(item)),
  );
}

export function createAnnotation(params: {
  fileId: string;
  x: number;
  y: number;
  text: string;
  flag?: string | null;
  linkedAnnotationId?: string | null;
}): Promise<ApiAnnotation> {
  return getJson<RawAnnotation>('/annotations', {
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
      flag: params.flag ?? null,
      linked_annotation_id: params.linkedAnnotationId ?? null,
    }),
  }).then((item) => normalizeAnnotation(item, { x: params.x, y: params.y, text: params.text }));
}

export function updateAnnotation(params: {
  annotationId: string;
  x: number;
  y: number;
  text: string;
  flag?: string | null;
  // Pass `null` to leave the link unchanged, the new id to set it, or set
  // `clearLink: true` below to explicitly remove it.
  linkedAnnotationId?: string | null;
  clearLink?: boolean;
}): Promise<ApiAnnotation> {
  return getJson<RawAnnotation>(`/annotations/${encodeURIComponent(params.annotationId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: {
        x: params.x,
        y: params.y,
        text: params.text,
      },
      flag: params.flag ?? null,
      linked_annotation_id: params.linkedAnnotationId ?? null,
      clear_link: params.clearLink ?? false,
    }),
  }).then((item) => normalizeAnnotation(item, { x: params.x, y: params.y, text: params.text }));
}

export async function uploadAnnotationAttachment(annotationId: string, file: File): Promise<ApiAnnotation> {
  const form = new FormData();
  form.append('file', file);
  const response = await apiFetch(
    `/annotations/${encodeURIComponent(annotationId)}/attachment`,
    { method: 'POST', body: form },
    true,
  );
  if (!response.ok) throw new Error(await parseApiError(response));
  const item = (await response.json()) as RawAnnotation;
  return normalizeAnnotation(item);
}

export async function deleteAnnotationAttachment(annotationId: string): Promise<ApiAnnotation> {
  const response = await apiFetch(
    `/annotations/${encodeURIComponent(annotationId)}/attachment`,
    { method: 'DELETE' },
    true,
  );
  if (!response.ok) throw new Error(await parseApiError(response));
  const item = (await response.json()) as RawAnnotation;
  return normalizeAnnotation(item);
}

export async function deleteAnnotation(annotationId: string): Promise<void> {
  const response = await apiFetch(`/annotations/${encodeURIComponent(annotationId)}`, { method: 'DELETE' }, true);
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
}
