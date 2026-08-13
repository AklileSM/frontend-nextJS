'use client';

import type { PointerEvent, ReactNode } from 'react';
import { useCallback, useRef, useState } from 'react';
import type { WheelEvent } from 'react';
import { RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import type { ApiRobotCapturePoint, ApiRobotMap } from '@/types/api';
import { mapPoseToNormalized } from '../_lib/robotMap';
import type { MapMarker } from '../_lib/robotMap';

/**
 * Where to draw a capture point, in 0..1 image coordinates. map_x/map_y are the authoritative
 * Nav2 world pose the robot drives to, so projecting them through the *current* map keeps the
 * pin correct across map replacement, cropping, or re-SLAM. floorplan_x/y is only a fallback
 * for legacy points that predate stored world coordinates.
 */
function capturePointMarker(robotMap: ApiRobotMap, point: ApiRobotCapturePoint): MapMarker | null {
  if (typeof point.map_x === 'number' && typeof point.map_y === 'number') {
    return mapPoseToNormalized(robotMap, { x: point.map_x, y: point.map_y, yaw: point.yaw });
  }
  if (point.floorplan_x !== null && point.floorplan_y !== null) {
    return {
      x: point.floorplan_x,
      y: point.floorplan_y,
      yaw: point.yaw - robotMap.origin_yaw,
    };
  }
  return null;
}

export type Placement = {
  position: MapMarker;
  facing: MapMarker | null;
  locked: boolean;
};

type Props = {
  robotMap: ApiRobotMap;
  capturePoints: ApiRobotCapturePoint[];
  /** Stop number per capture point id, drives the amber numbered pins on the Route tab. */
  stopNumbers?: Map<string, number>;
  onPointClick?: (point: ApiRobotCapturePoint) => void;
  placing?: boolean;
  placement?: Placement | null;
  onPlacementChange?: (placement: Placement) => void;
  /** Overlay drawn on top of the image, e.g. the telemetry canvas. */
  overlay?: ReactNode;
};

const DRAG_THRESHOLD_PX = 3;

/**
 * The map image plus its pins, with zoom/pan and an optional place-and-aim interaction.
 * Planning and watching are the same surface, so both tabs render this rather than each
 * growing their own copy of the map.
 */
export function RobotMapSurface({
  robotMap,
  capturePoints,
  stopNumbers,
  onPointClick,
  placing = false,
  placement = null,
  onPlacementChange,
  overlay,
}: Props) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    panX: number;
    panY: number;
    moved: boolean;
  } | null>(null);

  const reset = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const markerFrom = useCallback((element: HTMLElement, clientX: number, clientY: number): MapMarker => {
    const rect = element.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)),
    };
  }, []);

  const onWheel = useCallback((event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    setZoom((current) => {
      const next = current + (event.deltaY > 0 ? -0.15 : 0.15);
      return Math.min(5, Math.max(0.5, Number(next.toFixed(2))));
    });
  }, []);

  const onPointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      panX: pan.x,
      panY: pan.y,
      moved: false,
    };
    if (!placing || !onPlacementChange) return;
    // A fresh press starts a new point; press-drag-release then aims it in one gesture.
    if (!placement || placement.locked) {
      onPlacementChange({
        position: markerFrom(event.currentTarget, event.clientX, event.clientY),
        facing: null,
        locked: false,
      });
    }
  }, [markerFrom, onPlacementChange, pan.x, pan.y, placement, placing]);

  const onPointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag && drag.pointerId === event.pointerId) {
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (Math.abs(dx) > DRAG_THRESHOLD_PX || Math.abs(dy) > DRAG_THRESHOLD_PX) drag.moved = true;
      if (!placing) {
        setPan({ x: drag.panX + dx, y: drag.panY + dy });
        return;
      }
    }
    if (!placing || !onPlacementChange || !placement || placement.locked) return;
    // Aim follows the pointer until the facing is locked, so the arrow previews live.
    onPlacementChange({
      ...placement,
      facing: markerFrom(event.currentTarget, event.clientX, event.clientY),
    });
  }, [markerFrom, onPlacementChange, placement, placing]);

  const onPointerUp = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!placing || !onPlacementChange || !placement || placement.locked) return;
    // Released after dragging → the aim is deliberate, lock it. A plain click leaves aiming
    // open so the pointer can be moved and clicked again to choose the direction.
    if (drag?.moved) {
      onPlacementChange({
        ...placement,
        facing: markerFrom(event.currentTarget, event.clientX, event.clientY),
        locked: true,
      });
    } else if (placement.facing) {
      onPlacementChange({ ...placement, locked: true });
    }
  }, [markerFrom, onPlacementChange, placement, placing]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-base-800 px-3 py-2">
        <button
          type="button"
          onClick={() => setZoom((c) => Math.max(0.5, Number((c - 0.25).toFixed(2))))}
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-base-700 text-ink-200 transition hover:border-ink-400"
          title="Zoom out"
        >
          <ZoomOut size={13} />
        </button>
        <span className="min-w-12 rounded-lg border border-base-800 bg-base-900 px-2 py-1 text-center font-mono text-[11px] text-ink-200">
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          onClick={() => setZoom((c) => Math.min(5, Number((c + 0.25).toFixed(2))))}
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-base-700 text-ink-200 transition hover:border-ink-400"
          title="Zoom in"
        >
          <ZoomIn size={13} />
        </button>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-1.5 rounded-lg border border-base-700 px-2 py-1 text-[11px] text-ink-200 transition hover:border-ink-400"
        >
          <RotateCcw size={12} />
          Reset
        </button>
        {placing ? (
          <span className="ml-auto rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-200">
            {!placement ? 'Click to place' : placement.locked ? 'Placed' : 'Drag to aim, release to set'}
          </span>
        ) : null}
      </div>

      <div className="relative flex-1 overflow-hidden bg-base-950" onWheel={onWheel}>
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className={`absolute left-1/2 top-1/2 overflow-hidden border border-base-800 bg-base-900 shadow-2xl shadow-black/40 ${
            placing ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'
          }`}
          style={{
            width: 'min(100%, 840px)',
            aspectRatio: `${robotMap.width} / ${robotMap.height}`,
            transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom})`,
            transformOrigin: 'center center',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={robotMap.image_url} alt="" draggable={false} className="h-full w-full select-none" />

          {capturePoints.map((point) => {
            const marker = capturePointMarker(robotMap, point);
            if (!marker) return null;
            const stop = stopNumbers?.get(point.id);
            const selected = stop !== undefined;
            return (
              <div
                key={point.id}
                className={`group absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 ${
                  placing ? 'pointer-events-none opacity-60' : ''
                }`}
                style={{ left: `${marker.x * 100}%`, top: `${marker.y * 100}%` }}
              >
                {marker.yaw !== null && marker.yaw !== undefined ? (
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 32 12"
                    className={`pointer-events-none absolute left-1/2 top-1/2 z-0 h-3 w-8 origin-left overflow-visible drop-shadow-sm ${
                      selected ? 'text-amber-400' : 'text-emerald-400'
                    }`}
                    style={{ transform: `translateY(-50%) rotate(${-marker.yaw}rad)` }}
                  >
                    <path
                      d="M7 6H28M23 1L28 6L23 11"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.25"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : null}
                <button
                  type="button"
                  disabled={placing || !onPointClick}
                  onClick={(event) => {
                    event.stopPropagation();
                    onPointClick?.(point);
                  }}
                  title={point.name}
                  className={`relative z-10 flex h-5 w-5 items-center justify-center rounded-full border border-base-950 text-[10px] font-medium shadow transition ${
                    selected
                      ? 'bg-amber-400 text-base-950'
                      : 'bg-emerald-400 text-transparent group-hover:scale-125'
                  }`}
                >
                  {stop ?? ''}
                </button>
                <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md border border-base-700 bg-base-950 px-2 py-1 text-[11px] text-white opacity-0 shadow-lg shadow-black/40 transition-opacity group-hover:opacity-100">
                  {point.name}
                </span>
              </div>
            );
          })}

          {placement ? (
            <>
              {placement.facing ? (
                <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <defs>
                    <marker id="capture-point-arrowhead" markerWidth="4" markerHeight="4" refX="3.6" refY="2" orient="auto" markerUnits="strokeWidth">
                      <path d="M0,0 L4,2 L0,4 Z" fill="rgb(251 191 36)" />
                    </marker>
                  </defs>
                  <line
                    x1={placement.position.x * 100}
                    y1={placement.position.y * 100}
                    x2={placement.facing.x * 100}
                    y2={placement.facing.y * 100}
                    stroke="rgb(251 191 36)"
                    strokeWidth="0.45"
                    strokeLinecap="round"
                    markerEnd="url(#capture-point-arrowhead)"
                  />
                </svg>
              ) : null}
              <span
                className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-base-950 bg-amber-400 shadow"
                style={{ left: `${placement.position.x * 100}%`, top: `${placement.position.y * 100}%` }}
              />
            </>
          ) : null}

          {overlay}
        </div>
      </div>
    </div>
  );
}
