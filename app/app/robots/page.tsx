'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import type { MouseEvent } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Bot, Check, Loader2, MapPin, Maximize2, Plus, RefreshCcw, Send, Trash2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  cancelRobotMission,
  createRobotCapturePoint,
  createRobotMission,
  deleteRobotCapturePoint,
  deleteRobotMission,
  getRobotMap,
  listRobotCapturePoints,
  listProjects,
  listRobotMissions,
  listRobots,
  uploadRobotMap,
} from '@/services/apiClient';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { formatIsoDate } from '@/services/dateFormat';
import type { ApiProject, ApiRobotCapturePoint, ApiRobotMap, ApiRobotMission, ApiRobotSummary } from '@/types/api';

export const dynamic = 'force-dynamic';

const STATUS_STYLES: Record<string, string> = {
  queued: 'bg-base-800 text-amber-300',
  dispatched: 'bg-cyan-500/10 text-cyan-300',
  running: 'bg-blue-500/10 text-blue-300',
  succeeded: 'bg-emerald-500/10 text-emerald-300',
  failed: 'bg-red-500/10 text-red-300',
  cancelled: 'bg-base-700 text-ink-300',
  pending: 'bg-base-800 text-ink-300',
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatLastSeen(value: string | null): string {
  if (!value) return 'Never';
  return new Date(value).toLocaleString();
}

function canCancelMission(status: string): boolean {
  return ['queued', 'dispatched', 'running'].includes(status);
}

function canDeleteMission(status: string): boolean {
  return ['queued', 'dispatched', 'running', 'cancelled', 'failed', 'succeeded'].includes(status);
}

function normalizedToMapPose(robotMap: ApiRobotMap, marker: { x: number; y: number }): { x: number; y: number } {
  const pixelX = marker.x * robotMap.width;
  const pixelY = marker.y * robotMap.height;
  const localX = pixelX * robotMap.resolution;
  const localY = (robotMap.height - pixelY) * robotMap.resolution;
  const cos = Math.cos(robotMap.origin_yaw);
  const sin = Math.sin(robotMap.origin_yaw);
  return {
    x: robotMap.origin_x + localX * cos - localY * sin,
    y: robotMap.origin_y + localX * sin + localY * cos,
  };
}

function radiansToDegrees(value: number): number {
  return Math.round((value * 180) / Math.PI);
}

export default function RobotMissionsPage() {
  const [robots, setRobots] = useState<ApiRobotSummary[]>([]);
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [capturePoints, setCapturePoints] = useState<ApiRobotCapturePoint[]>([]);
  const [robotMap, setRobotMap] = useState<ApiRobotMap | null>(null);
  const [robotMapError, setRobotMapError] = useState<string | null>(null);
  const [missions, setMissions] = useState<ApiRobotMission[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, startRefresh] = useTransition();
  const [submitting, startSubmit] = useTransition();
  const [pendingAction, setPendingAction] = useState<{ type: 'cancel' | 'delete'; mission: ApiRobotMission } | null>(null);
  const robotMapRef = useRef<HTMLDivElement | null>(null);

  const [robotId, setRobotId] = useState('');
  const [projectSlug, setProjectSlug] = useState('');
  const [captureDate, setCaptureDate] = useState(todayIso());
  const [selectedCapturePointIds, setSelectedCapturePointIds] = useState<string[]>([]);
  const [addingCapturePoint, setAddingCapturePoint] = useState(false);
  const [newPointName, setNewPointName] = useState('');
  const [newPointMapX, setNewPointMapX] = useState('');
  const [newPointMapY, setNewPointMapY] = useState('');
  const [newPointYaw, setNewPointYaw] = useState('0');
  const [newPointMapMarker, setNewPointMapMarker] = useState<{ x: number; y: number } | null>(null);
  const [newPointFacingMarker, setNewPointFacingMarker] = useState<{ x: number; y: number } | null>(null);
  const [robotMapYamlFile, setRobotMapYamlFile] = useState<File | null>(null);
  const [robotMapImageFile, setRobotMapImageFile] = useState<File | null>(null);
  const [uploadingRobotMap, setUploadingRobotMap] = useState(false);
  const [sensor, setSensor] = useState('insta360-x4');
  const [continueOnFailure, setContinueOnFailure] = useState(false);

  const refresh = useCallback(async () => {
    const [robotsData, projectsData, missionsData] = await Promise.all([
      listRobots(),
      listProjects(),
      listRobotMissions({ limit: 25 }),
    ]);
    setRobots(robotsData);
    setProjects(projectsData);
    setMissions(missionsData);
    setRobotId((current) => current || robotsData[0]?.username || '');
    setProjectSlug((current) => current || projectsData[0]?.slug || '');
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    refresh()
      .catch((err) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Failed to load robot missions');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      startRefresh(() => {
        refresh().catch(() => undefined);
      });
    }, 10000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.slug === projectSlug) ?? null,
    [projectSlug, projects],
  );
  const selectedCapturePoints = useMemo(
    () => selectedCapturePointIds
      .map((id) => capturePoints.find((point) => point.id === id))
      .filter((point): point is ApiRobotCapturePoint => Boolean(point)),
    [capturePoints, selectedCapturePointIds],
  );
  const pendingMission = pendingAction?.mission ?? null;
  const pendingActionType = pendingAction?.type ?? null;

  const refreshCapturePoints = useCallback(async (projectId: string) => {
    const points = await listRobotCapturePoints(projectId);
    setCapturePoints(points);
    setSelectedCapturePointIds((current) => current.filter((id) => points.some((point) => point.id === id)));
  }, []);

  useEffect(() => {
    if (!selectedProject) {
      setCapturePoints([]);
      setSelectedCapturePointIds([]);
      setRobotMap(null);
      setAddingCapturePoint(false);
      return;
    }
    refreshCapturePoints(selectedProject.id).catch((err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to load capture points');
    });
    getRobotMap(selectedProject.id)
      .then((map) => {
        setRobotMap(map);
        setRobotMapError(null);
      })
      .catch((err) => {
        setRobotMap(null);
        setRobotMapError(err instanceof Error ? err.message : 'Robot map is not available');
      });
  }, [refreshCapturePoints, selectedProject]);

  const handleUploadRobotMap = useCallback(() => {
    if (!selectedProject) {
      toast.error('Select a project first');
      return;
    }
    if (!robotMapYamlFile || !robotMapImageFile) {
      toast.error('Choose both the map YAML and map image');
      return;
    }
    setUploadingRobotMap(true);
    uploadRobotMap(selectedProject.id, robotMapYamlFile, robotMapImageFile)
      .then((map) => {
        setRobotMap(map);
        setRobotMapError(null);
        setRobotMapYamlFile(null);
        setRobotMapImageFile(null);
        toast.success('Robot map uploaded');
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : 'Failed to upload robot map');
      })
      .finally(() => setUploadingRobotMap(false));
  }, [robotMapImageFile, robotMapYamlFile, selectedProject]);

  const handleCancelCapturePoint = useCallback(() => {
    setAddingCapturePoint(false);
    setNewPointName('');
    setNewPointMapX('');
    setNewPointMapY('');
    setNewPointYaw('0');
    setNewPointMapMarker(null);
    setNewPointFacingMarker(null);
  }, []);

  const getMapMarkerFromEvent = useCallback((event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    };
  }, []);

  const setNewPointPoseFromMarkers = useCallback((position: { x: number; y: number }, facing?: { x: number; y: number } | null) => {
    if (!robotMap) return;
    const mapPosition = normalizedToMapPose(robotMap, position);
    setNewPointMapMarker(position);
    setNewPointMapX(mapPosition.x.toFixed(3));
    setNewPointMapY(mapPosition.y.toFixed(3));

    if (facing) {
      const mapFacing = normalizedToMapPose(robotMap, facing);
      const yaw = Math.atan2(mapFacing.y - mapPosition.y, mapFacing.x - mapPosition.x);
      setNewPointFacingMarker(facing);
      setNewPointYaw(yaw.toFixed(4));
    }
  }, [robotMap]);

  const handleRobotMapClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (!robotMap || !addingCapturePoint) return;
    const marker = getMapMarkerFromEvent(event);
    if (!newPointMapMarker) {
      setNewPointPoseFromMarkers(marker, null);
      return;
    }
    setNewPointPoseFromMarkers(newPointMapMarker, marker);
  }, [addingCapturePoint, getMapMarkerFromEvent, newPointMapMarker, robotMap, setNewPointPoseFromMarkers]);

  const handleRobotMapMouseMove = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (!robotMap || !addingCapturePoint || !newPointMapMarker) return;
    setNewPointPoseFromMarkers(newPointMapMarker, getMapMarkerFromEvent(event));
  }, [addingCapturePoint, getMapMarkerFromEvent, newPointMapMarker, robotMap, setNewPointPoseFromMarkers]);

  const handleFullscreenMap = useCallback(() => {
    const target = robotMapRef.current;
    if (!target?.requestFullscreen) return;
    target.requestFullscreen().catch(() => toast.error('Could not open the map full screen'));
  }, []);

  const handleCreateCapturePoint = useCallback(() => {
    if (!selectedProject) {
      toast.error('Select a project first');
      return;
    }
    const mapX = Number(newPointMapX);
    const mapY = Number(newPointMapY);
    const yaw = Number(newPointYaw || 0);
    if (!newPointName.trim()) {
      toast.error('Name the capture point');
      return;
    }
    if (!newPointMapMarker || !newPointFacingMarker) {
      toast.error('Place the point and choose its facing direction on the map');
      return;
    }
    if (!Number.isFinite(mapX) || !Number.isFinite(mapY) || !Number.isFinite(yaw)) {
      toast.error('Capture point pose could not be read');
      return;
    }
    createRobotCapturePoint(selectedProject.id, {
      name: newPointName.trim(),
      room_slug: null,
      map_x: mapX,
      map_y: mapY,
      yaw,
      floorplan_x: newPointMapMarker?.x ?? null,
      floorplan_y: newPointMapMarker?.y ?? null,
      source: newPointMapMarker ? 'robot_map_click' : 'manual',
    })
      .then((point) => {
        toast.success(`Saved capture point ${point.name}`);
        handleCancelCapturePoint();
        return refreshCapturePoints(selectedProject.id);
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : 'Failed to save capture point');
      });
  }, [
    newPointMapX,
    newPointMapY,
    newPointMapMarker,
    newPointName,
    newPointYaw,
    newPointFacingMarker,
    handleCancelCapturePoint,
    refreshCapturePoints,
    selectedProject,
  ]);

  const toggleCapturePoint = useCallback((pointId: string) => {
    setSelectedCapturePointIds((current) => (
      current.includes(pointId)
        ? current.filter((id) => id !== pointId)
        : [...current, pointId]
    ));
  }, []);

  const handleSubmit = useCallback(() => {
    if (!robotId || !projectSlug) {
      toast.error('Select a robot and project first');
      return;
    }
    if (selectedCapturePointIds.length === 0) {
      toast.error('Select at least one capture point');
      return;
    }

    startSubmit(() => {
      createRobotMission({
        robot_id: robotId,
        project_slug: projectSlug,
        capture_point_ids: selectedCapturePointIds,
        capture_mode: 'panorama',
        capture_date: captureDate,
        retry_policy: { continue_on_failure: continueOnFailure },
        robot_meta: { sensor },
      })
        .then((mission) => {
          toast.success(`Queued mission ${mission.id.slice(0, 8)}`);
          return refresh();
        })
        .catch((err) => {
          toast.error(err instanceof Error ? err.message : 'Failed to create mission');
        });
    });
  }, [captureDate, continueOnFailure, projectSlug, refresh, robotId, selectedCapturePointIds, sensor]);

  const runPendingAction = useCallback(async () => {
    if (!pendingAction) return;

    if (pendingAction.type === 'cancel') {
      await cancelRobotMission(pendingAction.mission.id);
      toast.success(`Cancelled mission ${pendingAction.mission.id.slice(0, 8)}`);
    } else {
      await deleteRobotMission(pendingAction.mission.id);
      toast.success(`Deleted mission ${pendingAction.mission.id.slice(0, 8)}`);
    }

    setPendingAction(null);
    await refresh();
  }, [pendingAction, refresh]);

  return (
    <div className="px-6 py-10 sm:px-10 lg:px-12 xl:px-16">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"
      >
        <div>
          <p className="font-mono text-[12px] uppercase tracking-[0.22em] text-amber-500">
            Operations · Robots
          </p>
          <h1 className="mt-3 font-display text-[36px] font-semibold tracking-tight text-white">
            Mission control
          </h1>
          <p className="mt-2 max-w-2xl text-[14px] text-ink-300">
            Queue waypoint missions, watch robot heartbeat, and inspect mission progress without using Swagger or SSH.
          </p>
        </div>
        <button
          type="button"
          onClick={() => startRefresh(() => { refresh().catch(() => undefined); })}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded border border-base-700 px-3 py-2 text-[12px] text-white transition hover:border-ink-400 disabled:opacity-50"
        >
          {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
          Refresh
        </button>
        <Link
          href="/app/robots/pairing"
          className="inline-flex items-center gap-2 rounded border border-base-700 px-3 py-2 text-[12px] text-white transition hover:border-ink-400"
        >
          <Bot size={14} />
          Pair robot
        </Link>
      </motion.section>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-32 animate-pulse rounded-2xl border border-base-800 bg-base-900/50" />
          ))
        ) : (
          robots.map((robot) => (
            <div
              key={robot.robot_id}
              className="rounded-2xl border border-base-800 bg-base-900/65 p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-[18px] text-white">{robot.username}</p>
                  <p className="mt-1 font-mono text-[11px] text-ink-400">{robot.robot_id}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 font-mono text-[10px] uppercase ${STATUS_STYLES[robot.status ?? 'pending'] ?? 'bg-base-800 text-ink-300'}`}>
                  {robot.status ?? 'unknown'}
                </span>
              </div>
              <dl className="mt-4 space-y-2 text-[12px] text-ink-300">
                <div className="flex justify-between gap-3">
                  <dt>Current mission</dt>
                  <dd className="font-mono text-[11px] text-white">{robot.current_mission_id ?? '—'}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>Hostname</dt>
                  <dd className="font-mono text-[11px] text-white">{robot.hostname ?? '—'}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>Last seen</dt>
                  <dd className="text-right text-white">{formatLastSeen(robot.last_seen_at)}</dd>
                </div>
              </dl>
            </div>
          ))
        )}
      </div>

      <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(320px,420px)_1fr]">
        <section className="rounded-3xl border border-base-800 bg-base-900/60 p-6">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-300">
              <Bot size={18} />
            </div>
            <div>
              <h2 className="font-display text-[24px] text-white">Queue a mission</h2>
              <p className="text-[13px] text-ink-300">Select saved capture points for the robot to visit.</p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.16em] text-ink-400">Robot</span>
              <select
                value={robotId}
                onChange={(event) => setRobotId(event.target.value)}
                className="w-full rounded-xl border border-base-700 bg-base-950 px-3 py-2.5 text-[14px] text-white outline-none transition focus:border-amber-500"
              >
                <option value="">Select robot</option>
                {robots.map((robot) => (
                  <option key={robot.robot_id} value={robot.username}>
                    {robot.username}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.16em] text-ink-400">Project</span>
              <select
                value={projectSlug}
                onChange={(event) => setProjectSlug(event.target.value)}
                className="w-full rounded-xl border border-base-700 bg-base-950 px-3 py-2.5 text-[14px] text-white outline-none transition focus:border-amber-500"
              >
                <option value="">Select project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.slug}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.16em] text-ink-400">Capture date</span>
                <input
                  type="date"
                  value={captureDate}
                  onChange={(event) => setCaptureDate(event.target.value)}
                  className="w-full rounded-xl border border-base-700 bg-base-950 px-3 py-2.5 text-[14px] text-white outline-none transition focus:border-amber-500"
                />
              </label>
              <label className="block">
                <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.16em] text-ink-400">Sensor</span>
                <input
                  type="text"
                  value={sensor}
                  onChange={(event) => setSensor(event.target.value)}
                  className="w-full rounded-xl border border-base-700 bg-base-950 px-3 py-2.5 text-[14px] text-white outline-none transition focus:border-amber-500"
                />
              </label>
            </div>

	            <div className="rounded-2xl border border-base-800 bg-base-950/60 p-4">
	              <div className="flex items-center justify-between gap-3">
	                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-400">Capture points</p>
	                <span className="text-[12px] text-ink-500">{capturePoints.length} saved</span>
	              </div>
              <div className="mt-3 space-y-2">
                {capturePoints.length > 0 ? capturePoints.map((point) => {
                  const selected = selectedCapturePointIds.includes(point.id);
                  return (
                    <div
                      key={point.id}
                      className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 ${selected ? 'border-amber-500/60 bg-amber-500/10' : 'border-base-800 bg-base-900/70'}`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleCapturePoint(point.id)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <span className="block truncate text-[13px] text-white">{point.name}</span>
                        <span className="mt-0.5 block font-mono text-[11px] text-ink-400">
                          x {point.map_x.toFixed(2)} · y {point.map_y.toFixed(2)} · yaw {point.yaw.toFixed(2)}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!selectedProject) return;
                          deleteRobotCapturePoint(selectedProject.id, point.id)
                            .then(() => refreshCapturePoints(selectedProject.id))
                            .catch((err) => toast.error(err instanceof Error ? err.message : 'Failed to delete capture point'));
                        }}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-700/40 text-red-200 transition hover:bg-red-500/10"
                        title="Delete capture point"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                }) : (
                  <div className="rounded-xl border border-dashed border-base-700 px-3 py-5 text-center text-[13px] text-ink-400">
                    No capture points saved for this project.
	                  </div>
	                )}
	              </div>
	              <div className="mt-4 flex flex-wrap gap-2">
	                <button
	                  type="button"
	                  onClick={() => {
	                    if (!robotMap) {
	                      toast.error('Upload a robot map before adding capture points');
	                      return;
	                    }
	                    setAddingCapturePoint(true);
	                    setNewPointName('');
	                    setNewPointMapX('');
	                    setNewPointMapY('');
	                    setNewPointYaw('0');
	                    setNewPointMapMarker(null);
	                    setNewPointFacingMarker(null);
	                  }}
	                  className="inline-flex items-center gap-2 rounded-xl border border-amber-500/40 px-3 py-2 text-[12px] text-amber-200 transition hover:bg-amber-500/10"
	                >
	                  <Plus size={13} />
	                  Add capture point
	                </button>
	              </div>
	            </div>

	            <div className="rounded-2xl border border-base-800 bg-base-950/60 p-4">
	              <div className="flex items-center justify-between gap-3">
	                <div className="flex items-center gap-2">
	                  <MapPin size={14} className="text-amber-300" />
	                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-400">Robot map</p>
	                </div>
	                {robotMap ? (
	                  <button
	                    type="button"
	                    onClick={handleFullscreenMap}
	                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-base-700 text-ink-200 transition hover:border-ink-400"
	                    title="Open map full screen"
	                  >
	                    <Maximize2 size={13} />
	                  </button>
	                ) : null}
	              </div>

	              {robotMap ? (
	                <div
	                  ref={robotMapRef}
	                  role={addingCapturePoint ? 'button' : undefined}
	                  tabIndex={addingCapturePoint ? 0 : undefined}
	                  onClick={handleRobotMapClick}
	                  onMouseMove={handleRobotMapMouseMove}
	                  onKeyDown={(event) => {
	                    if (event.key === 'Enter' || event.key === ' ') event.preventDefault();
	                  }}
	                  className={`relative mt-3 overflow-hidden rounded-xl border border-base-800 bg-base-900 ${addingCapturePoint ? 'cursor-crosshair' : ''}`}
	                  style={{ aspectRatio: `${robotMap.width} / ${robotMap.height}` }}
	                >
	                  <img
	                    src={robotMap.image_url}
	                    alt=""
                    className="h-full w-full"
                  />
                  {capturePoints.map((point) => (
                    point.floorplan_x !== null && point.floorplan_y !== null ? (
                      <span
                        key={point.id}
                        className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-base-950 bg-emerald-400 shadow"
                        style={{ left: `${point.floorplan_x * 100}%`, top: `${point.floorplan_y * 100}%` }}
                        title={point.name}
	                      />
	                    ) : null
	                  ))}
	                  {newPointMapMarker ? (
	                    <>
	                      {newPointFacingMarker ? (
	                        <svg
	                          className="pointer-events-none absolute inset-0 h-full w-full"
	                          viewBox="0 0 100 100"
	                          preserveAspectRatio="none"
	                        >
	                          <line
	                            x1={newPointMapMarker.x * 100}
	                            y1={newPointMapMarker.y * 100}
	                            x2={newPointFacingMarker.x * 100}
	                            y2={newPointFacingMarker.y * 100}
	                            stroke="rgb(251 191 36)"
	                            strokeWidth="0.65"
	                            strokeLinecap="round"
	                          />
	                        </svg>
	                      ) : null}
	                      <span
	                        className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-base-950 bg-amber-400 shadow"
	                        style={{ left: `${newPointMapMarker.x * 100}%`, top: `${newPointMapMarker.y * 100}%` }}
	                      />
	                    </>
	                  ) : null}
	                  <div className="absolute bottom-2 left-2 rounded bg-base-950/80 px-2 py-1 font-mono text-[10px] text-ink-300">
	                    {robotMap.resolution} m/px · {robotMap.frame}
	                  </div>
	                  {addingCapturePoint ? (
	                    <div className="absolute right-2 top-2 rounded bg-base-950/85 px-2 py-1 text-[11px] text-amber-100">
	                      {newPointMapMarker
	                        ? `Choose facing direction${newPointFacingMarker ? ` · ${radiansToDegrees(Number(newPointYaw || 0))}°` : ''}`
	                        : 'Click to place point'}
	                    </div>
	                  ) : null}
	                </div>
	              ) : (
                <div className="mt-3 rounded-xl border border-dashed border-base-700 bg-base-900/50 px-3 py-4">
                  <p className="text-center text-[13px] text-ink-300">
                    {robotMapError || 'No robot map uploaded for this project.'}
                  </p>
                  <div className="mt-4 grid gap-3">
                    <label className="block">
                      <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">Map YAML</span>
                      <input
                        type="file"
                        accept=".yaml,.yml,text/yaml,text/plain"
                        onChange={(event) => setRobotMapYamlFile(event.target.files?.[0] ?? null)}
                        className="block w-full text-[12px] text-ink-300 file:mr-3 file:rounded-lg file:border-0 file:bg-base-800 file:px-3 file:py-2 file:text-[12px] file:text-white"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">Map image</span>
                      <input
                        type="file"
                        accept=".pgm,.png,.jpg,.jpeg,.webp,image/*"
                        onChange={(event) => setRobotMapImageFile(event.target.files?.[0] ?? null)}
                        className="block w-full text-[12px] text-ink-300 file:mr-3 file:rounded-lg file:border-0 file:bg-base-800 file:px-3 file:py-2 file:text-[12px] file:text-white"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={handleUploadRobotMap}
                      disabled={uploadingRobotMap}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-500/40 px-3 py-2.5 text-[13px] text-amber-200 transition hover:bg-amber-500/10 disabled:opacity-50"
                    >
                      {uploadingRobotMap ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
                      Upload robot map
                    </button>
                  </div>
	                </div>
	              )}

	              {addingCapturePoint ? (
	                <div className="mt-4 grid gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
	                  <input
	                    type="text"
	                    value={newPointName}
	                    onChange={(event) => setNewPointName(event.target.value)}
	                    placeholder="Capture point name"
	                    className="w-full rounded-xl border border-base-700 bg-base-950 px-3 py-2.5 text-[14px] text-white outline-none transition focus:border-amber-500"
	                  />
	                  <div className="flex flex-wrap gap-2 text-[12px] text-ink-300">
	                    <span className="rounded-lg border border-base-800 bg-base-950 px-2 py-1">
	                      {newPointMapMarker ? 'Position selected' : 'Position needed'}
	                    </span>
	                    <span className="rounded-lg border border-base-800 bg-base-950 px-2 py-1">
	                      {newPointFacingMarker ? `Facing ${radiansToDegrees(Number(newPointYaw || 0))}°` : 'Facing direction needed'}
	                    </span>
	                  </div>
	                  <div className="flex flex-wrap gap-2">
	                    <button
	                      type="button"
	                      onClick={handleCreateCapturePoint}
	                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-500/40 px-3 py-2.5 text-[13px] text-amber-200 transition hover:bg-amber-500/10"
	                    >
	                      <Check size={14} />
	                      Save capture point
	                    </button>
	                    <button
	                      type="button"
	                      onClick={handleCancelCapturePoint}
	                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-base-700 px-3 py-2.5 text-[13px] text-ink-200 transition hover:border-ink-400"
	                    >
	                      <XCircle size={14} />
	                      Cancel
	                    </button>
	                  </div>
	                </div>
	              ) : null}
	            </div>

            <label className="flex items-center gap-3 rounded-2xl border border-base-800 bg-base-950/70 px-3 py-3 text-[13px] text-ink-200">
              <input
                type="checkbox"
                checked={continueOnFailure}
                onChange={(event) => setContinueOnFailure(event.target.checked)}
                className="h-4 w-4 rounded border-base-700 bg-base-950 text-amber-500"
              />
              Continue to later waypoints if one stop fails
            </label>

            <div className="rounded-2xl border border-base-800 bg-base-950/60 p-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-400">Mission preview</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedCapturePoints.length > 0 ? selectedCapturePoints.map((point) => (
                  <span
                    key={point.id}
                    className="rounded-full border border-base-700 bg-base-900 px-2.5 py-1 font-mono text-[11px] text-white"
                  >
                    {point.name}
                  </span>
                )) : (
                  <span className="text-[13px] text-ink-400">No capture points selected.</span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 px-4 py-3 text-[14px] font-medium text-base-950 transition hover:bg-amber-400 disabled:opacity-60"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              Queue mission
            </button>
          </div>
        </section>

        <section className="rounded-3xl border border-base-800 bg-base-900/45 p-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-[24px] text-white">Recent missions</h2>
              <p className="mt-1 text-[13px] text-ink-300">Latest queued and completed robot runs from the backend.</p>
            </div>
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-500">
              {missions.length} loaded
            </span>
          </div>

          <div className="mt-6 space-y-4">
            {loading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-32 animate-pulse rounded-2xl border border-base-800 bg-base-900/60" />
              ))
            ) : missions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-base-700 px-4 py-10 text-center text-[14px] text-ink-400">
                No missions yet.
              </div>
            ) : (
              missions.map((mission) => (
                <article
                  key={mission.id}
                  className="rounded-2xl border border-base-800 bg-base-900/70 p-5"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2.5 py-1 font-mono text-[10px] uppercase ${STATUS_STYLES[mission.status] ?? 'bg-base-800 text-ink-300'}`}>
                          {mission.status}
                        </span>
                        <span className="font-mono text-[11px] text-ink-400">{mission.id}</span>
                      </div>
                      <h3 className="mt-3 font-display text-[20px] text-white">
                        {mission.robot_id} → {mission.project_slug}
                      </h3>
                      <p className="mt-1 text-[13px] text-ink-300">
                        {mission.waypoints.length} waypoint{mission.waypoints.length === 1 ? '' : 's'} · capture {formatIsoDate(mission.capture_date)}
                      </p>
                    </div>
                    <dl className="grid gap-2 text-[12px] text-ink-300 sm:grid-cols-2 lg:text-right">
                      <div>
                        <dt className="font-mono uppercase tracking-[0.14em] text-ink-500">Created</dt>
                        <dd className="mt-1 text-white">{new Date(mission.created_at).toLocaleString()}</dd>
                      </div>
                      <div>
                        <dt className="font-mono uppercase tracking-[0.14em] text-ink-500">Completed</dt>
                        <dd className="mt-1 text-white">{mission.completed_at ? new Date(mission.completed_at).toLocaleString() : '—'}</dd>
                      </div>
                    </dl>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {mission.steps.map((step) => (
                      <span
                        key={step.id}
                        className={`rounded-full px-2.5 py-1 font-mono text-[11px] ${STATUS_STYLES[step.status] ?? 'bg-base-800 text-ink-300'}`}
                        title={step.error_message ?? step.navigation_result ?? undefined}
                      >
                        {step.sequence_index}. {step.waypoint_name}
                      </span>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {canCancelMission(mission.status) && (
                      <button
                        type="button"
                        onClick={() => setPendingAction({ type: 'cancel', mission })}
                        className="inline-flex items-center gap-2 rounded-xl border border-amber-600/40 px-3 py-2 text-[12px] text-amber-200 transition hover:bg-amber-500/10"
                      >
                        <XCircle size={13} />
                        Cancel
                      </button>
                    )}
                    {canDeleteMission(mission.status) && (
                      <button
                        type="button"
                        onClick={() => setPendingAction({ type: 'delete', mission })}
                        className="inline-flex items-center gap-2 rounded-xl border border-red-700/40 px-3 py-2 text-[12px] text-red-200 transition hover:bg-red-500/10"
                      >
                        <Trash2 size={13} />
                        Delete
                      </button>
                    )}
                  </div>

                  {mission.steps.some((step) => step.error_message) && (
                    <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-3 text-[12px] text-red-200">
                      {mission.steps.find((step) => step.error_message)?.error_message}
                    </div>
                  )}
                </article>
              ))
            )}
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={!!pendingAction}
        title={
          pendingActionType === 'delete'
            ? 'Delete this mission?'
            : 'Cancel this mission?'
        }
        body={
          pendingActionType === 'delete' ? (
            <>
              <code className="rounded bg-base-800 px-1.5 py-0.5 font-mono text-[12px] text-ink-100">
                {pendingMission?.id}
              </code>{' '}
              will be removed from the mission queue and history. If the robot is already executing it, later status updates from the robot may be ignored because the mission row will no longer exist.
            </>
          ) : (
            <>
              <code className="rounded bg-base-800 px-1.5 py-0.5 font-mono text-[12px] text-ink-100">
                {pendingMission?.id}
              </code>{' '}
              will be marked cancelled. Running steps will stop being tracked, and queued steps will be cancelled.
            </>
          )
        }
        confirmLabel={pendingActionType === 'delete' ? 'Delete mission' : 'Cancel mission'}
        danger={pendingActionType === 'delete'}
        onConfirm={runPendingAction}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
}
