'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { getAccessToken } from '@/auth/authSession';
import { useViewerContext } from './useViewerContext';
import { backHrefFor } from '@/components/explorer/viewerContext';

export function PdfViewer() {
  const { ctx, loading, fallbackHref } = useViewerContext();
  const searchParams = useSearchParams();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const srcFromQuery = (searchParams.get('src') || '').trim();
  const nameFromQuery = (searchParams.get('name') || '').trim();
  const activePdfSrc = srcFromQuery || (ctx?.file.full_src || ctx?.file.src || '');
  const displayName = nameFromQuery || ctx?.file.file_name || 'Report PDF';

  const backHref = useMemo(() => {
    if (!ctx || !ctx.roomSlug || !ctx.date) return fallbackHref;
    return backHrefFor(ctx);
  }, [ctx, fallbackHref]);

  useEffect(() => {
    let mounted = true;
    let objectUrlToRevoke: string | null = null;

    const loadPdf = async () => {
      if (!activePdfSrc) return;
      if (ctx && !srcFromQuery && ctx.file.type !== 'pdf') {
        if (mounted) setError('This viewer only supports PDF files.');
        return;
      }
      setFetching(true);
      setError(null);
      try {
        const token = getAccessToken();
        const response = await fetch(activePdfSrc, {
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
  }, [activePdfSrc, ctx, srcFromQuery]);

  if (loading && !srcFromQuery) return <div className="p-6 text-ink-300">Loading viewer…</div>;
  if (!activePdfSrc) return (
    <div className="flex flex-col items-center justify-center gap-4 p-12 text-center">
      <p className="text-[14px] text-ink-300">No file selected — open a PDF from the explorer.</p>
      <Link href={fallbackHref} className="rounded-md bg-amber-500 px-4 py-2 text-[13px] font-semibold text-base-950 hover:bg-amber-400">
        Back to Explorer
      </Link>
    </div>
  );

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-base-800 bg-base-900/40 p-4">
        <div>
          <p className="font-mono text-[12px] tracking-[0.22em] text-amber-500">PDF Viewer</p>
          <h1 className="mt-1.5 font-display text-[22px] font-semibold leading-tight tracking-[-0.015em] text-white sm:text-[26px]">{displayName}</h1>
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
