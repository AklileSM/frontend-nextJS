'use client';

import { useCallback, useEffect, useRef } from 'react';
import { MapPin } from 'lucide-react';
import type { ApiRobotCapturePoint, ApiRobotMap } from '@/types/api';
import { RobotMapSurface } from './RobotMapSurface';
import { mapPoseToNormalized, visibleMarker } from '../_lib/robotMap';
import type { MapMarker } from '../_lib/robotMap';
import { TELEMETRY_STALE_SECONDS } from '../_hooks/useRobotTelemetry';
import type { TelemetryState } from '../_hooks/useRobotTelemetry';
import { formatMissionTime } from '../_lib/missions';

type Props = {
  robotMap: ApiRobotMap | null;
  capturePoints: ApiRobotCapturePoint[];
  telemetry: TelemetryState;
  /** Shown in the degraded banner so the user is pointed at the view that still works. */
  captureRunning: boolean;
  /** From the agent's heartbeat, not telemetry — the two fail independently. */
  robotOnline: boolean;
  robotQuietFor: string;
};

/**
 * Presence and position come from different systems, so a single "stale" state cannot explain
 * what is wrong. Naming which of the two is down is the difference between a one-line answer
 * and reading WebSocket frames by hand.
 */
function degradedNotice({
  status,
  lastUpdate,
  robotOnline,
  robotQuietFor,
  captureRunning,
}: {
  status: TelemetryState['status'];
  lastUpdate: string;
  robotOnline: boolean;
  robotQuietFor: string;
  captureRunning: boolean;
}): { headline: string; detail: string } | null {
  if (status === 'live') return null;

  if (!robotOnline) {
    return {
      headline: `Robot is offline — ${robotQuietFor}.`,
      detail: 'It is not reaching SiteScope at all. New captures will not start until it reconnects.',
    };
  }

  // The robot is talking to us, so the gap is between it and its own navigation stack.
  if (status === 'waiting') {
    return {
      headline: 'Robot is online, but is not reporting its position.',
      detail: captureRunning
        ? 'Its navigation stack may not be running. The capture is still going — Progress has the status.'
        : 'Its navigation stack may not be running. Queued captures are unaffected.',
    };
  }

  return {
    headline: `Robot is online, but its position is behind — last update ${lastUpdate}.`,
    detail: captureRunning
      ? 'The capture is still running — Progress has the current status.'
      : 'Its navigation stack may have stopped publishing a pose.',
  };
}

export function LiveMapTab({
  robotMap,
  capturePoints,
  telemetry,
  captureRunning,
  robotOnline,
  robotQuietFor,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { telemetry: pose, trail, ageSeconds, status } = telemetry;

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

    const robot = mapPoseToNormalized(robotMap, pose.pose);
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

  useEffect(() => {
    const frame = window.requestAnimationFrame(draw);
    return () => window.cancelAnimationFrame(frame);
  }, [draw]);

  const notice = degradedNotice({
    status,
    lastUpdate: formatMissionTime(pose?.received_at_utc ?? pose?.reported_at_utc),
    robotOnline,
    robotQuietFor,
    captureRunning,
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
      {/* The old UI greyed the marker and said nothing, so a robot that had not reported in
        * 17 hours looked identical to one pausing for a second. Say which it is. */}
      {notice ? (
        <div className="mb-4 rounded-2xl border border-amber-500/25 bg-amber-500/5 px-4 py-3">
          <p className="text-[13px] text-amber-100">{notice.headline}</p>
          <p className="mt-1 text-[12px] text-amber-200/70">{notice.detail}</p>
        </div>
      ) : null}

      <div
        className="overflow-hidden rounded-2xl border border-base-800 bg-base-950"
        style={{ height: 'min(60vh, 520px)' }}
      >
        <RobotMapSurface
          robotMap={robotMap}
          capturePoints={capturePoints}
          overlay={<canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-20 h-full w-full" />}
        />
      </div>
    </div>
  );
}
