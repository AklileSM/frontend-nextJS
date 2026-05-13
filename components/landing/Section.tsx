'use client';

import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import { useRef } from 'react';
import type { ReactNode } from 'react';

type Props = {
  id?: string;
  children: ReactNode;
  bordered?: boolean;
  className?: string;
};

export function Section({ id, children, bordered = true, className = '' }: Props) {
  return (
    <section
      id={id}
      className={`px-8 py-28 sm:px-12 lg:px-24 xl:px-32 ${
        bordered ? 'border-t border-base-800' : ''
      } ${className}`}
    >
      <div className="mx-auto max-w-[1480px]">{children}</div>
    </section>
  );
}

export function SectionEyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-[12px] uppercase tracking-[0.22em] text-amber-500">
      {children}
    </span>
  );
}

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};

// Eyebrow: slides in from left in 2D — provides contrast to the 3D heading
const eyebrowVariants = {
  hidden: { opacity: 0, x: -18 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
};

// Heading: rotates from a tilted-back plane into the reading surface.
// transformPerspective creates the depth illusion without a wrapper element.
const titleVariants = {
  hidden: { opacity: 0, y: 28, rotateX: 22 },
  visible: {
    opacity: 1,
    y: 0,
    rotateX: 0,
    transition: { duration: 0.78, ease: [0.22, 1, 0.36, 1] },
  },
};

const subVariants = {
  hidden: { opacity: 0, y: 16, rotateX: 10 },
  visible: {
    opacity: 1,
    y: 0,
    rotateX: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  },
};

export function SectionHeading({
  eyebrow,
  title,
  sub,
}: {
  eyebrow: string;
  title: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <motion.header
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-12% 0px' }}
      variants={containerVariants}
      className="max-w-[68ch]"
    >
      <motion.div variants={eyebrowVariants}>
        <SectionEyebrow>{eyebrow}</SectionEyebrow>
      </motion.div>

      {/* transformPerspective gives the rotateX genuine depth without a wrapper */}
      <motion.h2
        variants={titleVariants}
        style={{ transformPerspective: 800, transformOrigin: 'center top' }}
        className="mt-4 font-display text-[40px] font-semibold leading-[1.05] tracking-[-0.018em] text-white sm:text-[48px] lg:text-[54px]"
      >
        {title}
      </motion.h2>

      {sub && (
        <motion.p
          variants={subVariants}
          style={{ transformPerspective: 800, transformOrigin: 'center top' }}
          className="mt-5 text-[17px] leading-[1.7] text-ink-200"
        >
          {sub}
        </motion.p>
      )}
    </motion.header>
  );
}

// Cards/panels rotate in like a flat surface tilting to face the viewer.
export function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 44, rotateX: 16 }}
      whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
      viewport={{ once: true, margin: '-8% 0px' }}
      transition={{ duration: 0.72, delay, ease: [0.16, 1, 0.3, 1] }}
      style={{ transformPerspective: 900, transformOrigin: 'center top' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Genuine scroll parallax — wrap decorative/background layers.
// Positive speed → drifts down relative to scroll (appears further away).
// Negative speed → drifts up faster (appears closer / in front).
export function ParallaxFloat({
  children,
  speed = 0.15,
  className = '',
}: {
  children: ReactNode;
  speed?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });
  const rawY = useTransform(scrollYProgress, [0, 1], [0, speed * 130]);
  const y = useSpring(rawY, { stiffness: 55, damping: 18, restDelta: 0.001 });

  return (
    <motion.div ref={ref} style={{ y }} className={className}>
      {children}
    </motion.div>
  );
}
