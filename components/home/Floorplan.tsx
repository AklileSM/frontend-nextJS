'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

// Hotspot positions are percentage-based (top/left/width/height) so they scale
// with the floorplan image at any viewport size. Coords match the existing app.

type Hotspot = {
  id: string;
  label: string;
  top: string;
  left: string;
  width: string;
  height: string;
  rotate?: string;
  disabled?: boolean;
};

const HOTSPOTS: Hotspot[] = [
  { id: 'room1', label: 'Room 1', top: '15%', left: '6.5%',  width: '13%',   height: '30%', disabled: true },
  { id: 'room2', label: 'Room 2', top: '15%', left: '20.5%', width: '10%',   height: '30%' },
  { id: 'room3', label: 'Room 3', top: '15%', left: '31%',   width: '10.5%', height: '30%' },
  { id: 'room4', label: 'Room 4', top: '15%', left: '42.5%', width: '9.5%',  height: '30%' },
  { id: 'room5', label: 'Room 5', top: '15%', left: '52.6%', width: '9%',    height: '30%' },
  { id: 'room6', label: 'Room 6', top: '35%', left: '70%',   width: '13%',   height: '38%', rotate: '124deg' },
];

type Props = {
  hoveredRoom: string | null;
  onHoverChange: (room: string | null) => void;
};

export function Floorplan({ hoveredRoom, onHoverChange }: Props) {
  const router = useRouter();

  const handleClick = (h: Hotspot) => {
    if (h.disabled) {
      toast.info(`${h.label} has no captures yet.`);
      return;
    }
    router.push(`/app/room-explorer?room=${h.id}`);
  };

  return (
    <div className="relative overflow-hidden rounded-lg border border-base-800 bg-base-900/30 p-3">
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/Images/floorplan.jpg"
          alt="A6-Stern floorplan"
          draggable={false}
          className="block h-auto w-full select-none rounded"
        />

        {HOTSPOTS.map((h) => {
          const active = hoveredRoom === h.id;
          return (
            <button
              key={h.id}
              type="button"
              onMouseEnter={() => !h.disabled && onHoverChange(h.id)}
              onMouseLeave={() => onHoverChange(null)}
              onFocus={() => !h.disabled && onHoverChange(h.id)}
              onBlur={() => onHoverChange(null)}
              onClick={() => handleClick(h)}
              aria-label={h.label + (h.disabled ? ' (no data)' : '')}
              style={{
                top: h.top,
                left: h.left,
                width: h.width,
                height: h.height,
                transform: h.rotate ? `rotate(${h.rotate})` : undefined,
              }}
              className={`group absolute rounded-md transition-colors duration-150 ${
                h.disabled
                  ? 'cursor-not-allowed bg-base-950/0 hover:bg-base-950/30'
                  : 'cursor-pointer bg-amber-500/0 hover:bg-amber-500/15'
              }`}
            >
              {!h.disabled && (
                <span
                  className={`absolute inset-0 rounded-md ring-2 transition-opacity duration-200 ${
                    active ? 'opacity-100 ring-amber-500' : 'opacity-0 ring-amber-500/0 group-hover:opacity-100 group-hover:ring-amber-500'
                  }`}
                />
              )}

              {!h.disabled && active && (
                <motion.span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-md ring-2 ring-amber-500/60"
                  animate={{ scale: [1, 1.18, 1], opacity: [0.55, 0, 0.55] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}

              <span
                className={`pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-base-950/80 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] transition-opacity duration-150 ${
                  h.disabled
                    ? 'opacity-0 group-hover:opacity-100 text-ink-300'
                    : active
                    ? 'opacity-100 text-amber-500'
                    : 'opacity-0 group-hover:opacity-100 text-white'
                }`}
                style={{ transform: h.rotate ? `translate(-50%, -50%) rotate(-${h.rotate})` : undefined }}
              >
                {h.label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-base-800 pt-3 px-1 font-mono text-[11px] text-ink-300">
        <span className="uppercase tracking-[0.18em]">A6-Stern · floor 1</span>
        <span>{hoveredRoom ? humanize(hoveredRoom) : 'Hover a room to inspect'}</span>
      </div>
    </div>
  );
}

function humanize(slug: string): string {
  return slug.replace(/(\d+)/, ' $1').replace(/\b\w/g, (m) => m.toUpperCase());
}
