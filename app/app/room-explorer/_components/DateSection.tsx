'use client';

/** A single date block in the room explorer: heading + media-type pills +
 *  the file grid for the active media tab. Mirrors `RoomSection` from the
 *  per-project page but groups files by date rather than by room. */

import { format, parseISO } from 'date-fns';
import { FileGrid } from '@/components/explorer/FileGrid';
import type { ApiMediaFile, ApiRoomMediaGroup } from '@/types/api';

const TYPE_PILLS = [
  { key: 'images' as const,      label: 'IMG', bg: 'bg-amber-500/10',   text: 'text-amber-400'  },
  { key: 'videos' as const,      label: 'VID', bg: 'bg-steel-500/10',   text: 'text-steel-400'  },
  { key: 'pointclouds' as const, label: 'PCD', bg: 'bg-violet-500/10',  text: 'text-violet-400' },
  { key: 'pdfs' as const,        label: 'PDF', bg: 'bg-base-700/50',    text: 'text-ink-300'    },
] as const;

type Props = {
  date: string;
  group: ApiRoomMediaGroup;
  roomSlug: string;
  projectSlug: string;
  files: ApiMediaFile[];
  canDelete: boolean;
  onDelete: (file: ApiMediaFile) => void;
  batchActive?: boolean;
  selectedIds?: ReadonlySet<string>;
  onToggleSelect?: (file: ApiMediaFile, opts: { range: boolean }) => void;
};

export function DateSection({
  date,
  group,
  roomSlug,
  projectSlug,
  files,
  canDelete,
  onDelete,
  batchActive,
  selectedIds,
  onToggleSelect,
}: Props) {
  return (
    <section>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-[20px] font-semibold tracking-tight text-white">
            {format(parseISO(date), 'EEE, MMM d, yyyy')}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {TYPE_PILLS.map(({ key, label, bg, text }) => {
              const count = group[key].length;
              if (!count) return null;
              return (
                <span
                  key={key}
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[10px] font-medium ${bg} ${text}`}
                >
                  <span className="tabular-nums">{count}</span>
                  <span className="opacity-70">{label}</span>
                </span>
              );
            })}
          </div>
        </div>
      </div>
      <FileGrid
        files={files}
        roomSlug={roomSlug}
        projectSlug={projectSlug}
        date={date}
        origin="room"
        canDelete={canDelete}
        onDelete={onDelete}
        batchActive={batchActive}
        selectedIds={selectedIds}
        onToggleSelect={onToggleSelect}
      />
    </section>
  );
}
