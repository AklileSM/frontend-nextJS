'use client';

/** Per-file tile in the upload staging modal and the in-flight progress
 *  panel. The tile owns its own thumbnail-failure local state but is
 *  otherwise driven entirely by the `job` prop.
 *
 *  Two display modes:
 *    - staging mode (`showProgress=false`): no progress bar, surfaces the
 *      client-side dedupe state instead (CHECKING / DUPLICATE pill).
 *    - upload mode (`showProgress=true`): live progress bar + status pill
 *      (uploading / done / error / cancelled).
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Box, FileText, Image as ImageIcon, Loader2, Video, X } from 'lucide-react';
import type { ApiMediaFile } from '@/types/api';

export type Job = {
  id: string;
  file: File;
  thumbUrl: string | null;
  progress: number;
  state: 'staging' | 'pending' | 'uploading' | 'done' | 'error' | 'cancelled';
  error?: string;
  /** Client-side dedupe — we hash the file in the browser and ping the
   *  backend before sending any chunks. 'checking' = hash in flight;
   *  'duplicate' = the backend already has this SHA-256 (the user can't
   *  upload it again). */
  dedupe?: 'checking' | 'ok' | 'duplicate' | 'error';
  duplicateInfo?: { roomName: string | null; captureDate: string | null; displayName: string | null };
};

export function detectMediaType(file: File): ApiMediaFile['type'] {
  const name = file.name.toLowerCase();
  if (/\.(jpe?g|png|webp)$/.test(name)) return 'image';
  if (/\.(mp4|webm|mov)$/.test(name)) return 'video';
  if (/\.(las|laz)$/.test(name)) return 'pointcloud';
  if (/\.pdf$/.test(name)) return 'pdf';
  return 'image';
}

export function makeThumbUrl(file: File): string | null {
  if (detectMediaType(file) === 'image') {
    try { return URL.createObjectURL(file); } catch { return null; }
  }
  return null;
}

const TYPE_META: Record<
  ApiMediaFile['type'],
  { gradient: string; tint: string; Icon: typeof ImageIcon; label: string }
> = {
  image:      { gradient: 'from-amber-500/20 via-amber-500/5 to-base-900',   tint: 'text-amber-500',  Icon: ImageIcon, label: 'IMG' },
  video:      { gradient: 'from-steel-500/25 via-steel-500/5 to-base-900',   tint: 'text-steel-400',  Icon: Video,     label: 'VID' },
  pointcloud: { gradient: 'from-violet-500/25 via-violet-500/5 to-base-900', tint: 'text-violet-300', Icon: Box,       label: 'PCD' },
  pdf:        { gradient: 'from-base-700/60 via-base-800 to-base-900',       tint: 'text-ink-200',    Icon: FileText,  label: 'PDF' },
};

export function FileTile({
  job,
  onRemove,
  showProgress,
}: {
  job: Job;
  onRemove?: () => void;
  showProgress: boolean;
}) {
  const type = detectMediaType(job.file);
  const meta = TYPE_META[type];
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = !imgFailed && type === 'image' && !!job.thumbUrl;
  const isUploading = job.state === 'uploading' || job.state === 'pending';
  const isDuplicate = job.dedupe === 'duplicate';
  const isChecking = job.dedupe === 'checking';

  return (
    <div
      className={`group relative overflow-hidden rounded-lg border bg-base-900 ${
        isDuplicate ? 'border-red-500/60' : 'border-base-800'
      }`}
    >
      <div className={`relative aspect-[4/3] bg-gradient-to-br ${meta.gradient}`}>
        {showImage ? (
          <img
            src={job.thumbUrl!}
            alt={job.file.name}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <meta.Icon size={40} strokeWidth={1.25} className={meta.tint} />
            <span className={`font-mono text-[10px] font-semibold uppercase tracking-[0.2em] opacity-60 ${meta.tint}`}>
              {meta.label}
            </span>
          </div>
        )}

        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${job.file.name}`}
            className="absolute right-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-base-950/80 text-ink-200 transition-colors hover:bg-red-600 hover:text-white"
          >
            <X size={12} />
          </button>
        )}

        {showProgress && isUploading && (
          <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-sm bg-base-950/85 px-1.5 py-0.5 font-mono text-[9px] font-medium tracking-widest text-amber-300">
            <Loader2 size={10} className="animate-spin" aria-hidden />
            {job.progress}%
          </div>
        )}
        {showProgress && job.state === 'done' && (
          <span className="absolute left-2 top-2 rounded-sm bg-emerald-600/90 px-1.5 py-0.5 font-mono text-[9px] font-medium tracking-widest text-white">
            DONE
          </span>
        )}
        {showProgress && job.state === 'error' && (
          <span className="absolute left-2 top-2 rounded-sm bg-red-600/90 px-1.5 py-0.5 font-mono text-[9px] font-medium tracking-widest text-white">
            ERROR
          </span>
        )}
        {showProgress && job.state === 'cancelled' && (
          <span className="absolute left-2 top-2 rounded-sm bg-base-950/85 px-1.5 py-0.5 font-mono text-[9px] font-medium tracking-widest text-ink-300">
            CANCELLED
          </span>
        )}

        {/* Dedupe badge — only shown in the staging phase (no progress bar). */}
        {!showProgress && isChecking && (
          <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-sm bg-base-950/85 px-1.5 py-0.5 font-mono text-[9px] font-medium tracking-widest text-ink-200">
            <Loader2 size={10} className="animate-spin" aria-hidden />
            CHECKING
          </div>
        )}
        {!showProgress && isDuplicate && (
          <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-sm bg-red-600/90 px-1.5 py-0.5 font-mono text-[9px] font-medium tracking-widest text-white">
            <AlertTriangle size={10} aria-hidden />
            DUPLICATE
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-base-950/95 via-base-950/50 to-transparent px-2.5 pb-2 pt-8">
          <p className="truncate text-[11.5px] font-medium leading-snug text-white" title={job.file.name}>
            {job.file.name}
          </p>
          {isDuplicate && job.duplicateInfo && (
            <p className="mt-0.5 truncate font-mono text-[10px] text-red-300" title="Already uploaded">
              Already in {job.duplicateInfo.roomName ?? 'another room'}
              {job.duplicateInfo.captureDate ? ` · ${job.duplicateInfo.captureDate}` : ''}
            </p>
          )}
        </div>
      </div>

      {showProgress && (
        <div className="h-[3px] bg-base-800">
          <motion.div
            initial={false}
            animate={{ width: `${job.progress}%` }}
            transition={{ duration: 0.15 }}
            className={`h-full ${
              job.state === 'error'
                ? 'bg-red-400'
                : job.state === 'cancelled'
                  ? 'bg-ink-500'
                  : job.state === 'done'
                    ? 'bg-emerald-500'
                    : 'bg-amber-500'
            }`}
          />
        </div>
      )}
    </div>
  );
}
