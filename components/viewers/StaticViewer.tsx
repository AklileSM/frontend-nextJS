'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { analyzeImage, createAnnotation, listAnnotations } from '@/services/apiClient';
import { ReportBuilder } from '@/components/reports/ReportBuilder';
import type { ApiAnnotation } from '@/types/api';
import { useViewerContext } from './useViewerContext';

export function StaticViewer() {
  const { ctx, loading } = useViewerContext();
  const [scale, setScale] = useState(1);
  const [aiDescription, setAiDescription] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [annotations, setAnnotations] = useState<ApiAnnotation[]>([]);
  const [loadingAnnotations, setLoadingAnnotations] = useState(false);

  const backHref = useMemo(() => {
    if (!ctx) return '/app';
    return ctx.origin === 'project'
      ? `/app/projects/a6-stern?date=${encodeURIComponent(ctx.date)}`
      : `/app/room-explorer?room=${encodeURIComponent(ctx.roomSlug)}`;
  }, [ctx]);

  const loadAnnotations = async () => {
    if (!ctx) return;
    setLoadingAnnotations(true);
    try {
      const data = await listAnnotations(ctx.file.id);
      setAnnotations(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not load annotations.');
    } finally {
      setLoadingAnnotations(false);
    }
  };

  const runAi = async () => {
    if (!ctx || analyzing) return;
    setAnalyzing(true);
    try {
      const result = await analyzeImage(ctx.file.full_src || ctx.file.src, ctx.file.id);
      setAiDescription(result);
      toast.success('AI analysis complete.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'AI analysis failed.');
    } finally {
      setAnalyzing(false);
    }
  };

  const addAnnotation = async () => {
    if (!ctx) return;
    const text = window.prompt('Annotation text');
    if (!text?.trim()) return;
    try {
      const ann = await createAnnotation({
        fileId: ctx.file.id,
        x: 0.5,
        y: 0.5,
        text: text.trim(),
      });
      setAnnotations((prev) => [ann, ...prev]);
      toast.success('Annotation added.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create annotation.');
    }
  };

  if (loading) return <div className="p-6 text-ink-300">Loading viewer...</div>;
  if (!ctx) return <div className="p-6 text-ink-300">No file selected. Open a file from explorer first.</div>;

  return (
    <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="space-y-4 rounded-md border border-base-800 bg-base-900/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="font-display text-[26px] text-white">{ctx.file.file_name}</h1>
            <p className="text-[12px] text-ink-300">Static viewer · pan/zoom · annotations · AI</p>
          </div>
          <Link href={backHref} className="rounded-md border border-base-700 px-3 py-1.5 text-[13px] text-white">
            Back
          </Link>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setScale((s) => Math.max(0.5, Number((s - 0.1).toFixed(2))))}
            className="rounded border border-base-700 px-2 py-1 text-[12px]"
          >
            Zoom -
          </button>
          <button
            type="button"
            onClick={() => setScale((s) => Math.min(3, Number((s + 0.1).toFixed(2))))}
            className="rounded border border-base-700 px-2 py-1 text-[12px]"
          >
            Zoom +
          </button>
          <button
            type="button"
            onClick={runAi}
            disabled={analyzing}
            className="rounded border border-base-700 px-2 py-1 text-[12px] disabled:opacity-50"
          >
            {analyzing ? 'Running AI...' : 'Run AI'}
          </button>
          <button
            type="button"
            onClick={addAnnotation}
            className="rounded border border-base-700 px-2 py-1 text-[12px]"
          >
            Add Annotation
          </button>
          <button
            type="button"
            onClick={loadAnnotations}
            disabled={loadingAnnotations}
            className="rounded border border-base-700 px-2 py-1 text-[12px] disabled:opacity-50"
          >
            {loadingAnnotations ? 'Loading...' : 'Load Annotations'}
          </button>
        </div>

        <div className="overflow-auto rounded-md border border-base-800 bg-black/20 p-3">
          {ctx.file.type === 'video' ? (
            <video src={ctx.file.full_src || ctx.file.src} controls className="max-h-[70vh] w-full rounded-md" />
          ) : (
            <img
              src={ctx.file.full_src || ctx.file.src}
              alt={ctx.file.file_name}
              className="mx-auto max-h-[70vh] origin-top rounded-md"
              style={{ transform: `scale(${scale})` }}
            />
          )}
        </div>

        {aiDescription && (
          <div className="rounded-md border border-base-800 bg-base-950/60 p-3 text-[13px] text-ink-200">
            <p className="mb-1 font-medium text-white">AI description</p>
            <p>{aiDescription}</p>
          </div>
        )}

        <div className="rounded-md border border-base-800 bg-base-950/60 p-3">
          <p className="mb-2 text-[13px] font-medium text-white">Annotations ({annotations.length})</p>
          <div className="space-y-2">
            {annotations.map((a) => (
              <div key={a.id} className="rounded border border-base-800 px-2 py-1 text-[12px] text-ink-200">
                {a.text}
              </div>
            ))}
            {annotations.length === 0 && <p className="text-[12px] text-ink-400">No annotations loaded.</p>}
          </div>
        </div>
      </section>

      <ReportBuilder
        file={ctx.file}
        viewerKind="static"
        aiDescription={aiDescription}
        state={{ scale, annotationsCount: annotations.length }}
      />
    </div>
  );
}
