// Viewer context handoff. The Next.js App Router doesn't carry React Router's
// `location.state`, so we stash the file metadata in sessionStorage and let the
// viewer pages read it back after navigation. Keys are unique per viewer kind
// so two tabs never clobber each other's state.

import type { ApiMediaFile } from '@/types/api';

export type ViewerContext = {
  file: ApiMediaFile;
  roomSlug: string;
  projectSlug: string;
  date: string;
  origin: 'project' | 'room';
};

const KEY = 'a6.viewerContext';

export function setViewerContext(ctx: ViewerContext): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(ctx));
  } catch {
    /* ignore */
  }
}

export function getViewerContext(): ViewerContext | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ViewerContext;
  } catch {
    return null;
  }
}

export function clearViewerContext(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function backHrefFor(ctx: ViewerContext): string {
  if (ctx.origin === 'project') {
    return `/app/projects/${ctx.projectSlug}/files?date=${encodeURIComponent(ctx.date)}`;
  }
  return `/app/room-explorer?room=${encodeURIComponent(ctx.roomSlug)}`;
}

export function viewerHrefFor(file: ApiMediaFile): string {
  if (file.type === 'image') {
    // Panorama detection in the live app is heuristic-based; for the mock the
    // explorer simply opens panorama-y files via the static viewer until the
    // user explicitly chooses the panorama route from the inner viewer.
    return '/app/viewer/static';
  }
  if (file.type === 'pointcloud') return '/app/viewer/point-cloud';
  if (file.type === 'pdf') return '/app/pdf-viewer';
  if (file.type === 'video') return '/app/viewer/static'; // video plays inline in the static viewer for now
  return '/app/viewer/static';
}
