'use client';

import { useEffect, useRef } from 'react';

// Ambient illustration only, does not load or display any real point-cloud data.
// Generates a deterministic field of points arranged on a stylised room outline,
// projects them with a slowly rotating camera, and renders them at low intensity.
// The geometry is invented; nothing here represents an actual scan.

type Props = {
  className?: string;
  density?: number;
  paused?: boolean;
};

type Point = { x: number; y: number; z: number };

function buildPoints(count: number): Point[] {
  // Mulberry32, small deterministic PRNG so SSR and CSR agree.
  let s = 0x9e3779b9;
  const rand = () => {
    s |= 0;
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const points: Point[] = [];
  // Rectangular room shell: floor + four walls, with surface jitter.
  const W = 2.4;
  const D = 1.6;
  const H = 1.0;

  // Floor
  for (let i = 0; i < count * 0.45; i++) {
    points.push({
      x: (rand() - 0.5) * W,
      y: -H * 0.5 + (rand() - 0.5) * 0.02,
      z: (rand() - 0.5) * D,
    });
  }
  // Four walls
  for (let i = 0; i < count * 0.55; i++) {
    const wall = Math.floor(rand() * 4);
    const u = (rand() - 0.5);
    const h = (rand() - 0.5) * H;
    if (wall === 0) points.push({ x: u * W, y: h, z: -D * 0.5 });
    else if (wall === 1) points.push({ x: u * W, y: h, z: D * 0.5 });
    else if (wall === 2) points.push({ x: -W * 0.5, y: h, z: u * D });
    else points.push({ x: W * 0.5, y: h, z: u * D });
  }
  return points;
}

export function PointCloudCanvas({ className = '', density = 1400, paused = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let raf = 0;
    let running = !paused;

    const points = buildPoints(density);

    const resize = () => {
      const { clientWidth: cw, clientHeight: ch } = canvas;
      canvas.width = Math.floor(cw * dpr);
      canvas.height = Math.floor(ch * dpr);
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const onVis = () => {
      running = !document.hidden && !paused;
      if (running) raf = requestAnimationFrame(draw);
    };
    document.addEventListener('visibilitychange', onVis);

    let t0 = performance.now();
    const draw = (t: number) => {
      const dt = (t - t0) / 1000;
      t0 = t;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const angle = (t / 12000) * Math.PI * 2;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const cx = w / 2;
      const cy = h / 2;
      const focal = Math.min(w, h) * 0.85;

      for (const p of points) {
        // Rotate around Y, then a small fixed tilt around X for depth.
        const rx = p.x * cosA + p.z * sinA;
        const rz = -p.x * sinA + p.z * cosA;
        const tiltY = p.y * 0.94 - rz * 0.18;
        const tiltZ = rz * 0.94 + p.y * 0.18 + 4.2;

        const sx = cx + (rx / tiltZ) * focal;
        const sy = cy - (tiltY / tiltZ) * focal;

        // Depth-based size + alpha; near points slightly brighter.
        const depth = 1 - Math.min(Math.max((tiltZ - 3) / 3, 0), 1);
        const radius = (0.7 + depth * 1.5) * dpr;
        const alpha = 0.18 + depth * 0.45;

        ctx.fillStyle = `rgba(245, 158, 11, ${alpha})`;
        ctx.beginPath();
        ctx.arc(sx, sy, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      if (running) raf = requestAnimationFrame(draw);
      // Touch dt to silence unused-var lint without changing behavior.
      void dt;
    };

    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [density, paused]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      role="img"
      aria-label="Illustrative point-cloud animation"
    />
  );
}
