'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { ApiRoom, FloorPlanCoordinates } from '@/types/api';

type Props = {
  floorplanUrl: string;
  projectSlug: string;
  rooms: ApiRoom[];
  hoveredRoom: string | null;
  onHoverChange: (roomSlug: string | null) => void;
};

export function Floorplan({ floorplanUrl, projectSlug, rooms, hoveredRoom, onHoverChange }: Props) {
  const router = useRouter();

  const placedRooms = rooms.filter(
    (r): r is ApiRoom & { floor_plan_coordinates: FloorPlanCoordinates } =>
      r.floor_plan_coordinates !== null,
  );

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

        {placedRooms.map((room) => {
          const c = room.floor_plan_coordinates;
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
              style={{
                top: `${c.y}%`,
                left: `${c.x}%`,
                width: `${c.width}%`,
                height: `${c.height}%`,
              }}
              className="group absolute cursor-pointer rounded-md bg-amber-500/0 transition-colors duration-150 hover:bg-amber-500/15"
            >
              <span
                className={`absolute inset-0 rounded-md ring-2 transition-opacity duration-200 ${
                  active
                    ? 'opacity-100 ring-amber-500'
                    : 'opacity-0 ring-amber-500/0 group-hover:opacity-100 group-hover:ring-amber-500'
                }`}
              />

              {active && (
                <motion.span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-md ring-2 ring-amber-500/60"
                  animate={{ scale: [1, 1.18, 1], opacity: [0.55, 0, 0.55] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}

              <span
                className={`pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-base-950/80 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] transition-opacity duration-150 ${
                  active ? 'opacity-100 text-amber-500' : 'opacity-0 group-hover:opacity-100 text-white'
                }`}
              >
                {room.name}
              </span>
            </button>
          );
        })}

        {placedRooms.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center rounded">
            <p className="rounded-md bg-base-950/80 px-4 py-2 font-mono text-[11px] text-ink-400">
              No hotspots placed — go to Settings → Setup to add them
            </p>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-base-800 pt-3 px-1 font-mono text-[11px] text-ink-300">
        <span className="uppercase tracking-[0.18em]">{projectSlug} · floor 1</span>
        <span>{hoveredRoom ? rooms.find((r) => r.slug === hoveredRoom)?.name ?? hoveredRoom : 'Hover a room to inspect'}</span>
      </div>
    </div>
  );
}
