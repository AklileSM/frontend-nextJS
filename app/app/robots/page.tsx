'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Bot, Loader2, RefreshCcw, Send, Trash2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  cancelRobotMission,
  createRobotMission,
  deleteRobotMission,
  listProjects,
  listRobotMissions,
  listRobots,
} from '@/services/apiClient';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { formatIsoDate } from '@/services/dateFormat';
import type { ApiProject, ApiRobotMission, ApiRobotSummary } from '@/types/api';

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

function parseWaypoints(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((part) => part.trim())
    .filter(Boolean);
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

export default function RobotMissionsPage() {
  const [robots, setRobots] = useState<ApiRobotSummary[]>([]);
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [missions, setMissions] = useState<ApiRobotMission[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, startRefresh] = useTransition();
  const [submitting, startSubmit] = useTransition();
  const [pendingAction, setPendingAction] = useState<{ type: 'cancel' | 'delete'; mission: ApiRobotMission } | null>(null);

  const [robotId, setRobotId] = useState('');
  const [projectSlug, setProjectSlug] = useState('');
  const [captureDate, setCaptureDate] = useState(todayIso());
  const [waypointText, setWaypointText] = useState('room1\nroom2');
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

  const parsedWaypoints = useMemo(() => parseWaypoints(waypointText), [waypointText]);
  const pendingMission = pendingAction?.mission ?? null;
  const pendingActionType = pendingAction?.type ?? null;

  const handleSubmit = useCallback(() => {
    if (!robotId || !projectSlug) {
      toast.error('Select a robot and project first');
      return;
    }
    if (parsedWaypoints.length === 0) {
      toast.error('Add at least one waypoint');
      return;
    }

    const roomSlugMap = Object.fromEntries(parsedWaypoints.map((waypoint) => [waypoint, waypoint]));

    startSubmit(() => {
      createRobotMission({
        robot_id: robotId,
        project_slug: projectSlug,
        waypoints: parsedWaypoints,
        room_slug_map: roomSlugMap,
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
  }, [captureDate, continueOnFailure, parsedWaypoints, projectSlug, refresh, robotId, sensor]);

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
            
            <div>
              <h2 className="font-display text-[24px] text-white">Queue a mission</h2>
              <p className="text-[13px] text-ink-300">Waypoint names must match the robot navigation map.</p>
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

            <label className="block">
              <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.16em] text-ink-400">Waypoints</span>
              <textarea
                value={waypointText}
                onChange={(event) => setWaypointText(event.target.value)}
                rows={7}
                placeholder={'room1\nroom2\nroom3'}
                className="w-full rounded-2xl border border-base-700 bg-base-950 px-3 py-3 text-[14px] text-white outline-none transition focus:border-amber-500"
              />
              <p className="mt-2 text-[12px] text-ink-400">
                One waypoint per line or comma-separated. Current room mapping mirrors waypoint names.
              </p>
            </label>

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
                {parsedWaypoints.length > 0 ? parsedWaypoints.map((waypoint) => (
                  <span
                    key={waypoint}
                    className="rounded-full border border-base-700 bg-base-900 px-2.5 py-1 font-mono text-[11px] text-white"
                  >
                    {waypoint}
                  </span>
                )) : (
                  <span className="text-[13px] text-ink-400">No valid waypoints yet.</span>
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
