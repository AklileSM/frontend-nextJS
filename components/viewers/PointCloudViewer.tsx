'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ReportBuilder } from '@/components/reports/ReportBuilder';
import { useViewerContext } from './useViewerContext';

export function PointCloudViewer() {
  const { ctx, loading } = useViewerContext();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(true);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const backHref = useMemo(() => {
    if (!ctx) return '/app';
    return ctx.origin === 'project'
      ? `/app/projects/a6-stern?date=${encodeURIComponent(ctx.date)}`
      : `/app/room-explorer?room=${encodeURIComponent(ctx.roomSlug)}`;
  }, [ctx]);

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
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  if (loading) return <div className="p-6 text-ink-300">Loading viewer...</div>;
  if (!ctx) return <div className="p-6 text-ink-300">No file selected. Open a file from explorer first.</div>;

  return (
    <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="space-y-4 rounded-md border border-base-800 bg-base-900/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="font-display text-[26px] text-white">{ctx.file.file_name}</h1>
            <p className="text-[12px] text-ink-300">Point cloud viewer · Potree + report overlay</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={toggleFullscreen}
              className="rounded-md border border-base-700 px-3 py-1.5 text-[13px] text-white"
            >
              {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            </button>
            <Link href={backHref} className="rounded-md border border-base-700 px-3 py-1.5 text-[13px] text-white">
              Back
            </Link>
          </div>
        </div>

        <div ref={containerRef} className="h-[70vh] overflow-hidden rounded-md border border-base-800 bg-black/30">
          {potreeUrl ? (
            <iframe title="Point cloud viewer" src={potreeUrl} className="h-full w-full border-0" />
          ) : (
            <div className="flex h-full items-center justify-center text-[13px] text-ink-300">
              No point cloud URL. Open from explorer.
            </div>
          )}
          {isFullscreen && (
            <button
              type="button"
              onClick={toggleFullscreen}
              className="absolute right-4 top-4 z-20 rounded-md bg-base-950/80 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-base-900"
            >
              Exit Fullscreen
            </button>
          )}
        </div>
      </section>

      <aside className="space-y-3">
        <button
          type="button"
          onClick={() => setOverlayOpen((v) => !v)}
          className="w-full rounded-md border border-base-700 px-3 py-2 text-left text-[13px] text-white"
        >
          {overlayOpen ? 'Hide Report Overlay' : 'Show Report Overlay'}
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
      </aside>
    </div>
  );
}
