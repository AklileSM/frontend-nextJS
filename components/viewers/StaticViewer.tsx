'use client';

/**
 * Static image / video viewer.
 *
 * This file used to be ~855 lines. The annotation UI was split into
 * dedicated sub-modules under `./static/`:
 *
 *   - static/annotationStyles.ts     — FLAG_META, FLAG_ORDER, UNFLAGGED_*
 *   - static/types.ts                — AnnotationFormState
 *   - static/AnnotationPins.tsx      — pin overlay on the image
 *   - static/AnnotationFormModal.tsx — create / edit modal (uses <Modal>)
 *   - static/AnnotationDetailsModal.tsx — click-pin details (uses <Modal>)
 *
 * What remains here:
 *   - Viewer-context loading + back nav
 *   - Image / video render + zoom
 *   - AI analysis button + result display
 *   - Annotation state (list, selection, form, details, delete-confirm)
 *     and the API calls (create / update / delete / attachment upload).
 *
 * The state stays here because everything below the surface is coupled —
 * the pin overlay reads the same selection as the details modal; the form
 * modal reads the same annotations list to populate its "related" picker;
 * the parent's image click handler updates the open form's pin coords.
 */

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Maximize2 } from 'lucide-react';
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
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { ApiAnnotation } from '@/types/api';
import { useViewerContext } from './useViewerContext';
import { backHrefFor } from '@/components/explorer/viewerContext';
import { AnnotationPins } from './static/AnnotationPins';
import { AnnotationFormModal } from './static/AnnotationFormModal';
import { AnnotationDetailsModal } from './static/AnnotationDetailsModal';
import type { AnnotationFormState } from './static/types';

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

  const onPinClick = (id: string) => {
    setSelectedAnnotationId(id);
    setDetailsForId(id);
    setPlacingAnnotation(false);
    setAnnotationForm(null);
    requestAnimationFrame(() => {
      document
        .getElementById(`annotation-card-${id}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  };

  const crosshairActive = placingAnnotation || annotationForm?.mode === 'edit';

  if (loading) return <div className="p-6 text-ink-300">Loading viewer…</div>;
  if (!ctx) return (
    <div className="flex flex-col items-center justify-center gap-4 p-12 text-center">
      <p className="text-[14px] text-ink-300">No file selected, open a file from the explorer.</p>
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
                    <AnnotationPins
                      annotations={annotations}
                      show={showAnnotations}
                      selectedId={selectedAnnotationId}
                      editingId={annotationForm?.mode === 'edit' ? annotationForm.annotationId ?? null : null}
                      editingPin={annotationForm?.mode === 'edit' ? annotationForm.pin : null}
                      createPin={annotationForm?.mode === 'create' ? annotationForm.pin : null}
                      onPinClick={onPinClick}
                    />
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

      <AnnotationFormModal
        form={annotationForm}
        setForm={setAnnotationForm}
        annotations={annotations}
        saving={savingAnnotation}
        onSave={() => void submitAnnotationForm()}
        onClose={() => !savingAnnotation && setAnnotationForm(null)}
      />

      <AnnotationDetailsModal
        annotation={detailsAnnotation}
        index={detailsAnnotationIndex}
        annotations={annotations}
        onClose={() => setDetailsForId(null)}
        onEdit={openEditForm}
        onDelete={(a) => {
          setPendingDeleteAnnotationId(a.id);
          setDetailsForId(null);
        }}
        onJumpToLinked={(id) => {
          setSelectedAnnotationId(id);
          setDetailsForId(id);
        }}
      />

      <ConfirmDialog
        open={!!pendingDeleteAnnotation}
        title="Delete this annotation?"
        body={
          <>
            <p>The note below will be deleted permanently.</p>
            {pendingDeleteAnnotation?.text ? (
              <p className="mt-2 rounded-md border border-base-800 bg-base-950/80 px-2.5 py-2 text-[12px] text-ink-200">
                {pendingDeleteAnnotation.text.length > 120
                  ? `${pendingDeleteAnnotation.text.slice(0, 120)}…`
                  : pendingDeleteAnnotation.text}
              </p>
            ) : null}
          </>
        }
        confirmLabel="Delete annotation"
        danger
        onConfirm={performDeleteAnnotation}
        onCancel={() => setPendingDeleteAnnotationId(null)}
      />
    </div>
  );
}
