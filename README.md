# A6-Stern Frontend

> **New here?** Read `[deployment/PROJECT_OVERVIEW.md](../deployment/PROJECT_OVERVIEW.md)` first — it's the cross-repo front page with a topic-based map of every doc in the project.

Next.js application for the A6-Stern construction documentation platform. Provides file browsing, 360° panorama and 3D point cloud viewers, side-by-side image comparison, annotation tools, and PDF report generation.

Works alongside the `backend` and `deployment` repos.

## Documentation map

This README covers setup, route inventory, and the high-level state model. Deeper topics live in companion docs:


| Doc                                                  | Covers                                                                          |
| ---------------------------------------------------- | ------------------------------------------------------------------------------- |
| [STYLING.md](STYLING.md)                             | Color tokens, typography, common UI patterns, framer-motion conventions         |
| [VIEWERS.md](VIEWERS.md)                             | Static / panorama / point cloud / PDF / compare viewers; viewer-context handoff |
| [EXPLORER.md](EXPLORER.md)                           | File grid, thumbnails, upload zone, calendar, room filter, bulk ops             |
| [REPORTS.md](REPORTS.md)                             | ReportBuilder, draft lifecycle, PDF generation, comparison flow                 |
| [ANNOTATIONS.md](ANNOTATIONS.md)                     | Annotation pins, coordinate system, attachments, linked annotations             |
| [ADMIN.md](ADMIN.md)                                 | `/app/admin/users` and `/app/admin/projects` pages, role gating                 |
| [PROJECT_SETTINGS.md](PROJECT_SETTINGS.md)           | Per-project settings: members, rooms, floorplan, danger zone                    |
| [AUTH_FLOWS.md](AUTH_FLOWS.md)                       | Register, email verification, forgot/reset password, token storage              |
| [API_CLIENT.md](API_CLIENT.md)                       | How to add an endpoint, error handling, upload patterns                         |
| [TESTING.md](TESTING.md)                             | Current state (no tests) + Vitest / Playwright starter recipe                   |
| [docs/changelog-2026q2.md](docs/changelog-2026q2.md) | Historical UX audit changelog                                                   |


## Prerequisites

- Node.js 20+
- A running backend instance (see `backend` repo)

## Local development

```bash
npm install
# Configure the backend URL (see below — default points at Docker-mapped port 3002)
npm run dev
```

The app starts at `http://localhost:3000`.

### Backend URL

The frontend proxies all `/api/*` requests to the backend via a Next.js rewrite. For local dev, create a `.env.local` file (already provided) or set the env var before running:

```bash
# If running backend in Docker (default port mapping):
BACKEND_URL=http://localhost:3002 npm run dev

# If running backend directly (not in Docker):
BACKEND_URL=http://localhost:3001 npm run dev
```

The default fallback in `next.config.mjs` is `http://localhost:3002`, so if your backend container is running you can just `npm run dev` without setting anything.

## Environment variables


| Variable              | Where set             | Default                 | Description                                                                                                                                                             |
| --------------------- | --------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BACKEND_URL`         | `.env.local` or shell | `http://localhost:3002` | Backend base URL used by the Next.js rewrite proxy. **Build-time and runtime**, changing it requires a rebuild in Docker.                                               |
| `NEXT_PROXY_MAX_BODY` | `.env.local` or shell | `128mb`                 | Maximum request body the Next.js proxy will buffer. Must be larger than your point cloud chunk size (default chunks are 64 MB). Lower this only if memory is a concern. |


**Note:** `BACKEND_URL` is never sent to the browser. The browser always calls `/api/`* on the same origin; Next.js rewrites those server-side to the backend. This is why the variable needs to be available at build time in Docker, Next.js bakes the rewrite destination into its route manifest.

## Available scripts


| Command             | Description                             |
| ------------------- | --------------------------------------- |
| `npm run dev`       | Start dev server with hot reload        |
| `npm run build`     | Production build                        |
| `npm run start`     | Serve the production build              |
| `npm run lint`      | Run ESLint                              |
| `npm run typecheck` | Run TypeScript compiler check (no emit) |


## Authentication

JWT tokens are stored in `localStorage` under the key `a6_auth_v2`. The `apiFetch` wrapper in `services/apiClient.ts` attaches them automatically as `Authorization: Bearer <token>`.

Any `401` response from the API clears the stored token and redirects the browser to `/login`. No token refresh — when the token expires (7-day lifetime set by the backend), the user is sent back to login.

## Route structure


| Route                        | Auth required | Notes                                            |
| ---------------------------- | ------------- | ------------------------------------------------ |
| `/`                          | No            | Public landing page                              |
| `/login`                     | No            |                                                  |
| `/register`                  | No            |                                                  |
| `/app/`*                     | Yes           | Main application shell (navbar + sidebar)        |
| `/app/projects/[slug]/files` | Yes           | File explorer                                    |
| `/app/compare`               | Yes           | Side-by-side image comparison                    |
| `/app/viewer/panorama`       | Yes           | 360° viewer                                      |
| `/app/viewer/point-cloud`    | Yes           | 3D point cloud viewer                            |
| `/app/viewer/static`         | Yes           | Static image viewer                              |
| `/app/pdf-viewer`            | Yes           | PDF document viewer                              |
| `/app/admin/*`               | Yes + admin   | Admin dashboard, user and project management     |
| `/projects/[slug]/settings`  | Yes           | Project settings (own layout, outside app shell) |
| `/unauthorized`              | No            | 403 page                                         |


Unauthenticated users hitting protected routes are redirected to `/login` via the 401 handler in `apiFetch`.

## File uploads

All uploads require an admin account (enforced by the backend).

**Images, videos, PDFs** use a simple single-request POST to `/api/upload/single`.

**Point clouds (LAZ/LAS)** use a two-path strategy:

1. **Direct upload** (preferred): the backend issues a presigned MinIO PUT URL; the file is uploaded directly to MinIO from the browser, bypassing the Next.js proxy. This avoids buffering large files through Node.js.
2. **Chunked fallback**: if the direct path fails, the file is split into 64 MB chunks and uploaded sequentially with up to 5 concurrent workers and 3 retries per chunk. Assembly and conversion happen on the backend after all chunks arrive.

After upload, point clouds are converted to Potree format asynchronously. The file entry is created immediately with a `converting` status; the UI polls for completion.

## Key code locations


| Path                              | Purpose                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------- |
| `next.config.mjs`                 | Rewrite proxy config, `BACKEND_URL` wiring, proxy body size limit               |
| `services/apiClient.ts`           | All API calls, fetch wrapper, auth header injection, 401 redirect, upload logic |
| `auth/authSession.ts`             | JWT read/write/clear in localStorage                                            |
| `context/AuthContext.tsx`         | Auth state (current user, login, logout, register)                              |
| `context/SelectedDateContext.tsx` | Date filter state shared across the file explorer                               |
| `hooks/useMyProjectRole.ts`       | Returns the current user's role in a given project                              |
| `types/api.ts`                    | TypeScript interfaces mirroring all backend response shapes                     |
| `lib/engineeringReportPdf.ts`     | PDF generation for engineering reports (jsPDF)                                  |
| `lib/compareDraftPdfFromState.ts` | PDF generation for comparison reports                                           |
| `components/viewers/`             | Panorama (Three.js), PointCloud (Potree), Static image, PDF viewers             |
| `components/explorer/`            | File grid, thumbnails, date/room filters, upload zone                           |
| `components/compare/`             | Side-by-side 360° comparison viewer and panel                                   |


## Performance and bundle

### Production build

```bash
npm run build   # compiles and outputs to .next/
npm run start   # serve the production build locally
```

### Bundle analysis

Install the analyzer and set an env var before building:

```bash
npm install -D @next/bundle-analyzer
ANALYZE=true npm run build
```

Add to `next.config.mjs`:

```js
import bundleAnalyzer from '@next/bundle-analyzer';
const withBundleAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === 'true' });
export default withBundleAnalyzer(nextConfig);
```

The three heaviest dependencies are Three.js (`~600 KB gz`), PDF.js (`~400 KB gz`), and jsPDF (`~200 KB gz`). Each is only used by a specific viewer page.

### Lazy-loading viewers

All viewer components should be imported with `next/dynamic` to avoid bundling Three.js or PDF.js into the main chunk:

```tsx
// Good — loads only when the page renders
import dynamic from 'next/dynamic';
const PanoramaViewer = dynamic(() => import('@/components/viewers/PanoramaViewer'), {
  ssr: false,            // Three.js requires browser APIs
  loading: () => <Spinner />,
});
```

The `ssr: false` flag is required for any component that references `window`, `document`, or WebGL APIs.

### Image optimization

Next.js `<Image>` is used for thumbnails. The `remotePatterns` in `next.config.mjs` currently allows only `localhost:3002`. To serve images from a production backend, add its hostname there.

Thumbnails are already pre-sized at 400×300 px by the backend. Do not re-scale them with CSS alone, use the `width` and `height` props on `<Image>` to avoid layout shifts.

### Proxy body limit

The Next.js proxy buffers uploads before forwarding them. The limit is set to `128 MB` via `NEXT_PROXY_MAX_BODY`. If you raise the backend chunk size above 64 MB, raise this value proportionally. Under-sizing it causes silent upload truncation with no client-side error.

## next.config.mjs explained

Three things happen in `next.config.mjs` that are easy to miss:

**1. The API rewrite (proxy)**

```js
{ source: '/api/:path*', destination: `${backendBase}/api/:path`* }
```

Every browser request to `/api/*` is rewritten server-side by Next.js to the backend URL. The browser always calls the same origin as the frontend, the backend address never reaches the client. This eliminates CORS configuration entirely.

**2. BACKEND_URL is build-time AND runtime**

`backendBase` is read from `process.env.BACKEND_URL` when the Next.js server starts. In Docker, it is baked into the route manifest at `docker build` time as a build arg. Changing the value in `.env` after building has no effect, you must rebuild the image.

**3. Proxy body size limit**

Next.js buffers the full request body before forwarding it. The default is ~10 MB, which silently truncates point-cloud chunks (the backend accepts up to 32 MB per chunk). `NEXT_PROXY_MAX_BODY` raises this to 128 MB. If you change the backend chunk size you must also update this limit.

## State management

There is no global state library (no Redux, no Zustand). State is split across three mechanisms:

### React Context (in-memory, resets on hard refresh)


| Context               | Provider               | Hook                | What it holds                                                 |
| --------------------- | ---------------------- | ------------------- | ------------------------------------------------------------- |
| `AuthContext`         | `AuthProvider`         | `useAuth()`         | Current user, login/logout/register actions, `isLoading` flag |
| `SelectedDateContext` | `SelectedDateProvider` | `useSelectedDate()` | Selected date per explorer scope (scoped to project ID)       |
| `SidebarContext`      | `SidebarProvider`      | `useSidebar()`      | Sidebar open/collapsed state                                  |


**Provider hierarchy** (outermost first):

```
AuthProvider
  └── SelectedDateProvider       (app routes only)
        └── AppShell
              └── SidebarProvider (inside AppShell)
```

`AuthProvider` and `SelectedDateProvider` are mounted by `AppProviders` in `components/providers/RouteProviders.tsx`, which wraps every page under `/app/*`. `SidebarProvider` is mounted by `AppShell`.

### localStorage (persisted, survives refreshes)


| Key                       | Written by            | Purpose                                       |
| ------------------------- | --------------------- | --------------------------------------------- |
| `a6_auth_v2`              | `auth/authSession.ts` | JWT access token (7-day lifetime)             |
| `a6.explorerDate.<scope>` | `SelectedDateContext` | Selected date per project scope               |
| `a6.sidebarOpen`          | `SidebarContext`      | Sidebar collapsed preference (`"0"` or `"1"`) |


`a6_access_token` is a legacy key migrated transparently to `a6_auth_v2` on first read.

### URL / navigation state

Viewer state (which file is open, camera position) is passed via `sessionStorage` or `location.state` by the navigation code in each viewer component. It is not in Context or localStorage because it is ephemeral and route-specific.

### Auth lifecycle

1. **Page load**: `AuthProvider` checks for `a6_auth_v2` in localStorage. If present, calls `GET /auth/me` to hydrate the user object. `isLoading` is `true` until this settles.
2. **Login/register**: the token is written to localStorage; the user object is set in context.
3. **401 from any API call**: `apiFetch` clears the token and hard-redirects to `/login`.
4. **Logout**: token cleared from localStorage; user set to `null` in context.
5. **Token expiry**: handled identically to a 401, the next API call triggers the redirect.

### Adding new global state

- **Short-lived, route-scoped**: use `useState` in the component or page.
- **Shared across sibling components**: lift to the nearest common ancestor.
- **Persisted across navigation within a session**: add to `SelectedDateContext` or create a new context following the same pattern.
- **Persisted across hard refreshes**: write to localStorage and seed React state from it on mount (see `SidebarContext` for the pattern).

## Tech stack


| Area           | Library                                       |
| -------------- | --------------------------------------------- |
| Framework      | Next.js 16 (App Router), React 19             |
| Language       | TypeScript 5.6                                |
| Styling        | Tailwind CSS, Framer Motion                   |
| Icons          | Lucide React                                  |
| Toasts         | Sonner                                        |
| 3D / panorama  | Three.js, react-three/fiber, react-three/drei |
| PDF viewing    | PDF.js (`pdfjs-dist`), `@react-pdf-viewer`    |
| PDF generation | jsPDF, jsPDF-AutoTable, pdf-lib               |
| Charts         | Recharts                                      |
| Date utilities | date-fns                                      |


