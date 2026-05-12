'use client';

import { motion } from 'framer-motion';
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
};

export function FileGrid({ files, roomSlug, projectSlug = '', date, origin, isAdmin, onDelete }: Props) {
  if (files.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-base-700 bg-base-900/30 px-4 py-8 text-center text-[13px] text-ink-300">
        No files of this type for this view.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
      {files.map((file, i) => (
        <motion.div
          key={file.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, delay: Math.min(i * 0.03, 0.4), ease: [0.22, 1, 0.36, 1] }}
        >
          <Thumbnail
            file={file}
            roomSlug={roomSlug}
            projectSlug={projectSlug}
            date={date}
            origin={origin}
            isAdmin={isAdmin}
            onDelete={onDelete}
          />
        </motion.div>
      ))}
    </div>
  );
}
