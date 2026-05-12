'use client';

import { motion } from 'framer-motion';
import { ImageOff } from 'lucide-react';
import { Thumbnail } from './Thumbnail';
import { EmptyState } from '@/components/ui/EmptyState';
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
    return <EmptyState icon={ImageOff} title="No files" body="No files of this type for this view." />;
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
