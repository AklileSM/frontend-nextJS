'use client';

import Link from 'next/link';
import { ArrowRight, ArrowDown } from 'lucide-react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import { useRef } from 'react';
import { PlatformDiagram } from './PlatformDiagram';

export function Hero() {
  const heroRef = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });

  // Text column: rises 60 px — slower, feels closer to camera
  const rawTextY = useTransform(scrollYProgress, [0, 1], [0, -60]);
  // Diagram: rises 150 px faster + tips backward (rotateX) as it recedes
  const rawDiagramY = useTransform(scrollYProgress, [0, 1], [0, -150]);
  const rawDiagramScale = useTransform(scrollYProgress, [0, 1], [1, 0.92]);
  const rawDiagramRotateX = useTransform(scrollYProgress, [0, 0.7], [0, 7]);

  const textY = useSpring(rawTextY, { stiffness: 80, damping: 24, restDelta: 0.001 });
  const diagramY = useSpring(rawDiagramY, { stiffness: 80, damping: 24, restDelta: 0.001 });
  const diagramScale = useSpring(rawDiagramScale, { stiffness: 80, damping: 24, restDelta: 0.0001 });
  const diagramRotateX = useSpring(rawDiagramRotateX, { stiffness: 60, damping: 20, restDelta: 0.001 });

  return (
    <section
      ref={heroRef}
      className="relative px-8 pb-20 pt-36 sm:px-12 lg:px-24 lg:pb-28 lg:pt-44 xl:px-32"
    >
      <div className="mx-auto grid max-w-[1480px] grid-cols-1 gap-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start lg:gap-20">

        {/* ── Text column: slower scroll parallax ── */}
        <motion.div style={{ y: textY }} className="max-w-[68ch]">
          <motion.p
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45 }}
            className="mt-28 inline-flex items-center gap-3 font-mono text-[12px] uppercase tracking-[0.22em] text-ink-300"
          >
            Construction · documentation
          </motion.p>

          {/* h1: rotates in from tilted-back plane — clearly 3D, not a slide */}
          <motion.h1
            initial={{ opacity: 0, y: 24, rotateX: 24 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{ duration: 0.82, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformPerspective: 1000, transformOrigin: 'center top' }}
            className="mt-6 font-display text-[48px] font-semibold leading-[1.04] tracking-[-0.02em] text-white sm:text-[60px] lg:text-[68px] xl:text-[76px]"
          >
            One timeline for every capture taken on your site.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 18, rotateX: 12 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{ duration: 0.65, delay: 0.22, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformPerspective: 900, transformOrigin: 'center top' }}
            className="mt-7 text-[18px] leading-[1.7] text-ink-200"
          >
            SiteScope is the documentation layer for indoor construction projects. Photos, 360°
            panoramas, video walkthroughs, pcd renders, and field-report PDFs flow into one
            date-indexed archive keyed to the room they came from, opened in a viewer that
            understands the format, and turned into a defensible PDF whenever someone asks{' '}
            <em className="not-italic text-white">when</em> something happened on site.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.34 }}
            className="mt-10 flex flex-wrap items-center gap-3"
          >
            <Link
              href="/register"
              className="group inline-flex items-center gap-2 rounded-md bg-amber-500 px-5 py-3 text-[14px] font-semibold text-base-950 transition-colors hover:bg-amber-400"
            >
              Get started
              <ArrowRight
                size={15}
                strokeWidth={2.2}
                className="transition-transform duration-200 group-hover:translate-x-0.5"
              />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-md border border-base-700 px-5 py-3 text-[14px] font-medium text-white transition-colors hover:border-ink-300"
            >
              Sign in
            </Link>
            <a
              href="#model"
              className="group inline-flex items-center gap-2 px-1 py-3 text-[14px] text-ink-300 transition-colors hover:text-white"
            >
              How it works
              <motion.span
                animate={{ y: [0, 3, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                className="inline-flex"
              >
                <ArrowDown size={14} strokeWidth={2.2} />
              </motion.span>
            </a>
          </motion.div>
        </motion.div>

        {/* ── Diagram column: faster parallax + 3D entrance + scroll tilt ──
              On load:  swings in on Y axis (rotateY -12 → 0) — facing the viewer
              On scroll: tips backward (rotateX 0 → 7) + scales down — receding  */}
        <motion.div
          style={{
            y: diagramY,
            scale: diagramScale,
            rotateX: diagramRotateX,
            transformPerspective: 1400,
            transformOrigin: 'center top',
          }}
          className="w-full"
        >
          <motion.div
            initial={{ opacity: 0, rotateY: -12, y: 24 }}
            animate={{ opacity: 1, rotateY: 0, y: 0 }}
            transition={{ duration: 0.85, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformPerspective: 1400, transformOrigin: 'center center' }}
          >
            <div className="rounded-lg border border-base-800 bg-base-900/40 p-6 sm:p-8">
              <PlatformDiagram className="h-auto w-full" />
            </div>
            <p className="mt-5 max-w-[64ch] font-mono text-[12px] leading-[1.7] text-ink-300">
              A capture becomes a file asset keyed by{' '}
              <code className="rounded bg-base-800 px-1.5 py-0.5 text-ink-100">room_slug</code> and{' '}
              <code className="rounded bg-base-800 px-1.5 py-0.5 text-ink-100">capture_date</code>;
              opens in the viewer for its format; produces a draft or a published PDF report.
            </p>
          </motion.div>
        </motion.div>

      </div>
    </section>
  );
}
