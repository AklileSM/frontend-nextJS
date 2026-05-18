# Admin Pages

The admin panel lives under `/app/admin/*`. It's a thin UI over the backend `/api/admin/*` endpoints, see `backend/PERMISSIONS.md` for the server-side authorization rules.

## Routes


| Route                 | Page                      | Purpose                                                         |
| --------------------- | ------------------------- | --------------------------------------------------------------- |
| `/app/admin`          | `admin/page.tsx`          | Landing card with links to the two subpages                     |
| `/app/admin/users`    | `admin/users/page.tsx`    | Manage all registered users (toggle admin / active, edit email) |
| `/app/admin/projects` | `admin/projects/page.tsx` | List every project on the platform; hard-delete                 |


All three are gated by `admin/layout.tsx`, which checks `user.is_admin` and redirects non-admins to `/unauthorized`.

## Role gating

The frontend gate is purely UX, the backend enforces admin-only access on every `/api/admin/*` route. Don't rely on the frontend check for security; the backend is the source of truth.

The gate works in two layers:

1. **Sidebar visibility**: the "Admin" link only appears in the sidebar when `useAuth().user.is_admin` is `true`.
2. **Layout-level redirect**: `app/app/admin/layout.tsx` calls `useAuth()` and `router.replace('/unauthorized')` if `!user?.is_admin`.

A non-admin who types `/app/admin` into the URL bar sees the unauthorized page; the API calls would 403 anyway.

## Users page (`/app/admin/users`)

Lists every user, paginated client-side at **25 rows per page**.

### Columns


| Column   | Source                                            | Editable                          |
| -------- | ------------------------------------------------- | --------------------------------- |
| Username | `User.username`                                   | No                                |
| Email    | `User.email`                                      | Yes (via inline input on the row) |
| Joined   | `User.created_at`, formatted with `formatIsoDate` | No                                |
| Admin    | `User.is_admin` (Shield icon toggle)              | Yes                               |
| Active   | `User.is_active` (UserCheck icon toggle)          | Yes                               |


### Toggle behavior

Clicking either toggle calls `updateAdminUser(userId, { is_admin?: ..., is_active?: ... })` and merges the response into local state. Toasts confirm.

### Safety guards (enforced by backend)

You cannot:

- Demote yourself from admin (`is_admin: false` on your own id) → 400.
- Deactivate yourself → 400.

The buttons are not disabled client-side for these cases, the 400 surfaces as a toast.

### Pagination

```tsx
const PAGE_SIZE = 25;
const visibleUsers = users.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
```

Prev/Next buttons with an `(X–Y of N)` counter. Page resets to 1 on initial load and after any data refresh.

## Projects page (`/app/admin/projects`)

Lists every project on the platform with status, owner, and a delete button. Same 25-row pagination.

### Columns


| Column  | Notes                                                                                     |
| ------- | ----------------------------------------------------------------------------------------- |
| Name    |                                                                                           |
| Slug    | `font-mono` styling                                                                       |
| Status  | Colored chip: `active` (green), `on_hold` (amber), `completed` (steel), `archived` (gray) |
| Created |                                                                                           |
| Delete  | `DELETE /api/admin/projects/{id}`                                                         |


### Delete

Deletion uses the platform's native `confirm()` here (not `ConfirmDialog`), partly because the admin context already implies a power user, partly historical. If you want consistency, swap to `ConfirmDialog`.

The deletion **cascades** on the backend, rooms, file assets, project memberships, and activity rows all go. The MinIO objects for the project's files are **not** cleaned up by this endpoint today; if you need a full purge, follow up with a `mc rm --recursive` against the relevant buckets.

## What admin can NOT do via these pages

Even an admin **cannot**:

- Read another user's reports or drafts. Report ownership is enforced per-user; admins are not exempt. The admin pages do not surface other users' reports at all.
- Read another user's published-report PDFs. Hitting `/api/reports/<other-user-id>/pdf` returns 404.

If a real "admin override" is required for compliance reasons, add a separate dedicated endpoint and document it in `backend/PERMISSIONS.md`. Don't quietly relax the existing report-ownership filter.

Admins **can**:

- Upload to any project regardless of membership (gated by `_require_can_upload` allowing admin bypass).
- Delete any file regardless of project membership (`_can_delete_file` allows admin).
- Read every project's metadata and member list via `/api/projects/`.
- Trigger pointcloud-conversion retry (`POST /api/files/{id}/retry-conversion`), admin only.

## Where the code lives


| Concern             | File                                                                                                                    |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Admin layout (gate) | `app/app/admin/layout.tsx`                                                                                              |
| Admin landing card  | `app/app/admin/page.tsx`                                                                                                |
| Users page          | `app/app/admin/users/page.tsx`                                                                                          |
| Projects page       | `app/app/admin/projects/page.tsx`                                                                                       |
| Sidebar admin link  | `components/layout/Sidebar.tsx` (search `is_admin`)                                                                     |
| API client wrappers | `services/apiClient.ts` (`listAdminUsers`, `updateAdminUser`, `searchUsers`, `listAdminProjects`, `deleteAdminProject`) |
| Backend matrix      | `backend/PERMISSIONS.md`                                                                                                |


