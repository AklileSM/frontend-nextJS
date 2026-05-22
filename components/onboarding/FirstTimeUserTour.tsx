'use client';

import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

type Placement = 'top' | 'bottom' | 'left' | 'right' | 'auto' | 'center';
type Step = {
  targetSelector?: string;
  title: string;
  body: string;
  placement?: Placement;
};

const DISMISS_KEY = 'a6.firstTimeUserTour.dismissed';
const SESSION_CLOSE_KEY = 'a6.firstTimeUserTour.closedThisSession';

const POPOVER_W = 340;
const POPOVER_H_EST = 220;
const GAP = 12;
const PAD = 6;

const STEPS: Step[] = [
  {
    title: 'Welcome to A6-Stern',
    body: "Let's take a quick tour of how to document a construction site — from creating a project to publishing field reports. You can skip this any time.",
    placement: 'center',
  },
  {
    targetSelector: '[data-tour="new-project"]',
    title: 'Create a project',
    body: 'Click "New project" to set up a site. You\'ll give it a name, description, and location. Each project keeps its own rooms, captures, and reports.',
    placement: 'auto',
  },
  {
    title: 'Add rooms',
    body: "Inside the wizard you'll add rooms — every photo, video, or 3D scan lives in a room. Examples: 'Living Room', 'Kitchen', 'Floor 2 Hallway'. Names must be unique within a project.",
    placement: 'center',
  },
  {
    title: 'Floorplan & hotspots (optional)',
    body: 'Upload a floorplan image and draw hotspots on it to navigate visually between rooms. You can skip these steps in the wizard and add them later from project settings.',
    placement: 'center',
  },
  {
    title: 'Capture & upload',
    body: "Once rooms exist, upload photos, videos, or 3D point clouds. Captures are auto-grouped by date, so you can compare site progress over time in the Explorer.",
    placement: 'center',
  },
  {
    title: 'Field-observation reports',
    body: 'Open any capture to add observations, draw annotations, and publish a polished PDF report. Reports live in the Reports tab for download or sharing.',
    placement: 'center',
  },
];

type Rect = { top: number; left: number; width: number; height: number };

function getTargetRect(selector?: string): Rect | null {
  if (!selector) return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function placePopover(target: Rect, preferred: Placement, vw: number, vh: number) {
  const fitsBelow = target.top + target.height + GAP + POPOVER_H_EST < vh;
  const fitsAbove = target.top - GAP - POPOVER_H_EST > 0;
  const fitsRight = target.left + target.width + GAP + POPOVER_W < vw;
  const fitsLeft = target.left - GAP - POPOVER_W > 0;

  let p: Placement = preferred === 'auto' ? 'bottom' : preferred;
  if (preferred === 'auto') {
    if (fitsBelow) p = 'bottom';
    else if (fitsAbove) p = 'top';
    else if (fitsRight) p = 'right';
    else if (fitsLeft) p = 'left';
    else p = 'bottom';
  }

  let top = 0;
  let left = 0;
  if (p === 'bottom') {
    top = target.top + target.height + GAP;
    left = target.left + target.width / 2 - POPOVER_W / 2;
  } else if (p === 'top') {
    top = target.top - POPOVER_H_EST - GAP;
    left = target.left + target.width / 2 - POPOVER_W / 2;
  } else if (p === 'right') {
    top = target.top + target.height / 2 - POPOVER_H_EST / 2;
    left = target.left + target.width + GAP;
  } else {
    top = target.top + target.height / 2 - POPOVER_H_EST / 2;
    left = target.left - POPOVER_W - GAP;
  }

  const m = 12;
  top = Math.min(Math.max(top, m), vh - POPOVER_H_EST - m);
  left = Math.min(Math.max(left, m), vw - POPOVER_W - m);
  return { top, left };
}

function readDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(DISMISS_KEY) === 'true';
  } catch {
    return false;
  }
}

function readSessionClosed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(SESSION_CLOSE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function FirstTimeUserTour() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [target, setTarget] = useState<Rect | null>(null);
  const [pop, setPop] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    setMounted(true);
    if (!readDismissed() && !readSessionClosed()) setOpen(true);
  }, []);

  const step = STEPS[index];
  const isCentered = !step?.targetSelector || step.placement === 'center';

  useLayoutEffect(() => {
    if (!open || !step || isCentered) {
      setTarget(null);
      setPop(null);
      return;
    }
    function recompute() {
      const r = getTargetRect(step.targetSelector);
      setTarget(r);
      setPop(r ? placePopover(r, step.placement ?? 'auto', window.innerWidth, window.innerHeight) : null);
    }
    recompute();
    const t = window.setTimeout(recompute, 60);
    window.addEventListener('resize', recompute);
    window.addEventListener('scroll', recompute, true);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('resize', recompute);
      window.removeEventListener('scroll', recompute, true);
    };
  }, [open, step, index, isCentered]);

  useEffect(() => {
    if (!open || !step || isCentered) return;
    let raf = 0;
    let n = 0;
    function tick() {
      const r = getTargetRect(step.targetSelector);
      if (r) {
        setTarget(r);
        setPop(placePopover(r, step.placement ?? 'auto', window.innerWidth, window.innerHeight));
      }
      n++;
      if (n < 10) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [open, step, index, isCentered]);

  const closeForSession = useCallback(() => {
    try { window.sessionStorage.setItem(SESSION_CLOSE_KEY, 'true'); } catch { /* ignore */ }
    setOpen(false);
  }, []);

  const dismissForever = useCallback(() => {
    try { window.localStorage.setItem(DISMISS_KEY, 'true'); } catch { /* ignore */ }
    setOpen(false);
  }, []);

  const advance = useCallback(() => {
    if (index < STEPS.length - 1) setIndex((i) => i + 1);
    else closeForSession();
  }, [index, closeForSession]);

  const back = useCallback(() => {
    if (index > 0) setIndex((i) => i - 1);
  }, [index]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); closeForSession(); }
      else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); advance(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); back(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, advance, back, closeForSession]);

  if (!mounted || !open) return null;
  if (typeof document === 'undefined') return null;

  const isLast = index === STEPS.length - 1;
  const spot = target ? {
    top: Math.max(target.top - PAD, 0),
    left: Math.max(target.left - PAD, 0),
    width: target.width + PAD * 2,
    height: target.height + PAD * 2,
  } : null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="first-time-user-tour"
        className="fixed inset-0 z-[60]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
      >
        {spot ? (
          <motion.div
            className="pointer-events-none absolute rounded-lg ring-2 ring-amber-400/80"
            initial={false}
            animate={{ top: spot.top, left: spot.left, width: spot.width, height: spot.height }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            style={{ boxShadow: '0 0 0 9999px rgba(2, 6, 12, 0.78)' }}
          />
        ) : (
          <div className="absolute inset-0 bg-base-950/80 backdrop-blur-[2px]" />
        )}

        <motion.div
          key={`step-${index}`}
          className="pointer-events-auto absolute rounded-lg border border-base-700 bg-base-900 p-5 shadow-2xl shadow-black/60"
          style={
            isCentered || !pop
              ? { top: '50%', left: '50%', width: POPOVER_W, transform: 'translate(-50%, -50%)' }
              : { top: pop.top, left: pop.left, width: POPOVER_W }
          }
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="first-time-user-tour-title"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-500">
              Step {index + 1} of {STEPS.length}
            </span>
            <button
              type="button"
              onClick={closeForSession}
              aria-label="Close tour"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-400 transition-colors hover:bg-base-800 hover:text-white"
            >
              <X size={14} />
            </button>
          </div>

          <h3
            id="first-time-user-tour-title"
            className="mt-1.5 font-display text-[17px] font-semibold leading-tight text-white"
          >
            {step.title}
          </h3>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-200">{step.body}</p>

          <div className="mt-5 flex items-center justify-between">
            <button
              type="button"
              onClick={dismissForever}
              className="text-[11.5px] text-ink-400 transition-colors hover:text-white"
            >
              Don&apos;t show again
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={back}
                disabled={index === 0}
                aria-label="Previous step"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-base-700 text-ink-300 transition-colors hover:border-base-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                type="button"
                onClick={advance}
                className="inline-flex items-center gap-1 rounded-md bg-amber-500 px-3.5 py-1.5 text-[12.5px] font-semibold text-base-950 transition-colors hover:bg-amber-400"
              >
                {isLast ? 'Got it' : 'Next'}
                {!isLast && <ChevronRight size={13} />}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
