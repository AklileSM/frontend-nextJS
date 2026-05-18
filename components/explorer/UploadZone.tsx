'use client';

/**
 * Drag-and-drop upload zone for the explorer.
 *
 * Three phases:
 *   - idle      → drop target, "choose files" button
 *   - staging   → modal with FileTile grid + add-more + dedupe checks
 *   - uploading → inline progress panel with FileTile grid
 *
 * State stays here (heavy lifting around abort controllers, hash precheck,
 * batch enqueue). The visual tile lives in `./upload/FileTile.tsx`.
 */

import { motion } from 'framer-motion';
import { CloudUpload, Loader2 } from 'lucide-react';
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
import { precheckUploadHash, uploadSingleFile } from '@/services/apiClient';
import { sha256OfFile } from '@/lib/hashFile';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Modal } from '@/components/ui/Modal';
import type { ApiMediaFile } from '@/types/api';
import { FileTile, detectMediaType, makeThumbUrl, type Job } from './upload/FileTile';

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

export function UploadZone({ roomId, roomSlug, captureDate, onUploaded, onClose, visible = true }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [staged, setStaged] = useState<Job[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [confirmCancelJobId, setConfirmCancelJobId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const stagingInputRef = useRef<HTMLInputElement | null>(null);
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  /** Pending jobs removed from the list before upload started — skip in the enqueue loop. */
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
      dedupe: 'checking',
    }));
    setStaged((prev) => [...prev, ...fresh]);

    // Hash + dedupe-check each file in parallel. We can't block the modal
    // on the hash — a 2 GB LAS takes 10–20s — but we mark the tile as
    // 'checking' so the Upload button can wait for it.
    for (const job of fresh) {
      void runDedupeCheck(job);
    }
  };

  const runDedupeCheck = async (job: Job) => {
    try {
      const hash = await sha256OfFile(job.file);
      const result = await precheckUploadHash(hash);
      setStaged((prev) =>
        prev.map((j) =>
          j.id === job.id
            ? result.duplicate
              ? {
                  ...j,
                  dedupe: 'duplicate' as const,
                  duplicateInfo: {
                    roomName: result.room_name ?? null,
                    captureDate: result.capture_date ?? null,
                    displayName: result.display_name ?? null,
                  },
                }
              : { ...j, dedupe: 'ok' as const }
            : j,
        ),
      );
    } catch {
      // Hashing or the precheck call failed. Don't block the upload — fall
      // back to the server-side duplicate check (which still runs in the
      // background finalize thread). Mark as 'error' for visibility.
      setStaged((prev) =>
        prev.map((j) => (j.id === job.id ? { ...j, dedupe: 'error' as const } : j)),
      );
    }
  };

  const startUpload = async () => {
    if (!staged.length) return;
    // Drop duplicates entirely — the precheck has already told us the server
    // has these. Drop tiles still in 'checking' too: the Upload button is
    // disabled while any are pending, so this is a defensive filter.
    const skipped = staged.filter((j) => j.dedupe === 'duplicate' || j.dedupe === 'checking');
    const accepted = staged.filter((j) => j.dedupe !== 'duplicate' && j.dedupe !== 'checking');
    skipped.forEach((j) => j.thumbUrl && URL.revokeObjectURL(j.thumbUrl));
    if (!accepted.length) {
      setStaged([]);
      toast.error('Nothing to upload — every file is already in the project.');
      return;
    }

    const batch: Job[] = accepted.map((j) => ({ ...j, state: 'pending' }));
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

  const stagingChecking = useMemo(
    () => staged.filter((j) => j.dedupe === 'checking').length,
    [staged],
  );
  const stagingDuplicates = useMemo(
    () => staged.filter((j) => j.dedupe === 'duplicate').length,
    [staged],
  );
  const stagingUploadable = staged.length - stagingChecking - stagingDuplicates;

  return (
    <div className="space-y-3">
      {/* Confirm cancel of an in-flight upload */}
      <ConfirmDialog
        open={!!confirmCancelJob}
        title="Cancel upload?"
        body={
          <>
            <span className="text-white">{confirmCancelJob?.file.name}</span> will not be saved. This cannot be undone.
          </>
        }
        confirmLabel="Cancel upload"
        danger
        onConfirm={() => {
          if (confirmCancelJob) abortJob(confirmCancelJob.id);
          setConfirmCancelJobId(null);
        }}
        onCancel={() => setConfirmCancelJobId(null)}
      />

      {/* Staging modal — appears as soon as files are dropped/picked, before
          any upload starts. Drag-drop / "Add more files" appends to the batch.
          Suppressed when the parent panel is collapsed so we don't render a
          fixed-position overlay on top of the explorer. */}
      <Modal
        open={phase === 'staging' && visible}
        onClose={cancelStaging}
        title="Ready to upload"
        subtitle={
          <>
            {staged.length} file{staged.length === 1 ? '' : 's'} ·{' '}
            <span className="text-white">{roomSlug}</span> ·{' '}
            <span className="text-white">{captureDate}</span>
            {stagingDuplicates > 0 && (
              <>
                {' · '}
                <span className="text-red-300">{stagingDuplicates} duplicate{stagingDuplicates === 1 ? '' : 's'} skipped</span>
              </>
            )}
          </>
        }
        size="2xl"
        footer={
          <>
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
              disabled={!staged.length || stagingChecking > 0 || stagingUploadable === 0}
              className="inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-4 py-1.5 text-[13px] font-semibold text-base-950 hover:bg-amber-400 disabled:opacity-40"
            >
              {stagingChecking > 0 && <Loader2 size={12} className="animate-spin" aria-hidden />}
              {stagingChecking > 0
                ? `Checking ${stagingChecking}…`
                : `Upload ${stagingUploadable}`}
            </button>
          </>
        }
      >
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDropStaging}
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4"
        >
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
      </Modal>

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
