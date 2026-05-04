'use client';

import { motion } from 'framer-motion';
import { Section, SectionHeading, Reveal } from './Section';
import { PointCloudCanvas } from './PointCloudCanvas';

const viewers = [
  {
    label: '01 / Static',
    title: 'Image viewer',
    body:
      'Pan and zoom on a single photo. Drop annotation pins anywhere; each persists with its (x, y) and a comment. The right panel runs AI analysis and gathers the safety / quality / schedule flags that end up on the published report.',
    accepts: '.jpg · .jpeg · .png',
    visual: <ImageVisual />,
  },
  {
    label: '02 / Panorama',
    title: '360° viewer',
    body:
      'Equirectangular captures render in a Three.js sphere with orbit controls. The same annotation and report-builder panel attaches to the sphere, so a measurement at a specific yaw/pitch is recoverable later.',
    accepts: '.jpg (equirect) · .png',
    visual: <PanoramaVisual />,
  },
  {
    label: '03 / Video',
    title: 'Video player',
    body:
      'Site walkthroughs and time-lapses stream in an HTML5 player with auth headers attached. Frames can be paused and observations logged against the timestamp, so a report references exactly the moment in question.',
    accepts: '.mp4 · .webm · .mov',
    visual: <VideoVisual />,
  },
  {
    label: '04 / Point cloud',
    title: 'PCD viewer',
    body:
      'LAS / LAZ files convert to Potree format server-side; the conversion status is polled from the file detail. Once ready, the cloud loads in an embedded Potree iframe with the same draft / report overlay.',
    accepts: '.las · .laz',
    visual: <PointCloudVisual />,
  },
  {
    label: '05 / PDF',
    title: 'Report viewer',
    body:
      'Field-report PDFs already carried back from site open in the in-browser PDF viewer with the user\'s auth token attached, so private files stream through the same access path as everything else — no public links.',
    accepts: '.pdf',
    visual: <PdfVisual />,
  },
];

export function Viewers() {
  return (
    <Section id="viewers">
      <SectionHeading
        eyebrow="Viewers"
        title="Five viewers. One report builder."
        sub={
          <>
            Each capture format opens in a viewer that understands it.
          </>
        }
      />

      <div className="mt-14 grid gap-px overflow-hidden rounded-lg border border-base-800 bg-base-800 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {viewers.map((v, i) => (
          <Reveal key={v.title} delay={i * 0.06}>
            <ViewerCard {...v} />
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

function ViewerCard({
  label,
  title,
  body,
  accepts,
  visual,
}: {
  label: string;
  title: string;
  body: string;
  accepts: string;
  visual: React.ReactNode;
}) {
  return (
    <motion.article
      whileHover={{ y: -3 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="group flex h-full flex-col bg-base-950 p-7 transition-colors hover:bg-base-900/50"
    >
      <div className="mb-6 h-36 overflow-hidden rounded-md border border-base-800 bg-base-900/50 transition-colors group-hover:border-base-700">
        {visual}
      </div>
      <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink-300">
        {label}
      </span>
      <h3 className="mt-2 font-display text-[22px] font-semibold tracking-tight text-white">
        {title}
      </h3>
      <p className="mt-3 flex-1 text-[14.5px] leading-[1.65] text-ink-200">{body}</p>
      <div className="mt-5 flex items-center gap-2 border-t border-base-800 pt-4">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-300">
          Accepts
        </span>
        <code className="rounded bg-base-900 px-2 py-0.5 font-mono text-[12px] text-ink-100">
          {accepts}
        </code>
      </div>
    </motion.article>
  );
}

// --- Visuals (illustrative, no real captured data) ---------------------------

function ImageVisual() {
  return (
    <svg viewBox="0 0 240 100" className="h-full w-full" role="img" aria-label="Image viewer schematic">
      <rect x="20" y="14" width="200" height="72" rx="2" fill="#13171D" stroke="#262C35" />
      <line x1="20" y1="58" x2="220" y2="58" stroke="#3A424E" strokeWidth="0.8" />
      {[
        { x: 70, y: 40 },
        { x: 130, y: 70 },
        { x: 178, y: 32 },
      ].map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="3.5" fill="#F59E0B" />
          <circle cx={p.x} cy={p.y} r="6" fill="none" stroke="#F59E0B" strokeOpacity="0.35" />
        </g>
      ))}
      <g transform="translate(186 62)">
        <circle cx="0" cy="0" r="6" fill="none" stroke="#9BA3AE" />
        <line x1="4" y1="4" x2="9" y2="9" stroke="#9BA3AE" strokeWidth="1.3" />
      </g>
    </svg>
  );
}

function PanoramaVisual() {
  return (
    <svg viewBox="0 0 240 100" className="h-full w-full" role="img" aria-label="Panorama viewer schematic">
      <defs>
        <radialGradient id="pano-grad" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="rgba(245,158,11,0.18)" />
          <stop offset="100%" stopColor="rgba(245,158,11,0)" />
        </radialGradient>
      </defs>
      <circle cx="120" cy="50" r="38" fill="url(#pano-grad)" />
      <circle cx="120" cy="50" r="38" fill="none" stroke="rgba(255,255,255,0.18)" />
      {[-30, -15, 0, 15, 30].map((deg) => (
        <ellipse
          key={deg}
          cx="120"
          cy="50"
          rx={38 * Math.cos((deg * Math.PI) / 180)}
          ry="38"
          fill="none"
          stroke={deg === 0 ? 'rgba(245,158,11,0.5)' : 'rgba(255,255,255,0.1)'}
          strokeWidth={deg === 0 ? 0.8 : 0.5}
        />
      ))}
      {[-24, -12, 0, 12, 24].map((y) => (
        <ellipse
          key={y}
          cx="120"
          cy={50 + y}
          rx={Math.sqrt(Math.max(0, 38 * 38 - y * y))}
          ry="3"
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="0.5"
        />
      ))}
      <circle cx="120" cy="50" r="2" fill="#F59E0B" />
    </svg>
  );
}

function VideoVisual() {
  return (
    <svg viewBox="0 0 240 100" className="h-full w-full" role="img" aria-label="Video player schematic">
      <rect x="30" y="14" width="180" height="60" rx="2" fill="#13171D" stroke="#262C35" />
      {/* Play triangle */}
      <polygon points="115,32 115,56 138,44" fill="#F59E0B" />
      {/* Scrub bar */}
      <rect x="30" y="80" width="180" height="6" rx="3" fill="#262C35" />
      <rect x="30" y="80" width="62" height="6" rx="3" fill="#F59E0B" />
      <circle cx="92" cy="83" r="4" fill="#F59E0B" />
      {/* Time codes */}
      <text x="30" y="98" fontSize="7" fontFamily="var(--font-plex-mono), monospace" fill="#9BA3AE">0:24</text>
      <text x="210" y="98" textAnchor="end" fontSize="7" fontFamily="var(--font-plex-mono), monospace" fill="#9BA3AE">1:12</text>
    </svg>
  );
}

function PointCloudVisual() {
  return (
    <div className="relative h-full w-full overflow-hidden bg-base-950">
      <PointCloudCanvas className="absolute inset-0 h-full w-full" density={900} />
    </div>
  );
}

function PdfVisual() {
  return (
    <svg viewBox="0 0 240 100" className="h-full w-full" role="img" aria-label="PDF viewer schematic">
      <rect x="80" y="10" width="80" height="80" rx="2" fill="#13171D" stroke="#262C35" />
      <rect x="88" y="20" width="36" height="3" rx="1" fill="#F59E0B" />
      <rect x="88" y="28" width="64" height="2" rx="1" fill="#3A424E" />
      {[36, 44, 52, 60, 68].map((y) => (
        <rect
          key={y}
          x="88"
          y={y}
          width={y % 8 === 0 ? 64 : 56}
          height="2"
          rx="1"
          fill="#262C35"
        />
      ))}
      <text
        x="120"
        y="84"
        textAnchor="middle"
        fontSize="6.5"
        fontFamily="var(--font-plex-mono), monospace"
        fill="#9BA3AE"
      >
        report.pdf
      </text>
    </svg>
  );
}
