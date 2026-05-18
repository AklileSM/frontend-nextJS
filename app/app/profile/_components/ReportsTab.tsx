'use client';

/** Reports tab — flat list of the user's published reports for the
 *  currently-scoped project. Renders the "no project selected" hint when
 *  `projectSlug` is null. */

import { FileText } from 'lucide-react';
import { formatTimestamp } from '@/lib/formatDate';
import { MoreMenu } from '@/components/ui/MoreMenu';
import type { ApiReport } from '@/types/api';

type Props = {
  reports: ApiReport[];
  projectSlug: string | null;
  currentProjectName: string | null;
  onOpen: (r: ApiReport) => void;
  onDownload: (r: ApiReport) => void;
  onDelete: (id: string) => void;
};

export function ReportsTab({
  reports,
  projectSlug,
  currentProjectName,
  onOpen,
  onDownload,
  onDelete,
}: Props) {
  if (!projectSlug) {
    return (
      <p className="text-[13px] text-ink-300">
        Open a project from the projects page to see the reports you filed there.
      </p>
    );
  }

  return (
    <>
      {reports.map((r) => (
        <article key={r.id} className="flex items-center gap-3 rounded-md border border-base-800 bg-base-900/40 px-4 py-3">
          <div className="flex h-8 w-8 shrink-0 overflow-hidden rounded border border-base-700 bg-base-900">
            {r.screenshots[0] ? (
              <img src={r.screenshots[0]} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-ink-600">
                <FileText size={15} />
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-white">{r.label ?? 'Report'}</p>
            <p className="mt-0.5 text-[11px] text-ink-400">
              {formatTimestamp(r.created_at)}{r.flags.length > 0 ? ` · ${r.flags.join(', ')}` : ''}
            </p>
          </div>
          <MoreMenu
            items={[
              { label: 'Open', onClick: () => onOpen(r) },
              { label: 'Download', onClick: () => onDownload(r) },
              { label: 'Delete', onClick: () => onDelete(r.id), danger: true },
            ]}
          />
        </article>
      ))}
      {reports.length === 0 && (
        <p className="text-[13px] text-ink-300">
          No reports{currentProjectName ? ` in ${currentProjectName}` : ''} yet.
        </p>
      )}
    </>
  );
}
