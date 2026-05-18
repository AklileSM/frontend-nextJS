'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Box, FileText, Image as ImageIcon, Video as VideoIcon } from 'lucide-react';
import type { ApiMediaFile } from '@/types/api';

const PICKER_TYPE_META: Record<string, {
  label: string;
  gradient: string;
  tint: string;
  Icon: typeof ImageIcon;
}> = {
  image:      { label: 'IMG', gradient: 'from-amber-500/20 via-amber-500/5 to-base-900',   tint: 'text-amber-500',  Icon: ImageIcon  },
  video:      { label: 'VID', gradient: 'from-steel-500/25 via-steel-500/5 to-base-900',   tint: 'text-steel-400',  Icon: VideoIcon  },
  pointcloud: { label: 'PCD', gradient: 'from-violet-500/25 via-violet-500/5 to-base-900', tint: 'text-violet-300', Icon: Box        },
  pdf:        { label: 'PDF', gradient: 'from-base-700/60 via-base-800 to-base-900',        tint: 'text-ink-200',    Icon: FileText   },
};

export function PickerThumbnail({
  file,
  disabled,
  index = 0,
  onPick,
}: {
  file: ApiMediaFile;
  disabled: boolean;
  index?: number;
  onPick: () => void;
}) {
  const [thumbFailed, setThumbFailed] = useState(false);
  const meta = PICKER_TYPE_META[file.type] ?? PICKER_TYPE_META.image;
  const showThumb = !thumbFailed && (file.type === 'image' || file.type === 'video' || file.type === 'pdf') && !!file.src;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.36), ease: [0.22, 1, 0.36, 1] }}
      whileHover={!disabled ? { y: -3 } : {}}
      onClick={!disabled ? onPick : undefined}
      className={`group relative overflow-hidden rounded-lg border transition-colors ${
        disabled
          ? 'cursor-not-allowed border-amber-500/50 opacity-50'
          : 'cursor-pointer border-base-800 hover:border-amber-500/40'
      }`}
    >
      <div className={`relative aspect-[4/3] bg-gradient-to-br ${meta.gradient}`}>

        {/* Real thumbnail */}
        {showThumb && (
          <img
            src={file.src}
            alt={file.file_name}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
            onError={() => setThumbFailed(true)}
          />
        )}

        {/* Icon fallback */}
        {!showThumb && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5">
            <meta.Icon size={36} strokeWidth={1.25} className={meta.tint} />
            <span className={`font-mono text-[9px] font-semibold uppercase tracking-[0.2em] opacity-60 ${meta.tint}`}>
              {meta.label}
            </span>
          </div>
        )}

        {/* PCD dot scatter */}
        {file.type === 'pointcloud' && (
          <span className="pointer-events-none absolute inset-3 grid grid-cols-8 gap-1 opacity-50">
            {Array.from({ length: 24 }).map((_, i) => (
              <span
                key={i}
                className="block h-0.5 w-0.5 rounded-full bg-amber-500/60"
                style={{ opacity: 0.3 + ((i * 13) % 7) * 0.1 }}
              />
            ))}
          </span>
        )}

        {/* Type badge, only when showing a real thumbnail */}
        {showThumb && (
          <span className="absolute right-1.5 top-1.5 rounded-sm bg-base-950/80 px-1.5 py-0.5 font-mono text-[9px] font-medium tracking-widest text-ink-200">
            {meta.label}
          </span>
        )}

        {/* IN USE badge */}
        {disabled && (
          <span className="absolute left-2 top-2 rounded-sm bg-amber-500/20 px-1.5 py-0.5 font-mono text-[9px] font-medium tracking-widest text-amber-400">
            IN USE
          </span>
        )}

        {/* Bottom info overlay */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-base-950/95 via-base-950/50 to-transparent px-2.5 pb-2.5 pt-8">
          <p className="truncate text-[11px] font-medium leading-snug text-white" title={file.file_name}>
            {file.file_name}
          </p>
          <p className="mt-0.5 font-mono text-[9px] text-ink-400">{file.capture_date}</p>
        </div>

      </div>
    </motion.div>
  );
}
