'use client';

import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent } from 'react';
import { Loader2, Send, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { submitFeedback } from '@/services/apiClient';

const MAX_SCREENSHOTS = 10;
const MAX_BYTES = 8 * 1024 * 1024;

type Props = {
  open: boolean;
  onClose: () => void;
};

export function FeedbackModal({ open, onClose }: Props) {
  const [comment, setComment] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state when modal closes.
  useEffect(() => {
    if (!open) {
      setComment('');
      setFiles([]);
      setPreviews([]);
      setIsDragging(false);
    }
  }, [open]);

  // Rebuild preview URLs when files change, revoke old ones to avoid leaks.
  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, [files]);

  const addFiles = (incoming: File[]) => {
    if (!incoming.length) return;
    const accepted: File[] = [];
    let rejected = 0;
    for (const f of incoming) {
      if (!f.type.startsWith('image/')) { rejected++; continue; }
      if (f.size > MAX_BYTES) { rejected++; continue; }
      accepted.push(f);
    }
    if (rejected > 0) {
      toast.error(`${rejected} file(s) skipped, only images under 8 MB are allowed.`);
    }
    setFiles((prev) => {
      const merged = [...prev, ...accepted];
      if (merged.length > MAX_SCREENSHOTS) {
        toast.error(`Max ${MAX_SCREENSHOTS} screenshots; extras ignored.`);
        return merged.slice(0, MAX_SCREENSHOTS);
      }
      return merged;
    });
  };

  const onPaste = (e: ClipboardEvent) => {
    const items = Array.from(e.clipboardData?.items ?? []);
    const images = items
      .filter((it) => it.kind === 'file' && it.type.startsWith('image/'))
      .map((it) => it.getAsFile())
      .filter((f): f is File => f !== null);
    if (images.length) {
      e.preventDefault();
      addFiles(images);
    }
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(Array.from(e.dataTransfer.files));
  };

  const removeAt = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const canSubmit = !submitting && (comment.trim().length > 0 || files.length > 0);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await submitFeedback({
        comment: comment.trim(),
        screenshots: files,
        pageUrl: typeof window !== 'undefined' ? window.location.href : '',
        viewport: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : '',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      });
      toast.success('Your feedback was submitted, thank you!');
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send feedback.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={submitting ? () => {} : onClose}
      title="Share feedback"
      size="lg"
      busy={submitting}
      busyMessage="Submitting…"
      footer={
        <>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="rounded-md border border-base-700 px-3 py-1.5 text-[13px] text-white transition-colors hover:bg-base-800 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => void handleSubmit()}
            className="inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-3.5 py-1.5 text-[13px] font-semibold text-base-950 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send size={13} />
            Submit
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onPaste={onPaste}
            rows={5}
            placeholder="Describe what you saw, bugs, comments, anything."
            className="w-full resize-none rounded-md border border-base-700 bg-base-950/60 px-3 py-2.5 text-[13px] text-white placeholder-ink-600 focus:border-base-600 focus:outline-none"
            autoFocus
          />
        </div>

        <div>
          <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.18em] text-ink-400">
            Screenshots ({files.length}/{MAX_SCREENSHOTS})
          </label>
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex cursor-pointer items-center justify-center rounded-md border-2 border-dashed px-4 py-5 text-center transition-colors ${
              isDragging ? 'border-amber-400 bg-amber-500/5' : 'border-base-700 hover:border-base-600'
            }`}
          >
            <div className="flex flex-col items-center gap-1 text-ink-300">
              <Upload size={16} />
              <p className="text-[12.5px]">
                <span className="font-medium text-white">Click to upload</span>, drag and drop
              </p>
              <p className="text-[11px] text-ink-500">PNG / JPG / WebP up to 8 MB each</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                addFiles(Array.from(e.target.files ?? []));
                e.target.value = '';
              }}
            />
          </div>

          {files.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {previews.map((url, idx) => (
                <div key={idx} className="group relative">
                  <img
                    src={url}
                    alt={`Screenshot ${idx + 1}`}
                    className="h-20 w-full rounded-md object-cover"
                  />
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeAt(idx); }}
                    aria-label="Remove screenshot"
                    className="absolute right-1 top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-base-950/85 text-ink-200 transition-colors hover:bg-red-600 hover:text-white group-hover:flex"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {submitting && <Loader2 size={14} className="animate-spin text-ink-400" />}
      </div>
    </Modal>
  );
}