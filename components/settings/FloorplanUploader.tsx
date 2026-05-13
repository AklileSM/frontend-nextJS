'use client';

import { useRef, useState, type DragEvent, type ChangeEvent } from 'react';
import { motion } from 'framer-motion';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { uploadProjectFloorplan, deleteProjectFloorplan } from '@/services/apiClient';
import type { ApiProject } from '@/types/api';

export function FloorplanUploader({
  project,
  onUploaded,
}: {
  project: ApiProject;
  onUploaded: (updated: ApiProject) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Only image files are accepted for floorplans.');
      return;
    }
    setProgress(0);
    try {
      const updated = await uploadProjectFloorplan(project.id, file, setProgress);
      onUploaded(updated);
      toast.success('Floorplan uploaded');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setProgress(null);
    }
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) void upload(file);
  };

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void upload(file);
    e.target.value = '';
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const updated = await deleteProjectFloorplan(project.id);
      onUploaded(updated);
      toast.success('Floorplan removed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove floorplan');
    } finally {
      setDeleting(false);
    }
  };

  const uploading = progress !== null;

  return (
    <div className="space-y-4">
      {project.floorplan_url && (
        <div className="overflow-hidden rounded-lg border border-base-800">
          <img
            src={project.floorplan_url}
            alt="Current floorplan"
            className="max-h-48 w-full object-contain bg-base-950"
          />
          <div className="flex items-center justify-between border-t border-base-800 px-3 py-2">
            <p className="font-mono text-[11px] text-ink-400">
              Current floorplan — drop a new image below to replace it
            </p>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting || uploading}
              className="flex items-center gap-1 font-mono text-[11px] text-red-400 hover:text-red-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {deleting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Trash2 className="h-3 w-3" />
              )}
              Remove
            </button>
          </div>
        </div>
      )}

      <motion.div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        animate={dragOver ? { scale: 1.005 } : { scale: 1 }}
        transition={{ duration: 0.15 }}
        className={`relative rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors ${
          dragOver
            ? 'border-amber-500 bg-amber-500/5'
            : 'border-base-700 bg-base-900/30 hover:border-base-600'
        }`}
      >
        {uploading ? (
          <div className="space-y-3">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-amber-500" strokeWidth={1.5} />
            <div className="mx-auto h-[3px] max-w-xs overflow-hidden rounded-full bg-base-800">
              <motion.div
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.15 }}
                className="h-full bg-amber-500"
              />
            </div>
            <p className="font-mono text-[12px] text-ink-400">{progress}%</p>
          </div>
        ) : (
          <>
            <ImagePlus className="mx-auto h-6 w-6 text-amber-500" strokeWidth={1.5} />
            <p className="mt-3 text-[14px] font-semibold text-white">
              Drop floorplan image here, or{' '}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="text-amber-500 hover:underline"
              >
                choose file
              </button>
            </p>
            <p className="mt-1 font-mono text-[11px] text-ink-400">JPG, PNG, or WEBP</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={onPick}
        />
      </motion.div>
    </div>
  );
}
