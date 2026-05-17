# Project Settings

Per-project administration: edit metadata, manage rooms, manage members, upload a floorplan, delete the project. Distinct from the global `/app/admin/*` panel (which is platform-wide and admin-only).

## Routes — outside the app shell

```
/projects/[slug]/settings           ← canonical (this is the URL users see)
/app/projects/[slug]/settings       ← redirects to the above (HTTP 308)
```

The redirect is in `next.config.mjs`. Settings live **outside** the standard app shell (sidebar + header) because it's a focused administrative surface and the sidebar's project switcher is irrelevant while you're configuring one specific project. The wrapping layout is `StandaloneShell.tsx`, shared with `/projects` (the project picker hub).

If you change routes, also update:
- The redirect in `next.config.mjs`
- Sidebar links in `components/layout/Sidebar.tsx`
- `backHrefFor(ctx)` in `components/explorer/viewerContext.ts` (none currently point here, but check)

## Tabs

Tabs are rendered with `components/ui/Tabs.tsx` (the shared framer-motion sliding-rail component). Order:

| Tab | Component | Roles allowed |
|---|---|---|
| Edit | `ProjectEditTab.tsx` | owner only |
| Setup | `ProjectSetupTab.tsx` | owner or editor |
| Rooms | `ProjectRoomsTab.tsx` | owner or editor |
| Members | `ProjectMembersTab.tsx` | owner only (viewers can see the list but not modify) |
| Danger | `ProjectDangerTab.tsx` | owner only |

`useMyProjectRole(projectSlug)` returns the caller's role for the current project (`'admin' | 'owner' | 'editor' | 'viewer' | null`). Tabs whose role requirements aren't met are hidden, not just disabled.

## Edit tab — `ProjectEditTab.tsx`

Free-form metadata:

- Name
- Description (multi-line)
- Location (single line)
- Status — `active | on_hold | completed | archived` via a `select`

Calls `updateProject(projectId, patch)` on submit. Owner only.

## Setup tab — `ProjectSetupTab.tsx`

Two responsibilities:

1. **Floorplan upload** via `FloorplanUploader.tsx` — drag-and-drop or file-picker for a JPEG/PNG/WebP image. Posts to `/api/projects/{id}/floorplan` (multipart). Replacing replaces; deleting is a separate button.
2. **Hotspot editor** via `HotspotEditor.tsx` — once a floorplan exists, the user can drag rectangles onto it to define each room's clickable hotspot. The rectangle coords are normalized `{x, y, w, h}` (all `[0, 1]`) and PATCH'd into the corresponding `Room.floor_plan_coordinates` field.

The floorplan endpoint is **public** — no auth required to fetch the image. The browser loads it as a normal `<img>` src on the home page's floorplan view.

## Rooms tab — `ProjectRoomsTab.tsx` (+ `RoomManager.tsx`)

CRUD for rooms inside this project. Each room has:

- `name` — display string
- `slug` — URL-safe identifier; must be unique within the project
- `sort_order` — integer; controls grid ordering

### Optimistic delete

`RoomManager.handleDelete` removes the room from local state **before** awaiting the API. If the request fails, the previous list is restored and an error toast appears. Same pattern as file delete in the explorer.

### Sort order

Rooms are listed sorted by `sort_order` ascending. Drag-to-reorder is not currently implemented — sort order is edited as a numeric field. If you add drag-and-drop, send a batch PATCH of new sort orders rather than one PATCH per room.

## Members tab — `ProjectMembersTab.tsx`

Lists the current members and lets the owner add/remove/change roles.

### Adding a member

The "Add" button opens a search input wired to `GET /api/admin/user-search?q=...`. The endpoint is **not** admin-gated despite living under `/api/admin/` — it's used by the member picker for all project owners. See `backend/PERMISSIONS.md` for the explicit note.

After picking a user and a role (`owner | editor | viewer`), `inviteProjectMember(projectId, {user_id, role})` calls `POST /api/projects/{id}/members`. The new row appears in the list immediately.

### Changing a role

Inline dropdown next to each member. PATCH `/api/projects/{id}/members/{userId} { role }`.

### Removing

Trash icon. The owner can remove anyone except themselves (no UI guard for "last owner" — see "Caveats").

A non-owner can leave the project via the same button on **their own row** (the backend allows self-removal regardless of role).

### Caveats

- **No "last owner" check.** Removing the last owner of a project leaves it orphaned (only admins can still access it). If you want this guard, add it in the backend `remove_member` endpoint.
- The members list is membership-gated — viewers can see who else is in the project. If you want viewers blind to other members, raise the access bar to editor+.

## Danger tab — `ProjectDangerTab.tsx`

Two destructive actions:

- **Archive** — flip `status: 'archived'` (covered in Edit tab too; mirrored here for visibility).
- **Delete project** — `DELETE /api/projects/{id}`. Owner only. Cascades to rooms, files, members, activity.

Uses `ConfirmDialog` with a "type the project name to confirm" pattern.

> The MinIO objects belonging to a deleted project are **not** auto-purged. If you need a full purge, follow up with `mc rm --recursive a6minio/construction-images/<roomId>/...` for each room. This is intentional — it leaves an escape hatch for "I didn't mean to delete that".

## Wiring summary

```
/projects/[slug]/settings/page.tsx
  ├── StandaloneShell (header + background only)
  └── Tabs
        ├── ProjectEditTab     → updateProject()
        ├── ProjectSetupTab    → FloorplanUploader / HotspotEditor
        ├── ProjectRoomsTab    → RoomManager → createRoom/updateRoom/deleteRoom
        ├── ProjectMembersTab  → inviteProjectMember / updateProjectMember / removeProjectMember
        └── ProjectDangerTab   → updateProject({status}) / deleteProject()
```

## Where the code lives

| Concern | File |
|---|---|
| Settings page entry | `app/projects/[slug]/settings/page.tsx` |
| Tabbed sub-components | `components/settings/*.tsx` |
| Floorplan + hotspots | `components/settings/FloorplanUploader.tsx`, `HotspotEditor.tsx` |
| Standalone shell | `components/layout/StandaloneShell.tsx` |
| Role hook | `hooks/useMyProjectRole.ts` |
| API client wrappers | `services/apiClient.ts` (`updateProject`, `deleteProject`, `createRoom`, `updateRoom`, `deleteRoom`, `inviteProjectMember`, `updateProjectMember`, `removeProjectMember`, `uploadProjectFloorplan`, `deleteProjectFloorplan`) |
| Backend rules | `backend/PROJECTS.md`, `backend/PERMISSIONS.md` |
