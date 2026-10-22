'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Loader2, Map as MapIcon, Play, RotateCcw, Save, Square, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { createRobotCommand, getLatestRobotCommand, listRobots } from '@/services/apiClient';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ProgressTimeline } from '@/app/app/robots/_components/ProgressTimeline';
import { normalizeProgressEvents } from '@/app/app/robots/_lib/missions';
import { parseUtcTimestamp } from '@/app/app/robots/_lib/robotMap';
import { robotPresence } from '@/app/app/robots/_lib/presence';
import type { ApiRobotCommand, ApiRobotMap, ApiRobotSummary } from '@/types/api';

type Phase =
  | 'idle'
  | 'starting'
  | 'mapping'
  | 'saving'
  | 'cancelling'
  | 'rolling_back'
  | 'saved'
  | 'rolled_back'
  | 'failed';

const ACTIVE = ['queued', 'dispatched', 'running'];
const MAP_NAME = /^[a-z0-9_]{1,64}$/;

function phaseOf(command: ApiRobotCommand | null, projectId: string): Phase {
  if (!command) return 'idle';
  const active = ACTIVE.includes(command.status);
  const forThisProject = !command.params?.project_id || command.params.project_id === projectId;
  switch (command.kind) {
    case 'map_start':
      return active ? 'starting' : command.status === 'succeeded' ? 'mapping' : 'failed';
    case 'map_save':
      if (active) return 'saving';
      if (command.status === 'succeeded') return forThisProject ? 'saved' : 'idle';
      // A failed save leaves mapping running (the robot keeps its map in memory): try again.
      return 'failed';
    case 'map_cancel':
      return active ? 'cancelling' : 'idle';
    case 'map_rollback':
      if (active) return 'rolling_back';
      if (command.status === 'succeeded') return forThisProject ? 'rolled_back' : 'idle';
      return 'failed';
    default:
      return 'idle';
  }
}

function suggestName(projectSlug: string): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  const base = projectSlug.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'map';
  return `${base}_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
}

function formatElapsed(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * "Record a new map": runs the map runbook from SiteScope. The robot agent relays each step to the
 * laptop control panel (SLAM, map saving, home pose, localization switch) and uploads the result
 * here, retiring waypoints from the old map. Only the driving is done by hand.
 */
export function RobotMapRecorder({
  projectId,
  projectSlug,
  robotMap,
  onMapChanged,
}: {
  projectId: string;
  projectSlug: string;
  robotMap: ApiRobotMap | null;
  onMapChanged: () => void;
}) {
  const [robots, setRobots] = useState<ApiRobotSummary[]>([]);
  const [robotId, setRobotId] = useState('');
  const [command, setCommand] = useState<ApiRobotCommand | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [parked, setParked] = useState(false);
  const [mapName, setMapName] = useState(() => suggestName(projectSlug));
  const [submitting, setSubmitting] = useState(false);
  const [confirm, setConfirm] = useState<'cancel' | 'rollback' | null>(null);
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const announced = useRef<string | null>(null);

  useEffect(() => {
    const load = () =>
      listRobots()
        .then((data) => {
          setRobots(data);
          setRobotId((current) => current || data[0]?.username || '');
        })
        .catch(() => undefined);
    void load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, []);

  const refresh = useCallback(async () => {
    if (!robotId) return;
    try {
      setCommand(await getLatestRobotCommand(robotId, 'map'));
    } catch {
      // A missed poll keeps the last known state.
    } finally {
      setLoaded(true);
    }
  }, [robotId]);

  const shown = command && command.id !== dismissedId ? command : null;
  const phase = phaseOf(shown, projectId);
  const busy = ['starting', 'saving', 'cancelling', 'rolling_back'].includes(phase);

  // Poll fast while the robot is working, slower while someone drives around mapping.
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), busy ? 1500 : phase === 'mapping' ? 4000 : 15000);
    return () => clearInterval(timer);
  }, [busy, phase, refresh]);

  useEffect(() => {
    if (phase !== 'mapping') return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  // The project map changed: reload it once per finished command.
  useEffect(() => {
    if ((phase === 'saved' || phase === 'rolled_back') && shown && announced.current !== shown.id) {
      announced.current = shown.id;
      onMapChanged();
    }
  }, [onMapChanged, phase, shown]);

  const robot = useMemo(() => robots.find((item) => item.username === robotId) ?? null, [robotId, robots]);
  const online = robotPresence(robot, now).online;
  const events = normalizeProgressEvents(shown?.progress_events);
  const startedAt = shown?.kind === 'map_start' ? parseUtcTimestamp(shown.completed_at ?? shown.created_at) : null;
  const elapsed = startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
  const lastFailedKind = phase === 'failed' ? shown?.kind : null;

  const send = async (kind: ApiRobotCommand['kind'], params?: Record<string, unknown>) => {
    if (!robotId) return;
    setSubmitting(true);
    try {
      setCommand(await createRobotCommand(robotId, kind, params));
      setDismissedId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'The robot did not accept that');
    } finally {
      setSubmitting(false);
    }
  };

  const save = () => {
    if (!MAP_NAME.test(mapName)) {
      toast.error('Use only lowercase letters, numbers and underscores for the map name');
      return;
    }
    void send('map_save', { map_name: mapName, project_id: projectId });
  };

  return (
    <div className="mb-6 rounded-lg border border-base-800 bg-base-900/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MapIcon size={14} className="text-amber-300" />
          <p className="text-[13px] font-medium text-white">Record a new map</p>
        </div>
        <div className="flex items-center gap-2">
          {robots.length > 1 ? (
            <select
              value={robotId}
              onChange={(event) => setRobotId(event.target.value)}
              disabled={busy || phase === 'mapping'}
              className="rounded-md border border-base-700 bg-base-950 px-2 py-1 text-[12px] text-white"
            >
              {robots.map((item) => (
                <option key={item.username} value={item.username}>{item.username}</option>
              ))}
            </select>
          ) : robot ? (
            <span className="font-mono text-[11px] text-ink-400">{robot.username}</span>
          ) : null}
          <span className={`rounded-full border px-2 py-0.5 text-[11px] ${
            online ? 'border-emerald-500/30 text-emerald-300' : 'border-base-700 text-ink-500'
          }`}>
            {online ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>

      {!robotId ? (
        <p className="mt-3 text-[13px] text-ink-400">No robot is paired yet. Pair one from the Robot page first.</p>
      ) : !loaded ? (
        <div className="mt-4 h-20 animate-pulse rounded-md bg-base-900" />
      ) : phase === 'idle' ? (
        <div className="mt-3 space-y-3">
          <p className="text-[13px] leading-relaxed text-ink-300">
            The robot maps the site while you drive it with the handheld controller. Saving does the rest:
            the map, the home position and the robot&apos;s settings are updated, the map is uploaded here,
            and waypoints from the old map are retired.
          </p>
          <label className="flex items-start gap-2.5 text-[13px] text-ink-200">
            <input
              type="checkbox"
              checked={parked}
              onChange={(event) => setParked(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-base-700 bg-base-950 text-amber-500"
            />
            The robot is parked where its home should be, facing the way it should park.
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void send('map_start', { project_id: projectId })}
              disabled={!parked || !online || submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-3 py-2 text-[13px] font-medium text-base-950 transition hover:bg-amber-400 disabled:opacity-40"
            >
              {submitting ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
              Start mapping
            </button>
            {robotMap?.previous_map_name ? (
              <button
                type="button"
                onClick={() => setConfirm('rollback')}
                disabled={!online || submitting}
                className="inline-flex items-center gap-2 rounded-lg border border-base-700 px-3 py-2 text-[13px] text-ink-200 transition hover:border-ink-400 disabled:opacity-40"
              >
                <RotateCcw size={13} />
                Switch back to {robotMap.previous_map_name.replace(/\.yaml$/, '')}
              </button>
            ) : null}
          </div>
          {!online ? <p className="text-[12px] text-ink-500">The robot has to be online to record a map.</p> : null}
        </div>
      ) : phase === 'mapping' ? (
        <div className="mt-3 space-y-4">
          <div className="flex items-baseline gap-3">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-400" />
            <span className="font-mono text-[22px] text-white">{formatElapsed(elapsed)}</span>
            <span className="text-[13px] text-ink-400">mapping</span>
          </div>
          <ol className="list-decimal space-y-1 pl-5 text-[13px] leading-relaxed text-ink-300">
            <li>Drive slowly with the handheld controller, following the walls of each room and corridor.</li>
            <li>Pass through intersections more than once, so the map closes its loops.</li>
            <li>Bring the robot back to exactly where it started, facing the same way, and stop.</li>
          </ol>
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-0 flex-1">
              <span className="mb-1 block text-[12px] text-ink-400">Map name</span>
              <input
                value={mapName}
                onChange={(event) => setMapName(event.target.value.toLowerCase())}
                className="w-full rounded-lg border border-base-700 bg-base-950 px-3 py-2 font-mono text-[13px] text-white outline-none focus:border-amber-500"
              />
            </label>
            <button
              type="button"
              onClick={save}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-3 py-2 text-[13px] font-medium text-base-950 transition hover:bg-amber-400 disabled:opacity-40"
            >
              {submitting ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              It&apos;s back home: save map
            </button>
            <button
              type="button"
              onClick={() => setConfirm('cancel')}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg border border-base-700 px-3 py-2 text-[13px] text-ink-200 transition hover:border-ink-400 disabled:opacity-40"
            >
              <Square size={12} />
              Cancel mapping
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {busy ? (
            <p className="flex items-center gap-2 text-[13px] text-ink-300">
              <Loader2 size={13} className="animate-spin text-amber-300" />
              {phase === 'starting' ? 'Starting mapping…' : phase === 'saving' ? 'Saving the new map…'
                : phase === 'cancelling' ? 'Cancelling…' : 'Switching back…'}
            </p>
          ) : phase === 'failed' ? (
            <p className="flex items-start gap-2 text-[13px] text-red-200">
              <XCircle size={14} className="mt-0.5 shrink-0" />
              {shown?.detail || 'That did not work.'}
            </p>
          ) : (
            <p className="flex items-start gap-2 text-[13px] text-emerald-200">
              <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
              {shown?.detail || 'Done.'}
            </p>
          )}
          {events.length > 0 ? <ProgressTimeline events={events} /> : null}
          <div className="flex flex-wrap gap-2">
            {phase === 'saved' ? (
              <Link
                href="/app/robots"
                className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-3 py-2 text-[13px] font-medium text-base-950 transition hover:bg-amber-400"
              >
                Place the waypoints
              </Link>
            ) : null}
            {/* Right after a save is when a bad map is noticed, so the way back is offered here too. */}
            {(phase === 'saved' || phase === 'rolled_back') && robotMap?.previous_map_name ? (
              <button
                type="button"
                onClick={() => setConfirm('rollback')}
                disabled={!online || submitting}
                className="inline-flex items-center gap-2 rounded-lg border border-base-700 px-3 py-2 text-[13px] text-ink-200 transition hover:border-ink-400 disabled:opacity-40"
              >
                <RotateCcw size={13} />
                Switch back to {robotMap.previous_map_name.replace(/\.yaml$/, '')}
              </button>
            ) : null}
            {phase === 'failed' && lastFailedKind === 'map_save' ? (
              <>
                <label className="min-w-0 flex-1">
                  <span className="mb-1 block text-[12px] text-ink-400">Map name</span>
                  <input
                    value={mapName}
                    onChange={(event) => setMapName(event.target.value.toLowerCase())}
                    className="w-full rounded-lg border border-base-700 bg-base-950 px-3 py-2 font-mono text-[13px] text-white outline-none focus:border-amber-500"
                  />
                </label>
                <button
                  type="button"
                  onClick={save}
                  disabled={submitting}
                  className="inline-flex items-center gap-2 self-end rounded-lg bg-amber-500 px-3 py-2 text-[13px] font-medium text-base-950 transition hover:bg-amber-400 disabled:opacity-40"
                >
                  <Save size={13} />
                  Try saving again
                </button>
                <button
                  type="button"
                  onClick={() => setConfirm('cancel')}
                  disabled={submitting}
                  className="inline-flex items-center gap-2 self-end rounded-lg border border-base-700 px-3 py-2 text-[13px] text-ink-200 transition hover:border-ink-400 disabled:opacity-40"
                >
                  <Square size={12} />
                  Cancel mapping
                </button>
              </>
            ) : null}
            {!busy && !(phase === 'failed' && lastFailedKind === 'map_save') ? (
              <button
                type="button"
                onClick={() => {
                  setDismissedId(shown?.id ?? null);
                  setParked(false);
                  setMapName(suggestName(projectSlug));
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-base-700 px-3 py-2 text-[13px] text-ink-200 transition hover:border-ink-400"
              >
                {phase === 'failed' ? 'Start over' : phase === 'saved' ? 'Record another map' : 'Done'}
              </button>
            ) : null}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirm === 'cancel'}
        title="Cancel mapping?"
        body="The map recorded so far is thrown away and nothing changes on the robot."
        confirmLabel="Cancel mapping"
        danger
        onConfirm={async () => {
          setConfirm(null);
          await send('map_cancel');
        }}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'rollback'}
        title={`Switch back to ${robotMap?.previous_map_name?.replace(/\.yaml$/, '') ?? 'the previous map'}?`}
        body="The robot goes back to its previous map and home position, and so does this project. Waypoints placed on that map become usable again, and the ones on the current map are retired until you switch back."
        confirmLabel="Switch back"
        onConfirm={async () => {
          setConfirm(null);
          await send('map_rollback', { project_id: projectId });
        }}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
