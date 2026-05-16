'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Box, CloudUpload, FileText, Image as ImageIcon, Loader2, Video, X } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type ChangeEvent,
} from 'react';
import { toast } from 'sonner';
import { uploadSingleFile } from '@/services/apiClient';
import type { ApiMediaFile } from '@/types/api';

type Props = {
  roomId: string;
  roomSlug: string;
  captureDate: string;
  onUploaded: (type: ApiMediaFile['type']) => void;
  /** Parent flips its `showUploader` state false; we call this when the batch
   *  finishes so the panel auto-dismisses. The parent should keep this
   *  component mounted (e.g. via CSS visibility) so in-flight uploads
   *  survive a manual close. */
  onClose?: () => void;
  /** Whether the surrounding panel is currently visible to the user. When
   *  false (parent collapsed), the staging modal is suppressed — the modal
   *  is fixed-positioned and would otherwise overlay the explorer even with
   *  the parent panel hidden. State is preserved either way. */
  visible?: boolean;
};

type Job = {
  id: string;
  file: File;
  thumbUrl: string | null;
  progress: number;
  state: 'staging' | 'pending' | 'uploading' | 'done' | 'error' | 'cancelled';
  error?: string;
};

function detectMediaType(file: File): ApiMediaFile['type'] {
  const name = file.name.toLowerCase();
  if (/\.(jpe?g|png|webp)$/.test(name)) return 'image';
  if (/\.(mp4|webm|mov)$/.test(name)) return 'video';
  if (/\.(las|laz)$/.test(name)) return 'pointcloud';
  if (/\.pdf$/.test(name)) return 'pdf';
  return 'image';
}

function makeThumbUrl(file: File): string | null {
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

function FileTile({
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

  return (
    <div className="group relative overflow-hidden rounded-lg border border-base-800 bg-base-900">
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

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-base-950/95 via-base-950/50 to-transparent px-2.5 pb-2 pt-8">
          <p className="truncate text-[11.5px] font-medium leading-snug text-white" title={job.file.name}>
            {job.file.name}
          </p>
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

export function UploadZone({ roomId, roomSlug, captureDate, onUploaded, onClose, visible = true }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [staged, setStaged] = useState<Job[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [confirmCancelJobId, setConfirmCancelJobId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const stagingInputRef = useRef<HTMLInputElement | null>(null);
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  /** Pending jobs removed from the list before upload started — skip in the enqueue loop */
  const skippedJobIdsRef = useRef<Set<string>>(new Set());

  // Browser-level guard against accidental tab close while uploads are in flight.
  useEffect(() => {
    const uploading = jobs.some((j) => j.state === 'uploading' || j.state === 'pending');
    if (!uploading) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [jobs]);

  // Auto-close when an active batch fully settles to 'done'. We only auto-close
  // when every job succeeded — leave the panel open if anything errored so the
  // user can see what went wrong.
  useEffect(() => {
    if (jobs.length === 0) return;
    if (jobs.some((j) => j.state === 'pending' || j.state === 'uploading')) return;
    const allOk = jobs.every((j) => j.state === 'done');
    if (!allOk || !onClose) return;
    const t = setTimeout(() => {
      jobs.forEach((j) => j.thumbUrl && URL.revokeObjectURL(j.thumbUrl));
      setJobs([]);
      onClose();
    }, 700);
    return () => clearTimeout(t);
  }, [jobs, onClose]);

  // Free local object URLs on unmount. Tracked via refs so the cleanup
  // closure sees the final state, not the empty arrays at mount time.
  const stagedRef = useRef<Job[]>([]);
  const jobsRef = useRef<Job[]>([]);
  useEffect(() => { stagedRef.current = staged; }, [staged]);
  useEffect(() => { jobsRef.current = jobs; }, [jobs]);
  useEffect(() => {
    return () => {
      stagedRef.current.forEach((j) => j.thumbUrl && URL.revokeObjectURL(j.thumbUrl));
      jobsRef.current.forEach((j) => j.thumbUrl && URL.revokeObjectURL(j.thumbUrl));
    };
  }, []);

  const abortJob = useCallback((jobId: string) => {
    abortControllersRef.current.get(jobId)?.abort();
  }, []);

  const runJob = async (job: Job) => {
    const ac = new AbortController();
    abortControllersRef.current.set(job.id, ac);
    try {
      await uploadSingleFile({
        file: job.file,
        roomId,
        captureDate,
        mediaType: detectMediaType(job.file),
        signal: ac.signal,
        onProgress: (p) => {
          setJobs((prev) =>
            prev.map((j) => (j.id === job.id ? { ...j, progress: p } : j)),
          );
        },
      });
      setJobs((prev) =>
        prev.map((j) => (j.id === job.id ? { ...j, state: 'done', progress: 100 } : j)),
      );
      toast.success(`${job.file.name} uploaded.`);
      onUploaded(detectMediaType(job.file));
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setJobs((prev) =>
          prev.map((j) => (j.id === job.id ? { ...j, state: 'cancelled' } : j)),
        );
      } else {
        const msg = err instanceof Error ? err.message : 'Upload failed.';
        setJobs((prev) =>
          prev.map((j) => (j.id === job.id ? { ...j, state: 'error', error: msg } : j)),
        );
        toast.error(msg);
      }
    } finally {
      abortControllersRef.current.delete(job.id);
    }
  };

  const addToStaging = (files: File[]) => {
    if (!files.length) return;
    const fresh: Job[] = files.map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      thumbUrl: makeThumbUrl(file),
      progress: 0,
      state: 'staging',
    }));
    setStaged((prev) => [...prev, ...fresh]);
  };

  const startUpload = async () => {
    if (!staged.length) return;
    const batch: Job[] = staged.map((j) => ({ ...j, state: 'pending' }));
    setStaged([]);
    setJobs(batch);

    for (const job of batch) {
      if (skippedJobIdsRef.current.has(job.id)) {
        skippedJobIdsRef.current.delete(job.id);
        continue;
      }
      setJobs((prev) =>
        prev.map((j) => (j.id === job.id ? { ...j, state: 'uploading' } : j)),
      );
      await runJob(job);
    }
  };

  const cancelStaging = () => {
    staged.forEach((j) => j.thumbUrl && URL.revokeObjectURL(j.thumbUrl));
    setStaged([]);
  };

  const removeFromStaging = (id: string) => {
    setStaged((prev) => {
      const removed = prev.find((j) => j.id === id);
      if (removed?.thumbUrl) URL.revokeObjectURL(removed.thumbUrl);
      return prev.filter((j) => j.id !== id);
    });
  };

  const removeFromJobs = (id: string) => {
    const j = jobs.find((x) => x.id === id);
    if (j?.state === 'uploading' || j?.state === 'pending') {
      setConfirmCancelJobId(id);
      return;
    }
    skippedJobIdsRef.current.add(id);
    setJobs((prev) => {
      const removed = prev.find((x) => x.id === id);
      if (removed?.thumbUrl) URL.revokeObjectURL(removed.thumbUrl);
      return prev.filter((x) => x.id !== id);
    });
  };

  const onDropIdle = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files ?? []);
    addToStaging(files);
  };

  const onDropStaging = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files ?? []);
    addToStaging(files);
  };

  const onPickIdle = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    addToStaging(files);
    e.target.value = '';
  };

  const onPickStaging = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    addToStaging(files);
    e.target.value = '';
  };

  const confirmCancelJob = jobs.find((j) => j.id === confirmCancelJobId) ?? null;

  const phase: 'idle' | 'staging' | 'uploading' = useMemo(() => {
    if (jobs.length > 0) return 'uploading';
    if (staged.length > 0) return 'staging';
    return 'idle';
  }, [jobs, staged]);

  return (
    <div className="space-y-3">
      {/* Confirm cancel of an in-flight upload */}
      {confirmCancelJob && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-base-950/75 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-upload-title"
        >
          <div className="w-full max-w-md rounded-lg border border-base-700 bg-base-900 p-6 shadow-xl">
            <h2 id="cancel-upload-title" className="font-display text-lg font-semibold text-white">
              Cancel upload?
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-300">
              <span className="text-white">{confirmCancelJob.file.name}</span> will not be saved. This
              cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmCancelJobId(null)}
                className="rounded-md border border-base-600 px-3 py-1.5 text-[13px] text-white hover:bg-base-800"
              >
                Keep uploading
              </button>
              <button
                type="button"
                onClick={() => {
                  abortJob(confirmCancelJob.id);
                  setConfirmCancelJobId(null);
                }}
                className="rounded-md bg-red-600 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-red-500"
              >
                Cancel upload
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Staging modal — appears as soon as files are dropped/picked, before
          any upload starts. Drag-drop / "Add more files" appends to the batch.
          Suppressed when the parent panel is collapsed so we don't render a
          fixed-position overlay on top of the explorer. */}
      <AnimatePresence>
        {phase === 'staging' && visible && (
          <motion.div
            key="staging-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-base-950/80 px-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="staging-title"
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDropStaging}
          >
            <motion.div
              initial={{ scale: 0.97, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.97, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="w-full max-w-4xl rounded-lg border border-base-700 bg-base-900 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-base-800 px-5 py-4">
                <div>
                  <h2 id="staging-title" className="font-display text-base font-semibold text-white">
                    Ready to upload
                  </h2>
                  <p className="mt-0.5 font-mono text-[11px] text-ink-300">
                    {staged.length} file{staged.length === 1 ? '' : 's'} · <span className="text-white">{roomSlug}</span> ·{' '}
                    <span className="text-white">{captureDate}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={cancelStaging}
                  aria-label="Close"
                  className="inline-flex h-8 w-8 items-center justify-center rounded text-ink-300 hover:bg-base-800 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {staged.map((job) => (
                    <FileTile
                      key={job.id}
                      job={job}
                      onRemove={() => removeFromStaging(job.id)}
                      showProgress={false}
                    />
                  ))}
                  {/* Add-more affordance */}
                  <button
                    type="button"
                    onClick={() => stagingInputRef.current?.click()}
                    className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-base-700 bg-base-900/30 text-ink-300 transition-colors hover:border-amber-500/60 hover:text-white"
                  >
                    <CloudUpload size={26} strokeWidth={1.5} />
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em]">Add more</span>
                  </button>
                  <input
                    ref={stagingInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={onPickStaging}
                    accept=".jpg,.jpeg,.png,.webp,.mp4,.webm,.mov,.las,.laz,.pdf"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-base-800 px-5 py-3">
                <button
                  type="button"
                  onClick={cancelStaging}
                  className="rounded-md border border-base-600 px-3 py-1.5 text-[13px] text-white hover:bg-base-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={startUpload}
                  disabled={!staged.length}
                  className="rounded-md bg-amber-500 px-4 py-1.5 text-[13px] font-semibold text-base-950 hover:bg-amber-400 disabled:opacity-40"
                >
                  Upload {staged.length}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Drop zone — only when no batch is staged or running */}
      {phase === 'idle' && (
        <motion.div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDropIdle}
          animate={dragOver ? { scale: 1.005 } : { scale: 1 }}
          transition={{ duration: 0.15 }}
          className={`relative rounded-lg border-2 border-dashed px-6 py-7 text-center transition-colors ${
            dragOver
              ? 'border-amber-500 bg-amber-500/5'
              : 'border-base-700 bg-base-900/30 hover:border-base-600'
          }`}
        >
          <CloudUpload className="mx-auto h-7 w-7 text-amber-500" strokeWidth={1.5} />
          <p className="mt-3 text-[14px] font-semibold text-white">
            Drop captures here, or{' '}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="text-amber-500 hover:underline"
            >
              choose files
            </button>
          </p>
          <p className="mt-1 font-mono text-[11px] text-ink-300">
            Uploading to <span className="text-white">{roomSlug}</span> ·{' '}
            <span className="text-white">{captureDate}</span> · auto-detects media type
          </p>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={onPickIdle}
            accept=".jpg,.jpeg,.png,.webp,.mp4,.webm,.mov,.las,.laz,.pdf"
          />
        </motion.div>
      )}

      {/* Progress panel — only while a batch is running. Auto-closes when done. */}
      {phase === 'uploading' && (
        <div className="rounded-lg border border-base-800 bg-base-900/40 p-3">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-300">
              Uploading {jobs.filter((j) => j.state === 'uploading' || j.state === 'pending').length}
              {' of '}
              {jobs.length}
              {' · '}
              <span className="text-white">{roomSlug}</span>
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {jobs.map((job) => (
              <FileTile
                key={job.id}
                job={job}
                onRemove={() => removeFromJobs(job.id)}
                showProgress
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
