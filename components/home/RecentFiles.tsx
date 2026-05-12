'use client';

import { type ComponentType, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Image, Video, FileText, Box, Clock } from 'lucide-react';
import { getRecentFiles, setViewerContext, type RecentEntry } from '@/components/explorer/viewerContext';

const TYPE_ICON: Record<RecentEntry['fileType'], ComponentType<{ size?: number; className?: string }>> = {
  image: Image,
  video: Video,
  pdf: FileText,
  pointcloud: Box,
};

export function RecentFiles({ projectSlug }: { projectSlug: string }) {
  const router = useRouter();
  const [entries, setEntries] = useState<RecentEntry[]>([]);

  useEffect(() => {
    setEntries(getRecentFiles(projectSlug));
  }, [projectSlug]);

  if (!entries.length) return null;

  const handleOpen = (e: RecentEntry) => {
    setViewerContext({
      file: e.file,
      roomSlug: e.roomSlug,
      projectSlug: e.projectSlug,
      date: e.date,
      origin: 'project',
    });
    router.push(e.viewerHref);
  };

  return (
    <section className="mt-10">
      <div className="mb-4 flex items-center gap-2">
        <Clock size={12} className="text-ink-500" />
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">Recently opened</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map((entry) => {
          const Icon = TYPE_ICON[entry.fileType] ?? FileText;
          return (
            <button
              key={entry.fileId}
              type="button"
              onClick={() => handleOpen(entry)}
              className="flex items-center gap-3 rounded-md border border-base-800 bg-base-900/30 px-3.5 py-3 text-left transition-colors hover:border-base-600 hover:bg-base-900/60"
            >
              <Icon size={14} className="shrink-0 text-ink-400" />
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-white">{entry.fileName}</p>
                <p className="mt-0.5 font-mono text-[11px] text-ink-500">{entry.roomSlug} · {entry.date}</p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
