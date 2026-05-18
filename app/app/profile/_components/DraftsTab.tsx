'use client';

/** Drafts tab — viewer drafts (single-file reports) and comparison drafts
 *  (consolidated reports). A left rail switches between the two. */

import Link from 'next/link';
import { ArrowLeftRight, Globe, Image as ImageIcon, ScanLine } from 'lucide-react';
import { formatTimestamp } from '@/lib/formatDate';
import { SideRail } from './SideRail';

export type DraftSide = 'viewer' | 'comparison';

export type DraftRow = {
  id: string;
  kind: 'viewer' | 'comparison';
  viewerKind: string;
  label: string | null;
  createdAt: string;
  flags: string[];
  href: string;
};

type Props = {
  viewerDraftRows: DraftRow[];
  comparisonDraftRows: DraftRow[];
  draftSide: DraftSide;
  setDraftSide: (s: DraftSide) => void;
  projectSlug: string | null;
  currentProjectName: string | null;
};

export function DraftsTab({
  viewerDraftRows,
  comparisonDraftRows,
  draftSide,
  setDraftSide,
  projectSlug,
  currentProjectName,
}: Props) {
  const draftRows = draftSide === 'viewer' ? viewerDraftRows : comparisonDraftRows;

  return (
    <div className="grid grid-cols-[180px_1fr] gap-6">
      <SideRail
        tabs={[
          { id: 'viewer' as DraftSide, label: 'Drafts', count: viewerDraftRows.length },
          { id: 'comparison' as DraftSide, label: 'Comparison drafts', count: comparisonDraftRows.length },
        ]}
        active={draftSide}
        onChange={setDraftSide}
      />
      <div className="space-y-2">
        {!projectSlug ? (
          <p className="text-[13px] text-ink-300">
            Open a project from the projects page to see the drafts you started there.
          </p>
        ) : (
          <>
            {draftRows.map((d) => {
              const icon =
                d.viewerKind === 'interactive_360' ? <Globe size={15} /> :
                d.viewerKind === 'static_pcd' || d.viewerKind === 'point-cloud' ? <ScanLine size={15} /> :
                d.kind === 'comparison' ? <ArrowLeftRight size={15} /> :
                <ImageIcon size={15} />;
              const typeLabel =
                d.viewerKind === 'interactive_360' ? 'Panorama' :
                d.viewerKind === 'static_pcd' || d.viewerKind === 'point-cloud' ? 'Point cloud' :
                d.kind === 'comparison' ? 'Comparison' :
                'Image';
              return (
                <article key={`${d.kind}-${d.id}`} className="flex items-center gap-3 rounded-md border border-base-800 bg-base-900/40 px-4 py-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-base-700 bg-base-900 text-ink-400">
                    {icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-white">
                      {d.label ?? `${typeLabel} draft`}
                    </p>
                    <p className="mt-0.5 text-[11px] text-ink-400">
                      {typeLabel} · {formatTimestamp(d.createdAt)}{d.flags.length > 0 ? ` · ${d.flags.join(', ')}` : ''}
                    </p>
                  </div>
                  <Link
                    href={d.href}
                    className="shrink-0 rounded-md border border-base-700 px-3 py-1.5 text-[12px] text-white transition-colors hover:border-ink-300"
                  >
                    Continue
                  </Link>
                </article>
              );
            })}
            {draftRows.length === 0 && (
              <p className="text-[13px] text-ink-300">
                {draftSide === 'viewer' ? 'No drafts' : 'No comparison drafts'}
                {currentProjectName ? ` in ${currentProjectName}` : ''} yet.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
