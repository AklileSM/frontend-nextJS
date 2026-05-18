'use client';

import { useEffect, useLayoutEffect, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useCoachmark } from './useCoachmark';

type Placement = 'top' | 'bottom' | 'left' | 'right' | 'auto';

export type CoachmarkStep = {
  targetRef?: RefObject<HTMLElement | null>;
  targetSelector?: string;
  title?: string;
  body: string;
  placement?: Placement;
};

type Props = {
  id: string;
  steps: CoachmarkStep[];
  enabled?: boolean;
};

const POPOVER_W = 320;
const POPOVER_H_EST = 200;
const GAP = 12;
const PAD = 6;

type Rect = { top: number; left: number; width: number; height: number };

function getTargetRect(step: CoachmarkStep): Rect | null {
  let el: Element | null = null;
  if (step.targetRef?.current) el = step.targetRef.current;
  else if (step.targetSelector) el = document.querySelector(step.targetSelector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function placePopover(target: Rect, preferred: Placement, vw: number, vh: number) {
  const fitsBelow = target.top + target.height + GAP + POPOVER_H_EST < vh;
  const fitsAbove = target.top - GAP - POPOVER_H_EST > 0;
  const fitsRight = target.left + target.width + GAP + POPOVER_W < vw;
  const fitsLeft  = target.left - GAP - POPOVER_W > 0;

  let p: Placement = preferred === 'auto' ? 'bottom' : preferred;
  if (preferred === 'auto') {
    if (fitsBelow) p = 'bottom';
    else if (fitsAbove) p = 'top';
    else if (fitsRight) p = 'right';
    else if (fitsLeft) p = 'left';
    else p = 'bottom';
  } else {
    if (p === 'bottom' && !fitsBelow && fitsAbove) p = 'top';
    else if (p === 'top' && !fitsAbove && fitsBelow) p = 'bottom';
    else if (p === 'right' && !fitsRight && fitsLeft) p = 'left';
    else if (p === 'left' && !fitsLeft && fitsRight) p = 'right';
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

  return { top, left, placement: p };
}

export function CoachmarkTour({ id, steps, enabled = true }: Props) {
  const { state, mounted, complete, dismiss } = useCoachmark(id);
  const [index, setIndex] = useState(0);
  const [target, setTarget] = useState<Rect | null>(null);
  const [pop, setPop] = useState<{ top: number; left: number; placement: Placement } | null>(null);

  const isOpen = mounted && enabled && state === 'pending' && steps.length > 0;
  const step = steps[index];

  useLayoutEffect(() => {
    if (!isOpen || !step) return;
    function recompute() {
      const r = getTargetRect(step);
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
  }, [isOpen, step, index]);

  // Re-probe for a few frames after step change in case the target is still mounting.
  useEffect(() => {
    if (!isOpen || !step) return;
    let raf = 0;
    let n = 0;
    function tick() {
      const r = getTargetRect(step);
      if (r) {
        setTarget(r);
        setPop(placePopover(r, step.placement ?? 'auto', window.innerWidth, window.innerHeight));
      }
      n++;
      if (n < 10) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isOpen, step, index]);

  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); dismiss(); }
      else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); advance(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); back(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, index]);

  if (typeof document === 'undefined') return null;

  function advance() {
    if (index < steps.length - 1) setIndex((i) => i + 1);
    else complete();
  }
  function back() {
    if (index > 0) setIndex((i) => i - 1);
  }

  const isLast = index === steps.length - 1;

  const spot = target ? {
    top: Math.max(target.top - PAD, 0),
    left: Math.max(target.left - PAD, 0),
    width: target.width + PAD * 2,
    height: target.height + PAD * 2,
  } : null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="coachmark"
          className="fixed inset-0 z-[55]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          aria-hidden={false}
        >
          {spot ? (
            <motion.div
              key={`spot-${index}`}
              className="pointer-events-none absolute rounded-lg ring-2 ring-amber-400/80"
              initial={false}
              animate={{
                top: spot.top,
                left: spot.left,
                width: spot.width,
                height: spot.height,
              }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              style={{ boxShadow: '0 0 0 9999px rgba(2, 6, 12, 0.72)' }}
            />
          ) : (
            <div className="absolute inset-0 bg-base-950/75" />
          )}

          {pop && step && (
            <motion.div
              key={`pop-${index}`}
              className="pointer-events-auto absolute rounded-lg border border-base-700 bg-base-900 p-4 shadow-2xl shadow-black/60"
              style={{ top: pop.top, left: pop.left, width: POPOVER_W }}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              role="dialog"
              aria-modal="true"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-500">
                  Step {index + 1} of {steps.length}
                </span>
                <button
                  type="button"
                  onClick={dismiss}
                  aria-label="Skip tour"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-400 transition-colors hover:bg-base-800 hover:text-white"
                >
                  <X size={14} />
                </button>
              </div>

              {step.title && (
                <h3 className="mt-1 font-display text-[16px] font-semibold leading-tight text-white">
                  {step.title}
                </h3>
              )}
              <p className="mt-2 text-[13px] leading-relaxed text-ink-200">{step.body}</p>

              <div className="mt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={dismiss}
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
                    className="inline-flex items-center gap-1 rounded-md bg-amber-500 px-3 py-1.5 text-[12.5px] font-semibold text-base-950 transition-colors hover:bg-amber-400"
                  >
                    {isLast ? 'Got it' : 'Next'}
                    {!isLast && <ChevronRight size={13} />}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
