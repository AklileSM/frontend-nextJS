'use client';

import { motion } from 'framer-motion';
import { CloudUpload, Loader2, X } from 'lucide-react';
import {
  useCallback,
  useEffect,
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
  onUploaded: () => void;
};

type Job = {
  id: string;
  file: File;
  progress: number;
  state: 'pending' | 'uploading' | 'done' | 'error' | 'cancelled';
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

export function UploadZone({ roomId, roomSlug, captureDate, onUploaded }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [confirmCancelJobId, setConfirmCancelJobId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  /** Pending jobs removed from the list before upload started — skip in the enqueue loop */
  const skippedJobIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const uploading = jobs.some((j) => j.state === 'uploading');
    if (!uploading) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [jobs]);

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
      onUploaded();
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

  const enqueue = async (files: File[]) => {
    const fresh: Job[] = files.map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      progress: 0,
      state: 'pending',
    }));
    setJobs((prev) => [...prev, ...fresh]);

    for (const job of fresh) {
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

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length) void enqueue(files);
  };

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length) void enqueue(files);
    e.target.value = '';
  };

  const remove = (id: string) => {
    const j = jobs.find((x) => x.id === id);
    if (j?.state === 'uploading') {
      setConfirmCancelJobId(id);
      return;
    }
    skippedJobIdsRef.current.add(id);
    setJobs((prev) => prev.filter((x) => x.id !== id));
  };

  const clearDone = () => setJobs((prev) => prev.filter((j) => j.state !== 'done'));

  const confirmCancelJob = jobs.find((j) => j.id === confirmCancelJobId) ?? null;

  return (
    <div className="space-y-3">
      {confirmCancelJob && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-base-950/75 px-4"
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

      <motion.div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
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
          onChange={onPick}
          accept=".jpg,.jpeg,.png,.webp,.mp4,.webm,.mov,.las,.laz,.pdf"
        />
      </motion.div>

      {jobs.length > 0 && (
        <ul className="space-y-2">
          {jobs.map((job) => (
            <li
              key={job.id}
              className="flex items-center gap-3 rounded-md border border-base-800 bg-base-900/30 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-[12.5px] text-white" title={job.file.name}>
                    {job.file.name}
                  </p>
                  <span className="font-mono text-[11px] text-ink-300">
                    {job.state === 'done'
                      ? '100%'
                      : job.state === 'cancelled'
                        ? '—'
                        : `${job.progress}%`}
                  </span>
                </div>
                <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-base-800">
                  <motion.div
                    initial={false}
                    animate={{ width: `${job.progress}%` }}
                    transition={{ duration: 0.15 }}
                    className={`h-full ${
                      job.state === 'error'
                        ? 'bg-red-400'
                        : job.state === 'cancelled'
                          ? 'bg-ink-500'
                          : 'bg-amber-500'
                    }`}
                  />
                </div>
                {job.state === 'error' && job.error && (
                  <p className="mt-1 font-mono text-[11px] text-red-400">{job.error}</p>
                )}
                {job.state === 'cancelled' && (
                  <p className="mt-1 font-mono text-[11px] text-ink-400">Upload cancelled</p>
                )}
              </div>
              {job.state === 'uploading' ? (
                <div className="flex shrink-0 items-center gap-2">
                  <Loader2 size={14} className="animate-spin text-amber-500" aria-hidden />
                  <button
                    type="button"
                    onClick={() => setConfirmCancelJobId(job.id)}
                    className="rounded border border-base-600 px-2 py-1 text-[11px] text-ink-200 hover:border-amber-500/60 hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => remove(job.id)}
                  aria-label="Remove"
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-ink-400 transition-colors hover:bg-base-800 hover:text-white"
                >
                  <X size={13} />
                </button>
              )}
            </li>
          ))}
          {jobs.some((j) => j.state === 'done') && (
            <li>
              <button
                type="button"
                onClick={clearDone}
                className="font-mono text-[11px] text-ink-300 transition-colors hover:text-white"
              >
                Clear completed
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
