'use client';

import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  analyzeImage,
  createAnnotation,
  deleteAnnotation,
  listAnnotations,
  updateAnnotation,
} from '@/services/apiClient';
import { ReportBuilder } from '@/components/reports/ReportBuilder';
import { AnnotationDeleteConfirm } from '@/components/viewers/AnnotationDeleteConfirm';
import type { ApiAnnotation } from '@/types/api';
import { useViewerContext } from './useViewerContext';
import { backHrefFor } from '@/components/explorer/viewerContext';

type AnnotationFormState = {
  mode: 'create' | 'edit';
  annotationId?: string;
  pin: { x: number; y: number };
  text: string;
};

export function StaticViewer() {
  const { ctx, loading, fallbackHref } = useViewerContext();
  const [scale, setScale] = useState(1);
  const [aiDescription, setAiDescription] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [annotations, setAnnotations] = useState<ApiAnnotation[]>([]);
  const [placingAnnotation, setPlacingAnnotation] = useState(false);
  const [annotationForm, setAnnotationForm] = useState<AnnotationFormState | null>(null);
  const [savingAnnotation, setSavingAnnotation] = useState(false);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [detailsForId, setDetailsForId] = useState<string | null>(null);
  const [pendingDeleteAnnotationId, setPendingDeleteAnnotationId] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const backHref = useMemo(() => (ctx ? backHrefFor(ctx) : fallbackHref), [ctx, fallbackHref]);

  const loadAnnotations = async () => {
    if (!ctx) return;
    try {
      const data = await listAnnotations(ctx.file.id);
      setAnnotations(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not load annotations.');
    }
  };

  useEffect(() => {
    if (!ctx) return;
    setAnnotations([]);
    setSelectedAnnotationId(null);
    setPlacingAnnotation(false);
    setAnnotationForm(null);
    setShowAnnotations(true);
    setDetailsForId(null);
    setPendingDeleteAnnotationId(null);
    setScale((s) => Math.max(1, s));
    void loadAnnotations();
  }, [ctx?.file.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (annotationForm !== null) { setAnnotationForm(null); return; }
      if (detailsForId !== null) { setDetailsForId(null); return; }
      window.history.back();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [annotationForm, detailsForId]);

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

  const submitAnnotationForm = async () => {
    if (!ctx || !annotationForm || !annotationForm.text.trim() || savingAnnotation) return;
    setSavingAnnotation(true);
    try {
      if (annotationForm.mode === 'create') {
        const ann = await createAnnotation({
          fileId: ctx.file.id,
          x: annotationForm.pin.x,
          y: annotationForm.pin.y,
          text: annotationForm.text.trim(),
        });
        setAnnotations((prev) => [ann, ...prev]);
        setSelectedAnnotationId(ann.id);
        setPlacingAnnotation(false);
        toast.success('Annotation added.');
      } else if (annotationForm.annotationId) {
        const updated = await updateAnnotation({
          annotationId: annotationForm.annotationId,
          x: annotationForm.pin.x,
          y: annotationForm.pin.y,
          text: annotationForm.text.trim(),
        });
        setAnnotations((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
        setSelectedAnnotationId(updated.id);
        toast.success('Annotation updated.');
      }
      setAnnotationForm(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save annotation.');
    } finally {
      setSavingAnnotation(false);
    }
  };

  const onImageClickForAnnotation: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (annotationForm?.mode === 'edit') {
      const rect = e.currentTarget.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      setAnnotationForm((prev) => (prev ? { ...prev, pin: { x, y } } : null));
      return;
    }
    if (placingAnnotation && !annotationForm) {
      const rect = e.currentTarget.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      setAnnotationForm({ mode: 'create', pin: { x, y }, text: '' });
    }
  };

  const detailsAnnotation = useMemo(
    () => (detailsForId ? annotations.find((a) => a.id === detailsForId) ?? null : null),
    [annotations, detailsForId],
  );

  const detailsAnnotationIndex = useMemo(() => {
    if (!detailsForId) return -1;
    return annotations.findIndex((a) => a.id === detailsForId);
  }, [annotations, detailsForId]);

  const pendingDeleteAnnotation = useMemo(
    () =>
      pendingDeleteAnnotationId
        ? annotations.find((a) => a.id === pendingDeleteAnnotationId) ?? null
        : null,
    [annotations, pendingDeleteAnnotationId],
  );

  const performDeleteAnnotation = async () => {
    if (!pendingDeleteAnnotationId) return;
    const id = pendingDeleteAnnotationId;
    try {
      await deleteAnnotation(id);
      setAnnotations((prev) => prev.filter((a) => a.id !== id));
      if (selectedAnnotationId === id) setSelectedAnnotationId(null);
      setPendingDeleteAnnotationId(null);
      setDetailsForId(null);
      toast.success('Annotation deleted.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete annotation.');
    }
  };

  const openEditForm = (a: ApiAnnotation) => {
    setSelectedAnnotationId(a.id);
    setDetailsForId(null);
    setAnnotationForm({
      mode: 'edit',
      annotationId: a.id,
      pin: { x: a.x, y: a.y },
      text: a.text,
    });
  };

  const crosshairActive = placingAnnotation || annotationForm?.mode === 'edit';

  if (loading) return <div className="p-6 text-ink-300">Loading viewer…</div>;
  if (!ctx) return (
    <div className="flex flex-col items-center justify-center gap-4 p-12 text-center">
      <p className="text-[14px] text-ink-300">No file selected — open a file from the explorer.</p>
      <Link href={fallbackHref} className="rounded-md bg-amber-500 px-4 py-2 text-[13px] font-semibold text-base-950 hover:bg-amber-400">
        Back to Explorer
      </Link>
    </div>
  );

  return (
    <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="space-y-4 rounded-md border border-base-800 bg-base-900/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-mono text-[12px] tracking-[0.22em] text-amber-500">Static Viewer</p>
            <h1 className="mt-1.5 font-display text-[22px] font-semibold leading-tight tracking-[-0.015em] text-white sm:text-[26px]">{ctx.file.file_name}</h1>
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
            onClick={runAi}
            disabled={analyzing}
            className="rounded border border-base-700 px-2 py-1 text-[12px] disabled:opacity-50"
          >
            {analyzing ? 'Generating...' : 'Generate Description'}
          </button>
          <button
            type="button"
            onClick={() => {
              setPlacingAnnotation((v) => !v);
              setAnnotationForm(null);
            }}
            className="rounded border border-base-700 px-2 py-1 text-[12px]"
          >
            {placingAnnotation ? 'Cancel Annotation' : 'New Annotation'}
          </button>
          <button
            type="button"
            onClick={() => setShowAnnotations((v) => !v)}
            className="rounded border border-base-700 px-2 py-1 text-[12px]"
          >
            {showAnnotations ? 'Hide Annotations' : 'Show Annotations'}
          </button>
        </div>

        <div className="relative overflow-auto rounded-md border border-base-800 bg-black/20 p-3">
          {ctx.file.type === 'video' ? (
            <div className="relative">
              <video
                ref={videoRef}
                src={ctx.file.full_src || ctx.file.src}
                controls
                className="max-h-[70vh] w-full rounded-md"
              />
              <button
                type="button"
                onClick={() => videoRef.current?.requestFullscreen()}
                aria-label="Fullscreen"
                className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-md border border-base-700 bg-base-950/80 text-white backdrop-blur-sm transition-colors hover:bg-base-800"
              >
                <Maximize2 size={14} />
              </button>
            </div>
          ) : (
            <>
              <div className="pointer-events-none absolute bottom-4 right-4 z-10 flex flex-col items-stretch gap-1 rounded-md border border-base-700 bg-base-950/90 p-1 shadow-lg backdrop-blur-sm">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setScale((s) => Math.min(3, Number((s + 0.1).toFixed(2))));
                  }}
                  className="pointer-events-auto rounded border border-base-600 px-2.5 py-1.5 text-[13px] font-medium text-white hover:bg-base-800"
                  aria-label="Zoom in"
                >
                  +
                </button>
                <span className="pointer-events-none px-1 py-0.5 text-center font-mono text-[10px] text-ink-300">
                  {Math.round(scale * 100)}%
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setScale((s) => Math.max(1, Number((s - 0.1).toFixed(2))));
                  }}
                  className="pointer-events-auto rounded border border-base-600 px-2.5 py-1.5 text-[13px] font-medium text-white hover:bg-base-800"
                  aria-label="Zoom out"
                >
                  −
                </button>
              </div>
              <div className="flex justify-center">
                <div className="origin-top" style={{ transform: `scale(${scale})` }}>
                  <div
                    className={`relative inline-block ${crosshairActive ? 'cursor-crosshair' : ''}`}
                    onClick={onImageClickForAnnotation}
                  >
                    <img
                      src={ctx.file.full_src || ctx.file.src}
                      alt={ctx.file.file_name}
                      className="block max-h-[70vh] rounded-md"
                    />

                    {showAnnotations &&
                      annotations.map((a, idx) => {
                        const active = selectedAnnotationId === a.id;
                        const markerX =
                          annotationForm?.mode === 'edit' &&
                          annotationForm.annotationId === a.id &&
                          annotationForm.pin
                            ? annotationForm.pin.x
                            : a.x;
                        const markerY =
                          annotationForm?.mode === 'edit' &&
                          annotationForm.annotationId === a.id &&
                          annotationForm.pin
                            ? annotationForm.pin.y
                            : a.y;
                        return (
                          <button
                            key={a.id}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedAnnotationId(a.id);
                              setDetailsForId(a.id);
                              setPlacingAnnotation(false);
                              setAnnotationForm(null);
                              requestAnimationFrame(() => {
                                document
                                  .getElementById(`annotation-card-${a.id}`)
                                  ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                              });
                            }}
                            title={a.text}
                            className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 text-[10px] font-semibold transition-all duration-150 ${
                              active
                                ? 'z-20 h-7 w-7 border-amber-100 bg-amber-400 text-base-950 shadow-[0_0_0_3px_rgba(251,191,36,0.45)] ring-2 ring-amber-200/90 hover:scale-110 hover:shadow-[0_0_16px_rgba(251,191,36,0.55)]'
                                : 'h-5 w-5 border-amber-400 bg-base-950 text-amber-300 hover:z-30 hover:scale-125 hover:border-amber-200 hover:bg-amber-500/25 hover:text-amber-50 hover:shadow-[0_0_14px_rgba(251,191,36,0.4)]'
                            }`}
                            style={{ left: `${markerX * 100}%`, top: `${markerY * 100}%` }}
                          >
                            {idx + 1}
                          </button>
                        );
                      })}

                    {annotationForm?.mode === 'create' && (
                      <span
                        className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-emerald-300 bg-emerald-500/30"
                        style={{
                          left: `${annotationForm.pin.x * 100}%`,
                          top: `${annotationForm.pin.y * 100}%`,
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {aiDescription && (
          <div className="rounded-md border border-base-800 bg-base-950/60 p-3 text-[13px] text-ink-200">
            <p className="mb-1 font-medium text-white">AI description</p>
            <p>{aiDescription}</p>
          </div>
        )}
      </section>

      <ReportBuilder
        file={ctx.file}
        viewerKind="static"
        aiDescription={aiDescription}
        state={{ scale }}
        viewerContext={{ roomSlug: ctx.roomSlug, date: ctx.date }}
        annotations={annotations}
      />

      {/* Annotation form (new + edit) */}
      <AnimatePresence>
        {annotationForm && (
          <motion.div
            key="form-shell"
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <motion.div
              key="form-bd"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => !savingAnnotation && setAnnotationForm(null)}
              className="absolute inset-0 bg-base-950/75 backdrop-blur-sm"
            />
            <motion.div
              key="form-md"
              initial={{ opacity: 0, scale: 0.96, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 4 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="annotation-form-title"
              className="relative z-10 w-full max-w-[480px] rounded-lg border border-base-700 bg-base-900 shadow-2xl shadow-black/60"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="border-b border-base-800 px-5 py-4">
                <h2 id="annotation-form-title" className="font-display text-[18px] font-semibold text-white">
                  {annotationForm.mode === 'create' ? 'New annotation' : 'Edit annotation'}
                </h2>
                <p className="mt-1 font-mono text-[11px] text-ink-300">
                  x={annotationForm.pin.x.toFixed(3)} · y={annotationForm.pin.y.toFixed(3)}
                </p>
                {annotationForm.mode === 'edit' && (
                  <p className="mt-2 text-[12px] text-ink-300">Click the image to move this marker.</p>
                )}
              </div>
              <div className="px-5 py-4">
                <label htmlFor="annotation-form-text" className="sr-only">
                  Annotation text
                </label>
                <textarea
                  id="annotation-form-text"
                  value={annotationForm.text}
                  onChange={(e) =>
                    setAnnotationForm((prev) => (prev ? { ...prev, text: e.target.value } : null))
                  }
                  placeholder="Describe what you observed at this point..."
                  rows={5}
                  className="w-full rounded-md border border-base-700 bg-base-950 px-3 py-2 text-[13px] text-white outline-none focus:border-amber-500"
                />
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-base-800 px-5 py-3">
                <button
                  type="button"
                  disabled={savingAnnotation}
                  onClick={() => setAnnotationForm(null)}
                  className="rounded-md border border-base-700 px-3.5 py-1.5 text-[13px] font-medium text-white transition-colors hover:border-ink-300 hover:bg-base-800 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!annotationForm.text.trim() || savingAnnotation}
                  onClick={() => void submitAnnotationForm()}
                  className="rounded-md bg-amber-500 px-3.5 py-1.5 text-[13px] font-semibold text-base-950 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingAnnotation ? 'Saving…' : 'Save'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Details + actions (Edit / Delete) */}
      <AnimatePresence>
        {detailsAnnotation && detailsAnnotationIndex >= 0 && (
          <motion.div
            key="det-shell"
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <motion.div
              key="det-bd"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setDetailsForId(null)}
              className="absolute inset-0 bg-base-950/75 backdrop-blur-sm"
            />
            <motion.div
              key="det-md"
              initial={{ opacity: 0, scale: 0.96, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 4 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="annotation-details-title"
              className="relative z-10 w-full max-w-[480px] rounded-lg border border-base-700 bg-base-900 shadow-2xl shadow-black/60"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="border-b border-base-800 px-5 py-4">
                <h2 id="annotation-details-title" className="font-display text-[18px] font-semibold text-white">
                  Annotation {detailsAnnotationIndex + 1}
                </h2>
                <p className="mt-1 font-mono text-[11px] text-ink-300">
                  x={detailsAnnotation.x.toFixed(3)} · y={detailsAnnotation.y.toFixed(3)}
                </p>
              </div>
              <div className="max-h-[min(50vh,360px)] overflow-y-auto px-5 py-4 text-[13px] leading-relaxed text-ink-200">
                {detailsAnnotation.text}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-base-800 px-5 py-3">
                <button
                  type="button"
                  onClick={() => setDetailsForId(null)}
                  className="rounded-md border border-base-700 px-3.5 py-1.5 text-[13px] font-medium text-white transition-colors hover:border-ink-300 hover:bg-base-800"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => openEditForm(detailsAnnotation)}
                  className="rounded-md border border-base-700 px-3.5 py-1.5 text-[13px] font-medium text-white transition-colors hover:border-ink-300 hover:bg-base-800"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPendingDeleteAnnotationId(detailsAnnotation.id);
                    setDetailsForId(null);
                  }}
                  className="rounded-md border border-red-800/50 px-3.5 py-1.5 text-[13px] font-medium text-red-200 transition-colors hover:border-red-600/60 hover:bg-red-950/50"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnnotationDeleteConfirm
        annotation={pendingDeleteAnnotation}
        onConfirm={performDeleteAnnotation}
        onCancel={() => setPendingDeleteAnnotationId(null)}
      />
    </div>
  );
}
