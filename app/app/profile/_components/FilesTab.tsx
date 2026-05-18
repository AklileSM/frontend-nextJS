'use client';

/** Files tab — the user's own uploads, scoped to the current project,
 *  with an Images / Videos / PDFs side rail. */

import { FileText, Film } from 'lucide-react';
import { MoreMenu } from '@/components/ui/MoreMenu';
import type { ApiMyUpload } from '@/types/api';
import { SideRail } from './SideRail';

export type FileSide = 'image' | 'video' | 'pdf';

type Props = {
  uploads: ApiMyUpload[];
  fileSide: FileSide;
  setFileSide: (s: FileSide) => void;
  filesLoading: boolean;
  projectSlug: string | null;
  currentProjectName: string | null;
  onOpen: (u: ApiMyUpload) => void;
  onDownload: (u: ApiMyUpload) => void;
  onDelete: (id: string) => void;
};

export function FilesTab({
  uploads,
  fileSide,
  setFileSide,
  filesLoading,
  projectSlug,
  currentProjectName,
  onOpen,
  onDownload,
  onDelete,
}: Props) {
  const filesForSide = uploads.filter((u) => u.media_type === fileSide);

  return (
    <div className="grid grid-cols-[180px_1fr] gap-6">
      <SideRail
        tabs={[
          { id: 'image' as FileSide, label: 'Images', count: uploads.filter((u) => u.media_type === 'image').length },
          { id: 'video' as FileSide, label: 'Videos', count: uploads.filter((u) => u.media_type === 'video').length },
          { id: 'pdf'   as FileSide, label: 'PDFs',   count: uploads.filter((u) => u.media_type === 'pdf').length },
        ]}
        active={fileSide}
        onChange={setFileSide}
      />
      <div className="space-y-2">
        {!projectSlug ? (
          <p className="text-[13px] text-ink-300">
            Open a project from the projects page to see the files you uploaded there.
          </p>
        ) : filesLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex animate-pulse items-center gap-3 rounded-md border border-base-800 bg-base-900/40 px-4 py-3"
                style={{ animationDelay: `${i * 55}ms` }}
              >
                <div className="h-10 w-10 shrink-0 rounded border border-base-700 bg-base-800" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-2/5 rounded bg-base-800" />
                  <div className="h-3 w-1/4 rounded bg-base-800/70" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {filesForSide.map((u) => (
              <article
                key={u.id}
                onClick={() => onOpen(u)}
                className="flex cursor-pointer items-center gap-3 rounded-md border border-base-800 bg-base-900/40 px-4 py-3 transition-colors hover:border-base-700"
              >
                <div className="flex h-10 w-10 shrink-0 overflow-hidden rounded border border-base-700 bg-base-900">
                  {u.media_type === 'image' && u.src ? (
                    <img src={u.src} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-ink-400">
                      {u.media_type === 'video' ? <Film size={16} /> : <FileText size={16} />}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-white">{u.file_name}</p>
                  <p className="mt-0.5 text-[11px] text-ink-400">
                    {u.room_name} · {u.capture_date}
                  </p>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <MoreMenu
                    items={[
                      { label: 'Open', onClick: () => onOpen(u) },
                      { label: 'Download', onClick: () => onDownload(u) },
                      { label: 'Delete', onClick: () => onDelete(u.id), danger: true },
                    ]}
                  />
                </div>
              </article>
            ))}
            {filesForSide.length === 0 && (
              <p className="text-[13px] text-ink-300">
                No {fileSide === 'image' ? 'images' : fileSide === 'video' ? 'videos' : 'PDFs'} uploaded by you
                {currentProjectName ? ` in ${currentProjectName}` : ''} yet.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
