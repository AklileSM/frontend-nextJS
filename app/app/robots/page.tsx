'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Bot } from 'lucide-react';
import { toast } from 'sonner';
import {
  cancelRobotMission,
  createRobotMission,
  deleteRobotMission,
  getRobotMap,
  listProjects,
  listRobotCapturePoints,
} from '@/services/apiClient';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Tabs } from '@/components/ui/Tabs';
import type { ApiProject, ApiRobotCapturePoint, ApiRobotMap, ApiRobotMission } from '@/types/api';
import { RobotContextBar } from './_components/RobotContextBar';
import { ConnectControl } from './_components/ConnectControl';
import { RouteTab } from './_components/RouteTab';
import { ProgressTab } from './_components/ProgressTab';
import { LiveMapTab } from './_components/LiveMapTab';
import { HistoryTab } from './_components/HistoryTab';
import { SchedulesTab } from './_components/SchedulesTab';
import { useRobotMissions } from './_hooks/useRobotMissions';
import { useRobotTelemetry } from './_hooks/useRobotTelemetry';
import { useRobotConnection } from './_hooks/useRobotConnection';
import { deriveConnection } from './_lib/connection';
import { isActiveMissionStatus, routeSummary } from './_lib/missions';
import type { CaptureOutput } from './_lib/missions';
import { formatQuietFor, robotPresence } from './_lib/presence';

export const dynamic = 'force-dynamic';

type TabId = 'route' | 'schedules' | 'progress' | 'live' | 'history';

const TABS = [
  { id: 'route', label: 'Route' },
  { id: 'schedules', label: 'Schedules' },
  { id: 'progress', label: 'Progress' },
  { id: 'live', label: 'Live map' },
  { id: 'history', label: 'History' },
] as const satisfies readonly { id: TabId; label: string }[];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function RobotPage() {
  const { robots, missions, activeMission, loading, refresh } = useRobotMissions();
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [projectSlug, setProjectSlug] = useState('');
  const [robotId, setRobotId] = useState('');
  const [tab, setTab] = useState<TabId>('route');
  const [capturePoints, setCapturePoints] = useState<ApiRobotCapturePoint[]>([]);
  const [robotMap, setRobotMap] = useState<ApiRobotMap | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [captureOutputs, setCaptureOutputs] = useState<CaptureOutput[]>(['image']);
  const [continueOnFailure, setContinueOnFailure] = useState(false);
  const [starting, startCapture] = useTransition();
  const [pending, setPending] = useState<{ type: 'cancel' | 'delete'; mission: ApiRobotMission } | null>(null);

  // Live position only connects while its tab is on screen, most sessions never open it.
  const telemetry = useRobotTelemetry(robotId, tab === 'live');

  // One-click connect/disconnect for the robot's ROS stack (localization + navigation).
  const connection = useRobotConnection(robotId);

  useEffect(() => {
    listProjects()
      .then((data) => {
        setProjects(data);
        setProjectSlug((current) => current || data[0]?.slug || '');
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Could not load projects'));
  }, []);

  useEffect(() => {
    setRobotId((current) => current || robots[0]?.username || '');
  }, [robots]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.slug === projectSlug) ?? null,
    [projectSlug, projects],
  );
  const projectId = selectedProject?.id ?? null;

  const loadCapturePoints = useCallback(() => {
    if (!projectId) return;
    listRobotCapturePoints(projectId)
      .then((points) => {
        setCapturePoints(points);
        setSelectedIds((current) => current.filter((id) => points.some((point) => point.id === id)));
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Could not load capture points'));
  }, [projectId]);

  useEffect(() => {
    if (!projectId) {
      setCapturePoints([]);
      setSelectedIds([]);
      setRobotMap(null);
      return;
    }
    loadCapturePoints();
    getRobotMap(projectId)
      .then(setRobotMap)
      .catch(() => setRobotMap(null));
  }, [loadCapturePoints, projectId]);

  /* A capture that belongs to another robot or project should not drive this view. */
  const currentMission = useMemo(() => {
    if (!activeMission) return null;
    if (robotId && activeMission.robot_id !== robotId) return null;
    if (projectSlug && activeMission.project_slug !== projectSlug) return null;
    return activeMission;
  }, [activeMission, projectSlug, robotId]);

  /* Recomputed whenever the mission poll refreshes `robots`, which carries last_seen_at. */
  const presence = useMemo(
    () => robotPresence(robots.find((candidate) => candidate.username === robotId) ?? null, Date.now()),
    [robotId, robots],
  );

  /* "Connected" is the latest command's latched state AND a live heartbeat: the command never
   * expires on its own, so a powered-off robot would otherwise read as connected forever. This is
   * the immediate UX fix; making the stored state itself expire is the follow-up (backend reaper). */
  const isConnected = deriveConnection(connection.command).connection === 'connected' && presence.online;

  const visibleMissions = useMemo(
    () => missions.filter((mission) => (
      (!projectSlug || mission.project_slug === projectSlug)
      && (!robotId || mission.robot_id === robotId)
    )),
    [missions, projectSlug, robotId],
  );

  const toggleStop = useCallback((pointId: string) => {
    setSelectedIds((current) => (
      current.includes(pointId) ? current.filter((id) => id !== pointId) : [...current, pointId]
    ));
  }, []);

  const handleStart = useCallback(() => {
    if (!robotId || !projectSlug) {
      toast.error('Pick a project and a robot first');
      return;
    }
    if (selectedIds.length === 0) {
      toast.error('Add at least one stop to the route');
      return;
    }
    if (!isConnected) {
      toast.error('Connect the robot before starting a capture');
      return;
    }
    startCapture(() => {
      createRobotMission({
        robot_id: robotId,
        project_slug: projectSlug,
        capture_point_ids: selectedIds,
        capture_mode: captureOutputs.includes('image') ? 'panorama' : 'pointcloud',
        capture_date: todayIso(),
        retry_policy: { continue_on_failure: continueOnFailure },
        robot_meta: { capture_outputs: captureOutputs },
      })
        .then((mission) => {
          toast.success(`Capture started, ${routeSummary(mission)}`);
          setSelectedIds([]);
          setTab('progress');
          return refresh();
        })
        .catch((err) => toast.error(err instanceof Error ? err.message : 'Could not start the capture'));
    });
  }, [captureOutputs, continueOnFailure, isConnected, projectSlug, refresh, robotId, selectedIds]);

  // Follow the robot into Progress when a capture starts, since that is the view that works.
  useEffect(() => {
    if (currentMission && tab === 'route' && selectedIds.length === 0) setTab('progress');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMission?.id]);

  const runPending = useCallback(async () => {
    if (!pending) return;
    try {
      if (pending.type === 'cancel') {
        const mission = await cancelRobotMission(pending.mission.id);
        toast.success(
          mission.status === 'cancelled'
            ? 'Queued task cancelled'
            : 'Cancellation requested — the robot will return to start',
        );
      } else {
        await deleteRobotMission(pending.mission.id);
        toast.success('Capture deleted');
      }
      setPending(null);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'That did not work');
    }
  }, [pending, refresh]);

  return (
    <div className="px-6 py-10 sm:px-10 lg:px-12 xl:px-16">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"
      >
        <div>
          <p className="font-mono text-[12px] uppercase tracking-[0.22em] text-amber-500">Operations</p>
          <h1 className="mt-3 font-display text-[36px] font-semibold tracking-tight text-white">Robot</h1>
          <p className="mt-2 max-w-2xl text-[14px] text-ink-300">
            Send the robot to capture points around the site and watch its progress.
          </p>
        </div>
        <Link
          href="/app/robots/pairing"
          className="inline-flex shrink-0 items-center gap-2 rounded border border-base-700 px-3 py-2 text-[12px] text-white transition hover:border-ink-400"
        >
          <Bot size={14} />
          Pair robot
        </Link>
      </motion.section>

      <div className="mt-6">
        <RobotContextBar
          projects={projects}
          projectSlug={projectSlug}
          onProjectChange={setProjectSlug}
          robots={robots}
          robotId={robotId}
          onRobotChange={setRobotId}
          activeMission={currentMission}
        />
      </div>

      {robotId ? (
        <div className="mt-3">
          <ConnectControl
            robotId={robotId}
            command={connection.command}
            robotOnline={presence.online}
            submitting={connection.submitting}
            error={connection.error}
            timedOut={connection.timedOut}
            onConnect={connection.connect}
            onDisconnect={connection.disconnect}
            onCancel={connection.cancel}
            onRetry={connection.retry}
          />
        </div>
      ) : null}

      <div className="mt-6">
        <Tabs tabs={TABS} active={tab} onChange={setTab} railId="robot-tabs" />
      </div>

      <div className="mt-6">
        {loading ? (
          <div className="h-64 animate-pulse rounded-2xl border border-base-800 bg-base-900/50" />
        ) : tab === 'route' ? (
          <RouteTab
            projectId={projectId}
            projectSlug={projectSlug}
            robotMap={robotMap}
            capturePoints={capturePoints}
            selectedIds={selectedIds}
            onToggle={toggleStop}
            captureOutputs={captureOutputs}
            onCaptureOutputsChange={setCaptureOutputs}
            continueOnFailure={continueOnFailure}
            onContinueOnFailureChange={setContinueOnFailure}
            onStart={handleStart}
            starting={starting}
            connected={isConnected}
            onCapturePointsChanged={loadCapturePoints}
          />
        ) : tab === 'schedules' ? (
          <SchedulesTab
            projectSlug={projectSlug}
            robotId={robotId}
            capturePoints={capturePoints}
            onMissionQueued={() => {
              void refresh();
              setTab('progress');
            }}
          />
        ) : tab === 'progress' ? (
          <ProgressTab
            mission={currentMission ?? visibleMissions[0] ?? null}
            onCancel={(mission) => setPending({ type: 'cancel', mission })}
          />
        ) : tab === 'live' ? (
          <LiveMapTab
            robotMap={robotMap}
            capturePoints={capturePoints}
            telemetry={telemetry}
            captureRunning={Boolean(currentMission && isActiveMissionStatus(currentMission.status))}
            robotOnline={presence.online}
            robotQuietFor={formatQuietFor(presence.ageSeconds)}
            connected={isConnected}
          />
        ) : (
          <HistoryTab
            missions={visibleMissions}
            onDelete={(mission) => setPending({ type: 'delete', mission })}
          />
        )}
      </div>

      <ConfirmDialog
        open={!!pending}
        title={pending?.type === 'delete' ? 'Delete this capture?' : 'Cancel and return?'}
        body={
          pending?.type === 'delete'
            ? <>The record for <strong>{pending ? routeSummary(pending.mission) : ''}</strong> will be removed. Any files it already uploaded are kept.</>
            : <>The robot will stop its current navigation, skip the remaining stops, and return to its starting position. Captures already uploaded are kept.</>
        }
        confirmLabel={pending?.type === 'delete' ? 'Delete' : 'Cancel and return'}
        danger={pending?.type === 'delete'}
        onConfirm={runPending}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
