'use client';

import { motion } from 'framer-motion';

// Vertical flow that mirrors the actual code path: a capture becomes a file
// asset (keyed by room_slug + capture_date + media_type), opens in a viewer
// where annotations / AI / flags are gathered, and is saved as a draft or
// published as a PDF report. Lines draw themselves on first reveal.
//
// Aspect: ~600×560, so it sits balanced in a hero column instead of reading
// like a thin strip.

const NODE_FILL = '#13171D';
const NODE_STROKE = '#262C35';
const ACCENT = '#F59E0B';
const TEXT = '#E6EAEF';
const MUTED = '#9BA3AE';

type LabeledRect = {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  sub?: string[];
  accent?: boolean;
};

const NODES: LabeledRect[] = [
  {
    x: 160, y: 18, w: 280, h: 116,
    title: 'Field capture',
    sub: ['Photo · 360° · Video', 'Point cloud (LAS/LAZ)', 'PDF field report'],
  },
  {
    x: 205, y: 162, w: 190, h: 116,
    title: 'File asset',
    sub: ['room_slug', 'capture_date', 'media_type'],
    accent: true,
  },
  {
    x: 160, y: 304, w: 280, h: 132,
    title: 'Viewer',
    sub: ['Static · Panorama · Video', 'Point cloud · PDF', 'annotations · AI · flags'],
  },
  {
    x: 50, y: 466, w: 200, h: 80,
    title: 'Draft',
    sub: ['state_json', 'continue editing'],
  },
  {
    x: 350, y: 466, w: 200, h: 80,
    title: 'Published PDF',
    sub: ['stored in MinIO', 'profile · download'],
    accent: true,
  },
];

type Connector = {
  x1: number; y1: number;
  x2: number; y2: number;
  accent?: boolean;
  delay: number;
};

const CONNECTORS: Connector[] = [
  // capture → file (vertical)
  { x1: 300, y1: 134, x2: 300, y2: 162, accent: true, delay: 0.2 },
  // file → viewer (vertical)
  { x1: 300, y1: 278, x2: 300, y2: 304, accent: true, delay: 0.4 },
  // viewer → draft (down-left)
  { x1: 230, y1: 436, x2: 150, y2: 466, delay: 0.65 },
  // viewer → published (down-right)
  { x1: 370, y1: 436, x2: 450, y2: 466, accent: true, delay: 0.65 },
  // draft → published (horizontal, "publish" path)
  { x1: 250, y1: 506, x2: 350, y2: 506, delay: 0.85 },
];

export function PlatformDiagram({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 600 580"
      className={className}
      role="img"
      aria-label="Diagram: a capture becomes a file asset, opens in a viewer, becomes a draft or a published PDF report"
    >
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={MUTED} />
        </marker>
        <marker id="arrow-accent" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={ACCENT} />
        </marker>
      </defs>

      {CONNECTORS.map((c, i) => (
        <motion.line
          key={i}
          x1={c.x1}
          y1={c.y1}
          x2={c.x2}
          y2={c.y2}
          stroke={c.accent ? ACCENT : MUTED}
          strokeWidth={c.accent ? 1.5 : 1.1}
          strokeDasharray={c.accent ? undefined : '4 4'}
          markerEnd={c.accent ? 'url(#arrow-accent)' : 'url(#arrow)'}
          initial={{ pathLength: 0, opacity: 0 }}
          whileInView={{ pathLength: 1, opacity: 1 }}
          viewport={{ once: true, margin: '-10% 0px' }}
          transition={{ duration: 0.65, delay: c.delay, ease: [0.22, 1, 0.36, 1] }}
        />
      ))}

      {NODES.map((n, i) => (
        <motion.g
          key={n.title}
          initial={{ opacity: 0, y: 6 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-10% 0px' }}
          transition={{ duration: 0.45, delay: 0.05 + i * 0.12, ease: [0.22, 1, 0.36, 1] }}
        >
          <Node {...n} />
        </motion.g>
      ))}

      <text
        x="300"
        y="568"
        fontSize="11"
        fontFamily="var(--font-plex-mono), monospace"
        fill={MUTED}
        textAnchor="middle"
      >
        flow keyed by (room_slug, capture_date)
      </text>
    </svg>
  );
}

function Node({ x, y, w, h, title, sub, accent }: LabeledRect) {
  return (
    <>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx="6"
        fill={NODE_FILL}
        stroke={accent ? ACCENT : NODE_STROKE}
        strokeWidth={accent ? 1.4 : 1}
      />
      <text
        x={x + 18}
        y={y + 28}
        fontSize="15"
        fontFamily="var(--font-inter-tight), Inter Tight, sans-serif"
        fontWeight="600"
        fill={TEXT}
      >
        {title}
      </text>
      {sub?.map((s, i) => (
        <text
          key={s}
          x={x + 18}
          y={y + 54 + i * 19}
          fontSize="12"
          fontFamily="var(--font-plex-mono), monospace"
          fill={MUTED}
        >
          {s}
        </text>
      ))}
    </>
  );
}
