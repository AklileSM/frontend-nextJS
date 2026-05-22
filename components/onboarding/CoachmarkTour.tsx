'use client';

import { useCallback, useEffect, useLayoutEffect, useState, type RefObject } from 'react';
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
  /** Hide the Next button and advance only when the user really clicks the
   *  spotlit target. The popover's Prev / X / Don't show again still work. */
  waitForClick?: boolean;
};

type Props = {
  id: string;
  steps: CoachmarkStep[];
  enabled?: boolean;
  /** Block clicks anywhere outside the spotlit target and the popover. The
   *  scrim becomes click-blocking; users can only interact with the
   *  highlighted element or the popover controls. Default false. */
  lockBackground?: boolean;
  /** Fires whenever the current step index changes (including step 0 on open). */
  onStepChange?: (index: number) => void;
  /** Fires when the tour closes for the current view (Got it / X / Esc / Don't show again). */
  onClose?: () => void;
};

const POPOVER_W = 320;
const POPOVER_H_EST = 200;
const GAP = 12;
const PAD = 6;

type Rect = { top: number; left: number; width: number; height: number };

function getTargetEl(step: CoachmarkStep): Element | null {
  if (step.targetRef?.current) return step.targetRef.current;
  if (step.targetSelector) return document.querySelector(step.targetSelector);
  return null;
}

function getTargetRect(step: CoachmarkStep): Rect | null {
  const el = getTargetEl(step);
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
    else if (p === 'right' && !fitsRight && fitsLeft) p = 'right';
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

export function CoachmarkTour({ id, steps, enabled = true, lockBackground = false, onStepChange, onClose }: Props) {
  const { state, mounted, dismiss } = useCoachmark(id);
  const [index, setIndex] = useState(0);
  const [closedThisView, setClosedThisView] = useState(false);
  const [target, setTarget] = useState<Rect | null>(null);
  const [pop, setPop] = useState<{ top: number; left: number; placement: Placement } | null>(null);

  const isOpen = mounted && enabled && state === 'pending' && !closedThisView && steps.length > 0;
  const step = steps[index];

  // Notify parent on step change while open (covers initial mount and advance/back).
  useEffect(() => {
    if (isOpen) onStepChange?.(index);
  }, [isOpen, index, onStepChange]);

  const closeForView = useCallback(() => {
    setIndex(0);
    setClosedThisView(true);
    onClose?.();
  }, [onClose]);
  const advance = useCallback(() => {
    setIndex((i) => {
      if (i < steps.length - 1) return i + 1;
      // Last step — close.
      setClosedThisView(true);
      onClose?.();
      return 0;
    });
  }, [steps.length, onClose]);
  const back = useCallback(() => {
    setIndex((i) => (i > 0 ? i - 1 : i));
  }, []);

  const dismissAndClose = useCallback(() => {
    dismiss();
    setIndex(0);
    setClosedThisView(true);
    onClose?.();
  }, [dismiss, onClose]);

  useLayoutEffect(() => {
    if (!isOpen || !step) return;
    function centerPop() {
      return {
        top: Math.max((window.innerHeight - POPOVER_H_EST) / 2, 12),
        left: Math.max((window.innerWidth - POPOVER_W) / 2, 12),
        placement: 'bottom' as Placement,
      };
    }
    function recompute() {
      const hasTargetSpec = !!(step.targetRef?.current || step.targetSelector);
      const r = getTargetRect(step);
      setTarget(r);
      if (r) {
        setPop(placePopover(r, step.placement ?? 'auto', window.innerWidth, window.innerHeight));
      } else if (!hasTargetSpec) {
        // Step with no target (e.g. welcome) — center the popover.
        setPop(centerPop());
      } else {
        // Target spec given but not in DOM yet — leave pop null; tick() will retry.
        setPop(null);
      }
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
    const hasTargetSpec = !!(step.targetRef?.current || step.targetSelector);
    if (!hasTargetSpec) return;
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
      if (e.key === 'Escape') { e.preventDefault(); closeForView(); }
      else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        if (step?.waitForClick) return;
        e.preventDefault();
        advance();
      }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); back(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, step, advance, back, closeForView]);

  // Click-locking: prevent clicks outside the spotlit target / popover when
  // lockBackground is on. Uses capture-phase so it runs before any handler.
  useEffect(() => {
    if (!isOpen || !lockBackground) return;
    function block(e: MouseEvent) {
      const node = e.target as Node | null;
      if (!node) return;
      const popoverEl = document.querySelector('[data-coachmark-popover]');
      if (popoverEl && popoverEl.contains(node)) return;
      const targetEl = step ? getTargetEl(step) : null;
      if (targetEl && targetEl.contains(node)) return;
      e.preventDefault();
      e.stopPropagation();
    }
    document.addEventListener('mousedown', block, true);
    document.addEventListener('click', block, true);
    document.addEventListener('pointerdown', block, true);
    return () => {
      document.removeEventListener('mousedown', block, true);
      document.removeEventListener('click', block, true);
      document.removeEventListener('pointerdown', block, true);
    };
  }, [isOpen, lockBackground, step]);

  // waitForClick: advance when the user actually clicks the spotlit target.
  useEffect(() => {
    if (!isOpen || !step?.waitForClick) return;
    const el = getTargetEl(step);
    if (!el) return;
    function onClick() {
      // Defer one tick so the target's own handler runs first.
      setTimeout(() => advance(), 0);
    }
    el.addEventListener('click', onClick);
    return () => el.removeEventListener('click', onClick);
  }, [isOpen, step, index, advance]);

  if (typeof document === 'undefined') return null;

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
          className="pointer-events-none fixed inset-0 z-[55]"
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
              data-coachmark-popover
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
                  onClick={closeForView}
                  aria-label="Close tour"
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
                  onClick={dismissAndClose}
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
                  {!step.waitForClick && (
                    <button
                      type="button"
                      onClick={advance}
                      className="inline-flex items-center gap-1 rounded-md bg-amber-500 px-3 py-1.5 text-[12.5px] font-semibold text-base-950 transition-colors hover:bg-amber-400"
                    >
                      {isLast ? 'Got it' : 'Next'}
                      {!isLast && <ChevronRight size={13} />}
                    </button>
                  )}
                  {step.waitForClick && (
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-400/70">
                      Click to continue
                    </span>
                  )}
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
