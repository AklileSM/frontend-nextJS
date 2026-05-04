'use client';

import { motion, useScroll, useSpring } from 'framer-motion';

// Thin scroll-progress bar pinned to the top of the viewport. Real, not garnish:
// a quiet readout of how far through the page the user has scrolled.

export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 28,
    mass: 0.4,
  });

  return (
    <motion.div
      aria-hidden
      style={{ scaleX, transformOrigin: '0% 50%' }}
      className="fixed inset-x-0 top-0 z-[60] h-[2px] bg-amber-500"
    />
  );
}
