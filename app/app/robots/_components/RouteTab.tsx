'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, ChevronDown, Loader2, MapPin, Plus, Send, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  createRobotCapturePoint,
  deleteRobotCapturePoint,
  updateRobotCapturePoint,
} from '@/services/apiClient';
import { Modal } from '@/components/ui/Modal';
import { MoreMenu } from '@/components/ui/MoreMenu';
import type { ApiRobotCapturePoint, ApiRobotMap } from '@/types/api';
import { RobotMapSurface } from './RobotMapSurface';
import type { Placement } from './RobotMapSurface';
import { normalizedToMapPose } from '../_lib/robotMap';
import { formatCaptureOutputs } from '../_lib/missions';
import type { CaptureOutput } from '../_lib/missions';

const CAPTURE_OUTPUT_OPTIONS: Array<{ value: CaptureOutput; label: string }> = [
  { value: 'image', label: 'Photo' },
  { value: 'pointcloud', label: '3D scan' },
];

type Props = {
  projectId: string | null;
  projectSlug: string;
  robotMap: ApiRobotMap | null;
  capturePoints: ApiRobotCapturePoint[];
  selectedIds: string[];
  onToggle: (pointId: string) => void;
  captureOutputs: CaptureOutput[];
  onCaptureOutputsChange: (outputs: CaptureOutput[]) => void;
  continueOnFailure: boolean;
  onContinueOnFailureChange: (value: boolean) => void;
  onStart: () => void;
  starting: boolean;
  connected: boolean;
  onCapturePointsChanged: () => void;
};

export function RouteTab({
  projectId,
  projectSlug,
  robotMap,
  capturePoints,
  selectedIds,
  onToggle,
  captureOutputs,
  onCaptureOutputsChange,
  continueOnFailure,
  onContinueOnFailureChange,
  onStart,
  starting,
  connected,
  onCapturePointsChanged,
}: Props) {
  const [placing, setPlacing] = useState(false);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [newPointName, setNewPointName] = useState('');
  const [saving, setSaving] = useState(false);
  const [renaming, setRenaming] = useState<ApiRobotCapturePoint | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [outputMenuOpen, setOutputMenuOpen] = useState(false);
  const outputMenuRef = useRef<HTMLDivElement>(null);

  const stopNumbers = useMemo(() => {
    const map = new Map<string, number>();
    selectedIds.forEach((id, index) => map.set(id, index + 1));
    return map;
  }, [selectedIds]);

  const route = useMemo(
    () => selectedIds
      .map((id) => capturePoints.find((point) => point.id === id))
      .filter((point): point is ApiRobotCapturePoint => Boolean(point)),
    [capturePoints, selectedIds],
  );

  const cancelPlacing = useCallback(() => {
    setPlacing(false);
    setPlacement(null);
    setNewPointName('');
  }, []);

  const savePoint = useCallback(() => {
    if (!projectId || !robotMap || !placement?.locked || !placement.facing) return;
    const name = newPointName.trim();
    if (!name) {
      toast.error('Name the point first');
      return;
    }
    const position = normalizedToMapPose(robotMap, placement.position);
    const facing = normalizedToMapPose(robotMap, placement.facing);
    const yaw = Math.atan2(facing.y - position.y, facing.x - position.x);

    setSaving(true);
    createRobotCapturePoint(projectId, {
      name,
      room_slug: null,
      map_x: position.x,
      map_y: position.y,
      yaw,
      floorplan_x: placement.position.x,
      floorplan_y: placement.position.y,
      source: 'robot_map_click',
    })
      .then(() => {
        toast.success(`Saved ${name}`);
        cancelPlacing();
        onCapturePointsChanged();
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Could not save the point'))
      .finally(() => setSaving(false));
  }, [cancelPlacing, newPointName, onCapturePointsChanged, placement, projectId, robotMap]);

  const handleRename = useCallback(() => {
    if (!projectId || !renaming) return;
    const name = renameValue.trim();
    if (!name || name === renaming.name) {
      setRenaming(null);
      return;
    }
    updateRobotCapturePoint(projectId, renaming.id, { name })
      .then(() => {
        toast.success(`Renamed to ${name}`);
        setRenaming(null);
        onCapturePointsChanged();
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Could not rename the point'));
  }, [onCapturePointsChanged, projectId, renameValue, renaming]);

  const handleDelete = useCallback((point: ApiRobotCapturePoint) => {
    if (!projectId) return;
    deleteRobotCapturePoint(projectId, point.id)
      .then(() => {
        toast.success(`Deleted ${point.name}`);
        onCapturePointsChanged();
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Could not delete the point'));
  }, [onCapturePointsChanged, projectId]);

  const toggleOutput = useCallback((output: CaptureOutput) => {
    if (captureOutputs.includes(output)) {
      if (captureOutputs.length === 1) return;
      onCaptureOutputsChange(captureOutputs.filter((item) => item !== output));
      return;
    }
    onCaptureOutputsChange([...captureOutputs, output]);
  }, [captureOutputs, onCaptureOutputsChange]);

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_minmax(300px,360px)]">
      <div className="overflow-hidden rounded-2xl border border-base-800 bg-base-950" style={{ height: 'min(62vh, 560px)' }}>
        {robotMap ? (
          <RobotMapSurface
            robotMap={robotMap}
            capturePoints={capturePoints}
            stopNumbers={stopNumbers}
            onPointClick={(point) => onToggle(point.id)}
            placing={placing}
            placement={placement}
            onPlacementChange={setPlacement}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center px-4 text-center">
            <MapPin size={18} className="text-ink-500" />
            <p className="mt-2 text-[14px] text-ink-300">No map for this project yet.</p>
            <p className="mt-1 text-[13px] text-ink-500">
              Add one under{' '}
              {projectSlug ? (
                <Link href={`/projects/${projectSlug}/settings?tab=setup`} className="text-amber-300 underline-offset-2 hover:underline">
                  project settings → Setup
                </Link>
              ) : (
                'project settings → Setup'
              )}
              .
            </p>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {placing ? (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-amber-200">New point</p>
            <p className="mt-2 text-[13px] text-ink-300">
              {!placement
                ? 'Click the map where the robot should stand.'
                : !placement.locked
                  ? 'Now drag to point the arrow the way it should face.'
                  : 'Name it and save.'}
            </p>
            <input
              type="text"
              value={newPointName}
              onChange={(event) => setNewPointName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') savePoint();
              }}
              placeholder="Point name"
              disabled={!placement?.locked}
              className="mt-3 w-full rounded-xl border border-base-700 bg-base-950 px-3 py-2 text-[14px] text-white outline-none transition focus:border-amber-500 disabled:opacity-50"
            />
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={savePoint}
                disabled={!placement?.locked || saving}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-amber-500/40 px-3 py-2 text-[13px] text-amber-200 transition hover:bg-amber-500/10 disabled:opacity-40"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                Save
              </button>
              <button
                type="button"
                onClick={cancelPlacing}
                className="rounded-xl border border-base-700 px-3 py-2 text-[13px] text-ink-200 transition hover:border-ink-400"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        <div className="rounded-2xl border border-base-800 bg-base-950/60 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-400">Route</p>
            <span className="text-[12px] text-ink-500">{route.length} stop{route.length === 1 ? '' : 's'}</span>
          </div>

          <div className="mt-3 space-y-2">
            {route.length > 0 ? route.map((point, index) => (
              <div key={point.id} className="flex items-center gap-2.5 rounded-xl border border-amber-500/50 bg-amber-500/10 px-3 py-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400 text-[10px] font-medium text-base-950">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-white" title={point.name}>{point.name}</span>
                {/* × removes from this route; deleting the saved point lives in the list below. */}
                <button
                  type="button"
                  onClick={() => onToggle(point.id)}
                  title="Remove from route"
                  className="shrink-0 rounded-lg p-1 text-ink-400 transition hover:bg-base-800 hover:text-white"
                >
                  <X size={13} />
                </button>
              </div>
            )) : (
              <div className="rounded-xl border border-dashed border-base-700 px-3 py-6 text-center text-[13px] text-ink-400">
                Click points on the map to build a route.
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => (placing ? cancelPlacing() : setPlacing(true))}
            disabled={!robotMap}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-base-700 px-3 py-2 text-[12px] text-ink-200 transition hover:border-ink-400 disabled:opacity-40"
          >
            <Plus size={13} />
            New point
          </button>
        </div>

        {capturePoints.length > 0 ? (
          <div className="rounded-2xl border border-base-800 bg-base-950/60 p-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-400">Saved points</p>
            <div className="mt-3 space-y-1">
              {capturePoints.map((point) => {
                const stop = stopNumbers.get(point.id);
                return (
                  <div key={point.id} className="flex items-center gap-2 rounded-lg px-1 transition hover:bg-base-900/60">
                    <button
                      type="button"
                      onClick={() => onToggle(point.id)}
                      className="flex min-w-0 flex-1 items-center gap-2.5 py-1.5 text-left"
                    >
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${stop ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                      <span className={`min-w-0 flex-1 truncate text-[13px] ${stop ? 'text-white' : 'text-ink-300'}`}>
                        {point.name}
                      </span>
                    </button>
                    <MoreMenu
                      items={[
                        {
                          label: 'Rename',
                          onClick: () => {
                            setRenaming(point);
                            setRenameValue(point.name);
                          },
                        },
                        { label: 'Delete', danger: true, onClick: () => handleDelete(point) },
                      ]}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="rounded-2xl border border-base-800 bg-base-950/60 p-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-400">Capture</p>
          <div ref={outputMenuRef} className="relative mt-3">
            <button
              type="button"
              onClick={() => setOutputMenuOpen((current) => !current)}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-base-700 bg-base-950 px-3 py-2.5 text-left text-[14px] text-white transition hover:border-ink-400"
              aria-haspopup="menu"
              aria-expanded={outputMenuOpen}
            >
              <span>{formatCaptureOutputs(captureOutputs)}</span>
              <ChevronDown size={15} className={`text-ink-400 transition-transform ${outputMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {outputMenuOpen ? (
              <div className="absolute left-0 right-0 top-full z-40 mt-2 rounded-xl border border-base-700 bg-base-900 p-2 shadow-xl shadow-black/40">
                {CAPTURE_OUTPUT_OPTIONS.map((option) => {
                  const checked = captureOutputs.includes(option.value);
                  return (
                    <label key={option.value} className="flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] text-ink-200 transition hover:bg-base-800 hover:text-white">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={checked && captureOutputs.length === 1}
                        onChange={() => toggleOutput(option.value)}
                        className="h-4 w-4 rounded border-base-700 bg-base-950 text-amber-500 disabled:opacity-60"
                      />
                      {option.label}
                    </label>
                  );
                })}
              </div>
            ) : null}
          </div>

          <label className="mt-3 flex items-center gap-3 text-[13px] text-ink-200">
            <input
              type="checkbox"
              checked={continueOnFailure}
              onChange={(event) => onContinueOnFailureChange(event.target.checked)}
              className="h-4 w-4 rounded border-base-700 bg-base-950 text-amber-500"
            />
            Keep going if one stop fails
          </label>
        </div>

        <button
          type="button"
          onClick={onStart}
          disabled={starting || route.length === 0 || !connected}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 px-4 py-3 text-[14px] font-medium text-base-950 transition hover:bg-amber-400 disabled:opacity-40"
        >
          {starting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          Start capture
        </button>
        {!connected && route.length > 0 ? (
          <p className="mt-2 text-center text-[12px] text-ink-500">Connect the robot first to start a capture.</p>
        ) : null}
      </div>

      <Modal
        open={!!renaming}
        onClose={() => setRenaming(null)}
        title="Rename point"
        subtitle={renaming?.name ?? undefined}
        size="sm"
      >
        <div className="space-y-4">
          <input
            type="text"
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleRename();
            }}
            className="w-full rounded-xl border border-base-700 bg-base-950 px-3 py-2.5 text-[14px] text-white outline-none transition focus:border-amber-500"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setRenaming(null)}
              className="rounded-xl border border-base-700 px-3 py-2 text-[13px] text-ink-200 transition hover:border-ink-400"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleRename}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-3 py-2 text-[13px] font-medium text-base-950 transition hover:bg-amber-400"
            >
              <Check size={14} />
              Save
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
