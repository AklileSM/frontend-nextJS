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

const LEGACY_KEY = 'a6.viewerContext';
const LATEST_KEY = 'a6.viewerContext.latest';
const RECENT_KEY = 'a6.recentFiles';
const RECENT_MAX = 12;

function projectKey(projectSlug: string) {
  return `a6.viewerContext.${projectSlug}`;
}

export function setViewerContext(ctx: ViewerContext): void {
  try {
    localStorage.setItem(projectKey(ctx.projectSlug), JSON.stringify(ctx));
    localStorage.setItem(LATEST_KEY, ctx.projectSlug);
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
    const slug = localStorage.getItem(LATEST_KEY);
    if (slug) {
      const raw = localStorage.getItem(projectKey(slug));
      if (raw) return JSON.parse(raw) as ViewerContext;
    }
    // Fallback: read legacy key for sessions created before namespacing.
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ViewerContext;
  } catch {
    return null;
  }
}

export function clearViewerContext(): void {
  try {
    const slug = localStorage.getItem(LATEST_KEY);
    if (slug) localStorage.removeItem(projectKey(slug));
    localStorage.removeItem(LATEST_KEY);
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* ignore */
  }
}

export function backHrefFor(ctx: ViewerContext): string {
  if (ctx.origin === 'project') {
    return `/app/projects/${ctx.projectSlug}/files?date=${encodeURIComponent(ctx.date)}`;
  }
  return `/app/room-explorer?project=${encodeURIComponent(ctx.projectSlug)}&room=${encodeURIComponent(ctx.roomSlug)}`;
}

export function viewerHrefFor(file: ApiMediaFile): string {
  if (file.type === 'image') {
    // Images open in the static viewer by default. The panorama route is
    // opt-in from inside the viewer rather than auto-detected here.
    return '/app/viewer/static';
  }
  if (file.type === 'pointcloud') return '/app/viewer/point-cloud';
  if (file.type === 'pdf') return '/app/pdf-viewer';
  if (file.type === 'video') return '/app/viewer/static'; // video plays inline in the static viewer for now
  return '/app/viewer/static';
}
