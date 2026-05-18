/** File uploads.
 *
 * `uploadSingleFile` is the public entry point. It dispatches based on
 * `mediaType`:
 *   - image / video / pdf → single multipart POST to /upload/single
 *   - pointcloud         → tries `uploadPointcloudDirect` first (browser →
 *                          MinIO via presigned PUT), falls back to
 *                          `uploadPointcloudInChunks` on any non-abort error.
 *
 * `precheckUploadHash` lets the browser ask "is this hash already known?"
 * before transferring large files.
 */
import { getAccessToken } from '@/auth/authSession';
import type { ApiPrecheckHash, UploadSingleResponse } from '@/types/api';
import { API_BASE, apiFetch, parseApiError, sleepAbortable } from './core';

const POINTCLOUD_CHUNK_SIZE = 64 * 1024 * 1024;
const POINTCLOUD_UPLOAD_CONCURRENCY = 5;
const POINTCLOUD_CHUNK_MAX_RETRIES = 3;

export async function precheckUploadHash(sha256Hash: string): Promise<ApiPrecheckHash> {
  const response = await apiFetch('/upload/precheck-hash', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sha256_hash: sha256Hash }),
  }, true);
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return response.json() as Promise<ApiPrecheckHash>;
}

/**
 * Upload a LAZ/LAS file in 64 MB chunks through the Next.js proxy.
 *
 * Protocol:
 *  1. POST /upload/pointcloud/init  → upload_id, chunk_size
 *  2. POST /upload/pointcloud/chunk (repeated, up to 5 concurrent workers)
 *     Each chunk retries up to 3 times with exponential back-off (500 ms × 2^n).
 *  3. POST /upload/pointcloud/complete → UploadSingleResponse
 *
 * `onProgress` is called with 0–99% during chunk uploads and 100% on completion.
 * The `signal` propagates cancellation to every fetch and sleep; an AbortError
 * bubbles up immediately without further retries.
 *
 * Used as the fallback when `uploadPointcloudDirect` fails (e.g. no presigned
 * URL configured) or is unavailable.
 */
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
  const chunkSize =
    initData.chunk_size && initData.chunk_size > 0 ? initData.chunk_size : POINTCLOUD_CHUNK_SIZE;
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

/**
 * Upload a LAZ/LAS file directly from the browser to MinIO via a presigned URL.
 *
 * Protocol:
 *  1. POST /upload/pointcloud/direct-init → upload_id, upload_url (presigned PUT)
 *  2. PUT <upload_url>  (XHR, direct to MinIO, bypasses the Next.js proxy)
 *  3. POST /upload/pointcloud/direct-complete → UploadSingleResponse
 *
 * XHR is used instead of fetch because `XMLHttpRequest.upload.onprogress` gives
 * real upload progress events. The fetch Streams API does not support upload
 * progress in all browsers.
 *
 * Requires `MINIO_PUBLIC_UPLOAD_BASE_URL` to be set server-side. If the backend
 * returns 400 on direct-init, `uploadSingleFile` catches it and falls back to
 * `uploadPointcloudInChunks`. AbortError is re-thrown immediately (no fallback).
 */
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

/**
 * Upload any supported file type to the backend.
 *
 * For images, videos, and PDFs: single multipart POST to /upload/single.
 *
 * For point clouds (LAZ/LAS):
 *  - Tries `uploadPointcloudDirect` first (browser → MinIO presigned URL).
 *  - Falls back to `uploadPointcloudInChunks` on any non-abort error (e.g.
 *    presigned URLs not configured, CORS issue, network hiccup).
 *  - AbortError from either path is re-thrown immediately, no fallback.
 *
 * `onProgress` is called with 0–100. `signal` cancels the upload at any stage.
 */
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
