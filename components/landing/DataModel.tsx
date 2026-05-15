'use client';

import { motion } from 'framer-motion';
import { Section, SectionHeading, Reveal } from './Section';

// Wireframe sketches of the two views the file explorer actually offers in
// Phase 5: grouped by room (one date selected), grouped by date (one room
// selected). Both views pivot the same data; the rooms × dates keying is the
// invariant. These wireframes intentionally read as schematics, not screenshots.

export function DataModel() {
  return (
    <Section id="model">
      <SectionHeading
        eyebrow="Data model"
        title="Two views. One pivot."
        sub={
          <>
            Every file is keyed by{' '}
            <code className="rounded bg-base-800 px-1.5 py-0.5 font-mono text-[14px] text-ink-100">
              (room_slug, capture_date, media_type)
            </code>
            . The explorer offers two ways to read that grid: hold a date and group by room, or
            hold a room and group by date. Same files, same metadata, different lens.
          </>
        }
      />

      <div className="mt-14 grid gap-8 lg:grid-cols-2 lg:gap-10">
        <Reveal delay={0.05}>
          <ExplorerWireframe
            kind="by-room"
            label="File explorer"
            scope="One date · all rooms"
            primary="2024-10-18"
            primaryNote="capture_date"
            sections={['Room 2', 'Room 3', 'Room 4', 'Room 5']}
          />
        </Reveal>
        <Reveal delay={0.15}>
          <ExplorerWireframe
            kind="by-date"
            label="Room explorer"
            scope="One room · all dates"
            primary="Room 2"
            primaryNote="room_slug"
            sections={['2024-10-09', '2024-10-14', '2024-10-16', '2024-10-18']}
          />
        </Reveal>
      </div>

      
    </Section>
  );
}

type Props = {
  kind: 'by-room' | 'by-date';
  label: string;
  scope: string;
  primary: string;
  primaryNote: string;
  sections: string[];
};

function ExplorerWireframe({ kind, label, scope, primary, primaryNote, sections }: Props) {
  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="overflow-hidden rounded-lg border border-base-800 bg-base-900/30"
    >
      {/* Title bar */}
      <div className="flex items-center justify-between border-b border-base-800 bg-base-900/60 px-5 py-3.5">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-amber-500">
            {label}
          </span>
          <span className="font-mono text-[11px] text-ink-300">{scope}</span>
        </div>
        <div className="hidden items-center gap-1.5 sm:flex">
          {['Images', 'Videos', 'PCD', 'PDF'].map((t, i) => (
            <span
              key={t}
              className={`rounded-sm px-2 py-0.5 font-mono text-[10px] ${
                i === 0 ? 'bg-amber-500/15 text-amber-500' : 'text-ink-300'
              }`}
            >
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* Selector strip */}
      <div className="flex items-center gap-3 border-b border-base-800 px-5 py-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-300">
          {primaryNote}
        </span>
        <span className="rounded-sm border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 font-mono text-[12px] font-medium text-amber-500">
          {primary}
        </span>
        <div className="ml-auto flex items-center gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <span key={i} className="block h-1.5 w-1.5 rounded-full bg-base-700" />
          ))}
        </div>
      </div>

      {/* Grouped sections */}
      <div className="divide-y divide-base-800">
        {sections.map((title, idx) => (
          <div key={title} className="px-5 py-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[13px] font-medium text-white">{title}</span>
              <span className="font-mono text-[10px] text-ink-300">
                {kind === 'by-room' ? `${2 + (idx % 2)} files` : `${1 + (idx % 3)} files`}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <Thumb key={i} idx={i} variant={kind} sectionIdx={idx} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function Thumb({ idx, variant, sectionIdx }: { idx: number; variant: 'by-room' | 'by-date'; sectionIdx: number }) {
  // Mix media types so the wireframe reads as varied content without revealing
  // any real captures. Type tag in the corner mimics the badge on real cards.
  const types = ['IMG', 'IMG', 'IMG', 'PCD', 'VID', 'PDF'];
  const type = types[(idx + sectionIdx + (variant === 'by-room' ? 0 : 1)) % types.length];

  const tone =
    type === 'IMG' ? 'from-base-800 to-base-900' :
    type === 'PCD' ? 'from-amber-500/15 to-base-900' :
    type === 'VID' ? 'from-steel-500/15 to-base-900' :
    /* PDF */         'from-base-700 to-base-900';

  return (
    <div className={`relative aspect-square overflow-hidden rounded-sm bg-gradient-to-br ${tone} ring-1 ring-base-800`}>
      {/* faint horizon band so it reads as imagery, not solid */}
      {type === 'IMG' && <div className="absolute inset-x-0 top-1/2 h-px bg-base-700" />}
      {/* PCD speckle */}
      {type === 'PCD' && (
        <div className="absolute inset-2 grid grid-cols-6 gap-1 opacity-60">
          {Array.from({ length: 12 }).map((_, i) => (
            <span key={i} className="block h-0.5 w-0.5 rounded-full bg-amber-500/70" />
          ))}
        </div>
      )}
      {/* VID play indicator */}
      {type === 'VID' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="block h-3 w-3 rotate-90" style={{
            clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
            background: '#38BDF8',
            opacity: 0.7,
          }} />
        </div>
      )}
      {/* PDF doc lines */}
      {type === 'PDF' && (
        <div className="absolute inset-2 flex flex-col gap-1">
          <span className="block h-0.5 w-3/4 bg-base-600" />
          <span className="block h-0.5 w-2/3 bg-base-600" />
          <span className="block h-0.5 w-1/2 bg-base-600" />
        </div>
      )}
      <span className="absolute right-1 top-1 rounded-sm bg-base-950/80 px-1 font-mono text-[8px] tracking-wider text-ink-200">
        {type}
      </span>
    </div>
  );
}
