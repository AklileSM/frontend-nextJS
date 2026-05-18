'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Check, MapPin, PenLine, Pencil, X } from 'lucide-react';
import { updateRoom } from '@/services/apiClient';
import {
  isPolygonCoords,
  isPinCoords,
  isRectCoords,
  type ApiRoom,
  type FloorPlanCoordinates,
  type Point,
  type PolygonCoordinates,
  type PinCoordinates,
  type RectCoordinates,
} from '@/types/api';

type Mode = 'polygon' | 'pin';

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function pct(px: number, total: number) {
  return (px / total) * 100;
}

function toSvgPoints(points: Point[]): string {
  return points.map((p) => `${p.x},${p.y}`).join(' ');
}

function centroid(points: Point[]): Point {
  return {
    x: points.reduce((s, p) => s + p.x, 0) / points.length,
    y: points.reduce((s, p) => s + p.y, 0) / points.length,
  };
}

function controlsAnchor(c: FloorPlanCoordinates): Point {
  if (isPolygonCoords(c)) return centroid(c.points);
  if (isPinCoords(c))     return { x: c.x, y: c.y - 8 };
  return { x: c.x + c.width / 2, y: c.y + c.height / 2 };
}

function RoomPicker({
  rooms,
  defaultRoomId,
  anchor,
  onAssign,
  onDiscard,
}: {
  rooms: ApiRoom[];
  defaultRoomId?: string;
  anchor: Point;
  onAssign: (roomId: string) => void;
  onDiscard: () => void;
}) {
  const [selected, setSelected] = useState(defaultRoomId ?? rooms[0]?.id ?? '');

  return (
    <div
      style={{
        position: 'absolute',
        left: `${clamp(anchor.x, 5, 72)}%`,
        top: `${clamp(anchor.y + 3, 2, 82)}%`,
        zIndex: 20,
      }}
      className="w-52 rounded-lg border border-base-700 bg-base-900 p-3 shadow-xl"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-400">
        Assign room
      </p>
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="w-full rounded-md border border-base-700 bg-base-950 px-2 py-1.5 text-[13px] text-white outline-none focus:border-amber-500"
      >
        {rooms.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => onAssign(selected)}
          disabled={!selected}
          className="flex items-center gap-1.5 rounded-md bg-amber-500 px-3 py-1.5 text-[12px] font-semibold text-base-950 hover:bg-amber-400 disabled:opacity-40"
        >
          <Check size={12} />
          Assign
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className="rounded-md border border-base-700 px-3 py-1.5 text-[12px] text-white hover:border-ink-300"
        >
          Discard
        </button>
      </div>
    </div>
  );
}


function ZoneControls({
  room,
  anchor,
  onRedraw,
  onClear,
  onClose,
}: {
  room: ApiRoom;
  anchor: Point;
  onRedraw: () => void;
  onClear: () => void;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        left: `${clamp(anchor.x, 5, 78)}%`,
        top: `${clamp(anchor.y, 5, 88)}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: 15,
      }}
      className="flex items-center gap-1 rounded-md border border-base-700 bg-base-900 px-2 py-1.5 shadow-lg"
      onClick={(e) => e.stopPropagation()}
    >
      <span className="mr-1 font-mono text-[11px] text-amber-300">{room.name}</span>
      <button
        type="button"
        onClick={() => { onClose(); onRedraw(); }}
        aria-label="Redraw"
        title="Redraw"
        className="flex h-6 w-6 items-center justify-center rounded text-ink-400 transition-colors hover:bg-base-800 hover:text-amber-400"
      >
        <Pencil size={11} />
      </button>
      <button
        type="button"
        onClick={() => { onClose(); onClear(); }}
        aria-label="Delete"
        title="Delete"
        className="flex h-6 w-6 items-center justify-center rounded text-ink-400 transition-colors hover:bg-base-800 hover:text-red-400"
      >
        <X size={11} />
      </button>
    </div>
  );
}


function RectZone({
  room,
  coords,
  onSelect,
}: {
  room: ApiRoom;
  coords: RectCoordinates;
  onSelect: () => void;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        left: `${coords.x}%`,
        top: `${coords.y}%`,
        width: `${coords.width}%`,
        height: `${coords.height}%`,
      }}
      className="cursor-pointer"
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
    >
      <div className="relative h-full w-full rounded border-2 border-amber-500/70 bg-amber-500/10 hover:bg-amber-500/20 transition-colors">
        <span className="absolute left-1 top-1 max-w-[calc(100%-4px)] truncate rounded bg-base-950/80 px-1.5 py-0.5 font-mono text-[10px] font-medium text-amber-300">
          {room.name}
        </span>
      </div>
    </div>
  );
}


export function HotspotEditor({
  projectId,
  floorplanUrl,
  rooms,
  onRoomUpdated,
}: {
  projectId: string;
  floorplanUrl: string;
  rooms: ApiRoom[];
  onRoomUpdated: (room: ApiRoom) => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);

  const [mode, setMode] = useState<Mode>('polygon');
  const [polyPoints, setPolyPoints] = useState<Point[]>([]);
  const [mousePos, setMousePos] = useState<Point | null>(null);
  const [pendingCoords, setPendingCoords] = useState<FloorPlanCoordinates | null>(null);
  const [pendingAnchor, setPendingAnchor] = useState<Point | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [redrawingRoomId, setRedrawingRoomId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const unassigned = rooms.filter((r) => !r.floor_plan_coordinates || r.id === redrawingRoomId);
  const assigned   = rooms.filter((r) => r.floor_plan_coordinates && r.id !== redrawingRoomId);

  const nearFirstVertex = useMemo(() => {
    if (polyPoints.length < 3 || !mousePos) return false;
    const first = polyPoints[0];
    return Math.hypot(mousePos.x - first.x, mousePos.y - first.y) < 3;
  }, [polyPoints, mousePos]);

  const isInteracting = polyPoints.length > 0 || !!pendingCoords;


  const getRelativePos = useCallback((e: { clientX: number; clientY: number }): Point | null => {
    const el = overlayRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return {
      x: clamp(pct(e.clientX - rect.left, rect.width), 0, 100),
      y: clamp(pct(e.clientY - rect.top, rect.height), 0, 100),
    };
  }, []);

  const switchMode = (newMode: Mode) => {
    setMode(newMode);
    setPolyPoints([]);
    setMousePos(null);
    setPendingCoords(null);
    setPendingAnchor(null);
    setSelectedZoneId(null);
  };

  const closePolygon = useCallback((pts: Point[]) => {
    if (pts.length < 3) return;
    const coords: PolygonCoordinates = { type: 'polygon', points: pts };
    setPendingCoords(coords);
    setPendingAnchor(centroid(pts));
    setPolyPoints([]);
    setMousePos(null);
  }, []);

  const discard = useCallback(() => {
    setPolyPoints([]);
    setMousePos(null);
    setPendingCoords(null);
    setPendingAnchor(null);
    setRedrawingRoomId(null);
    setSelectedZoneId(null);
  }, []);


  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') discard();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [discard]);


  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (pendingCoords) return;
      if ((e.target as HTMLElement).closest('button, select, [data-nopropagate]')) return;
      setSelectedZoneId(null);

      const pos = getRelativePos(e);
      if (!pos) return;

      if (mode === 'pin') {
        const coords: PinCoordinates = { type: 'pin', x: pos.x, y: pos.y };
        setPendingCoords(coords);
        setPendingAnchor({ x: pos.x, y: pos.y + 5 });
        return;
      }

      // Polygon mode
      if (nearFirstVertex) {
        closePolygon(polyPoints);
        return;
      }
      setPolyPoints((prev) => [...prev, pos]);
    },
    [mode, pendingCoords, polyPoints, nearFirstVertex, getRelativePos, closePolygon],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (pendingCoords || mode === 'pin') return;
      const pos = getRelativePos(e);
      if (pos) setMousePos(pos);
    },
    [pendingCoords, mode, getRelativePos],
  );

  const handleMouseLeave = useCallback(() => setMousePos(null), []);


  const handleAssign = async (roomId: string) => {
    if (!pendingCoords) return;
    const room = rooms.find((r) => r.id === roomId);
    if (!room) return;
    setSaving(true);
    try {
      const updated = await updateRoom(projectId, roomId, { floor_plan_coordinates: pendingCoords });
      onRoomUpdated(updated);
      setPendingCoords(null);
      setPendingAnchor(null);
      setRedrawingRoomId(null);
      toast.success(`Hotspot set for "${room.name}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save hotspot');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async (room: ApiRoom) => {
    try {
      const updated = await updateRoom(projectId, room.id, { floor_plan_coordinates: null });
      onRoomUpdated(updated);
      toast.success(`Hotspot removed for "${room.name}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to clear hotspot');
    }
  };

  const handleRedraw = (room: ApiRoom) => {
    setRedrawingRoomId(room.id);
    setSelectedZoneId(null);
  };


  const cursor =
    pendingCoords ? 'cursor-default'
    : mode === 'pin' ? 'cursor-crosshair'
    : polyPoints.length === 0 ? 'cursor-crosshair'
    : nearFirstVertex ? 'cursor-pointer'
    : 'cursor-crosshair';


  const hint = redrawingRoomId
    ? `Redrawing ${rooms.find((r) => r.id === redrawingRoomId)?.name ?? ''}, `
    : '';

  const modeHint =
    mode === 'pin'
      ? 'Click to drop a pin.'
      : polyPoints.length === 0
      ? 'Click to start a polygon.'
      : polyPoints.length < 3
      ? `${polyPoints.length} point${polyPoints.length > 1 ? 's' : ''} placed, keep clicking.`
      : nearFirstVertex
      ? 'Click to close the polygon.'
      : 'Click the first point to close, or keep adding vertices.';


  return (
    <div className="space-y-3">
      {/* Mode toggle + hint */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-0.5 rounded-md border border-base-700 bg-base-950 p-0.5">
          <button
            type="button"
            onClick={() => switchMode('polygon')}
            className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-[12px] font-medium transition-colors ${
              mode === 'polygon' ? 'bg-amber-500 text-base-950' : 'text-ink-300 hover:text-white'
            }`}
          >
            <PenLine size={13} />
            Zone
          </button>
          <button
            type="button"
            onClick={() => switchMode('pin')}
            className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-[12px] font-medium transition-colors ${
              mode === 'pin' ? 'bg-amber-500 text-base-950' : 'text-ink-300 hover:text-white'
            }`}
          >
            <MapPin size={13} />
            Pin
          </button>
        </div>

        <p className="text-[12px] text-ink-400">
          {hint}
          {pendingCoords ? 'Assign a room to this hotspot.' : modeHint}
          {polyPoints.length > 0 && !pendingCoords && (
            <button
              type="button"
              onClick={discard}
              className="ml-2 text-ink-500 underline hover:text-white"
            >
              cancel
            </button>
          )}
          {redrawingRoomId && !pendingCoords && polyPoints.length === 0 && (
            <button
              type="button"
              onClick={discard}
              className="ml-2 text-ink-500 underline hover:text-white"
            >
              cancel
            </button>
          )}
        </p>
      </div>

      {!redrawingRoomId && unassigned.length > 0 && (
        <p className="font-mono text-[11px] text-ink-400">
          Without a hotspot: {unassigned.map((r) => r.name).join(', ')}
        </p>
      )}

      {/* Outer wrapper, relative but NOT overflow-hidden so popovers can escape */}
      <div className="relative select-none">
        <div className="overflow-hidden rounded-lg border border-base-800 bg-base-950">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={floorplanUrl} alt="Floorplan" draggable={false} className="block h-auto w-full" />
        </div>

        {/* Interaction overlay */}
        <div
          ref={overlayRef}
          onClick={handleOverlayClick}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className={`absolute inset-0 ${cursor}`}
          style={{ touchAction: 'none' }}
        >
          {/* ── SVG layer: polygon zones + in-progress drawing ── */}
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            style={{ pointerEvents: 'none' }}
          >
            {/* Existing polygon zones */}
            {assigned.map((room) => {
              const c = room.floor_plan_coordinates!;
              if (!isPolygonCoords(c)) return null;
              const isSelected = selectedZoneId === room.id;
              return (
                <polygon
                  key={room.id}
                  points={toSvgPoints(c.points)}
                  fill={isSelected ? 'rgba(245,158,11,0.22)' : 'rgba(245,158,11,0.1)'}
                  stroke={isSelected ? '#F59E0B' : 'rgba(245,158,11,0.6)'}
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                  strokeDasharray={isSelected ? undefined : '6 3'}
                  style={{ pointerEvents: 'all', cursor: 'pointer' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedZoneId(isSelected ? null : room.id);
                  }}
                />
              );
            })}

            {/* In-progress polygon: completed segments */}
            {polyPoints.length >= 2 && (
              <polyline
                points={toSvgPoints(polyPoints)}
                fill="none"
                stroke="#F59E0B"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
                strokeDasharray="6 3"
                style={{ pointerEvents: 'none' }}
              />
            )}

            {/* Preview line from last vertex to cursor */}
            {polyPoints.length >= 1 && mousePos && (
              <line
                x1={polyPoints[polyPoints.length - 1].x}
                y1={polyPoints[polyPoints.length - 1].y}
                x2={nearFirstVertex ? polyPoints[0].x : mousePos.x}
                y2={nearFirstVertex ? polyPoints[0].y : mousePos.y}
                stroke="#F59E0B"
                strokeWidth="1.5"
                strokeOpacity="0.5"
                vectorEffect="non-scaling-stroke"
                strokeDasharray="4 4"
                style={{ pointerEvents: 'none' }}
              />
            )}

            {/* Vertex dots */}
            {polyPoints.map((p, i) => {
              const isFirst = i === 0;
              const snap = isFirst && nearFirstVertex;
              return (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={snap ? 2 : 1.2}
                  fill={snap ? '#F59E0B' : '#FBBF24'}
                  stroke="#0D1117"
                  strokeWidth="0.8"
                  vectorEffect="non-scaling-stroke"
                  style={{ pointerEvents: 'none' }}
                />
              );
            })}

            {/* Pending polygon preview (after closed, before assigned) */}
            {pendingCoords && isPolygonCoords(pendingCoords) && (
              <polygon
                points={toSvgPoints(pendingCoords.points)}
                fill="rgba(245,158,11,0.15)"
                stroke="#F59E0B"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
                style={{ pointerEvents: 'none' }}
              />
            )}
          </svg>

          {/* ── Pin zones (HTML) ── */}
          {assigned.map((room) => {
            const c = room.floor_plan_coordinates!;
            if (!isPinCoords(c)) return null;
            const isSelected = selectedZoneId === room.id;
            return (
              <button
                key={room.id}
                type="button"
                style={{ position: 'absolute', left: `${c.x}%`, top: `${c.y}%` }}
                className="-translate-x-1/2 -translate-y-full cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedZoneId(isSelected ? null : room.id);
                }}
              >
                <MapPin
                  size={24}
                  className={`drop-shadow-md transition-colors ${isSelected ? 'text-amber-400' : 'text-amber-600 hover:text-amber-400'}`}
                  fill="currentColor"
                />
                {!isSelected && (
                  <span className="pointer-events-none absolute left-1/2 top-1 -translate-x-1/2 whitespace-nowrap rounded bg-base-950/80 px-1.5 py-0.5 font-mono text-[10px] text-amber-300">
                    {room.name}
                  </span>
                )}
              </button>
            );
          })}

          {/* Pending pin preview */}
          {pendingCoords && isPinCoords(pendingCoords) && (
            <div
              style={{ position: 'absolute', left: `${pendingCoords.x}%`, top: `${pendingCoords.y}%` }}
              className="pointer-events-none -translate-x-1/2 -translate-y-full"
            >
              <MapPin size={24} className="text-amber-400 drop-shadow-md" fill="currentColor" />
            </div>
          )}

          {/* ── Rect zones (legacy HTML) ── */}
          {assigned.map((room) => {
            const c = room.floor_plan_coordinates!;
            if (!isRectCoords(c)) return null;
            return (
              <RectZone
                key={room.id}
                room={room}
                coords={c}
                onSelect={() => setSelectedZoneId(selectedZoneId === room.id ? null : room.id)}
              />
            );
          })}

          {/* ── Selected zone controls popover ── */}
          {selectedZoneId && !isInteracting && (() => {
            const room = assigned.find((r) => r.id === selectedZoneId);
            if (!room || !room.floor_plan_coordinates) return null;
            const anchor = controlsAnchor(room.floor_plan_coordinates);
            return (
              <ZoneControls
                room={room}
                anchor={anchor}
                onRedraw={() => handleRedraw(room)}
                onClear={() => handleClear(room)}
                onClose={() => setSelectedZoneId(null)}
              />
            );
          })()}

          {/* ── Room picker popover (after drawing) ── */}
          {pendingCoords && pendingAnchor && (
            <RoomPicker
              rooms={unassigned.length > 0 ? unassigned : rooms}
              defaultRoomId={redrawingRoomId ?? undefined}
              anchor={pendingAnchor}
              onAssign={handleAssign}
              onDiscard={discard}
            />
          )}

          {saving && (
            <div className="absolute inset-0 flex items-center justify-center bg-base-950/50">
              <div className="rounded-lg bg-base-900 px-4 py-2 text-[13px] text-ink-200">
                Saving…
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
