# A6-Stern Frontend

Next.js application for the A6-Stern construction documentation platform. Provides file browsing, 360° panorama and 3D point cloud viewers, side-by-side image comparison, annotation tools, and PDF report generation.

Works alongside the `backend` and `deployment` repos.

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

| Variable | Where set | Default | Description |
|----------|-----------|---------|-------------|
| `BACKEND_URL` | `.env.local` or shell | `http://localhost:3002` | Backend base URL used by the Next.js rewrite proxy. **Build-time and runtime** — changing it requires a rebuild in Docker. |
| `NEXT_PROXY_MAX_BODY` | `.env.local` or shell | `128mb` | Maximum request body the Next.js proxy will buffer. Must be larger than your point cloud chunk size (default chunks are 64 MB). Lower this only if memory is a concern. |

**Note:** `BACKEND_URL` is never sent to the browser. The browser always calls `/api/*` on the same origin; Next.js rewrites those server-side to the backend. This is why the variable needs to be available at build time in Docker — Next.js bakes the rewrite destination into its route manifest.

## Available scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript compiler check (no emit) |

## Authentication

JWT tokens are stored in `localStorage` under the key `a6_auth_v2`. The `apiFetch` wrapper in `services/apiClient.ts` attaches them automatically as `Authorization: Bearer <token>`.

Any `401` response from the API clears the stored token and redirects the browser to `/login`. No token refresh — when the token expires (7-day lifetime set by the backend), the user is sent back to login.

## Route structure

| Route | Auth required | Notes |
|-------|--------------|-------|
| `/` | No | Public landing page |
| `/login` | No | |
| `/register` | No | |
| `/app/*` | Yes | Main application shell (navbar + sidebar) |
| `/app/projects/[slug]/files` | Yes | File explorer |
| `/app/compare` | Yes | Side-by-side image comparison |
| `/app/viewer/panorama` | Yes | 360° viewer |
| `/app/viewer/point-cloud` | Yes | 3D point cloud viewer |
| `/app/viewer/static` | Yes | Static image viewer |
| `/app/pdf-viewer` | Yes | PDF document viewer |
| `/app/admin/*` | Yes + admin | Admin dashboard, user and project management |
| `/projects/[slug]/settings` | Yes | Project settings (own layout, outside app shell) |
| `/unauthorized` | No | 403 page |

Unauthenticated users hitting protected routes are redirected to `/login` via the 401 handler in `apiFetch`.

## File uploads

All uploads require an admin account (enforced by the backend).

**Images, videos, PDFs** use a simple single-request POST to `/api/upload/single`.

**Point clouds (LAZ/LAS)** use a two-path strategy:
1. **Direct upload** (preferred): the backend issues a presigned MinIO PUT URL; the file is uploaded directly to MinIO from the browser, bypassing the Next.js proxy. This avoids buffering large files through Node.js.
2. **Chunked fallback**: if the direct path fails, the file is split into 64 MB chunks and uploaded sequentially with up to 5 concurrent workers and 3 retries per chunk. Assembly and conversion happen on the backend after all chunks arrive.

After upload, point clouds are converted to Potree format asynchronously. The file entry is created immediately with a `converting` status; the UI polls for completion.

## Key code locations

| Path | Purpose |
|------|---------|
| `next.config.mjs` | Rewrite proxy config, `BACKEND_URL` wiring, proxy body size limit |
| `services/apiClient.ts` | All API calls — fetch wrapper, auth header injection, 401 redirect, upload logic |
| `auth/authSession.ts` | JWT read/write/clear in localStorage |
| `context/AuthContext.tsx` | Auth state (current user, login, logout, register) |
| `context/SelectedDateContext.tsx` | Date filter state shared across the file explorer |
| `hooks/useMyProjectRole.ts` | Returns the current user's role in a given project |
| `types/api.ts` | TypeScript interfaces mirroring all backend response shapes |
| `lib/engineeringReportPdf.ts` | PDF generation for engineering reports (jsPDF) |
| `lib/compareDraftPdfFromState.ts` | PDF generation for comparison reports |
| `components/viewers/` | Panorama (Three.js), PointCloud (Potree), Static image, PDF viewers |
| `components/explorer/` | File grid, thumbnails, date/room filters, upload zone |
| `components/compare/` | Side-by-side 360° comparison viewer and panel |

## Tech stack

| Area | Library |
|------|---------|
| Framework | Next.js 16 (App Router), React 19 |
| Language | TypeScript 5.6 |
| Styling | Tailwind CSS, Framer Motion |
| Icons | Lucide React |
| Toasts | Sonner |
| 3D / panorama | Three.js, react-three/fiber, react-three/drei |
| PDF viewing | PDF.js (`pdfjs-dist`), `@react-pdf-viewer` |
| PDF generation | jsPDF, jsPDF-AutoTable, pdf-lib |
| Charts | Recharts |
| Date utilities | date-fns |
