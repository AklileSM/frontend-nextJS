# API Client

All API calls go through `services/apiClient.ts`. This document explains the conventions so adding a new endpoint takes minutes, not hours.

## The two layers

```
your component
   │ uses
   ▼
named export      (e.g. listProjects, createReportWithPdf)   ← public surface
   │ calls
   ▼
apiFetch / getJson                                            ← core wrappers
   │ uses
   ▼
fetch('/api/...')
   │ rewritten server-side by Next.js
   ▼
backend (FastAPI :3001)
```

Components only ever call the **named exports**. They are typed functions that return parsed JSON (or `Blob` / `void` for special cases), and throw a plain `Error` on any non-2xx response.

## Conventions

- **Same-origin paths.** Every request goes to `/api/<path>` — no hardcoded backend URL, no `process.env.BACKEND_URL` in the browser bundle. The Next.js rewrite (`next.config.mjs`) routes it server-side.
- **Auth attached automatically.** `apiFetch` reads the JWT from `localStorage` via `getAccessToken()` and sets `Authorization: Bearer <token>`. Calls that must be unauthenticated (login, register) pass `withAuth=false`.
- **Errors are strings.** Backend errors come back as `{"detail": "..."}` or, for 422, `{"detail": [{msg, loc, ...}]}`. Both are normalized to a single readable string by `parseApiError`. The caller catches `Error` and toasts the message.
- **No retry by default.** Two exceptions:
  - `listRooms()` has a one-shot retry — used early in the boot sequence where flakes are common.
  - Chunked pointcloud uploads retry each chunk up to 3 times — implemented inline, not in `apiFetch`.
- **No SWR / React Query.** State management is component-local. If you want caching, lift the call to a context and memoize. Don't reach for SWR for a single use site.
- **Global 401 → /login.** `apiFetch` checks for 401 outside `/login` and `/register`, clears the token, and `window.location.replace('/login')`. This is the only side effect inside the fetch wrapper.

## Anatomy of `apiFetch`

```ts
async function apiFetch(path: string, init?: RequestInit, withAuth = true) {
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
```

`getJson<T>` is a thin convenience wrapper:

```ts
async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(path, init, true);
  if (!response.ok) throw new Error(await parseApiError(response));
  return response.json() as Promise<T>;
}
```

## Adding a new endpoint

### 1. Add the type to `types/api.ts`

```ts
// Mirror the backend response shape exactly. Use snake_case to match FastAPI.
export interface ApiThing {
  id: string;
  name: string;
  created_at: string;   // ISO 8601
}
```

If you need a request body type, prefix it `Api<Thing>CreateRequest` to stay consistent.

### 2. Add the exported function in `services/apiClient.ts`

Pick the right wrapper:

```ts
// JSON GET — most common
export function listThings(): Promise<ApiThing[]> {
  return getJson<ApiThing[]>('/things');
}

// JSON POST with body
export function createThing(body: { name: string }): Promise<ApiThing> {
  return getJson<ApiThing>('/things', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// 204 No Content
export async function deleteThing(id: string): Promise<void> {
  const r = await apiFetch(`/things/${id}`, { method: 'DELETE' });
  if (!r.ok) throw new Error(await parseApiError(r));
}

// Multipart form (file upload)
export async function uploadThingPicture(id: string, file: File): Promise<ApiThing> {
  const fd = new FormData();
  fd.append('file', file);
  const r = await apiFetch(`/things/${id}/picture`, { method: 'POST', body: fd });
  if (!r.ok) throw new Error(await parseApiError(r));
  return r.json();
}

// Binary download (e.g. ZIP)
export async function downloadThingBundle(id: string): Promise<Blob> {
  const r = await apiFetch(`/things/${id}/bundle`);
  if (!r.ok) throw new Error(await parseApiError(r));
  return r.blob();
}

// Auth-free (login, register, reset endpoints)
export async function publicPing(): Promise<{ ok: true }> {
  const r = await apiFetch('/ping', undefined, /*withAuth=*/ false);
  if (!r.ok) throw new Error(await parseApiError(r));
  return r.json();
}
```

### 3. Use it

```tsx
'use client';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { listThings } from '@/services/apiClient';
import type { ApiThing } from '@/types/api';

export default function Page() {
  const [things, setThings] = useState<ApiThing[]>([]);
  useEffect(() => {
    listThings()
      .then(setThings)
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Failed'));
  }, []);
  // …
}
```

Don't:

- ❌ Read the response status code in your component. The wrapper has thrown — you'd be unreachable.
- ❌ Inline a `fetch('/api/things')` in a component. Always go through `apiClient.ts`.
- ❌ Add `Authorization` headers manually. `apiFetch` does it; double-setting is fine but pointless.

## Specific patterns

### Upload progress (XHR fallback)

`fetch` doesn't expose upload progress. For `uploadSingleFile`, we drop down to `XMLHttpRequest` to wire up the progress callback:

```ts
const xhr = new XMLHttpRequest();
xhr.upload.onprogress = (e) => {
  if (e.lengthComputable) onProgress(e.loaded / e.total);
};
xhr.open('POST', `${API_BASE}/upload/single`);
xhr.setRequestHeader('Authorization', `Bearer ${getAccessToken()}`);
xhr.send(formData);
```

If you need progress on a new upload endpoint, copy the pattern from `uploadSingleFile` and `uploadOneChunkWithRetry`.

### Pointcloud chunked upload

A bespoke flow inside `apiClient.ts`:

1. `POST /api/upload/pointcloud/init` → `{upload_id, chunk_size}`
2. Slice the file into `chunk_size`-byte chunks.
3. Concurrently `POST /api/upload/pointcloud/chunk` for each, with retry-on-failure (3 attempts).
4. `POST /api/upload/pointcloud/complete` → asset row.

The "direct" variant (`/pointcloud/direct-init` → presigned PUT → `/pointcloud/direct-complete`) is preferred when `MINIO_PUBLIC_UPLOAD_BASE_URL` is configured. The client transparently falls back to chunked if direct returns 400.

### Bulk endpoints

Bulk-delete returns `{affected, skipped}`. Surface both to the user — "Deleted 4, skipped 2 (no permission)".

Bulk-download returns a Blob; combine with `affected` / `skipped` from response headers (`X-Bulk-Affected`, `X-Bulk-Skipped`):

```ts
const r = await apiFetch(`/files/bulk-download`, { method: 'POST', body: JSON.stringify({ ids }) });
if (!r.ok) throw new Error(await parseApiError(r));
return {
  blob: await r.blob(),
  affected: Number(r.headers.get('X-Bulk-Affected') ?? 0),
  skipped: Number(r.headers.get('X-Bulk-Skipped') ?? 0),
};
```

### Auth-free calls

Login, register, forgot-password, reset-password, verify-email, `validate-reset-token`, `resend-verification` — these all bypass the 401-redirect side effect by passing `withAuth=false` (or by being on a page exempt from the redirect rule).

If you're tempted to add an unauthenticated endpoint, make sure the route is exempted in `apiFetch`'s 401 check too, or you'll loop.

### Aborting requests

For search-as-you-type and similar racing-fetch scenarios, accept an `AbortSignal`:

```ts
export function searchFiles(q: string, projectSlug: string, signal?: AbortSignal): Promise<ApiMyUpload[]> {
  return getJson<ApiMyUpload[]>(`/files/search?q=${encodeURIComponent(q)}&project_slug=${encodeURIComponent(projectSlug)}`, { signal });
}
```

The caller creates an `AbortController`, passes `.signal`, and calls `.abort()` on the previous request before issuing a new one.

## Types vs schemas

The backend's Pydantic schemas live in `backend/app/schemas.py`. The frontend's TypeScript types live in `types/api.ts`. They must stay aligned by convention — there's no codegen step.

When you change a backend response shape:

1. Update the Pydantic model.
2. Update the corresponding TypeScript interface in `types/api.ts`.
3. Compile-check: `npm run typecheck`. Anything that uses the old shape lights up.

## Where the code lives

| Concern | File |
|---|---|
| All API wrappers | `services/apiClient.ts` |
| TypeScript types | `types/api.ts` |
| Token storage | `auth/authSession.ts` |
| Hash helper (for upload precheck) | `lib/hashFile.ts` |
| Next.js rewrite config | `next.config.mjs` |
