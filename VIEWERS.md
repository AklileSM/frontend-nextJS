# Viewers: Frontend Reference

This document covers how viewers work: how file context passes from the explorer to a viewer, what each viewer can do, and keyboard shortcuts.

## How viewers receive file context

Viewers are standalone pages under `/app/viewer/*`. The App Router provides no built-in way to pass state between navigations, so file metadata is stashed in `localStorage` before navigation and read back by the viewer.

**Writing context (in the file explorer):**

```ts
import { setViewerContext } from '@/components/explorer/viewerContext';

setViewerContext({
  file,           // ApiMediaFile
  roomSlug,       // string
  projectSlug,    // string
  date,           // string (YYYY-MM-DD)
  origin,         // 'project' | 'room'
});
```

**Reading context (in the viewer):**

```ts
const { ctx, loading, fallbackHref } = useViewerContext();
// ctx is ViewerContext | null, null if the user navigated directly without going through the explorer
```

Context is stored per project slug under `a6.viewerContext.<projectSlug>` and survives full page reloads. The last 12 opened files are tracked in `a6.recentFiles` for the recently-viewed list on the dashboard.

## Which viewer opens for which file type

`viewerHrefFor(file)` in `viewerContext.ts` determines the default viewer route:


| File type    | Default route             | Notes                                              |
| ------------ | ------------------------- | -------------------------------------------------- |
| `image`      | `/app/viewer/static`      | User can switch to Panorama from inside the viewer |
| `video`      | `/app/viewer/static`      | Video plays inline in the static viewer            |
| `pointcloud` | `/app/viewer/point-cloud` |                                                    |
| `pdf`        | `/app/pdf-viewer`         |                                                    |


## Back navigation

`backHrefFor(ctx)` returns the correct back URL based on where the user came from:


| `ctx.origin` | Back destination                         |
| ------------ | ---------------------------------------- |
| `'project'`  | `/app/projects/<slug>/files?date=<date>` |
| `'room'`     | `/app/room-explorer?room=<roomSlug>`     |


If `ctx` is null (direct navigation), the fallback is the last project files page stored in `sidebar.lastProjectSlug`.

## Static Viewer (`/app/viewer/static`)

**Handles:** images, video

**Image features:**

- Zoom in/out (10% steps, capped at 300%) via `+`/`−` buttons
- Click the image to place annotation markers (when annotation mode is active)
- Annotation markers shown as numbered circles; click to open details
- Edit marker position by clicking elsewhere while in edit mode
- Toggle annotation visibility
- AI description generation (calls `/api/ai/analyze`)
- Switch to Panorama viewer button

**Video features:**

- Native `<video>` controls
- Fullscreen button

**Keyboard shortcuts:**

- `Escape`  if annotation form is open: close form; if details panel is open: close panel; otherwise: go back

**Annotation coordinate system:** `x` and `y` are normalised to `[0, 1]` relative to the displayed image dimensions. Stored as floats in the database.

## Panorama Viewer (`/app/viewer/panorama`)

**Handles:** images only (equirectangular/360° photos)

**How it works:** The image is mapped as a texture onto the inside of a Three.js sphere (radius 500, 60×40 segments). The camera sits at the origin looking outward with a 70° FOV. OrbitControls lets the user drag to rotate.

**Controls:**

- Click + drag to look around
- Damping enabled (factor 0.3) for smooth deceleration
- Pan enabled; zoom disabled

**Notes:**

- The viewer preloads the image with a plain `<Image>` element to confirm it is accessible before handing it to Three.js,  this avoids a blank sphere on load failure
- If the image fails to load, an error message is shown and the raw image is displayed as a fallback preview
- Switch to Static viewer button

**Keyboard shortcuts:**

- `Escape`  go back

## Point Cloud Viewer (`/app/viewer/point-cloud`)

**Handles:** point clouds (Potree-converted LAZ/LAS files)

**How it works:** The viewer renders a Potree web viewer inside an `<iframe>` pointed at `/potree/examples/viewer.html?url=<cloudUrl>`. The `cloudUrl` is the presigned MinIO URL for the converted point cloud (the `_potree/` prefix directory returned by the API).

Potree loads its three output files from that URL:

- `metadata.json`  octree metadata
- `hierarchy.bin`  node hierarchy
- `octree.bin` point data

**Controls (inside the Potree iframe):**

- Left drag orbit
- Right drag pan
- Scroll zoom
- Potree's built-in toolbar for point size, rendering quality, etc.

**Host page controls:**

- Fullscreen button (requests fullscreen on the container div, not the iframe)

**Keyboard shortcuts:**

- `Escape` go back (only when not in fullscreen mode; browser handles Escape in fullscreen)

**If the point cloud shows nothing:** the file may still be converting. Check `conversion_status` in the file metadata the explorer shows a converting indicator. If status is `failed`, re-upload the file.

## PDF Viewer (`/app/pdf-viewer`)

**Handles:** PDF files

Uses `@react-pdf-viewer` (PDF.js wrapper). PDFs are streamed from the backend via `/api/reports/{id}/pdf` or served via presigned URL from MinIO, depending on the file type. The backend endpoint supports HTTP Range requests so the viewer can load pages progressively.

## Compare Viewer (`/app/compare`)

**Handles:** two images side by side (both must be images equirectangular or standard)

The Compare page renders two `Compare360Viewer` instances. Each is an independent Three.js Canvas with a panoramic sphere (radius 500, FOV 70°), the same setup as the Panorama viewer.

### Camera synchronisation

When "Sync cameras" is enabled, dragging in one viewer updates the other's view in real time. The parent page holds `sharedCameraState` (position + OrbitControls target) and passes it to both instances. Each viewer:

- Broadcasts its camera state via `onCameraStateChange` on every OrbitControls change, throttled to once per 50 ms
- Applies incoming `sharedCameraState` only when it originated from the *other* viewer (`sharedCameraState.source !== viewerSide`)
- Uses `isApplyingRef` to suppress re-broadcast while applying received state, preventing feedback loops

When sync is off, each viewer orbits independently.

### Screenshots

Each viewer exposes a `onTakeScreenshot` callback. When triggered, it calls `WebGLRenderer.render()` on the current scene and camera, then returns `canvas.toDataURL('image/png')`. The Compare page collects screenshots from both viewers and embeds them in the comparison PDF.

### Controls

- Click + drag, orbit (damping factor 0.3, zoom disabled)
- Fullscreen button, each viewer can enter fullscreen independently
- Close (×) button, dismisses that side of the comparison

### Report flow

Comparison reports use `ComparisonDraft` rather than `ViewerReportDraft`. See `REPORTS.md` for the full draft/publish lifecycle. The `state_json` stored in a comparison draft contains the left and right viewer contexts:

```json
{
  "left":  { "displayFileName": "room1-20260401-001.jpg", "src": "...", ... },
  "right": { "displayFileName": "room1-20260501-001.jpg", "src": "...", ... }
}
```

The label shown in the drafts list is derived from these display names: `"room1-20260401-001.jpg vs room1-20260501-001.jpg"`.

## viewerKind strings

When a viewer creates a report draft it passes a `viewerKind` string. The `ReportBuilder` component maps the viewer's internal kind to the API value:


| Viewer             | Internal `viewerKind` prop | API `viewer_kind` sent |
| ------------------ | -------------------------- | ---------------------- |
| Static viewer      | `'static'`                 | `'static_360'`         |
| Panorama viewer    | `'panorama'`               | `'interactive_360'`    |
| Point cloud viewer | `'point-cloud'`            | `'static_pcd'`         |


See `REPORTS.md` for the full list of `viewer_kind` values and what the backend does with them.