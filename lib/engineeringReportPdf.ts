import { jsPDF } from 'jspdf';

const PAGE = { w: 210, h: 297, margin: 18, footer: 11 };
const CONTENT_W = PAGE.w - PAGE.margin * 2;
const BODY_LH = 5.2;
const TITLE_LH = 6.5;

export function fieldObservationReportReference(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `FOR-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export type FieldObservationFlags = {
  scheduleDelayed: boolean;
  qualityConcern: boolean;
  safetyConcern: boolean;
};

export type PdfAnnotationFlag = 'safety' | 'quality' | 'delayed';

export type PdfAnnotation = {
  index: number;
  text: string;
  /** Optional category. Drives the colored pill next to the index. */
  flag?: PdfAnnotationFlag | null;
  /** 1-based index of the linked annotation (same file). Rendered as
   *  "See also: annotation #N" under the note. */
  linkedIndex?: number | null;
  /** Pre-fetched data URL of the attachment image. The caller is
   *  responsible for resolving the network URL to base64 before invoking
   *  buildFieldObservationPdf, because jsPDF.addImage is synchronous. */
  attachmentDataUrl?: string | null;
};

export type FieldObservationPdfInput = {
  /** Main title under org line, e.g. "FIELD OBSERVATION REPORT" */
  documentTitle: string;
  /** Shorter line under title, e.g. "Planar image record" / "Panoramic (360°) visual record" */
  assessmentMethodSubtitle: string;
  projectName: string;
  organizationLine?: string;
  preparedBy: string;
  reportReference: string;
  recordFileName: string;
  locationOrRoom: string;
  imageCaptureDate: string;
  reportIssueDate: Date;
  sections: {
    includeVisualAssessment: boolean;
    visualAssessmentHeading?: string;
    visualAssessmentBody: string;
    includeEngineerComments: boolean;
    engineerCommentsHeading?: string;
    engineerCommentsBody: string;
    includeAnnotations: boolean;
    annotationsHeading?: string;
    annotations: PdfAnnotation[];
  };
  flags: FieldObservationFlags;
  /** PNG data URLs from canvas */
  annexScreenshots?: string[];
};

// Per-flag pill colors used in the PDF. Tuned so the white label text
// stays legible on the fill — these are the same hues as the on-screen
// chips in StaticViewer but darkened slightly for print.
const FLAG_PDF_META: Record<PdfAnnotationFlag, { label: string; fill: [number, number, number] }> = {
  safety:  { label: 'SAFETY',  fill: [239, 68, 68] },   // red-500
  quality: { label: 'QUALITY', fill: [217, 119, 6] },   // amber-600 (darker for white text contrast)
  delayed: { label: 'DELAYED', fill: [14, 165, 233] },  // sky-500
};

function drawFooters(doc: jsPDF): void {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(90);
    doc.text(
      `Page ${i} of ${total}  ·  Observation record `,
      PAGE.margin,
      PAGE.h - PAGE.footer,
    );
  }
}

function createLayout(doc: jsPDF) {
  const state = { y: PAGE.margin };
  const pageHeight = () => doc.internal.pageSize.getHeight();

  const ensureSpace = (needMm: number) => {
    if (state.y + needMm > pageHeight() - PAGE.footer - 4) {
      doc.addPage();
      state.y = PAGE.margin;
    }
  };

  const horizontalRule = () => {
    ensureSpace(5);
    doc.setDrawColor(55, 65, 81);
    doc.setLineWidth(0.35);
    doc.line(PAGE.margin, state.y, PAGE.w - PAGE.margin, state.y);
    state.y += 5;
  };

  const writeParagraph = (text: string, fontSize = 10, style: 'normal' | 'bold' | 'italic' = 'normal') => {
    doc.setFont('helvetica', style);
    doc.setFontSize(fontSize);
    doc.setTextColor(28);
    const lines = doc.splitTextToSize(text.trim() || '—', CONTENT_W);
    for (const line of lines) {
      ensureSpace(BODY_LH);
      doc.text(line, PAGE.margin, state.y);
      state.y += BODY_LH;
    }
    state.y += 2;
  };

  const writeSectionHeading = (num: string, title: string) => {
    ensureSpace(TITLE_LH + 2);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(17);
    doc.text(`${num}  ${title}`, PAGE.margin, state.y);
    state.y += TITLE_LH;
    doc.setDrawColor(180);
    doc.setLineWidth(0.2);
    doc.line(PAGE.margin, state.y - 1.5, PAGE.w - PAGE.margin, state.y - 1.5);
    state.y += 3;
  };

  const metaRow = (label: string, value: string) => {
    ensureSpace(BODY_LH + 1);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(55);
    doc.text(label, PAGE.margin, state.y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(28);
    const vw = CONTENT_W - 48;
    const vlines = doc.splitTextToSize(value || '—', vw);
    let rowY = state.y;
    doc.text(vlines[0] ?? '—', PAGE.margin + 48, rowY);
    if (vlines.length > 1) {
      for (let i = 1; i < vlines.length; i++) {
        rowY += BODY_LH;
        ensureSpace(BODY_LH);
        doc.text(vlines[i], PAGE.margin + 48, rowY);
      }
      state.y = rowY + BODY_LH + 1;
    } else {
      state.y += BODY_LH + 1;
    }
  };

  const drawTitleBlock = (organizationLine: string, documentTitle: string, assessmentSubtitle: string) => {
    state.y = PAGE.margin;
    const org = organizationLine.trim();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(75);
    doc.text(org.toUpperCase(), PAGE.w / 2, state.y, { align: 'center' });
    state.y += 6;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(17);
    doc.text(documentTitle.toUpperCase(), PAGE.w / 2, state.y, { align: 'center' });
    state.y += 7;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(55);
    doc.text(assessmentSubtitle, PAGE.w / 2, state.y, { align: 'center' });
    state.y += 8;
    horizontalRule();
  };

  return {
    state,
    ensureSpace,
    horizontalRule,
    writeParagraph,
    writeSectionHeading,
    metaRow,
    drawTitleBlock,
  };
}

export function buildFieldObservationPdf(input: FieldObservationPdfInput): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const {
    state,
    ensureSpace,
    horizontalRule,
    writeParagraph,
    writeSectionHeading,
    metaRow,
    drawTitleBlock,
  } = createLayout(doc);

  drawTitleBlock(
    input.organizationLine ?? 'SMART Construction Research Group',
    input.documentTitle ?? 'A6_Stern Project Observation Report',
    input.assessmentMethodSubtitle ?? '',
  );

  metaRow('Report reference', input.reportReference);
  metaRow('Issue date', input.reportIssueDate.toLocaleDateString(undefined, { dateStyle: 'long' }));
  metaRow('Project', input.projectName);
  metaRow('Prepared by', input.preparedBy);
  metaRow('Subject record (file)', input.recordFileName);
  metaRow('Location / zone', input.locationOrRoom);
  metaRow('Image capture date', input.imageCaptureDate);
  state.y += 2;
  horizontalRule();

  writeSectionHeading('1', 'PURPOSE AND SCOPE');
  writeParagraph(
    'This document records a visual assessment based on the referenced digital imagery (and optional screen captures). ' +
      'It supports project communication, progress records, and identification of apparent quality or safety-related observations. ' +
      'It is not a substitute for statutory inspections, structural design checks, or a full site walkdown unless explicitly stated elsewhere.',
  );

  writeSectionHeading('2', 'REFERENCE RECORD');
  writeParagraph(
    `The assessment relates to the visual record "${input.recordFileName}" for ${input.locationOrRoom}, ` +
      `with an indicated capture date of ${input.imageCaptureDate}. ` +
      'Coordinates, grid lines, and hidden works are not inferred beyond what is visible in the imagery.',
  );

  let sectionNo = 3;

  if (input.sections.includeVisualAssessment) {
    writeSectionHeading(
      String(sectionNo++),
      (input.sections.visualAssessmentHeading ?? 'VISUAL / AI-ASSISTED DESCRIPTION').toUpperCase(),
    );
    writeParagraph(
      input.sections.visualAssessmentBody || 'No visual assessment text was included in this issue.',
      10,
      'normal',
    );
  }

  if (input.sections.includeEngineerComments) {
    writeSectionHeading(
      String(sectionNo++),
      (input.sections.engineerCommentsHeading ?? "AUTHOR'S COMMENTS AND SITE NOTES").toUpperCase(),
    );
    writeParagraph(
      input.sections.engineerCommentsBody || 'No author comments were included in this issue.',
      10,
      'normal',
    );
  }

  if (input.sections.includeAnnotations) {
    writeSectionHeading(
      String(sectionNo++),
      (input.sections.annotationsHeading ?? 'IMAGE ANNOTATIONS').toUpperCase(),
    );
    const anns = input.sections.annotations;
    if (anns.length === 0) {
      writeParagraph('No annotations were present on this image at the time of issue.', 10, 'italic');
    } else {
      for (const ann of anns) {
        ensureSpace(BODY_LH * 2 + 4);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(28);
        doc.text(`${ann.index}.`, PAGE.margin, state.y);

        // Optional category pill, drawn to the right of the index number.
        // Width is measured at the page font size so it adapts if the label
        // length ever changes.
        let textStartX = PAGE.margin + 8;
        if (ann.flag) {
          const meta = FLAG_PDF_META[ann.flag];
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7);
          const labelW = doc.getTextWidth(meta.label);
          const pillW = labelW + 3.6;
          const pillH = 3.6;
          const pillX = PAGE.margin + 5.5;
          const pillY = state.y - 3.1;
          doc.setFillColor(meta.fill[0], meta.fill[1], meta.fill[2]);
          // 1.4mm radius rounded rect — tight pill at this size.
          doc.roundedRect(pillX, pillY, pillW, pillH, 1, 1, 'F');
          doc.setTextColor(255);
          doc.text(meta.label, pillX + 1.8, pillY + 2.6);
          textStartX = pillX + pillW + 2;
          // Restore body font for the note text below.
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          doc.setTextColor(28);
        }

        doc.setFont('helvetica', 'normal');
        const wrapWidth = CONTENT_W - (textStartX - PAGE.margin);
        const lines = doc.splitTextToSize(ann.text.trim() || '—', wrapWidth);
        doc.text(lines[0] ?? '—', textStartX, state.y);
        state.y += BODY_LH;
        for (let i = 1; i < lines.length; i++) {
          ensureSpace(BODY_LH);
          doc.text(lines[i], PAGE.margin + 8, state.y);
          state.y += BODY_LH;
        }

        // "See also: annotation #N" line under the note, italic muted text.
        if (ann.linkedIndex && ann.linkedIndex > 0) {
          ensureSpace(BODY_LH);
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(9);
          doc.setTextColor(90);
          doc.text(`See also: annotation #${ann.linkedIndex}`, PAGE.margin + 8, state.y);
          state.y += BODY_LH;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          doc.setTextColor(28);
        }

        // Embedded attachment image. addImage is synchronous and reads from
        // the data URL prepared upstream; we cap the height so a tall image
        // doesn't dominate the page, preserving aspect ratio against width.
        if (ann.attachmentDataUrl) {
          const maxW = Math.min(CONTENT_W - 8, 110);
          const maxH = 60;
          try {
            const props = doc.getImageProperties(ann.attachmentDataUrl);
            const ratio = props.width / props.height || 1;
            let w = maxW;
            let h = w / ratio;
            if (h > maxH) {
              h = maxH;
              w = h * ratio;
            }
            ensureSpace(h + 3);
            doc.addImage(ann.attachmentDataUrl, PAGE.margin + 8, state.y, w, h);
            state.y += h + 2;
          } catch {
            // Unsupported format or decode error — fall back to a text note
            // so the reader at least knows an attachment was associated.
            ensureSpace(BODY_LH);
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(9);
            doc.setTextColor(90);
            doc.text('(attachment image could not be embedded)', PAGE.margin + 8, state.y);
            state.y += BODY_LH;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.setTextColor(28);
          }
        }

        state.y += 2;
      }
    }
  }

  writeSectionHeading(String(sectionNo++), 'CLASSIFICATION SUMMARY');
  const schedule = input.flags.scheduleDelayed ? 'Delay indicated' : 'No schedule delay flagged';
  const quality = input.flags.qualityConcern ? 'Quality concern flagged' : 'No quality concern flagged';
  const safety = input.flags.safetyConcern ? 'Safety concern flagged' : 'No safety concern flagged';
  writeParagraph(`Schedule: ${schedule}.`, 10, 'normal');
  writeParagraph(`Quality: ${quality}.`, 10, 'normal');
  writeParagraph(`Health & safety (visual): ${safety}.`, 10, 'normal');

  writeSectionHeading(String(sectionNo++), 'LIMITATIONS');
  writeParagraph(
    'Observations are limited to what can be reasonably inferred from the supplied imagery at the stated resolution and viewpoint. ' +
      'Artificial-intelligence-generated narrative, where used, is advisory and must be verified by qualified personnel. ' +
      'This report does not confirm compliance with codes, standards, or contract specifications unless backed by separate written certification.',
    10,
    'normal',
  );

  const shots = input.annexScreenshots?.filter(Boolean) ?? [];
  if (shots.length > 0) {
    writeSectionHeading(String(sectionNo++), 'ANNEX A — SCREEN CAPTURES');
    writeParagraph(
      'The following figures are exports from the viewer at the time of report issue. They are illustrative and may not cover the full scene.',
      10,
      'italic',
    );
    const imgW = CONTENT_W;
    const imgH = 85;
    shots.forEach((dataUrl, idx) => {
      ensureSpace(imgH + 14);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(55);
      doc.text(`Figure A.${idx + 1}`, PAGE.margin, state.y);
      state.y += 5;
      try {
        doc.addImage(dataUrl, 'PNG', PAGE.margin, state.y, imgW, imgH);
      } catch {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        doc.text('(Image could not be embedded.)', PAGE.margin, state.y + 10);
      }
      state.y += imgH + 8;
    });
  }

  drawFooters(doc);
  return doc;
}

export type ComparisonReportSide = {
  fileName: string;
  roomOrZone: string;
  captureDate: string;
  notes: string;
  flags: FieldObservationFlags;
};

export type AnnexScreenshotNotes = { images: string[]; text: string };

export function buildComparisonFieldObservationPdf(input: {
  projectName: string;
  organizationLine?: string;
  preparedBy: string;
  reportReference: string;
  issueDate: Date;
  left: ComparisonReportSide | null;
  right: ComparisonReportSide | null;
  annexLeft: AnnexScreenshotNotes;
  annexRight: AnnexScreenshotNotes;
}): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const {
    state,
    ensureSpace,
    horizontalRule,
    writeParagraph,
    writeSectionHeading,
    metaRow,
    drawTitleBlock,
  } = createLayout(doc);

  drawTitleBlock(
    input.organizationLine ?? 'Construction site documentation',
    'Comparative field observation report',
    'Dual-view construction imagery comparison',
  );

  metaRow('Report reference', input.reportReference);
  metaRow('Issue date', input.issueDate.toLocaleDateString(undefined, { dateStyle: 'long' }));
  metaRow('Project', input.projectName);
  metaRow('Prepared by', input.preparedBy);
  metaRow('Subject', 'Comparative assessment of two visual records (application left / right)');

  const scopeSummary = [
    input.left &&
      `Reference A: "${input.left.fileName}", ${input.left.roomOrZone}, capture ${input.left.captureDate}.`,
    input.right &&
      `Reference B: "${input.right.fileName}" , ${input.right.roomOrZone}, capture ${input.right.captureDate}.`,
  ]
    .filter(Boolean)
    .join(' ');
  metaRow('Records compared', scopeSummary || '—');
  state.y += 2;
  horizontalRule();

  let sectionNo = 1;
  writeSectionHeading(String(sectionNo++), 'PURPOSE AND SCOPE');
  writeParagraph(
    'This comparative record documents observations from two related visual datasets (typically different dates or conditions). ' +
      'It supports schedule variance review, defect tracking, and coordination. It is not a substitute for formal inspections or design verification.',
  );

  writeSectionHeading(String(sectionNo++), 'REFERENCE RECORDS');
  if (input.left) {
    writeParagraph(
      `Reference A: File "${input.left.fileName}", location ${input.left.roomOrZone}, date ${input.left.captureDate}.`,
      10,
      'normal',
    );
  }
  if (input.right) {
    writeParagraph(
      `Reference B: File "${input.right.fileName}", location ${input.right.roomOrZone}, date ${input.right.captureDate}.`,
      10,
      'normal',
    );
  }
  if (!input.left && !input.right) {
    writeParagraph('No file metadata was attached for this comparison issue.', 10, 'italic');
  }

  writeSectionHeading(String(sectionNo++), "AUTHOR COMMENTS — DUAL VIEW");
  if (input.left) {
    writeParagraph(`Reference A notes: ${input.left.notes || '—'}`, 10, 'normal');
  }
  if (input.right) {
    writeParagraph(`Reference B notes: ${input.right.notes || '—'}`, 10, 'normal');
  }

  const flagLine = (label: string, f: FieldObservationFlags) => {
    const s = f.scheduleDelayed ? 'Delay indicated' : 'No schedule delay flagged';
    const q = f.qualityConcern ? 'Quality concern flagged' : 'No quality concern flagged';
    const h = f.safetyConcern ? 'Safety concern flagged' : 'No safety concern flagged';
    return `${label}: Schedule — ${s}; Quality — ${q}; H&S (visual) — ${h}.`;
  };

  writeSectionHeading(String(sectionNo++), 'CLASSIFICATION SUMMARY');
  if (input.left) writeParagraph(flagLine('Reference A', input.left.flags), 10, 'normal');
  if (input.right) writeParagraph(flagLine('Reference B', input.right.flags), 10, 'normal');
  if (!input.left && !input.right) writeParagraph('No classification data.', 10, 'italic');

  writeSectionHeading(String(sectionNo++), 'LIMITATIONS');
  writeParagraph(
    'Comparison is limited to viewpoints and resolutions available in the viewer. Hidden work, temporary coverings, and lighting differences may affect interpretation. ' +
      'Observations must be reviewed by qualified personnel.',
    10,
    'normal',
  );

  const L = input.annexLeft.images.filter(Boolean);
  const R = input.annexRight.images.filter(Boolean);
  if (L.length > 0 || R.length > 0) {
    writeSectionHeading(String(sectionNo++), 'ANNEX A — SUPPLEMENTARY SCREEN CAPTURES');
    writeParagraph(
      'Optional exports captured during the comparison session. Horizontal position follows Reference A (left) and Reference B (right) as shown in the application.',
      10,
      'italic',
    );
    const imgW = 84;
    const imgH = 72;
    const gap = 6;
    const leftX = PAGE.margin;
    const rightX = PAGE.margin + imgW + gap;
    const maxRows = Math.max(L.length, R.length);
    let fig = 1;
    for (let i = 0; i < maxRows; i++) {
      ensureSpace(imgH + 16);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(55);
      doc.text(`Figure A.${fig}`, PAGE.margin, state.y);
      fig += 1;
      state.y += 4;
      if (L[i]) {
        try {
          doc.addImage(L[i], 'PNG', leftX, state.y, imgW, imgH);
        } catch {
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(8);
          doc.text('(A: embed error)', leftX, state.y + 20);
        }
      }
      if (R[i]) {
        try {
          doc.addImage(R[i], 'PNG', rightX, state.y, imgW, imgH);
        } catch {
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(8);
          doc.text('(B: embed error)', rightX, state.y + 20);
        }
      }
      state.y += imgH + 8;
    }
    if (L.length && input.annexLeft.text?.trim()) {
      writeParagraph(`Reference A — annex notes: ${input.annexLeft.text}`, 9, 'normal');
    }
    if (R.length && input.annexRight.text?.trim()) {
      writeParagraph(`Reference B — annex notes: ${input.annexRight.text}`, 9, 'normal');
    }
  }

  drawFooters(doc);
  return doc;
}
