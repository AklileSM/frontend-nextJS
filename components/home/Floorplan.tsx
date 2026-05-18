'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { MapPin } from 'lucide-react';
import {
  isPolygonCoords,
  isPinCoords,
  isRectCoords,
  type ApiRoom,
  type FloorPlanCoordinates,
  type Point,
} from '@/types/api';

type Props = {
  floorplanUrl: string;
  projectSlug: string;
  rooms: ApiRoom[];
  hoveredRoom: string | null;
  onHoverChange: (roomSlug: string | null) => void;
};

function toSvgPoints(points: Point[]): string {
  return points.map((p) => `${p.x},${p.y}`).join(' ');
}

function centroid(points: Point[]): Point {
  return {
    x: points.reduce((s, p) => s + p.x, 0) / points.length,
    y: points.reduce((s, p) => s + p.y, 0) / points.length,
  };
}

export function Floorplan({ floorplanUrl, projectSlug, rooms, hoveredRoom, onHoverChange }: Props) {
  const router = useRouter();

  const placedRooms = rooms.filter(
    (r): r is ApiRoom & { floor_plan_coordinates: FloorPlanCoordinates } =>
      r.floor_plan_coordinates !== null,
  );

  const rectRooms    = placedRooms.filter((r) => isRectCoords(r.floor_plan_coordinates));
  const polygonRooms = placedRooms.filter((r) => isPolygonCoords(r.floor_plan_coordinates));
  const pinRooms     = placedRooms.filter((r) => isPinCoords(r.floor_plan_coordinates));

  const handleClick = (room: ApiRoom) => {
    router.push(`/app/room-explorer?room=${room.slug}`);
  };

  return (
    <div className="relative overflow-hidden rounded-lg border border-base-800 bg-base-900/30 p-3">
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={floorplanUrl}
          alt="Project floorplan"
          draggable={false}
          className="block h-auto w-full select-none rounded"
        />

        {/* Polygon zones, SVG overlay */}
        {polygonRooms.length > 0 && (
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            style={{ pointerEvents: 'none' }}
          >
            {polygonRooms.map((room) => {
              const c = room.floor_plan_coordinates;
              if (!isPolygonCoords(c)) return null;
              const active = hoveredRoom === room.slug;
              return (
                <polygon
                  key={room.id}
                  points={toSvgPoints(c.points)}
                  fill={active ? 'rgba(245,158,11,0.2)' : 'rgba(245,158,11,0.07)'}
                  stroke={active ? '#F59E0B' : 'rgba(245,158,11,0.45)'}
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                  style={{ pointerEvents: 'all', cursor: 'pointer' }}
                  onMouseEnter={() => onHoverChange(room.slug)}
                  onMouseLeave={() => onHoverChange(null)}
                  onClick={() => handleClick(room)}
                />
              );
            })}
          </svg>
        )}

        {/* Polygon name labels at centroid */}
        {polygonRooms.map((room) => {
          const c = room.floor_plan_coordinates;
          if (!isPolygonCoords(c)) return null;
          const cen = centroid(c.points);
          const active = hoveredRoom === room.slug;
          return (
            <span
              key={`lbl-${room.id}`}
              style={{ left: `${cen.x}%`, top: `${cen.y}%` }}
              className={`pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-sm bg-base-950/80 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] transition-opacity duration-150 ${
                active ? 'opacity-100 text-amber-500' : 'opacity-0'
              }`}
            >
              {room.name}
            </span>
          );
        })}

        {/* Rect zones */}
        {rectRooms.map((room) => {
          const c = room.floor_plan_coordinates;
          if (!isRectCoords(c)) return null;
          const active = hoveredRoom === room.slug;
          return (
            <button
              key={room.id}
              type="button"
              onMouseEnter={() => onHoverChange(room.slug)}
              onMouseLeave={() => onHoverChange(null)}
              onFocus={() => onHoverChange(room.slug)}
              onBlur={() => onHoverChange(null)}
              onClick={() => handleClick(room)}
              aria-label={room.name}
              style={{ top: `${c.y}%`, left: `${c.x}%`, width: `${c.width}%`, height: `${c.height}%` }}
              className="group absolute cursor-pointer rounded-md transition-colors duration-150 hover:bg-amber-500/15"
            >
              <span className={`absolute inset-0 rounded-md ring-2 transition-opacity duration-200 ${
                active ? 'opacity-100 ring-amber-500' : 'opacity-0 ring-amber-500/0 group-hover:opacity-100 group-hover:ring-amber-500'
              }`} />
              {active && (
                <motion.span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-md ring-2 ring-amber-500/60"
                  animate={{ scale: [1, 1.18, 1], opacity: [0.55, 0, 0.55] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}
              <span className={`pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-base-950/80 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] transition-opacity duration-150 ${
                active ? 'opacity-100 text-amber-500' : 'opacity-0 group-hover:opacity-100 text-white'
              }`}>
                {room.name}
              </span>
            </button>
          );
        })}

        {/* Pin zones */}
        {pinRooms.map((room) => {
          const c = room.floor_plan_coordinates;
          if (!isPinCoords(c)) return null;
          const active = hoveredRoom === room.slug;
          return (
            <button
              key={room.id}
              type="button"
              onMouseEnter={() => onHoverChange(room.slug)}
              onMouseLeave={() => onHoverChange(null)}
              onFocus={() => onHoverChange(room.slug)}
              onBlur={() => onHoverChange(null)}
              onClick={() => handleClick(room)}
              aria-label={room.name}
              style={{ left: `${c.x}%`, top: `${c.y}%` }}
              className="group absolute -translate-x-1/2 -translate-y-full cursor-pointer"
            >
              <MapPin
                size={28}
                className={`drop-shadow-md transition-colors duration-150 ${
                  active ? 'text-amber-400' : 'text-amber-600 group-hover:text-amber-400'
                }`}
                fill="currentColor"
              />
              <span className={`pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-sm bg-base-950/80 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] transition-opacity duration-150 ${
                active ? 'opacity-100 text-amber-500' : 'opacity-0 group-hover:opacity-100 text-white'
              }`}>
                {room.name}
              </span>
            </button>
          );
        })}

        {placedRooms.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center rounded">
            <p className="rounded-md bg-base-950/80 px-4 py-2 font-mono text-[11px] text-ink-400">
              No hotspots placed, go to Settings → Setup to add them
            </p>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-base-800 px-1 pt-3 font-mono text-[11px] text-ink-300">
        <span className="uppercase tracking-[0.18em]">{projectSlug} · floor 1</span>
        <span>
          {hoveredRoom
            ? (rooms.find((r) => r.slug === hoveredRoom)?.name ?? hoveredRoom)
            : 'Hover a room to inspect'}
        </span>
      </div>
    </div>
  );
}
