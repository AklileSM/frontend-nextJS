'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Trash2, FileText, Image as ImageIcon, Box, Video, Eye } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useState } from 'react';
import { toast } from 'sonner';
import { setViewerContext, viewerHrefFor } from './viewerContext';
import type { ApiMediaFile } from '@/types/api';

type Props = {
  file: ApiMediaFile;
  roomSlug: string;
  projectSlug?: string;
  date: string;
  origin: 'project' | 'room';
  isAdmin: boolean;
  onDelete: (file: ApiMediaFile) => void;
};

const TYPE_META: Record<
  ApiMediaFile['type'],
  { label: string; gradient: string; tint: string; Icon: typeof ImageIcon }
> = {
  image: { label: 'IMG', gradient: 'from-amber-500/20 via-amber-500/5 to-base-900', tint: 'text-amber-500', Icon: ImageIcon },
  video: { label: 'VID', gradient: 'from-steel-500/25 via-steel-500/5 to-base-900', tint: 'text-steel-400', Icon: Video },
  pointcloud: { label: 'PCD', gradient: 'from-violet-500/25 via-violet-500/5 to-base-900', tint: 'text-violet-300', Icon: Box },
  pdf: { label: 'PDF', gradient: 'from-base-700/60 via-base-800 to-base-900', tint: 'text-ink-200', Icon: FileText },
};

export function Thumbnail({ file, roomSlug, projectSlug = '', date, origin, isAdmin, onDelete }: Props) {
  const router = useRouter();
  const meta = TYPE_META[file.type];
  const canDelete = isAdmin;
  const [pending, setPending] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);
  const conversionStatus = file.conversion_status ?? null;
  const isPointcloud = file.type === 'pointcloud';
  const isPointcloudReady = !isPointcloud || conversionStatus === 'ready';
  const showThumbnail =
    !thumbFailed && (file.type === 'image' || file.type === 'video' || file.type === 'pdf') && !!file.src;

  const open = () => {
    if (isPointcloud && !isPointcloudReady) {
      if (conversionStatus === 'failed') {
        toast.error(file.conversion_error || 'Point cloud conversion failed. Retry upload or conversion.');
      } else {
        toast.info('Point cloud is still converting. Please wait until status is READY.');
      }
      return;
    }
    if (file.type === 'video') {
      // Video opens in a new tab in the live app. For the mock we still hand
      // the file to the static viewer so deletion / draft flows can be tested.
    }
    setViewerContext({ file, roomSlug, projectSlug, date, origin });
    router.push(viewerHrefFor(file));
  };

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="group relative overflow-hidden rounded-md border border-base-800 bg-base-900/40"
    >
      <button
        type="button"
        onClick={open}
        onKeyDown={(e) => {
          if ((e.key === 'Delete' || e.key === 'Backspace') && canDelete) {
            e.preventDefault();
            onDelete(file);
          }
        }}
        className={`relative block w-full bg-gradient-to-br ${meta.gradient} aspect-[4/3]`}
        aria-label={`Open ${file.file_name}`}
      >
        {showThumbnail && (
          // Keep real thumbnails for media while retaining icon fallback for missing/broken URLs.
          <img
            src={file.src}
            alt={file.file_name}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
            onError={() => setThumbFailed(true)}
          />
        )}
        <span
          className={`pointer-events-none absolute inset-0 flex items-center justify-center ${meta.tint} transition-opacity ${
            showThumbnail ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'
          }`}
        >
          <meta.Icon size={28} strokeWidth={1.5} />
        </span>
        {file.type === 'pointcloud' && (
          <span className="pointer-events-none absolute inset-3 grid grid-cols-8 gap-1 opacity-70">
            {Array.from({ length: 24 }).map((_, i) => (
              <span
                key={i}
                className="block h-0.5 w-0.5 rounded-full bg-amber-500/60"
                style={{ opacity: 0.3 + ((i * 13) % 7) * 0.1 }}
              />
            ))}
          </span>
        )}
        <span className="absolute right-1.5 top-1.5 rounded-sm bg-base-950/80 px-1.5 py-0.5 font-mono text-[9px] font-medium tracking-widest text-ink-200">
          {meta.label}
        </span>
        {isPointcloud && conversionStatus && conversionStatus !== 'ready' && (
          <span className="absolute left-1.5 top-1.5 rounded-sm bg-base-950/85 px-1.5 py-0.5 font-mono text-[9px] font-medium tracking-widest text-amber-300">
            {conversionStatus === 'processing' ? 'PROCESSING' : conversionStatus.toUpperCase()}
          </span>
        )}
        <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-base-950/0 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-white opacity-0 transition-all duration-200 group-hover:bg-base-950/70 group-hover:opacity-100">
          <Eye size={11} />
          {isPointcloud && !isPointcloudReady ? 'Converting...' : 'Open'}
        </span>
      </button>

      <div className="flex items-start justify-between gap-2 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-medium text-white" title={file.file_name}>
            {file.file_name}
          </p>
          <p className="mt-0.5 font-mono text-[10px] text-ink-400">
            {format(parseISO(file.capture_date), 'MMM d, yyyy')}
          </p>
        </div>
        {canDelete && (
          <button
            type="button"
            disabled={pending}
            onClick={(e) => {
              e.stopPropagation();
              setPending(true);
              onDelete(file);
              // Reset pending after a tick — parent handles the actual deletion
              setTimeout(() => setPending(false), 600);
            }}
            aria-label={`Delete ${file.file_name}`}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-ink-400 opacity-0 transition-all duration-150 hover:bg-base-800 hover:text-amber-500 group-hover:opacity-100 disabled:opacity-40"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </motion.div>
  );
}
