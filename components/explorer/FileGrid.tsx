'use client';

import { Thumbnail } from './Thumbnail';
import type { ApiMediaFile } from '@/types/api';

type Props = {
  files: ApiMediaFile[];
  roomSlug: string;
  projectSlug?: string;
  date: string;
  origin: 'project' | 'room';
  isAdmin: boolean;
  onDelete: (file: ApiMediaFile) => void;
  // Multi-select wiring. Selection lives on the page so it can span across
  // multiple FileGrid instances (rooms × dates × media types).
  selectionMode?: boolean;
  selectedIds?: ReadonlySet<string>;
  onToggleSelect?: (file: ApiMediaFile, opts: { range: boolean }) => void;
};

export function FileGrid({
  files,
  roomSlug,
  projectSlug = '',
  date,
  origin,
  isAdmin,
  onDelete,
  selectionMode = false,
  selectedIds,
  onToggleSelect,
}: Props) {
  if (files.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
      {files.map((file, i) => (
        <Thumbnail
          key={file.id}
          file={file}
          roomSlug={roomSlug}
          projectSlug={projectSlug}
          date={date}
          origin={origin}
          isAdmin={isAdmin}
          onDelete={onDelete}
          index={i}
          selectionMode={selectionMode}
          selected={selectedIds?.has(file.id) ?? false}
          onToggleSelect={onToggleSelect}
        />
      ))}
    </div>
  );
}
