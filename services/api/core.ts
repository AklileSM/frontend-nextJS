/**
 * Shared internals for the API client modules.
 *
 * All HTTP calls go through `apiFetch`, which:
 *   - prefixes paths with `/api`
 *   - attaches the bearer token from `localStorage` (when `withAuth` is true)
 *   - on a 401 outside `/login` and `/register`, clears the token and hard-
 *     redirects to `/login`
 *
 * Public surface re-exported by `services/apiClient.ts` for backwards
 * compatibility. New code should import directly from `services/api/*`.
 */
import { clearAccessToken, getAccessToken } from '@/auth/authSession';

/** Same-origin prefix. Next.js rewrites `/api/*` server-side to the backend. */
export const API_BASE = '/api';

/**
 * Extract a readable message from a non-OK response.
 *
 * Backend errors come back as `{"detail": "string"}` for app errors or
 * `{"detail": [{msg, loc, ...}, ...]}` for Pydantic 422s. Both shapes are
 * normalised to a plain string here.
 */
export async function parseApiError(response: Response): Promise<string> {
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

/**
 * Core fetch wrapper used by every API call.
 *
 * - Prepends `/api` to `path` and attaches `Authorization: Bearer <token>`
 *   when `withAuth` is true (default). Auth-free paths (login, register)
 *   pass `false`.
 * - On a 401 outside the auth pages: clears the stored token and hard-
 *   redirects to `/login`. The `typeof window !== 'undefined'` guard
 *   prevents the redirect during SSR. The login/register pages are
 *   excluded to avoid a redirect loop on bad credentials.
 * - Does NOT retry. Callers that need retry logic implement it themselves
 *   (see `uploadOneChunkWithRetry` in `services/api/upload.ts`).
 */
export async function apiFetch(path: string, init?: RequestInit, withAuth = true): Promise<Response> {
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

/** GET JSON. Throws `Error(<parsed detail>)` on any non-2xx. */
export async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(path, init, true);
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return response.json() as Promise<T>;
}

/** Resolves after `ms` milliseconds. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** Like `sleep`, but rejects with AbortError if `signal` aborts. */
export function sleepAbortable(ms: number, signal?: AbortSignal): Promise<void> {
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
