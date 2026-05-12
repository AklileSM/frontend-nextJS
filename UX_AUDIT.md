# UX & Workflow Audit — A6-Stern Frontend

_Generated 2026-05-12. Organized by severity: Critical → High → Medium → Low → Flow improvements._

---

## Critical — Broken Flows

These actively break the user experience.

**1. Viewer page reload loses all context** ✅ Fixed
Every viewer reads its file from `sessionStorage`. Refreshing clears it — the back button disappears and the user has no way to return or know where they are.
_Fix applied: switched to `localStorage`; all four viewers show a "Back to Explorer" fallback when context is missing._

**2. Settings lives on two separate URL trees** ✅ Fixed
Settings is served at `/projects/[slug]/settings` (outside the app shell) but several internal links pointed to `/app/projects/[slug]/settings`. The redirect worked but the URL switched mid-session, breaking browser back behavior and bookmarks.
_Fix applied: HTTP-level redirect in `next.config.mjs`; single canonical URL, no client-side flash._

**3. Logout on 401 never happens** ✅ Fixed
If the auth token expires server-side, the app silently fails API calls and shows toast errors rather than redirecting to login. Users see broken data states with no explanation.
_Fix applied: `apiFetch` now intercepts 401, clears the stored token, and hard-navigates to `/login`._

**4. Conversion status polling doesn't stop on unmount** ✅ Already correct
If a user uploads a point cloud and navigates away before conversion finishes, `setInterval` polling could continue indefinitely in the background.
_Verified: both polling `useEffect` blocks already return `() => clearInterval(id)`._

---

## High — Feels Unprofessional

These make the app feel unfinished or fragmented.

**5. Three completely different top-level layouts** ✅ Fixed
`components/layout/StandaloneShell.tsx` — shared shell now used by both `/projects` hub and settings page. Same header, background, sign-out button, and max-width rhythm. Duplicated `BackgroundGrid` and header code removed from both pages.

**6. No breadcrumbs inside the app shell** ✅ Improved
`components/layout/Header.tsx` — breadcrumb now shows real project names (loaded once, shared with ProjectSwitcher) and distinguishes sub-pages: `Project Name / Files · 2024-10-14`, `Room explorer / Room Name`, etc. Raw slug fallback still applies for unmapped routes.

**7. Date formatting is inconsistent across the app** ✅ Fixed
`lib/formatDate.ts` created — `formatCaptureDate`, `formatCaptureDateShort`, `formatTimestamp`. Profile page `toLocaleString()` calls replaced.

**8. Empty states have no consistent design** ✅ Fixed
`components/ui/EmptyState.tsx` — shared component with icon, title, body, and optional action. Applied to `FileGrid`, file explorer, and room explorer.

**9. Delete confirmations are inconsistent** ✅ Fixed
`components/ui/ConfirmDialog.tsx` — generic animated confirm dialog. Profile page report delete replaced from `window.confirm()` to this component.

**10. Tab styling varies across pages** ✅ Fixed
`components/ui/Tabs.tsx` — shared tab component using Framer Motion sliding rail (`layoutId`). Applied to profile page and settings page. Project home and room explorer already used the rail pattern.

**11. The `/app` home page is hardcoded demo data** ✅ Fixed
`app/app/page.tsx` now redirects to last-visited project (`sidebar.lastProjectSlug` from sessionStorage) or to `/projects` if none. Hardcoded A6-Stern demo removed.

---

## Medium — Workflow Gaps

These don't break the app but meaningfully hurt daily usability.

**12. No search or filter in the room picker dropdown** ✅ Fixed
`Uploader` in `files/page.tsx` — replaced `<select>` with a type-to-filter combobox. Typing filters the rooms list; clicking a match selects it. Dropdown dismisses on blur.

**13. No "recent files" or "recent activity" anywhere** ✅ Fixed
`components/home/RecentFiles.tsx` — new component reads `getRecentFiles(projectSlug)` from localStorage and renders a grid of recently opened files with file type icons. Clicking an entry restores the full viewer context and navigates directly to the viewer. Added to `app/app/projects/[slug]/page.tsx` below the main header.
`viewerContext.ts` — `RecentEntry` now includes the full `ApiMediaFile` object so direct viewer navigation works.

**14. Upload capture date isn't changeable in the upload dialog** ✅ Fixed
`Uploader` in `files/page.tsx` — added a `<input type="date">` that initialises to the page's `?date=` param but is editable. The chosen date is passed to `UploadZone` instead of the page date.

**15. Room explorer resets the date filter when switching rooms** ✅ Fixed
`room-explorer/page.tsx` — replaced the naive `setDateFilter(null)` on room change with a stash-and-restore approach: the current filter is saved into `savedFilterRef` before clearing, then once the new room's data loads the applicable dates (intersection with the new room's dates) are restored. If no dates carry over, defaults to "show all".

**16. No pagination in the file explorer** ✅ Fixed
`files/page.tsx` — added `visibleCount` state (starts at 10, resets on date change). Rooms beyond the visible count are hidden; a "Load more" button with a `(visible of total)` counter loads the next 10.

**17. No notification when point cloud conversion finishes** ✅ Fixed
Both `files/page.tsx` and `room-explorer/page.tsx` — `knownPendingRef` tracks in-flight point cloud IDs. On each poll cycle, any ID that was pending and is now `done` fires a `toast.success`. Pending IDs are tracked and done ones are removed after toasting.

**18. AI analysis can be queued multiple times** ✅ Already correct
`disabled={analyzing}` is on the AI button in `StaticViewer.tsx`; re-clicking while running is a no-op.

**19. Flags field in the report builder has no guidance** ✅ Already correct
Report builder uses checkboxes for a fixed flag list, not free-text input.

---

## Low — Polish and Refinement

**20. The panorama viewer is a stub**
`/app/viewer/panorama` renders a shell but has no real functionality. Either wire it to a proper equirectangular renderer (Three.js sphere) or remove the route and open panoramas in the static viewer. The dead route creates confusion.

**21. Video has no fullscreen in the static viewer**
Videos open using browser-default `<video>` controls only. No fullscreen button, no keyboard shortcuts. At minimum, add a fullscreen wrapper.

**22. Admin lists have no pagination**
The users list and projects list in the admin panel load everything at once. Fine at 20 users, broken at 500.

**23. Session storage keys aren't namespaced per project**
`a6.viewerContext` and `a6.lastRoom` are global across all projects. Two browser tabs open on different projects will overwrite each other's context.

**24. `SelectedDateContext` persistence is deferred (TODO in code)**
Selected dates reset on page reload, which disrupts workflows where users repeatedly return to a specific date. The context has a comment noting localStorage persistence was deferred.

**25. Report publishing has no progress indicator**
Clicking "Publish report" or "Publish PDF" kicks off an async operation with no loading state. The button doesn't disable, users can double-submit, and if the backend is slow there's no feedback at all.

---

## Professional Flow Improvements

Beyond individual bugs, these are the patterns that would make the app feel like a real product:

**Global page transitions**
Every route change is currently an instant swap. A subtle fade or slide between pages via `AnimatePresence` in the root layout is one change that elevates every single navigation in the app.

**Skeleton screens instead of spinners**
Loading spinners feel placeholder-y. Skeleton screens — grey content-shaped blocks in the exact layout the data will occupy — make the app feel faster and more intentional. The file grid already does this well; make it universal.

**Optimistic UI on room management**
When renaming or reordering a room, the list currently waits for the API response before updating. Applying the change immediately (and rolling back on error) makes the interface feel instant.

**Persistent sidebar state across navigation**
The project accordion collapses when navigating between pages because it re-mounts. The currently-open room and its expanded state should survive routing within a project.

**Toasts with undo on destructive actions**
Deleting a file shows a success toast. Adding an "Undo" action with a 5-second cancellation window is a well-known pattern that significantly reduces user anxiety around irreversible actions.

**Keyboard navigation throughout**
The hotspot editor, file grid, and viewers have no keyboard support. `Escape` to close, arrow keys to navigate between files, `Delete` to remove — these shortcuts are expected in any media management tool used professionally.

**Persistent current project indicator in the top bar**
When inside the app shell, the current project name should be visible at all times (in the header or sidebar header) so users never lose their bearings, especially in viewers or the admin panel.

---

## Priority Matrix

| Priority | Items | Rationale |
|---|---|---|
| **Done** | 1, 2, 3, 4 | Broken behavior — trust-breaking |
| **Next sprint** | 5, 6, 7, 11 | High impact on first impressions and professionalism |
| **Daily workflow** | 12, 13, 14, 15 | High-frequency user pain, moderate effort |
| **Polish pass** | Global transitions, skeleton screens, optimistic UI, persistent sidebar | Transforms perceived quality across the whole app |
| **Backlog** | 16–25 | Real but lower frequency or lower effort-to-impact ratio |
