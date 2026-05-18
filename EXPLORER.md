# File Explorer

The Explorer is the primary "browse your project" surface. It groups uploaded files by **room** when a date is selected, or by **date** when a room is selected. From the Explorer, users open viewers, kick off uploads, delete files, run bulk operations, and search.

## Routes


| Route                        | Purpose                   | Grouping                    |
| ---------------------------- | ------------------------- | --------------------------- |
| `/app/projects/[slug]/files` | Per-project file explorer | by room (for selected date) |
| `/app/room-explorer`         | Cross-project room view   | by date (for selected room) |


Both pages are wrapped in `AppShell` (sidebar + header) and share most of the explorer components.

## Component layout

```
components/explorer/
├── FileGrid.tsx          — responsive grid of Thumbnail cards
├── Thumbnail.tsx         — single file tile (image, video, pdf, pointcloud)
├── UploadZone.tsx        — drag-and-drop upload panel (admin only)
├── MediaTabs.tsx         — Images | Videos | Point Clouds | PDFs tab bar
├── DateFilterMenu.tsx    — date picker + recently-used dates
├── RoomFilterMenu.tsx    — type-to-filter combobox for room picker
├── BulkActionBar.tsx     — appears when files are multi-selected
├── DeleteConfirm.tsx     — animated confirm dialog for destructive actions
├── ViewerStub.tsx        — placeholder card used in the recent-files list
└── viewerContext.ts      — localStorage handoff to viewer pages
```

## Data flow

```
page.tsx
  ↓ getExplorerByDate / getExplorerByRoom (apiClient)
  ↓
ExplorerByDateResponse | ExplorerByRoomResponse
  ↓ split per room / per date
  ↓
<MediaTabs>            — switch by media type (image | video | pointcloud | pdf)
  └── <FileGrid files={...} />
        └── <Thumbnail file={...} />
              ↓ on click
              setViewerContext(...) + router.push(viewerHrefFor(file))
```

The page owns:

- Selected date (via `SelectedDateContext`, persisted to localStorage)
- Active room filter (URL query param `?room=`)
- Active media tab (URL query param `?tab=`)
- Bulk-select state (`Set<fileId>`)
- Upload zone visibility

## Viewer handoff: `viewerContext.ts`

Next.js App Router has no `location.state` equivalent. To pass a clicked file's metadata into a viewer page (which lives at a different URL), the Explorer writes to localStorage *before* navigating:

```ts
setViewerContext({
  file,            // ApiMediaFile, the full record
  roomSlug,
  projectSlug,
  date,            // YYYY-MM-DD
  origin,          // 'project' | 'room', controls the back button target
});
router.push(viewerHrefFor(file));
```

The viewer pages call `getViewerContext()` to read it back. This survives a full page refresh.

### Per-project namespacing

Context is stored under `a6.viewerContext.<projectSlug>`, with a pointer at `a6.viewerContext.latest` pointing to the most-recent project. This lets each project keep its own viewer state independently (open one project in tab A, another in tab B, both keep working).

A legacy key `a6.viewerContext` is read as a fallback for sessions that pre-date the namespacing rollout.

### `viewerHrefFor(file)` routing


| File type    | Default route             | Notes                                         |
| ------------ | ------------------------- | --------------------------------------------- |
| `image`      | `/app/viewer/static`      | User can switch to Panorama inside the viewer |
| `video`      | `/app/viewer/static`      | Plays inline                                  |
| `pointcloud` | `/app/viewer/point-cloud` |                                               |
| `pdf`        | `/app/pdf-viewer`         |                                               |


### `backHrefFor(ctx)`: back button target


| `ctx.origin` | Back URL                                 |
| ------------ | ---------------------------------------- |
| `'project'`  | `/app/projects/<slug>/files?date=<date>` |
| `'room'`     | `/app/room-explorer?room=<slug>`         |


Viewer pages also show a "Back to Explorer" fallback when `ctx` is null (e.g., the user bookmarked the viewer URL).

### Recent files

Every `setViewerContext` call also writes to `a6.recentFiles`, a capped list of the **last 12** files opened across all projects. Used by the project home page's "Recent files" widget. The list keeps the full `ApiMediaFile` object so clicking a recent entry can navigate straight to the right viewer without an API round-trip.

## Calendar / Date filter

`DateFilterMenu` is backed by `getExplorerDatesSummary()` (or its per-project variant). The endpoint returns:

```json
{
  "dates": {
    "2026-04-01": { "images": 12, "videos": 0, "pointclouds": 1, "pdfs": 0 },
    "2026-04-02": { "images":  7, "videos": 1, "pointclouds": 0, "pdfs": 2 }
  }
}
```

Days with any media are highlighted. Selecting one updates `SelectedDateContext` (persists per project scope under `a6.explorerDate.<scope>`) and triggers a refetch.

## Room filter (combobox)

`RoomFilterMenu` is a type-to-filter combobox, not a plain `<select>`. Reasons:

- Projects with 20+ rooms are common.
- Typing a partial match (e.g., "lobby") narrows the list as you go.
- Selection updates the URL `?room=` so the filter survives a reload.

## Upload Zone

Wrapped in admin/editor gating at the page level, the upload toggle only appears when the user has permission. Inside `UploadZone`:

1. Files are detected by extension into one of `image / video / pointcloud / pdf`.
2. For each file, a **client-side SHA-256** is computed (`lib/hashFile.ts`).
3. `precheckUploadHash` is called; if the backend already has this hash, the tile is marked `duplicate` with the room/date where it lives, and the upload is blocked client-side.
4. On confirm, `uploadSingleFile` runs:
  - Images / videos / PDFs → single `POST /api/upload/single` with XHR progress.
  - Point clouds → tries direct-MinIO upload first (`/pointcloud/direct-init` → presigned PUT), falls back to chunked (`/pointcloud/init` → repeated `/chunk` → `/complete`) if direct is disabled or fails.

A staging modal collects all files first, lets the user remove individual tiles, and uploads sequentially.

### Capture date is editable

The capture date defaults to the page's `?date=` param but can be changed before upload. This matters when a batch is being backfilled from earlier scans.

## Bulk operations

When any thumbnail is selected, `BulkActionBar` appears with:

- **Delete**: `POST /api/files/bulk-delete` (returns `{affected, skipped}`)
- **Download**: `POST /api/files/bulk-download` (streams a ZIP)

Each operation is gated server-side per asset; failures count as `skipped` and the rest of the batch still completes. The bar disappears when the selection becomes empty.

## Optimistic delete + undo

Single-file delete is **optimistic with a 5-second undo window**:

1. User confirms delete.
2. File hides immediately (`hiddenFileIds: Set<string>`).
3. Toast fires with an "Undo" action button (5s duration).
4. If undo is clicked: file un-hides, the pending `setTimeout` is cancelled, no API call is made.
5. If 5s elapses: `deleteFileAsset` is called; on failure, the file un-hides and an error toast appears.

Implemented in `app/app/projects/[slug]/files/page.tsx` and `app/app/room-explorer/page.tsx`.

## Pointcloud conversion polling

Pointclouds appear in the grid immediately with a "converting…" indicator. Each page tracks pending IDs in `knownPendingRef` and polls `/api/files/{id}/conversion-status` every 2 seconds. When an ID moves from `pending` / `processing` → `ready`, a `toast.success` fires once and the ID is dropped from the pending set.

The polling `useEffect` cleans up via `clearInterval` on unmount so navigating away stops the requests.

## Search

The header search box (`Header.tsx` → `ProjectSearch.tsx`) calls `searchFiles(q, projectSlug)`. The backend does trigram + ILIKE matching across `display_name`, `original_name`, `Room.name`, and parses ISO dates as exact matches on `capture_date`. Results route through a dedicated dropdown, clicking a result triggers `setViewerContext` + navigate, same handoff as the grid.

## Empty states

`components/ui/EmptyState.tsx` is used consistently across explorer pages:

- No date selected → "Pick a date from the calendar to start browsing"
- Date has no files for the active room/tab → "No files captured here yet"
- Search returns nothing → "No matches for ''"

Don't introduce ad-hoc empty messages; reuse `EmptyState`.

## Pagination

The per-project explorer paginates rooms, `visibleCount: 10` initially, "Load more" reveals the next 10. Resets to 10 when the date changes. Inside each room, all files in the active tab are shown without inner pagination (typical batch sizes are well under a hundred).

## Keyboard

- Inside a thumbnail card (focused): `Delete` or `Backspace` triggers delete for admins/editors.
- On the date filter: `Escape` closes the menu.

## Where the code lives


| Concern               | File                                                |
| --------------------- | --------------------------------------------------- |
| Per-project page      | `app/app/projects/[slug]/files/page.tsx`            |
| Room explorer page    | `app/app/room-explorer/page.tsx`                    |
| Grid / Thumbnail      | `components/explorer/FileGrid.tsx`, `Thumbnail.tsx` |
| Upload zone           | `components/explorer/UploadZone.tsx`                |
| Date filter           | `components/explorer/DateFilterMenu.tsx`            |
| Room combobox         | `components/explorer/RoomFilterMenu.tsx`            |
| Bulk actions          | `components/explorer/BulkActionBar.tsx`             |
| Viewer handoff        | `components/explorer/viewerContext.ts`              |
| Selected-date context | `context/SelectedDateContext.tsx`                   |
| Hash helper           | `lib/hashFile.ts`                                   |
| Recent files widget   | `components/home/RecentFiles.tsx`                   |


