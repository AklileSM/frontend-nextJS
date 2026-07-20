'use client';

import { useEffect, useState } from 'react';
import { Loader2, MapPin, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { deleteRobotMap, getRobotMap, uploadRobotMap } from '@/services/apiClient';
import type { ApiRobotMap } from '@/types/api';

/**
 * The robot map is a pair of files produced by the SLAM toolchain (a .yaml describing the
 * origin/resolution and the occupancy grid image). It is a setup-time artefact, so it lives
 * here rather than in front of everyone queueing a capture.
 */
export function RobotMapUploader({
  projectId,
  onLoaded,
}: {
  projectId: string;
  onLoaded?: (map: ApiRobotMap | null) => void;
}) {
  const [map, setMap] = useState<ApiRobotMap | null>(null);
  const [yamlFile, setYamlFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getRobotMap(projectId)
      .then((next) => {
        if (cancelled) return;
        setMap(next);
        onLoaded?.(next);
      })
      .catch(() => {
        if (cancelled) return;
        setMap(null);
        onLoaded?.(null);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const handleUpload = () => {
    if (!yamlFile || !imageFile) {
      toast.error('Choose both the map .yaml and the map image');
      return;
    }
    setBusy(true);
    uploadRobotMap(projectId, yamlFile, imageFile)
      .then((next) => {
        setMap(next);
        onLoaded?.(next);
        setYamlFile(null);
        setImageFile(null);
        toast.success('Robot map uploaded');
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Could not upload the robot map'))
      .finally(() => setBusy(false));
  };

  const handleDelete = () => {
    setBusy(true);
    deleteRobotMap(projectId)
      .then(() => {
        setMap(null);
        onLoaded?.(null);
        toast.success('Robot map removed');
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Could not remove the robot map'))
      .finally(() => setBusy(false));
  };

  return (
    <div className="space-y-4">
      {map ? (
        <div className="rounded-lg border border-base-800 bg-base-900/40 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] text-white">Map in place</p>
              <p className="mt-0.5 font-mono text-[11px] text-ink-500">
                {map.width}×{map.height} px · {map.resolution} m/px
              </p>
            </div>
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-red-700/40 px-2.5 py-1.5 text-[12px] text-red-200 transition hover:bg-red-500/10 disabled:opacity-50"
            >
              <Trash2 size={12} />
              Remove
            </button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={map.image_url}
            alt="Robot map"
            className="mt-3 max-h-64 w-full rounded-md border border-base-800 object-contain"
          />
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-base-700 bg-base-900/20 px-4 py-8 text-center text-[13px] text-ink-400">
          No robot map yet. Capture points and live position need one.
        </p>
      )}

      <div className="grid gap-3 rounded-lg border border-base-800 bg-base-900/40 p-4">
        <label className="block">
          <span className="mb-1.5 block text-[12px] text-ink-400">Map description (.yaml)</span>
          <input
            type="file"
            accept=".yaml,.yml,text/yaml,text/plain"
            onChange={(event) => setYamlFile(event.target.files?.[0] ?? null)}
            className="block w-full text-[12px] text-ink-300 file:mr-3 file:rounded-lg file:border-0 file:bg-base-800 file:px-3 file:py-2 file:text-[12px] file:text-white"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[12px] text-ink-400">Map image (.pgm or .png)</span>
          <input
            type="file"
            accept=".pgm,.png,.jpg,.jpeg,.webp,image/*"
            onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
            className="block w-full text-[12px] text-ink-300 file:mr-3 file:rounded-lg file:border-0 file:bg-base-800 file:px-3 file:py-2 file:text-[12px] file:text-white"
          />
        </label>
        <button
          type="button"
          onClick={handleUpload}
          disabled={busy || !yamlFile || !imageFile}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-500/40 px-3 py-2 text-[13px] text-amber-200 transition hover:bg-amber-500/10 disabled:opacity-40"
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : map ? <Upload size={13} /> : <MapPin size={13} />}
          {map ? 'Replace map' : 'Upload map'}
        </button>
      </div>
    </div>
  );
}
