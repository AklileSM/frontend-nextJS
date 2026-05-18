'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ChevronDown, ChevronUp, Maximize2, Minimize2, ScanLine } from 'lucide-react';
import { ReportBuilder } from '@/components/reports/ReportBuilder';
import { useViewerContext } from './useViewerContext';
import { backHrefFor } from '@/components/explorer/viewerContext';

export function PointCloudViewer() {
  const { ctx, loading, fallbackHref } = useViewerContext();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(true);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const backHref = useMemo(() => (ctx ? backHrefFor(ctx) : fallbackHref), [ctx, fallbackHref]);

  const potreeUrl = useMemo(() => {
    if (!ctx) return '';
    const cloudUrl = ctx.file.full_src || ctx.file.src;
    return `/potree/examples/viewer.html?url=${encodeURIComponent(cloudUrl)}`;
  }, [ctx]);

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.fullscreenElement) window.history.back();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  if (loading) return <div className="p-6 text-[13px] text-ink-300">Loading viewer…</div>;
  if (!ctx) return (
    <div className="flex flex-col items-center justify-center gap-4 p-12 text-center">
      <p className="text-[14px] text-ink-300">No file selected, open a file from the explorer.</p>
      <Link
        href={fallbackHref}
        className="rounded-md bg-amber-500 px-4 py-2 text-[13px] font-semibold text-base-950 transition-colors hover:bg-amber-400"
      >
        Back to Explorer
      </Link>
    </div>
  );

  return (
    <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      {/* ── Main panel ── */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-4 rounded-md border border-base-800 bg-base-900/40 p-4"
      >
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[12px] tracking-[0.22em] text-amber-500">Point Cloud Viewer</p>
            <h1 className="mt-1.5 font-display text-[22px] font-semibold leading-tight tracking-[-0.015em] text-white sm:text-[26px]">
              {ctx.file.file_name}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleFullscreen}
              className="inline-flex items-center gap-1.5 rounded-md border border-base-700 px-3 py-1.5 text-[12px] text-white transition-colors hover:border-ink-300"
            >
              {isFullscreen ? (
                <><Minimize2 size={12} /> Exit fullscreen</>
              ) : (
                <><Maximize2 size={12} /> Fullscreen</>
              )}
            </button>
            <Link
              href={backHref}
              className="inline-flex items-center gap-1.5 rounded-md border border-base-700 px-3 py-1.5 text-[12px] text-white transition-colors hover:border-ink-300"
            >
              <ArrowLeft size={12} />
              Back
            </Link>
          </div>
        </div>

        {/* Viewer iframe */}
        <div
          ref={containerRef}
          className="relative h-[70vh] overflow-hidden rounded-md border border-base-800 bg-black/40"
        >
          {potreeUrl ? (
            <iframe
              title="Point cloud viewer"
              src={potreeUrl}
              className="h-full w-full border-0"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-[13px] text-ink-400">
              No point cloud URL, open a file from the explorer.
            </div>
          )}

          {isFullscreen && (
            <button
              type="button"
              onClick={toggleFullscreen}
              className="absolute right-4 top-4 z-20 inline-flex items-center gap-1.5 rounded-md border border-base-700 px-3 py-1.5 text-[12px] text-white transition-colors hover:border-ink-300"
            >
              <Minimize2 size={12} />
              Exit fullscreen
            </button>
          )}
        </div>
      </motion.section>

      {/* ── Sidebar ── */}
      <motion.aside
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-3"
      >
        {/* Report overlay toggle */}
        <button
          type="button"
          onClick={() => setOverlayOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-md border border-base-700 px-4 py-3 text-left text-white transition-colors hover:border-ink-300"
        >
          <span className="font-display text-[14px] font-semibold">Field report</span>
          {overlayOpen
            ? <ChevronUp size={15} className="text-ink-400" />
            : <ChevronDown size={15} className="text-ink-400" />}
        </button>

        {overlayOpen && (
          <ReportBuilder
            file={ctx.file}
            viewerKind="point-cloud"
            aiDescription=""
            state={{ mode: 'point-cloud' }}
            viewerContext={{ roomSlug: ctx.roomSlug, date: ctx.date }}
          />
        )}
      </motion.aside>
    </div>
  );
}
