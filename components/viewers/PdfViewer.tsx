'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { getAccessToken } from '@/auth/authSession';
import { useViewerContext } from './useViewerContext';

export function PdfViewer() {
  const { ctx, loading } = useViewerContext();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);

  const backHref = useMemo(() => {
    if (!ctx) return '/app';
    return ctx.origin === 'project'
      ? `/app/projects/a6-stern?date=${encodeURIComponent(ctx.date)}`
      : `/app/room-explorer?room=${encodeURIComponent(ctx.roomSlug)}`;
  }, [ctx]);

  useEffect(() => {
    let mounted = true;
    let objectUrlToRevoke: string | null = null;

    const loadPdf = async () => {
      if (!ctx) return;
      if (ctx.file.type !== 'pdf') {
        if (mounted) setError('This viewer only supports PDF files.');
        return;
      }
      setFetching(true);
      setError(null);
      try {
        const token = getAccessToken();
        const response = await fetch(ctx.file.full_src || ctx.file.src, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!response.ok) {
          throw new Error(`Failed to load PDF (${response.status}).`);
        }
        const blob = await response.blob();
        if (blob.type && !blob.type.includes('pdf')) {
          throw new Error(`Unexpected content type: ${blob.type}`);
        }
        const objectUrl = URL.createObjectURL(blob);
        objectUrlToRevoke = objectUrl;
        if (mounted) setPdfUrl(objectUrl);
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Could not load PDF.');
        }
      } finally {
        if (mounted) setFetching(false);
      }
    };

    void loadPdf();

    return () => {
      mounted = false;
      if (objectUrlToRevoke) URL.revokeObjectURL(objectUrlToRevoke);
    };
  }, [ctx]);

  if (loading) return <div className="p-6 text-ink-300">Loading viewer...</div>;
  if (!ctx) return <div className="p-6 text-ink-300">No file selected. Open a PDF from explorer first.</div>;

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-base-800 bg-base-900/40 p-4">
        <div>
          <h1 className="font-display text-[26px] text-white">{ctx.file.file_name}</h1>
          <p className="text-[12px] text-ink-300">PDF viewer · authenticated fetch</p>
        </div>
        <Link href={backHref} className="rounded-md border border-base-700 px-3 py-1.5 text-[13px] text-white">
          Back
        </Link>
      </div>

      <div className="h-[78vh] overflow-hidden rounded-md border border-base-800 bg-black/20">
        {fetching ? (
          <div className="flex h-full items-center justify-center text-[13px] text-ink-300">Loading PDF...</div>
        ) : error ? (
          <div className="flex h-full items-center justify-center p-6 text-center text-[13px] text-red-300">
            {error}
          </div>
        ) : pdfUrl ? (
          <iframe title="PDF viewer" src={pdfUrl} className="h-full w-full border-0" />
        ) : (
          <div className="flex h-full items-center justify-center text-[13px] text-ink-300">
            PDF was not loaded.
          </div>
        )}
      </div>
    </div>
  );
}
