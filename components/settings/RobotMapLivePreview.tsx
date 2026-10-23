'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Home, Loader2 } from 'lucide-react';
import { getRobotMapPreview } from '@/services/apiClient';
import { RobotMapSurface } from '@/app/app/robots/_components/RobotMapSurface';
import { mapPoseToNormalized, parseUtcTimestamp, visibleMarker } from '@/app/app/robots/_lib/robotMap';
import type { MapMarker } from '@/app/app/robots/_lib/robotMap';
import type { ApiRobotMap, ApiRobotMapPreview } from '@/types/api';

const POLL_MS = 1000;
/** Past this the laptop has gone quiet: say so instead of showing a frozen robot as live. */
const STALE_SECONDS = 10;
/** Close enough to the start to save: the home pose is taken from wherever the robot stands. */
const HOME_DISTANCE_M = 0.3;
const HOME_HEADING_DEG = 15;

function headingDifference(a: number, b: number): number {
  const degrees = (((a - b) * 180) / Math.PI) % 360;
  return Math.abs(((degrees + 540) % 360) - 180);
}

/**
 * The map SLAM is building, live, while someone drives the robot: the robot, the path it has
 * driven, and the home marker it has to come back to before the map is saved.
 */
export function RobotMapLivePreview({ robotId, since }: { robotId: string; since: number | null }) {
  const [preview, setPreview] = useState<ApiRobotMapPreview | null>(null);
  const [image, setImage] = useState<{ seq: number; url: string } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageSeq = useRef<number | undefined>(undefined);

  useEffect(() => {
    let stopped = false;
    const poll = async () => {
      try {
        const next = await getRobotMapPreview(robotId, imageSeq.current);
        if (stopped) return;
        // A frame from an earlier mapping run is not this map.
        const startedAt = parseUtcTimestamp(next?.started_at_utc);
        const current = next && (since === null || startedAt === null || startedAt >= since - 5000) ? next : null;
        setPreview(current);
        if (current?.map?.image) {
          imageSeq.current = current.map.seq;
          setImage({ seq: current.map.seq, url: current.map.image });
        } else if (!current?.map) {
          imageSeq.current = undefined;
          setImage(null);
        }
      } catch {
        // A missed poll keeps the last frame; the age readout shows it going stale.
      } finally {
        if (!stopped) setNow(Date.now());
      }
    };
    void poll();
    const timer = setInterval(() => void poll(), POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [robotId, since]);

  const robotMap = useMemo<ApiRobotMap | null>(() => {
    const map = preview?.map;
    if (!map || !image) return null;
    return {
      image_url: image.url,
      width: map.width,
      height: map.height,
      resolution: map.resolution,
      origin_x: map.origin_x,
      origin_y: map.origin_y,
      origin_yaw: 0,
      frame: 'map',
      yaml_object_name: null,
      image_object_name: null,
    };
  }, [image, preview?.map]);

  const updatedAt = parseUtcTimestamp(preview?.updated_at_utc);
  const ageSeconds = updatedAt === null ? null : Math.max(0, Math.round((now - updatedAt) / 1000));
  const stale = ageSeconds !== null && ageSeconds > STALE_SECONDS;
  const pose = preview?.pose ?? null;
  const home = preview?.home ?? null;
  const fromHome = pose && home ? Math.hypot(pose.x - home.x, pose.y - home.y) : null;
  const turn = pose?.yaw != null && home?.yaw != null ? headingDifference(pose.yaw, home.yaw) : null;
  const atHome = fromHome !== null && fromHome <= HOME_DISTANCE_M && (turn === null || turn <= HOME_HEADING_DEG);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !robotMap || !preview) return;
    // Size from the untransformed box and zoom from the rect, as on the Live map tab.
    const rect = canvas.getBoundingClientRect();
    const layoutWidth = Math.max(1, canvas.offsetWidth);
    const layoutHeight = Math.max(1, canvas.offsetHeight);
    const screenScale = Math.sqrt((rect.width * rect.height) / (layoutWidth * layoutHeight)) || 1;
    const width = layoutWidth * screenScale;
    const height = layoutHeight * screenScale;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const toCanvas = (marker: MapMarker) => ({ x: marker.x * width, y: marker.y * height });

    const trail = preview.trail.map((point) => mapPoseToNormalized(robotMap, point)).filter(visibleMarker);
    if (trail.length > 1) {
      ctx.save();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      trail.forEach((marker, index) => {
        const point = toCanvas(marker);
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.stroke();
      ctx.restore();
    }

    if (home) {
      const marker = mapPoseToNormalized(robotMap, home);
      if (visibleMarker(marker)) {
        const point = toCanvas(marker);
        ctx.save();
        ctx.translate(point.x, point.y);
        ctx.fillStyle = 'rgba(52, 211, 153, 0.18)';
        ctx.strokeStyle = 'rgb(52 211 153)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.arc(0, 0, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
        // The way the robot faced at the start, which it should face again when parked.
        ctx.rotate(-(marker.yaw ?? 0));
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(20, 0);
        ctx.stroke();
        ctx.restore();
      }
    }

    if (pose) {
      const marker = mapPoseToNormalized(robotMap, pose);
      if (visibleMarker(marker)) {
        const point = toCanvas(marker);
        ctx.save();
        ctx.translate(point.x, point.y);
        ctx.rotate(-(marker.yaw ?? 0));
        ctx.fillStyle = 'rgba(2, 6, 23, 0.94)';
        ctx.strokeStyle = stale ? 'rgb(100 116 139)' : 'rgb(252 211 77)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = stale ? 'rgb(148 163 184)' : 'rgb(252 211 77)';
        ctx.beginPath();
        ctx.moveTo(9, 0);
        ctx.lineTo(-4, -6);
        ctx.lineTo(-4, 6);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
  }, [home, pose, preview, robotMap, stale]);

  // Redraw every frame: zoom and pan change the canvas size without changing any state here.
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

  if (!robotMap || !preview) {
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-base-700 text-center">
        <Loader2 size={16} className="animate-spin text-ink-500" />
        <p className="text-[13px] text-ink-300">Waiting for the first picture of the map…</p>
        <p className="max-w-sm text-[12px] text-ink-500">
          It appears a few seconds after the robot starts moving. If it never does, check
          sitescope-map-preview on the laptop.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-400">
        {preview.map?.mapped_area_m2 != null ? (
          <span><span className="font-mono text-ink-200">{Math.round(preview.map.mapped_area_m2)}</span> m² mapped</span>
        ) : null}
        <span><span className="font-mono text-ink-200">{preview.distance_m.toFixed(1)}</span> m driven</span>
        {fromHome !== null ? (
          atHome ? (
            <span className="inline-flex items-center gap-1 text-emerald-300">
              <Home size={12} />
              At home: ready to save
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <Home size={12} className="text-emerald-400" />
              <span className="font-mono text-ink-200">{fromHome.toFixed(1)}</span> m from home
              {turn !== null && turn > HOME_HEADING_DEG ? <>, turned <span className="font-mono text-ink-200">{Math.round(turn)}°</span></> : null}
            </span>
          )
        ) : null}
        <span className={`ml-auto ${stale ? 'text-amber-300' : ''}`}>
          {stale ? `No update for ${ageSeconds} s` : 'Live'}
        </span>
      </div>
      <div className="overflow-hidden rounded-lg border border-base-800 bg-base-950" style={{ height: 'min(55vh, 460px)' }}>
        <RobotMapSurface
          robotMap={robotMap}
          capturePoints={[]}
          overlay={<canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-20 h-full w-full" />}
        />
      </div>
      <p className="text-[12px] text-ink-500">
        The picture updates every few seconds. Grey is unexplored, black is a wall; the dashed green
        circle is home, where the robot has to be, facing the green line, when you save.
      </p>
    </div>
  );
}
