'use client';

import { useCallback, useEffect, useRef } from 'react';
import { MapPin } from 'lucide-react';
import type { ApiRobotCapturePoint, ApiRobotHomePose, ApiRobotMap } from '@/types/api';
import { RobotMapSurface } from './RobotMapSurface';
import { mapPoseToNormalized, visibleMarker } from '../_lib/robotMap';
import type { MapMarker } from '../_lib/robotMap';
import { TELEMETRY_STALE_SECONDS } from '../_hooks/useRobotTelemetry';
import type { TelemetryState } from '../_hooks/useRobotTelemetry';
import { createPoseTween } from '../_lib/poseTween';
import type { PoseTween } from '../_lib/poseTween';

type Props = {
  robotMap: ApiRobotMap | null;
  capturePoints: ApiRobotCapturePoint[];
  homePose: ApiRobotHomePose | null;
  telemetry: TelemetryState;
  /** Shown in the banner so the user is pointed at the view that still works. */
  captureRunning: boolean;
  /** From the agent's heartbeat, not telemetry, the two fail independently. */
  robotOnline: boolean;
  robotQuietFor: string;
  /** Whether the robot's ROS stack has been connected from the UI. No pose is expected until it is. */
  connected: boolean;
};

type NoticeTone = 'ready' | 'warn' | 'muted';

/**
 * Presence, connection, and live position come from three different systems, so a single "stale"
 * state cannot explain what the user is seeing. The live position only exists once the robot is
 * connected, so an online-but-not-connected robot is a normal, positive state, not a fault.
 */
function statusNotice({
  status,
  robotOnline,
  robotQuietFor,
  captureRunning,
  connected,
}: {
  status: TelemetryState['status'];
  robotOnline: boolean;
  robotQuietFor: string;
  captureRunning: boolean;
  connected: boolean;
}): { headline: string; detail: string; tone: NoticeTone } | null {
  if (status === 'live') return null;

  if (!robotOnline) {
    return {
      tone: 'muted',
      headline: `Robot is offline, ${robotQuietFor}.`,
      detail: 'It is not reaching SiteScope. Captures will not start until it comes back online.',
    };
  }

  // Online but not connected: the live position simply doesn't exist yet. This is the normal
  // resting state, so keep it positive and point at the one action that fixes it.
  if (!connected) {
    return {
      tone: 'ready',
      headline: 'Robot is online and ready to connect.',
      detail: 'Connect the robot to see its live position and start a capture.',
    };
  }

  // Connected, so a pose should be arriving but isn't (yet), a genuine, but recoverable, gap.
  return {
    tone: 'warn',
    headline: 'Robot is online, but its live position hasn’t updated recently.',
    detail: captureRunning
      ? 'The capture is still running, Progress has the current status.'
      : 'This usually clears on its own. If it lingers, reconnect the robot.',
  };
}

const NOTICE_STYLES: Record<NoticeTone, { box: string; headline: string; detail: string }> = {
  ready: {
    box: 'border-emerald-500/25 bg-emerald-500/5',
    headline: 'text-emerald-100',
    detail: 'text-emerald-200/70',
  },
  warn: {
    box: 'border-amber-500/25 bg-amber-500/5',
    headline: 'text-amber-100',
    detail: 'text-amber-200/70',
  },
  muted: {
    box: 'border-base-700 bg-base-900/60',
    headline: 'text-ink-200',
    detail: 'text-ink-400',
  },
};

export function LiveMapTab({
  robotMap,
  capturePoints,
  homePose,
  telemetry,
  captureRunning,
  robotOnline,
  robotQuietFor,
  connected,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { telemetry: pose, trail, ageSeconds, status } = telemetry;

  /* Frames go into a delayed-interpolation buffer, timestamped on arrival; the render
   * loop below reads a smoothed pose out of it every animation frame. */
  const tweenRef = useRef<PoseTween | null>(null);
  if (tweenRef.current === null) tweenRef.current = createPoseTween();

  useEffect(() => {
    if (!pose) {
      tweenRef.current?.clear();
      return;
    }
    tweenRef.current?.push({
      x: pose.pose.x,
      y: pose.pose.y,
      z: pose.pose.z,
      yaw: pose.pose.yaw ?? null,
    });
  }, [pose]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !robotMap) return;

    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    const dpr = window.devicePixelRatio || 1;
    const pixelWidth = Math.round(width * dpr);
    const pixelHeight = Math.round(height * dpr);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    if (!pose) return;

    const toCanvas = (marker: MapMarker) => ({ x: marker.x * width, y: marker.y * height });
    const drawPolyline = (markers: MapMarker[], stroke: string, lineWidth: number, alpha: number) => {
      const points = markers.filter(visibleMarker);
      if (points.length < 2) return;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      points.forEach((marker, index) => {
        const point = toCanvas(marker);
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.stroke();
      ctx.restore();
    };

    drawPolyline(pose.global_path.map((p) => mapPoseToNormalized(robotMap, p)), 'rgb(34 211 238)', 2, 0.75);
    drawPolyline(pose.local_path.map((p) => mapPoseToNormalized(robotMap, p)), 'rgb(251 191 36)', 2.5, 0.88);
    drawPolyline(trail.map((p) => mapPoseToNormalized(robotMap, p)), 'rgb(255 255 255)', 1.6, 0.78);

    if (pose.goal) {
      const goal = mapPoseToNormalized(robotMap, pose.goal);
      if (visibleMarker(goal)) {
        const point = toCanvas(goal);
        ctx.save();
        ctx.fillStyle = 'rgba(34, 211, 238, 0.18)';
        ctx.strokeStyle = 'rgb(165 243 252)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(point.x, point.y, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }

    // Marker from the smoothed pose; paths, goal, and trail from the raw frame above.
    const smoothed = tweenRef.current?.sample() ?? null;
    const robot = mapPoseToNormalized(robotMap, smoothed ?? pose.pose);
    if (!visibleMarker(robot)) return;
    const point = toCanvas(robot);
    const fresh = ageSeconds !== null && ageSeconds <= TELEMETRY_STALE_SECONDS;

    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.rotate(-(robot.yaw ?? 0));
    ctx.fillStyle = 'rgba(2, 6, 23, 0.94)';
    ctx.strokeStyle = fresh ? 'rgb(252 211 77)' : 'rgb(100 116 139)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = fresh ? 'rgb(252 211 77)' : 'rgb(148 163 184)';
    ctx.beginPath();
    ctx.moveTo(11, 0);
    ctx.lineTo(-5, -7);
    ctx.lineTo(-5, 7);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgb(255 255 255)';
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }, [ageSeconds, pose, robotMap, trail]);

  /* Continuous render loop: interpolation means there is something new to draw on every
   * animation frame, not just when a network frame lands. The ref indirection keeps the
   * loop itself mounted once instead of restarting per state change. */
  const drawRef = useRef(draw);
  useEffect(() => {
    drawRef.current = draw;
  }, [draw]);

  useEffect(() => {
    let frame = 0;
    const loop = () => {
      drawRef.current();
      frame = window.requestAnimationFrame(loop);
    };
    frame = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const notice = statusNotice({
    status,
    robotOnline,
    robotQuietFor,
    captureRunning,
    connected,
  });

  if (!robotMap) {
    return (
      <div className="rounded-2xl border border-dashed border-base-700 px-4 py-14 text-center">
        <MapPin size={18} className="mx-auto text-ink-500" />
        <p className="mt-2 text-[14px] text-ink-300">No map for this project yet.</p>
        <p className="mt-1 text-[13px] text-ink-500">Add one under project settings → Setup.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Presence, connection, and live pose are three separate systems, the banner names the
        * one that explains what the user sees, and stays positive when nothing is actually wrong. */}
      {notice ? (
        <div className={`mb-4 rounded-2xl border px-4 py-3 ${NOTICE_STYLES[notice.tone].box}`}>
          <p className={`text-[13px] ${NOTICE_STYLES[notice.tone].headline}`}>{notice.headline}</p>
          <p className={`mt-1 text-[12px] ${NOTICE_STYLES[notice.tone].detail}`}>{notice.detail}</p>
        </div>
      ) : null}

      <div
        className="overflow-hidden rounded-2xl border border-base-800 bg-base-950"
        style={{ height: 'min(60vh, 520px)' }}
      >
        <RobotMapSurface
          robotMap={robotMap}
          capturePoints={capturePoints}
          homePose={homePose}
          overlay={<canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-20 h-full w-full" />}
        />
      </div>
    </div>
  );
}
