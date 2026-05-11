'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
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
  const [placingAnnotation, setPlacingAnnotation] = useState(false);
  const [draftPin, setDraftPin] = useState<{ x: number; y: number } | null>(null);
  const [draftText, setDraftText] = useState('');
  const [savingAnnotation, setSavingAnnotation] = useState(false);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);

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

  useEffect(() => {
    if (!ctx) return;
    setAnnotations([]);
    setSelectedAnnotationId(null);
    setDraftPin(null);
    setDraftText('');
    setPlacingAnnotation(false);
    void loadAnnotations();
  }, [ctx?.file.id]);

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
    if (!ctx || !draftPin || !draftText.trim() || savingAnnotation) return;
    setSavingAnnotation(true);
    try {
      const ann = await createAnnotation({
        fileId: ctx.file.id,
        x: draftPin.x,
        y: draftPin.y,
        text: draftText.trim(),
      });
      setAnnotations((prev) => [ann, ...prev]);
      setSelectedAnnotationId(ann.id);
      setDraftPin(null);
      setDraftText('');
      setPlacingAnnotation(false);
      toast.success('Annotation added.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create annotation.');
    } finally {
      setSavingAnnotation(false);
    }
  };

  const onImageClickForAnnotation: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (!placingAnnotation) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    setDraftPin({ x, y });
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
          <Link
            href="/app/viewer/panorama"
            className="rounded border border-base-700 px-2 py-1 text-[12px] text-white hover:border-ink-300"
          >
            Open in Panorama
          </Link>
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
            onClick={() => {
              setPlacingAnnotation((v) => !v);
              setDraftPin(null);
              setDraftText('');
            }}
            className="rounded border border-base-700 px-2 py-1 text-[12px]"
          >
            {placingAnnotation ? 'Cancel Annotation' : 'New Annotation'}
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
            <div className="flex justify-center">
              <div className="origin-top" style={{ transform: `scale(${scale})` }}>
                <div
                  className={`relative inline-block ${placingAnnotation ? 'cursor-crosshair' : ''}`}
                  onClick={onImageClickForAnnotation}
                >
                  <img
                    src={ctx.file.full_src || ctx.file.src}
                    alt={ctx.file.file_name}
                    className="block max-h-[70vh] rounded-md"
                  />

                  {annotations.map((a, idx) => {
                    const active = selectedAnnotationId === a.id;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAnnotationId(a.id);
                        }}
                        title={a.text}
                        className={`absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 text-[10px] font-semibold ${
                          active
                            ? 'border-amber-200 bg-amber-500 text-base-950'
                            : 'border-amber-400 bg-base-950 text-amber-300'
                        }`}
                        style={{ left: `${a.x * 100}%`, top: `${a.y * 100}%` }}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}

                  {draftPin && (
                    <span
                      className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-emerald-300 bg-emerald-500/30"
                      style={{ left: `${draftPin.x * 100}%`, top: `${draftPin.y * 100}%` }}
                    />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {placingAnnotation && (
          <div className="rounded-md border border-base-800 bg-base-950/60 p-3">
            <p className="mb-2 text-[13px] font-medium text-white">New annotation</p>
            {!draftPin ? (
              <p className="text-[12px] text-ink-300">
                Click a point on the image to place an annotation marker.
              </p>
            ) : (
              <div className="space-y-2">
                <p className="font-mono text-[11px] text-ink-300">
                  Marker at x={draftPin.x.toFixed(3)} · y={draftPin.y.toFixed(3)}
                </p>
                <textarea
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                  placeholder="Describe what you observed at this point..."
                  className="min-h-[84px] w-full rounded border border-base-700 bg-base-900 px-2 py-1.5 text-[12px] text-white outline-none focus:border-amber-500"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDraftPin(null);
                      setDraftText('');
                      setPlacingAnnotation(false);
                    }}
                    className="rounded border border-base-700 px-2.5 py-1 text-[12px] text-ink-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={addAnnotation}
                    disabled={!draftText.trim() || savingAnnotation}
                    className="rounded bg-amber-500 px-2.5 py-1 text-[12px] font-medium text-base-950 disabled:opacity-50"
                  >
                    {savingAnnotation ? 'Saving...' : 'Save Annotation'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

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
              <div
                key={a.id}
                className={`rounded border px-2 py-1 text-[12px] ${
                  selectedAnnotationId === a.id
                    ? 'border-amber-500/60 bg-amber-500/10 text-amber-100'
                    : 'border-base-800 text-ink-200'
                }`}
              >
                <p className="font-mono text-[10px] text-ink-300">
                  x={a.x.toFixed(3)} · y={a.y.toFixed(3)}
                </p>
                <p>{a.text}</p>
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
