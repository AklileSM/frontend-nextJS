'use client';

import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Maximize2, Paperclip, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  analyzeImage,
  createAnnotation,
  deleteAnnotation,
  deleteAnnotationAttachment,
  listAnnotations,
  updateAnnotation,
  uploadAnnotationAttachment,
} from '@/services/apiClient';
import { ReportBuilder } from '@/components/reports/ReportBuilder';
import { AnnotationDeleteConfirm } from '@/components/viewers/AnnotationDeleteConfirm';
import type { ApiAnnotation, AnnotationFlag } from '@/types/api';
import { useViewerContext } from './useViewerContext';
import { backHrefFor } from '@/components/explorer/viewerContext';

// Per-flag visual treatment. Pin color flows from this; details modal uses
// `chip` for the small badge. Keep additions in sync with the backend
// _ALLOWED_FLAGS taxonomy and lib/observationReportFlags.ts.
const FLAG_META: Record<AnnotationFlag, { label: string; pin: string; chip: string; ring: string }> = {
  safety:  { label: 'Safety',  pin: 'bg-red-500 border-red-200 text-white',        chip: 'bg-red-500/15 text-red-300',     ring: 'ring-red-400/40'    },
  quality: { label: 'Quality', pin: 'bg-amber-400 border-amber-100 text-base-950', chip: 'bg-amber-500/15 text-amber-300', ring: 'ring-amber-400/40'  },
  delayed: { label: 'Delayed', pin: 'bg-sky-500 border-sky-200 text-white',        chip: 'bg-sky-500/15 text-sky-300',     ring: 'ring-sky-400/40'    },
};
const FLAG_ORDER: AnnotationFlag[] = ['safety', 'quality', 'delayed'];
const UNFLAGGED_PIN = 'bg-base-950 border-amber-400 text-amber-300';
const UNFLAGGED_RING = 'ring-amber-400/40';

type AnnotationFormState = {
  mode: 'create' | 'edit';
  annotationId?: string;
  pin: { x: number; y: number };
  text: string;
  flag: AnnotationFlag | null;
  linkedAnnotationId: string | null;
  // The user-selected file for upload. Cleared after a successful save.
  newAttachment: File | null;
  // Set in edit mode when the annotation already has an attachment in MinIO.
  existingAttachmentUrl: string | null;
  // Edit-mode flag set when the user wants to drop an existing attachment.
  removeExistingAttachment: boolean;
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
      // 1) Save the row (create or update) with the new flag/link fields.
      let saved: ApiAnnotation;
      if (annotationForm.mode === 'create') {
        saved = await createAnnotation({
          fileId: ctx.file.id,
          x: annotationForm.pin.x,
          y: annotationForm.pin.y,
          text: annotationForm.text.trim(),
          flag: annotationForm.flag ?? null,
          linkedAnnotationId: annotationForm.linkedAnnotationId ?? null,
        });
      } else if (annotationForm.annotationId) {
        saved = await updateAnnotation({
          annotationId: annotationForm.annotationId,
          x: annotationForm.pin.x,
          y: annotationForm.pin.y,
          text: annotationForm.text.trim(),
          flag: annotationForm.flag ?? null,
          linkedAnnotationId: annotationForm.linkedAnnotationId ?? null,
          clearLink: annotationForm.linkedAnnotationId === null,
        });
      } else {
        return;
      }

      // 2) Attachment changes run as separate calls — multipart upload for
      //    new files, DELETE to drop an existing one. Failures here surface
      //    as a toast but don't roll back the row save.
      if (annotationForm.removeExistingAttachment && !annotationForm.newAttachment) {
        try {
          saved = await deleteAnnotationAttachment(saved.id);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Could not remove attachment.');
        }
      }
      if (annotationForm.newAttachment) {
        try {
          saved = await uploadAnnotationAttachment(saved.id, annotationForm.newAttachment);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Could not upload attachment.');
        }
      }

      if (annotationForm.mode === 'create') {
        setAnnotations((prev) => [saved, ...prev]);
        setPlacingAnnotation(false);
        toast.success('Annotation added.');
      } else {
        setAnnotations((prev) => prev.map((a) => (a.id === saved.id ? saved : a)));
        toast.success('Annotation updated.');
      }
      setSelectedAnnotationId(saved.id);
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
      setAnnotationForm({
        mode: 'create',
        pin: { x, y },
        text: '',
        flag: null,
        linkedAnnotationId: null,
        newAttachment: null,
        existingAttachmentUrl: null,
        removeExistingAttachment: false,
      });
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
      flag: a.flag ?? null,
      linkedAnnotationId: a.linked_annotation_id ?? null,
      newAttachment: null,
      existingAttachmentUrl: a.attachment_url ?? null,
      removeExistingAttachment: false,
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
                        // Pin color comes from the flag taxonomy; unflagged
                        // annotations fall back to the original amber treatment.
                        const flagMeta = a.flag ? FLAG_META[a.flag] : null;
                        const pinColor = flagMeta ? flagMeta.pin : UNFLAGGED_PIN;
                        const ringColor = flagMeta ? flagMeta.ring : UNFLAGGED_RING;
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
                            className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 text-[10px] font-semibold transition-all duration-150 ${pinColor} ${
                              active
                                ? `z-20 h-7 w-7 shadow-lg ring-2 ${ringColor} hover:scale-110`
                                : 'z-10 h-5 w-5 hover:z-30 hover:scale-125'
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
            <p className="mb-2 font-medium text-white">AI description</p>
            <ReactMarkdown
              components={{
                p:      ({ children }) => <p className="my-1 leading-relaxed">{children}</p>,
                strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
                em:     ({ children }) => <em className="italic text-ink-300">{children}</em>,
                ul:     ({ children }) => <ul className="my-1 list-disc pl-4 space-y-0.5">{children}</ul>,
                ol:     ({ children }) => <ol className="my-1 list-decimal pl-4 space-y-0.5">{children}</ol>,
                li:     ({ children }) => <li>{children}</li>,
                h1:     ({ children }) => <h1 className="mt-3 mb-1 text-[14px] font-semibold text-white">{children}</h1>,
                h2:     ({ children }) => <h2 className="mt-3 mb-1 text-[13px] font-semibold text-white">{children}</h2>,
                h3:     ({ children }) => <h3 className="mt-2 mb-1 font-semibold text-white">{children}</h3>,
              }}
            >
              {aiDescription}
            </ReactMarkdown>
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
              className="relative z-10 w-full max-w-[520px] max-h-[85vh] overflow-hidden rounded-lg border border-base-700 bg-base-900 shadow-2xl shadow-black/60 flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* × corner replaces the previous bottom Cancel button. Escape
                  and backdrop-click still dismiss, so dismissal has three
                  equally valid affordances. */}
              <button
                type="button"
                disabled={savingAnnotation}
                onClick={() => setAnnotationForm(null)}
                aria-label="Close"
                className="absolute right-2 top-2 z-20 inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-300 transition-colors hover:bg-base-800 hover:text-white disabled:opacity-50"
              >
                <X size={16} />
              </button>

              <div className="border-b border-base-800 px-5 py-4 pr-12">
                <h2 id="annotation-form-title" className="font-display text-[18px] font-semibold text-white">
                  {annotationForm.mode === 'create' ? 'New annotation' : 'Edit annotation'}
                </h2>
                {annotationForm.mode === 'edit' && (
                  <p className="mt-1 text-[12px] text-ink-300">Click the image to move this marker.</p>
                )}
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                <div>
                  <label htmlFor="annotation-form-text" className="block font-mono text-[10px] uppercase tracking-[0.18em] text-ink-300">
                    Note
                  </label>
                  <textarea
                    id="annotation-form-text"
                    value={annotationForm.text}
                    onChange={(e) =>
                      setAnnotationForm((prev) => (prev ? { ...prev, text: e.target.value } : null))
                    }
                    placeholder="Describe what you observed at this point..."
                    rows={5}
                    className="mt-1.5 w-full rounded-md border border-base-700 bg-base-950 px-3 py-2 text-[13px] text-white outline-none focus:border-amber-500"
                  />
                </div>

                {/* Flag picker — categorises the annotation and drives the
                    pin color. None is allowed (the original neutral pin). */}
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-300">Category</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setAnnotationForm((prev) => (prev ? { ...prev, flag: null } : null))
                      }
                      className={`rounded-full border px-3 py-1 text-[12px] font-medium transition-colors ${
                        annotationForm.flag === null
                          ? 'border-amber-500 bg-amber-500/10 text-amber-300'
                          : 'border-base-700 bg-base-950 text-ink-300 hover:border-ink-300'
                      }`}
                    >
                      None
                    </button>
                    {FLAG_ORDER.map((f) => {
                      const meta = FLAG_META[f];
                      const active = annotationForm.flag === f;
                      return (
                        <button
                          key={f}
                          type="button"
                          onClick={() =>
                            setAnnotationForm((prev) => (prev ? { ...prev, flag: f } : null))
                          }
                          className={`rounded-full border px-3 py-1 text-[12px] font-medium transition-colors ${
                            active
                              ? `${meta.chip} border-transparent`
                              : 'border-base-700 bg-base-950 text-ink-300 hover:border-ink-300'
                          }`}
                        >
                          {meta.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Same-file link picker. The list is built from the page-level
                    annotations array, excluding the one being edited. */}
                {(() => {
                  const linkable = annotations.filter((a) => a.id !== annotationForm.annotationId);
                  if (!linkable.length) return null;
                  return (
                    <div>
                      <label htmlFor="annotation-form-link" className="block font-mono text-[10px] uppercase tracking-[0.18em] text-ink-300">
                        Related annotation (optional)
                      </label>
                      <select
                        id="annotation-form-link"
                        value={annotationForm.linkedAnnotationId ?? ''}
                        onChange={(e) =>
                          setAnnotationForm((prev) =>
                            prev ? { ...prev, linkedAnnotationId: e.target.value || null } : null,
                          )
                        }
                        className="mt-1.5 w-full rounded-md border border-base-700 bg-base-950 px-3 py-2 text-[13px] text-white outline-none focus:border-amber-500"
                      >
                        <option value="">— none —</option>
                        {linkable.map((a) => {
                          // Use the page-wide index (1-based) so the label
                          // matches the number on the pin.
                          const idx = annotations.findIndex((x) => x.id === a.id);
                          const preview = (a.text || '').slice(0, 50);
                          return (
                            <option key={a.id} value={a.id}>
                              #{idx + 1}{preview ? ` — ${preview}` : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  );
                })()}

                {/* Image attachment. New uploads + drop-existing tracked separately. */}
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-300">Attachment</p>
                  {(() => {
                    const showExisting =
                      annotationForm.existingAttachmentUrl &&
                      !annotationForm.removeExistingAttachment &&
                      !annotationForm.newAttachment;
                    const previewSrc = annotationForm.newAttachment
                      ? URL.createObjectURL(annotationForm.newAttachment)
                      : showExisting
                        ? annotationForm.existingAttachmentUrl
                        : null;
                    return (
                      <div className="mt-1.5 space-y-2">
                        {previewSrc && (
                          <div className="relative inline-block">
                            <img
                              src={previewSrc}
                              alt="Attachment preview"
                              className="max-h-32 rounded-md border border-base-700 object-cover"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setAnnotationForm((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        newAttachment: null,
                                        removeExistingAttachment: !!prev.existingAttachmentUrl,
                                      }
                                    : null,
                                )
                              }
                              aria-label="Remove attachment"
                              className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-base-950/85 text-ink-200 hover:bg-red-600 hover:text-white"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        )}
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-base-700 bg-base-950 px-3 py-1.5 text-[12px] text-white hover:border-ink-300">
                          <Paperclip size={13} />
                          {previewSrc ? 'Replace image' : 'Attach image'}
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0] ?? null;
                              setAnnotationForm((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      newAttachment: f,
                                      removeExistingAttachment: false,
                                    }
                                  : null,
                              );
                              e.target.value = '';
                            }}
                          />
                        </label>
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-base-800 px-5 py-3">
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
              className="relative z-10 w-full max-w-[520px] max-h-[85vh] overflow-hidden rounded-lg border border-base-700 bg-base-900 shadow-2xl shadow-black/60 flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* × corner — replaces the previous footer Close button. */}
              <button
                type="button"
                onClick={() => setDetailsForId(null)}
                aria-label="Close"
                className="absolute right-2 top-2 z-20 inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-300 transition-colors hover:bg-base-800 hover:text-white"
              >
                <X size={16} />
              </button>

              <div className="border-b border-base-800 px-5 py-4 pr-12">
                <div className="flex items-center gap-2">
                  <h2 id="annotation-details-title" className="font-display text-[18px] font-semibold text-white">
                    Annotation {detailsAnnotationIndex + 1}
                  </h2>
                  {detailsAnnotation.flag && (
                    <span
                      className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] ${FLAG_META[detailsAnnotation.flag].chip}`}
                    >
                      {FLAG_META[detailsAnnotation.flag].label}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 text-[13px] leading-relaxed text-ink-200">
                <p className="whitespace-pre-wrap">{detailsAnnotation.text}</p>

                {/* Linked annotation reference, resolved to the pin number on
                    the image. Null after the linked row got deleted (the FK
                    set it null on the backend); we don't render the line. */}
                {detailsAnnotation.linked_annotation_id && (() => {
                  const linkedIdx = annotations.findIndex((a) => a.id === detailsAnnotation.linked_annotation_id);
                  if (linkedIdx < 0) return null;
                  return (
                    <p className="text-[12px] text-ink-300">
                      Related:{' '}
                      <button
                        type="button"
                        onClick={() => {
                          const linked = annotations[linkedIdx];
                          if (!linked) return;
                          setSelectedAnnotationId(linked.id);
                          setDetailsForId(linked.id);
                        }}
                        className="font-medium text-amber-300 underline-offset-2 hover:underline"
                      >
                        annotation #{linkedIdx + 1}
                      </button>
                    </p>
                  );
                })()}

                {detailsAnnotation.attachment_url && (
                  <div>
                    <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-300">
                      Attachment
                    </p>
                    <a
                      href={detailsAnnotation.attachment_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <img
                        src={detailsAnnotation.attachment_url}
                        alt="Annotation attachment"
                        className="max-h-64 rounded-md border border-base-700 object-cover"
                      />
                    </a>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-base-800 px-5 py-3">
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
