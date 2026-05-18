/** AI vision analysis. The backend may return 202 while a background analysis
 *  is in flight (triggered automatically on image upload); we poll until done. */
import { apiFetch, parseApiError, sleep } from './core';

const AI_POLL_INTERVAL_MS = 2000;
const AI_POLL_MAX_ATTEMPTS = 30;

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

/**
 * Request AI analysis for an image and poll until the result is ready.
 *
 * The backend may return 202 if the analysis is still in-progress (triggered
 * automatically at upload time). This function polls every 2 s for up to 60 s
 * (30 attempts). Throws if the analysis is not ready within that window.
 *
 * Results are cached server-side — repeated calls for the same `fileId` return
 * immediately without re-calling the vision API.
 */
export async function analyzeImage(imageUrl: string, fileId?: string): Promise<string> {
  for (let attempt = 0; attempt < AI_POLL_MAX_ATTEMPTS; attempt++) {
    const result = await analyzeImageOnce(imageUrl, fileId);
    if (result.status === 200) return result.description;
    await sleep(AI_POLL_INTERVAL_MS);
  }
  throw new Error('AI analysis timed out. Please try again later.');
}
