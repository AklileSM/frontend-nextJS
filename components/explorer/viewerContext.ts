// Viewer context handoff. The Next.js App Router doesn't carry React Router's
// `location.state`, so we stash the file metadata in localStorage and let the
// viewer pages read it back after navigation (including after a full page reload).

import type { ApiMediaFile } from '@/types/api';

export type ViewerContext = {
  file: ApiMediaFile;
  roomSlug: string;
  projectSlug: string;
  date: string;
  origin: 'project' | 'room';
};

export type RecentEntry = {
  fileId: string;
  fileName: string;
  fileType: ApiMediaFile['type'];
  file: ApiMediaFile;
  roomSlug: string;
  date: string;
  projectSlug: string;
  viewerHref: string;
  openedAt: number;
};

const KEY = 'a6.viewerContext';
const RECENT_KEY = 'a6.recentFiles';
const RECENT_MAX = 12;

export function setViewerContext(ctx: ViewerContext): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(ctx));
    pushRecentFile(ctx);
  } catch {
    /* ignore */
  }
}

function pushRecentFile(ctx: ViewerContext): void {
  try {
    const entry: RecentEntry = {
      fileId: ctx.file.id,
      fileName: ctx.file.file_name,
      fileType: ctx.file.type,
      file: ctx.file,
      roomSlug: ctx.roomSlug,
      date: ctx.date,
      projectSlug: ctx.projectSlug,
      viewerHref: viewerHrefFor(ctx.file),
      openedAt: Date.now(),
    };
    const raw = localStorage.getItem(RECENT_KEY);
    const list: RecentEntry[] = raw ? (JSON.parse(raw) as RecentEntry[]) : [];
    const deduped = list.filter((e) => e.fileId !== entry.fileId);
    deduped.unshift(entry);
    localStorage.setItem(RECENT_KEY, JSON.stringify(deduped.slice(0, RECENT_MAX)));
  } catch {
    /* ignore */
  }
}

export function getRecentFiles(projectSlug: string): RecentEntry[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as RecentEntry[];
    return list.filter((e) => e.projectSlug === projectSlug);
  } catch {
    return [];
  }
}

export function getViewerContext(): ViewerContext | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ViewerContext;
  } catch {
    return null;
  }
}

export function clearViewerContext(): void {
  try {
    localStorage.removeItem(KEY);
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
