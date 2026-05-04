'use client';

import { motion } from 'framer-motion';
import { Section, SectionHeading, Reveal } from './Section';

export function CompareSection() {
  return (
    <Section id="compare">
      <SectionHeading
        eyebrow="Compare"
        title="Two captures, one frame, one PDF."
        sub={
          <>
            The compare page is two viewers side by side, each with its own room and date selector.
            Drop a panorama from October next to a panorama from November and walk the same room
            through time. Save the comparison as a draft, or publish it as a single PDF that lists
            what changed.
          </>
        }
      />

      <div className="mt-14 grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Reveal>
          <div className="overflow-hidden rounded-lg border border-base-800 bg-base-900/30 p-7">
            <CompareDiagram />
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-base-800 pt-5">
              <div className="flex flex-wrap items-center gap-2.5 font-mono text-[12px] text-ink-300">
                <span className="rounded bg-base-800 px-2 py-0.5 text-ink-100">left.draft</span>
                <span className="text-ink-400">+</span>
                <span className="rounded bg-base-800 px-2 py-0.5 text-ink-100">right.draft</span>
                <span className="text-ink-400">→</span>
                <span className="rounded bg-amber-500/15 px-2.5 py-0.5 text-amber-500">
                  comparison-report.pdf
                </span>
              </div>
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-300">
                same form, both panels
              </span>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <aside className="flex h-full flex-col gap-4 rounded-lg border border-base-800 bg-base-900/30 p-7 text-[14.5px] leading-[1.7] text-ink-200">
            <h3 className="font-display text-[17px] font-semibold text-white">What gets compared</h3>
            <p>
              Any combination: image vs image, panorama vs panorama, today&apos;s walkthrough vs last
              month&apos;s. Both selectors are independent and accept the full set of media types.
            </p>
            <h3 className="mt-2 font-display text-[17px] font-semibold text-white">Drafts persist</h3>
            <p>
              A comparison in progress autosaves to a draft. Navigating away with unsaved changes
              triggers a confirmation dialog so a stray click doesn&apos;t lose the work.
            </p>
          </aside>
        </Reveal>
      </div>
    </Section>
  );
}

function CompareDiagram() {
  return (
    <svg viewBox="0 0 720 240" className="h-auto w-full" role="img" aria-label="Compare layout">
      <defs>
        <pattern id="cmp-grid" width="8" height="8" patternUnits="userSpaceOnUse">
          <path d="M 8 0 L 0 0 0 8" fill="none" stroke="rgba(255,255,255,0.025)" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="720" height="240" fill="url(#cmp-grid)" />

      <Panel x={20} y={20} w={320} h={180} label="Panel A" code="room2 · 2024-10-09" />
      <Panel x={380} y={20} w={320} h={180} label="Panel B" code="room2 · 2024-10-18" />

      <line x1="360" y1="20" x2="360" y2="200" stroke="#262C35" strokeDasharray="3 3" />

      {/* Bottom merge */}
      <motion.line
        x1="180" y1="200" x2="180" y2="220"
        stroke="#9BA3AE" strokeWidth="1"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true, margin: '-10% 0px' }}
        transition={{ duration: 0.5, delay: 0.3 }}
      />
      <motion.line
        x1="540" y1="200" x2="540" y2="220"
        stroke="#9BA3AE" strokeWidth="1"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true, margin: '-10% 0px' }}
        transition={{ duration: 0.5, delay: 0.3 }}
      />
      <motion.line
        x1="180" y1="220" x2="540" y2="220"
        stroke="#9BA3AE" strokeWidth="1"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true, margin: '-10% 0px' }}
        transition={{ duration: 0.6, delay: 0.5 }}
      />
      <motion.line
        x1="360" y1="220" x2="360" y2="232"
        stroke="#F59E0B" strokeWidth="1.4"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true, margin: '-10% 0px' }}
        transition={{ duration: 0.4, delay: 0.95 }}
      />

      <text
        x="360"
        y="232"
        textAnchor="middle"
        fontSize="12"
        fontFamily="var(--font-plex-mono), monospace"
        fill="#F59E0B"
      >
        publishComparisonDrafts()
      </text>
    </svg>
  );
}

function Panel({
  x, y, w, h, label, code,
}: {
  x: number; y: number; w: number; h: number; label: string; code: string;
}) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={4} fill="#13171D" stroke="#262C35" />
      <text
        x={x + 14}
        y={y + 24}
        fontSize="12"
        fontFamily="var(--font-plex-mono), monospace"
        fill="#9BA3AE"
      >
        {label}
      </text>
      <text
        x={x + 14}
        y={y + 44}
        fontSize="14"
        fontFamily="var(--font-inter-tight), Inter Tight, sans-serif"
        fontWeight="600"
        fill="#E6EAEF"
      >
        {code}
      </text>

      <rect x={x + 14} y={y + 64} width={w - 28} height={3} rx={1.5} fill="#1B2027" />
      <rect x={x + 14} y={y + 74} width={(w - 28) * 0.85} height={3} rx={1.5} fill="#1B2027" />
      <rect x={x + 14} y={y + 84} width={(w - 28) * 0.6} height={3} rx={1.5} fill="#1B2027" />

      <motion.circle
        cx={x + w * 0.55}
        cy={y + h * 0.62}
        r={4}
        fill="#F59E0B"
        animate={{ scale: [1, 1.18, 1] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.circle
        cx={x + w * 0.55}
        cy={y + h * 0.62}
        r={6}
        fill="none"
        stroke="#F59E0B"
        strokeOpacity="0.4"
      />
    </g>
  );
}
