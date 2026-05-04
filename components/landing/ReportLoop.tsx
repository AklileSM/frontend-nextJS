'use client';

import { motion } from 'framer-motion';
import { Section, SectionHeading, Reveal } from './Section';

const steps = [
  {
    n: '01',
    title: 'Open',
    body: 'Click any capture from the timeline grid to launch the matching viewer.',
    notes: ['Static · Panorama · Video · PCD · PDF'],
  },
  {
    n: '02',
    title: 'Observe',
    body: 'Place annotation pins, run AI analysis on the frame, type up manual observations.',
    notes: ['AI image analysis', 'free-text observations'],
  },
  {
    n: '03',
    title: 'Flag',
    body: 'Mark the report with the categories your team tracks: safety, quality, schedule.',
    notes: ['safety_issue', 'quality_issue', 'schedule_delayed'],
  },
  {
    n: '04',
    title: 'Save or publish',
    body: 'Save a draft to come back to, or publish a PDF. Both flow through the same form.',
    notes: ['save_draft', 'publish_report'],
  },
];

export function ReportLoop() {
  return (
    <Section id="reports">
      <SectionHeading
        eyebrow="Report loop"
        title="What you do with a capture, and what comes out."
        sub={
          <>
            The viewer has a panel is the same surface for taking notes, getting AI
            help, and producing the final PDF. Drafts and reports share the schema, so resuming
            tomorrow looks identical to publishing today.
          </>
        }
      />

      <div className="relative mt-14 grid gap-px overflow-hidden rounded-lg border border-base-800 bg-base-800 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => (
          <Reveal key={s.n} delay={i * 0.08}>
            <motion.div
              whileHover={{ y: -3 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="group relative flex h-full flex-col bg-base-950 p-7 transition-colors hover:bg-base-900/50"
            >
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-[12px] uppercase tracking-[0.22em] text-amber-500">
                  {s.n}
                </span>
                {i < steps.length - 1 && (
                  <span aria-hidden className="hidden text-base-700 group-hover:text-base-600 lg:block">
                    →
                  </span>
                )}
              </div>
              <h3 className="mt-3 font-display text-[22px] font-semibold tracking-tight text-white">
                {s.title}
              </h3>
              <p className="mt-3 flex-1 text-[14.5px] leading-[1.65] text-ink-200">{s.body}</p>
              <ul className="mt-5 space-y-2 border-t border-base-800 pt-4">
                {s.notes.map((n) => (
                  <li key={n} className="flex items-center gap-2 font-mono text-[12px] text-ink-300">
                    <span className="h-1 w-1 rounded-full bg-base-600" />
                    <code className="text-ink-100">{n}</code>
                  </li>
                ))}
              </ul>
            </motion.div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
