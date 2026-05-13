import {
  buildComparisonFieldObservationPdf,
  fieldObservationReportReference,
  type ComparisonReportSide,
  type FieldObservationFlags,
} from './engineeringReportPdf';

export type CompareDraftSideV1 = {
  captureDate: string;
  fileId: string;
  fileUrl: string;
  displayFileName: string;
  roomLabel: string;
  mediaType?: string;
  viewerKind: '360' | 'pcd';
};

export type CompareDraftStateV1 = {
  version: 1;
  left: CompareDraftSideV1 | null;
  right: CompareDraftSideV1 | null;
  leftNotes: string;
  rightNotes: string;
  leftAnnex: { images: string[]; text: string };
  rightAnnex: { images: string[]; text: string };
  leftFlags: { safety: boolean; quality: boolean; delayed: boolean };
  rightFlags: { safety: boolean; quality: boolean; delayed: boolean };
};

export function isCompareDraftStateV1(x: unknown): x is CompareDraftStateV1 {
  return (
    typeof x === 'object' &&
    x !== null &&
    (x as { version?: unknown }).version === 1 &&
    typeof (x as { leftNotes?: unknown }).leftNotes === 'string' &&
    typeof (x as { rightNotes?: unknown }).rightNotes === 'string'
  );
}

function comparisonSideFromDraft(
  side: CompareDraftSideV1 | null,
  notes: string,
  flags: FieldObservationFlags,
): ComparisonReportSide | null {
  if (!side) return null;
  const m = side.displayFileName.match(/room(\d+)/i);
  const room =
    (side.roomLabel && side.roomLabel.trim()) || (m ? `Room ${m[1]}` : '—');
  return {
    fileName: side.displayFileName,
    roomOrZone: room,
    captureDate: side.captureDate,
    notes,
    flags,
  };
}

export function buildCompareDraftPdfBlob(
  state: CompareDraftStateV1,
  ctx: {
    projectName: string;
    preparedBy: string;
    reportReference?: string;
    issueDate?: Date;
  },
): Blob {
  const issueDate = ctx.issueDate ?? new Date();
  const ref = ctx.reportReference ?? fieldObservationReportReference(issueDate);
  const left = comparisonSideFromDraft(state.left, state.leftNotes, {
    scheduleDelayed: state.leftFlags.delayed,
    qualityConcern: state.leftFlags.quality,
    safetyConcern: state.leftFlags.safety,
  });
  const right = comparisonSideFromDraft(state.right, state.rightNotes, {
    scheduleDelayed: state.rightFlags.delayed,
    qualityConcern: state.rightFlags.quality,
    safetyConcern: state.rightFlags.safety,
  });
  const doc = buildComparisonFieldObservationPdf({
    projectName: ctx.projectName,
    preparedBy: ctx.preparedBy,
    reportReference: ref,
    issueDate,
    left,
    right,
    annexLeft: state.leftAnnex,
    annexRight: state.rightAnnex,
  });
  return doc.output('blob');
}
