'use client';

import { useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import { toast } from 'sonner';
import {
  createReportWithPdf,
  createViewerFieldDraft,
  publishViewerFieldDraft,
  updateViewerFieldDraft,
} from '@/services/apiClient';
import type { ApiMediaFile } from '@/types/api';

type Props = {
  file: ApiMediaFile;
  viewerKind: 'static' | 'panorama' | 'point-cloud';
  aiDescription: string;
  state: Record<string, unknown>;
};

export function ReportBuilder({ file, viewerKind, aiDescription, state }: Props) {
  const [manualObservations, setManualObservations] = useState('');
  const [flagsInput, setFlagsInput] = useState('');
  const [draftId, setDraftId] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const flags = useMemo(
    () =>
      flagsInput
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
    [flagsInput],
  );

  const buildPdfBlob = (): Blob => {
    const doc = new jsPDF();
    const lines = [
      `SiteScope Field Report`,
      `File: ${file.file_name}`,
      `Type: ${file.type}`,
      `Capture date: ${file.capture_date}`,
      `Viewer: ${viewerKind}`,
      '',
      'AI description:',
      aiDescription || '(none)',
      '',
      'Manual observations:',
      manualObservations || '(none)',
      '',
      `Flags: ${flags.join(', ') || '(none)'}`,
      '',
      `Generated: ${new Date().toISOString()}`,
    ];
    let y = 20;
    doc.setFontSize(16);
    doc.text(lines[0], 14, y);
    y += 10;
    doc.setFontSize(11);
    for (const line of lines.slice(1)) {
      const wrapped = doc.splitTextToSize(line, 180);
      doc.text(wrapped, 14, y);
      y += wrapped.length * 6 + 2;
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
    }
    return doc.output('blob');
  };

  const onSaveDraft = async () => {
    if (savingDraft) return;
    setSavingDraft(true);
    try {
      if (draftId) {
        await updateViewerFieldDraft({
          draftId,
          state,
          manualObservations,
          flags,
        });
        toast.success('Draft updated.');
      } else {
        const d = await createViewerFieldDraft({
          fileId: file.id,
          viewerKind,
          state,
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
      const pdfBlob = buildPdfBlob();
      if (draftId) {
        await publishViewerFieldDraft({
          draftId,
          pdfBlob,
          fileId: file.id,
          filename: `${file.file_name.replace(/\.[^.]+$/, '') || 'report'}.pdf`,
          aiDescription: aiDescription || null,
          manualObservations: manualObservations || null,
          flags,
        });
        setDraftId(null);
      } else {
        await createReportWithPdf({
          pdfBlob,
          fileId: file.id,
          filename: `${file.file_name.replace(/\.[^.]+$/, '') || 'report'}.pdf`,
          aiDescription: aiDescription || null,
          manualObservations: manualObservations || null,
          flags,
        });
      }
      toast.success('Report published.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not publish report.');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <aside className="space-y-4 rounded-md border border-base-800 bg-base-900/50 p-4">
      <h3 className="font-display text-[18px] text-white">Report Builder</h3>
      <div className="space-y-1">
        <label className="text-[12px] text-ink-300">Manual observations</label>
        <textarea
          value={manualObservations}
          onChange={(e) => setManualObservations(e.target.value)}
          className="min-h-24 w-full rounded-md border border-base-700 bg-base-950/70 px-3 py-2 text-[13px] text-white outline-none focus:border-amber-500/70"
          placeholder="Describe what you observed on site..."
        />
      </div>
      <div className="space-y-1">
        <label className="text-[12px] text-ink-300">Flags (comma separated)</label>
        <input
          value={flagsInput}
          onChange={(e) => setFlagsInput(e.target.value)}
          className="w-full rounded-md border border-base-700 bg-base-950/70 px-3 py-2 text-[13px] text-white outline-none focus:border-amber-500/70"
          placeholder="safety, moisture, crack"
        />
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
