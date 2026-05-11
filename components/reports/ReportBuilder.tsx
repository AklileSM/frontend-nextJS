'use client';

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
import type { ApiMediaFile } from '@/types/api';

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

export function ReportBuilder({ file, viewerKind, aiDescription, state, viewerContext }: Props) {
  const { user } = useAuth();
  const [manualObservations, setManualObservations] = useState('');
  const [draftId, setDraftId] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const [includeVisualAssessment, setIncludeVisualAssessment] = useState(true);
  const [includeEngineerComments, setIncludeEngineerComments] = useState(true);
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
          state: mergedState,
          manualObservations,
          flags,
        });
        toast.success('Draft updated.');
      } else {
        const d = await createViewerFieldDraft({
          fileId: file.id,
          viewerKind: viewerKindForApi(viewerKind),
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
    if (!includeVisualAssessment && !includeEngineerComments) {
      toast.error('Select at least one section to include in the report (visual assessment and/or author comments).');
      return;
    }
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
          aiDescription: includeVisualAssessment ? (aiDescription || null) : null,
          manualObservations: includeEngineerComments ? (manualObservations || null) : null,
          flags,
        });
      }
      toast.success('Report published.');
      triggerDownload(pdfBlob, filename);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not publish report.');
    } finally {
      setPublishing(false);
    }
  };

  const checkboxClass =
    'flex cursor-pointer items-start gap-2 rounded-md border border-transparent px-1 py-1.5 text-[12px] text-ink-200 transition-colors hover:border-base-600 hover:bg-base-800/50';

  return (
    <aside className="space-y-4 rounded-md border border-base-800 bg-base-900/50 p-4">
      <h3 className="font-display text-[18px] text-white">Report Builder</h3>
      <p className="text-[11px] leading-relaxed text-ink-400">
        A4 field observation layout: metadata, purpose and scope, references, optional narrative sections,
        classification, and limitations (same structure as the legacy SiteScope PDF generator).
      </p>

      <div className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-ink-400">Include in PDF</p>
        <label className={checkboxClass}>
          <input
            type="checkbox"
            checked={includeVisualAssessment}
            onChange={(e) => setIncludeVisualAssessment(e.target.checked)}
            className="mt-0.5"
          />
          <span>Visual / AI-assisted description</span>
        </label>
        <label className={checkboxClass}>
          <input
            type="checkbox"
            checked={includeEngineerComments}
            onChange={(e) => setIncludeEngineerComments(e.target.checked)}
            className="mt-0.5"
          />
          <span>Author comments and site notes</span>
        </label>
      </div>

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
        <label className={checkboxClass}>
          <input
            type="checkbox"
            checked={safetyConcern}
            onChange={(e) => setSafetyConcern(e.target.checked)}
            className="mt-0.5"
          />
          <span>Safety concern (visual)</span>
        </label>
        <label className={checkboxClass}>
          <input
            type="checkbox"
            checked={qualityConcern}
            onChange={(e) => setQualityConcern(e.target.checked)}
            className="mt-0.5"
          />
          <span>Quality concern</span>
        </label>
        <label className={checkboxClass}>
          <input
            type="checkbox"
            checked={scheduleDelayed}
            onChange={(e) => setScheduleDelayed(e.target.checked)}
            className="mt-0.5"
          />
          <span>Schedule delay indicated</span>
        </label>
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
          onClick={onPublish}
          disabled={publishing}
          className="rounded-md bg-amber-500 px-3 py-2 text-[13px] font-medium text-base-950 transition-colors hover:bg-amber-400 disabled:opacity-50"
        >
          {publishing ? 'Publishing...' : 'Publish PDF'}
        </button>
      </div>
      {draftId && <p className="font-mono text-[11px] text-ink-400">Draft ID: {draftId}</p>}
    </aside>
  );
}
