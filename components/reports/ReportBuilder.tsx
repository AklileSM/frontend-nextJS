'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import {
  buildFieldObservationPdf,
  fieldObservationReportReference,
} from '@/lib/engineeringReportPdf';
import { flagsFromObservationBooleans } from '@/lib/observationReportFlags';
import {
  createReportWithPdf,
  createViewerFieldDraft,
  publishViewerFieldDraft,
  updateViewerFieldDraft,
} from '@/services/apiClient';
import type { ApiAnnotation, ApiMediaFile } from '@/types/api';

export type ReportBuilderViewerContext = {
  roomSlug: string;
  date: string;
};

type Props = {
  file: ApiMediaFile;
  viewerKind: 'static' | 'panorama' | 'point-cloud';
  aiDescription: string;
  state: Record<string, unknown>;
  viewerContext?: ReportBuilderViewerContext | null;
  annotations?: ApiAnnotation[];
};

function assessmentSubtitle(viewerKind: Props['viewerKind']): string {
  switch (viewerKind) {
    case 'panorama':
      return 'Panoramic (360°) visual record';
    case 'point-cloud':
      return 'Three-dimensional point cloud visual record';
    default:
      return 'Planar (2D) construction image record';
  }
}

/** Aligns with legacy Vite app values stored in viewer field drafts. */
function viewerKindForApi(kind: Props['viewerKind']): string {
  switch (kind) {
    case 'panorama':
      return 'interactive_360';
    case 'point-cloud':
      return 'static_pcd';
    default:
      return 'static_360';
  }
}

function locationLabel(ctx: ReportBuilderViewerContext | null | undefined): string {
  if (!ctx?.roomSlug) return '—';
  const room = ctx.roomSlug.replace(/-/g, ' ');
  return `${room} · ${ctx.date || '—'}`;
}

function captureDateLabel(file: ApiMediaFile): string {
  const d = file.capture_date?.trim();
  return d ? d.slice(0, 10) : '—';
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function CheckboxField({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded-md border border-transparent px-1 py-1.5 text-[12px] text-ink-200 transition-colors hover:border-base-600 hover:bg-base-800/50">
      <span
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
          checked ? 'border-amber-500 bg-amber-500' : 'border-base-600 bg-base-800'
        }`}
      >
        {checked && <Check size={10} strokeWidth={3} className="text-base-950" />}
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only" />
      <span>{label}</span>
    </label>
  );
}

export function ReportBuilder({ file, viewerKind, aiDescription, state, viewerContext, annotations = [] }: Props) {
  const { user } = useAuth();
  const [manualObservations, setManualObservations] = useState('');
  const [draftId, setDraftId] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [includeVisualAssessment, setIncludeVisualAssessment] = useState(true);
  const [includeEngineerComments, setIncludeEngineerComments] = useState(true);
  const [includeAnnotations, setIncludeAnnotations] = useState(true);
  const [safetyConcern, setSafetyConcern] = useState(false);
  const [qualityConcern, setQualityConcern] = useState(false);
  const [scheduleDelayed, setScheduleDelayed] = useState(false);

  const projectName = useMemo(
    () => (typeof process.env.NEXT_PUBLIC_PROJECT_NAME === 'string' && process.env.NEXT_PUBLIC_PROJECT_NAME.trim()
      ? process.env.NEXT_PUBLIC_PROJECT_NAME.trim()
      : 'A6 Stern'),
    [],
  );

  const documentTitle = useMemo(
    () => `${projectName.replace(/\s+/g, '_')} Project Observation Report`,
    [projectName],
  );

  useEffect(() => {
    setDraftId(null);
  }, [file.id]);

  const flags = useMemo(
    () => flagsFromObservationBooleans(safetyConcern, qualityConcern, scheduleDelayed),
    [safetyConcern, qualityConcern, scheduleDelayed],
  );

  const buildObservationPdf = () => {
    const ref = fieldObservationReportReference();
    const doc = buildFieldObservationPdf({
      documentTitle,
      assessmentMethodSubtitle: assessmentSubtitle(viewerKind),
      projectName,
      organizationLine: 'SMART Construction Research Group',
      preparedBy: user?.username?.trim() || 'Not signed in',
      reportReference: ref,
      recordFileName: file.file_name,
      locationOrRoom: locationLabel(viewerContext),
      imageCaptureDate: captureDateLabel(file),
      reportIssueDate: new Date(),
      sections: {
        includeVisualAssessment,
        visualAssessmentHeading: 'Visual and AI-assisted description',
        visualAssessmentBody: aiDescription || '',
        includeEngineerComments,
        engineerCommentsHeading: "Author's comments and site notes",
        engineerCommentsBody: manualObservations || '',
        includeAnnotations,
        annotationsHeading: 'Image annotations',
        annotations: annotations.map((a, i) => ({ index: i + 1, text: a.text })),
      },
      flags: {
        scheduleDelayed,
        qualityConcern,
        safetyConcern,
      },
    });
    return { doc, ref };
  };

  const onSaveDraft = async () => {
    if (savingDraft) return;
    setSavingDraft(true);
    try {
      const mergedState = {
        ...state,
        reportIncludeVisual: includeVisualAssessment,
        reportIncludeComments: includeEngineerComments,
        reportSafetyConcern: safetyConcern,
        reportQualityConcern: qualityConcern,
        reportScheduleDelayed: scheduleDelayed,
      };
      if (draftId) {
        await updateViewerFieldDraft({
          draftId,
          label: file.file_name,
          state: mergedState,
          manualObservations,
          flags,
        });
        toast.success('Draft updated.');
      } else {
        const d = await createViewerFieldDraft({
          fileId: file.id,
          viewerKind: viewerKindForApi(viewerKind),
          label: file.file_name,
          state: mergedState,
          manualObservations,
          flags,
        });
        setDraftId(d.id);
        toast.success('Draft saved.');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save draft.');
    } finally {
      setSavingDraft(false);
    }
  };

  const onPublish = async () => {
    if (publishing) return;
    setPublishing(true);
    try {
      const { doc, ref } = buildObservationPdf();
      const pdfBlob = doc.output('blob');
      const filename = `FieldObservation_${ref}.pdf`;
      if (draftId) {
        await publishViewerFieldDraft({
          draftId,
          pdfBlob,
          fileId: file.id,
          filename,
          label: file.file_name,
          aiDescription: includeVisualAssessment ? (aiDescription || null) : null,
          manualObservations: includeEngineerComments ? (manualObservations || null) : null,
          flags,
        });
        setDraftId(null);
      } else {
        await createReportWithPdf({
          pdfBlob,
          fileId: file.id,
          filename,
          label: file.file_name,
          aiDescription: includeVisualAssessment ? (aiDescription || null) : null,
          manualObservations: includeEngineerComments ? (manualObservations || null) : null,
          flags,
        });
      }
      toast.success('Report published.');
      triggerDownload(pdfBlob, filename);
      setPublishModalOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not publish report.');
    } finally {
      setPublishing(false);
    }
  };

  const neitherSelected = !includeVisualAssessment && !includeEngineerComments && !includeAnnotations;

  return (
    <>
      <aside className="space-y-4 rounded-md border border-base-800 bg-base-900/50 p-4">
        <h3 className="font-display text-[18px] text-white">Report Builder</h3>

        <div className="space-y-1">
          <label className="text-[12px] text-ink-300">Author comments and site notes</label>
          <textarea
            value={manualObservations}
            onChange={(e) => setManualObservations(e.target.value)}
            className="min-h-24 w-full rounded-md border border-base-700 bg-base-950/70 px-3 py-2 text-[13px] text-white outline-none focus:border-amber-500/70"
            placeholder="Describe what you observed on site..."
          />
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-ink-400">Classification</p>
          <CheckboxField checked={safetyConcern} onChange={setSafetyConcern} label="Safety concern (visual)" />
          <CheckboxField checked={qualityConcern} onChange={setQualityConcern} label="Quality concern" />
          <CheckboxField checked={scheduleDelayed} onChange={setScheduleDelayed} label="Schedule delay indicated" />
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onSaveDraft}
            disabled={savingDraft}
            className="rounded-md border border-base-700 px-3 py-2 text-[13px] text-white transition-colors hover:border-ink-300 disabled:opacity-50"
          >
            {savingDraft ? 'Saving...' : draftId ? 'Update Draft' : 'Save Draft'}
          </button>
          <button
            type="button"
            onClick={() => setPublishModalOpen(true)}
            className="rounded-md bg-amber-500 px-3 py-2 text-[13px] font-medium text-base-950 transition-colors hover:bg-amber-400"
          >
            Publish PDF
          </button>
        </div>
        {draftId && <p className="font-mono text-[11px] text-ink-400">Draft ID: {draftId}</p>}
      </aside>

      <AnimatePresence>
        {publishModalOpen && (
          <>
            <motion.div
              key="publish-bd"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={publishing ? undefined : () => setPublishModalOpen(false)}
              className="fixed inset-0 z-50 bg-base-950/75 backdrop-blur-sm"
            />
            <motion.div
              key="publish-md"
              initial={{ opacity: 0, scale: 0.96, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 4 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              role="dialog"
              aria-modal="true"
              className="fixed left-1/2 top-1/2 z-50 w-[400px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-base-700 bg-base-900 shadow-2xl shadow-black/60"
            >
              <div className="p-6">
                <h3 className="font-display text-[18px] font-semibold text-white">Publish PDF</h3>
                <p className="mt-1 text-[13px] text-ink-400">Choose which sections to include in the report.</p>
                <div className="mt-4 space-y-2">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-ink-400">Include in PDF</p>
                  <CheckboxField
                    checked={includeVisualAssessment}
                    onChange={setIncludeVisualAssessment}
                    label="Visual / AI-assisted description"
                  />
                  <CheckboxField
                    checked={includeEngineerComments}
                    onChange={setIncludeEngineerComments}
                    label="Author comments and site notes"
                  />
                  <CheckboxField
                    checked={includeAnnotations}
                    onChange={setIncludeAnnotations}
                    label={
                      <span>
                        Image annotations
                        {annotations.length > 0 && (
                          <span className="ml-1 text-ink-400">({annotations.length})</span>
                        )}
                      </span>
                    }
                  />
                  {neitherSelected && (
                    <p className="text-[12px] text-amber-400">Select at least one section to publish.</p>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-base-800 px-5 py-3">
                <button
                  type="button"
                  disabled={publishing}
                  onClick={() => setPublishModalOpen(false)}
                  className="rounded-md border border-base-700 px-3.5 py-1.5 text-[13px] font-medium text-white transition-colors hover:border-ink-300 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={publishing || neitherSelected}
                  onClick={() => void onPublish()}
                  className="inline-flex items-center gap-2 rounded-md bg-amber-500 px-3.5 py-1.5 text-[13px] font-semibold text-base-950 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {publishing ? 'Publishing…' : 'Publish PDF'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
