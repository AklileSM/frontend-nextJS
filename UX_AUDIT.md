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

**20. The panorama viewer is a stub** ✅ Already correct
`components/viewers/PanoramaViewer.tsx` already has a full Three.js equirectangular sphere renderer (`@react-three/fiber` + `OrbitControls`), image probe logic, debug tooling, and fallback to static viewer on error.

**21. Video has no fullscreen in the static viewer** ✅ Fixed
`StaticViewer.tsx` — added a `videoRef` and a fullscreen button overlay (`Maximize2` icon) that calls `videoRef.current.requestFullscreen()`. Positioned bottom-right over the video.

**22. Admin lists have no pagination** ✅ Fixed
Both `admin/users/page.tsx` and `admin/projects/page.tsx` — added `PAGE_SIZE = 25`, `page` state, `visibleUsers`/`visibleProjects` memo slices, and Prev/Next controls with a `(X–Y of N)` counter. Page resets to 1 on data load.

**23. Session storage keys aren't namespaced per project** ✅ Fixed
`viewerContext.ts` — viewer context is now written to `a6.viewerContext.${projectSlug}` with a `a6.viewerContext.latest` pointer. Each project's context is stored independently; the reader follows the pointer. `clearViewerContext` clears both the namespaced key and the legacy key. Legacy `a6.viewerContext` key is still read as a fallback for existing sessions.

**24. `SelectedDateContext` persistence is deferred (TODO in code)** ✅ Fixed
`context/SelectedDateContext.tsx` — reads all `a6.explorerDate.*` keys from localStorage on init, and writes/removes the matching key on every `setDateForScope` call. Selected dates now survive page reloads.

**25. Report publishing has no progress indicator** ✅ Already correct
`ReportBuilder.tsx` already has `disabled={publishing}` / `disabled={savingDraft}` on both buttons and text that changes to "Publishing..." / "Saving..." while in flight. Double-submit is guarded by the early return at the top of each handler.

---

## Professional Flow Improvements

Beyond individual bugs, these are the patterns that would make the app feel like a real product:

**Global page transitions** ✅ Fixed
`components/layout/AppShell.tsx` — `Layout` now uses `AnimatePresence` + `motion.div` keyed by `usePathname()`. Every route change within the app shell fades in with a 22px upward slide (0.22s, spring ease). No exit animation to avoid double-render issues with the App Router.

**Skeleton screens instead of spinners** ✅ Fixed
Three loading states replaced:
- `app/app/profile/page.tsx` — "Loading profile data..." text → 6 animated skeleton report cards matching the grid layout.
- `app/projects/[slug]/settings/page.tsx` — `Loader2` spinner → skeleton breadcrumb + heading + tab rail + 4 form field rows.
- `components/settings/RoomManager.tsx` — `Loader2` spinner → 4 skeleton list rows matching the room list item layout.

**Optimistic UI on room management** ✅ Fixed
`components/settings/RoomManager.tsx` — `handleDelete` now removes the room from local state immediately before awaiting the API. On error, the previous list is restored and an error toast is shown.

**Persistent sidebar state across navigation** ✅ Fixed
`components/layout/Sidebar.tsx` — `RoomAccordion` now reads its initial open/closed state from `sessionStorage` (`a6.sidebar.roomOpen.${slug}`) and writes back on every toggle. When restored as open, a `useEffect` automatically fetches the room's date list (previously only triggered on manual toggle).

**Toasts with undo on destructive actions** ✅ Fixed
`files/page.tsx` and `room-explorer/page.tsx` — file deletion is now optimistic with a 5-second undo window:
1. User confirms delete → file is hidden immediately (`hiddenFileIds` Set).
2. Toast fires with an "Undo" action button (5s duration).
3. If undo is clicked: file is un-hidden, the pending `setTimeout` is cancelled, no API call is made.
4. If 5s elapses: `deleteFileAsset` is called; on failure, the file is un-hidden and an error toast is shown.

**Keyboard navigation throughout** ✅ Fixed
- `components/viewers/StaticViewer.tsx` — `Escape` key now dismisses annotation form/details first; if neither is open, `window.history.back()` is called.
- `components/viewers/PanoramaViewer.tsx` — `Escape` key calls `window.history.back()`.
- `components/explorer/Thumbnail.tsx` — `Delete`/`Backspace` on a focused thumbnail triggers the delete callback (for admins).

**Persistent current project indicator in the top bar** ✅ Fixed
`components/layout/Header.tsx` — `ProjectSwitcher` now reads `sessionStorage.getItem('sidebar.lastProjectSlug')` as a fallback when no project slug is in the URL (e.g., on viewer pages, admin panel). The current project name is now always shown accurately in the header switcher button.

---

## Priority Matrix

_Updated 2026-05-13 — all items shipped._

| Wave | Items | Status |
|---|---|---|
| **Critical** | 1 (viewer reload), 2 (settings URL), 3 (401 logout), 4 (polling cleanup) | ✅ All done |
| **High** | 5 (unified layout), 6 (breadcrumbs), 7 (date formatting), 8 (empty states), 9 (delete confirm), 10 (tab styling), 11 (/app home) | ✅ All done |
| **Medium** | 12 (room combobox), 13 (recent files), 14 (upload date), 15 (date filter persistence), 16 (pagination), 17 (conversion toast), 18 (AI debounce — already correct), 19 (flags guidance — already correct) | ✅ All done |
| **Low** | 20 (panorama viewer — already correct), 21 (video fullscreen), 22 (admin pagination), 23 (key namespacing), 24 (date persistence), 25 (publish progress — already correct) | ✅ All done |
| **Flow improvements** | Page transitions, skeleton screens, optimistic UI, persistent sidebar state, undo toasts, keyboard navigation, persistent project indicator | ✅ All done |
