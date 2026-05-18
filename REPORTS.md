# Reports: Frontend Reference

This document covers how reports are built and published from the frontend: the `ReportBuilder` component, the draft lifecycle, PDF generation, and the comparison report flow.

## ReportBuilder component

`ReportBuilder` is a sidebar panel rendered alongside each viewer. It handles draft saving and PDF publishing for viewer reports (static, panorama, point cloud).

**Props:**


| Prop            | Type                      | Description                                                         |
| --------------- | ------------------------- | ------------------------------------------------------------------- |
| `file`          | `ApiMediaFile`            | The file being viewed, used for filename, capture date, and file ID |
| `viewerKind`    | `'static'                 | 'panorama'                                                          |
| `aiDescription` | `string`                  | AI-generated image description to include in the PDF                |
| `state`         | `Record<string, unknown>` | Viewer-specific state to persist in the draft (scale, mode, etc.)   |
| `viewerContext` | `{ roomSlug, date }       | null`                                                               |


## Draft lifecycle

```
first "Save Draft" click
        │
        ▼
createViewerFieldDraft()   ← POST /api/reports/viewer-drafts
        │
        │  returns draftId, stored in component state
        ▼
subsequent "Update Draft" clicks
        │
        ▼
updateViewerFieldDraft()   ← PATCH /api/reports/viewer-drafts/{id}
        │
"Publish PDF" click
        │
        ▼
buildFieldObservationPdf() ← generates PDF blob client-side (jsPDF)
        │
        ▼
publishViewerFieldDraft()  ← POST /api/reports/viewer-drafts/{id}/publish
   (or createReportWithPdf if no draftId)
        │
        ▼
draft deleted on server, Report created, PDF stored in MinIO
PDF auto-downloaded to user's browser
draftId cleared from component state
```

**Important:** If "Publish PDF" is clicked without having saved a draft first, the report is created directly via `createReportWithPdf` (no draft involved). Saving a draft first is optional, it only matters if you want to preserve state across sessions.

## PDF generation

PDFs are built entirely in the browser using **jsPDF** via `lib/engineeringReportPdf.ts`. The backend receives a finished PDF blob, it does not generate or modify the PDF.

**PDF contents:**


| Section                 | Controlled by                      | Notes                                               |
| ----------------------- | ---------------------------------- | --------------------------------------------------- |
| Document title          | `NEXT_PUBLIC_PROJECT_NAME` env var | Defaults to `"A6 Stern"` if not set                 |
| Assessment subtitle     | `viewerKind` prop                  | e.g. "Panoramic (360°) visual record"               |
| Organisation line       | Hardcoded                          | `"SMART Construction Research Group"`               |
| Prepared by             | Logged-in username                 | Falls back to `"Not signed in"`                     |
| Report reference        | Auto-generated                     | `fieldObservationReportReference()` timestamp-based |
| Location                | `viewerContext.roomSlug + date`    | Hyphens replaced with spaces                        |
| Capture date            | `file.capture_date`                |                                                     |
| Visual / AI description | Optional checkbox                  | Includes `aiDescription` string                     |
| Author comments         | Optional checkbox                  | Includes `manualObservations` textarea              |
| Classification flags    | Checkboxes                         | Safety concern, quality concern, schedule delay     |


At least one section (visual assessment or author comments) must be included, publishing with both unchecked is blocked with a toast error.

## Report flags

The three classification checkboxes map to these flag strings stored in the database:


| Checkbox                 | Flag string        |
| ------------------------ | ------------------ |
| Safety concern (visual)  | `safety_concern`   |
| Quality concern          | `quality_concern`  |
| Schedule delay indicated | `schedule_delayed` |


`flagsFromObservationBooleans()` in `lib/observationReportFlags.ts` converts the booleans to the string array.

## Environment variable


| Variable                   | Default      | Description                                          |
| -------------------------- | ------------ | ---------------------------------------------------- |
| `NEXT_PUBLIC_PROJECT_NAME` | `"A6 Stern"` | Project name used in PDF headers and document titles |


Set this in `.env.local` for local dev or as a build arg in Docker if you are deploying for a different project.

## Comparison report flow

Comparison reports are handled separately in `/app/compare` (not via `ReportBuilder`). The flow:

```
User opens Compare page with two images side-by-side
        │
Annotates / observes differences
        │
"Save Draft" → createComparisonDraft()   ← POST /api/reports/comparison-drafts
        │         stores state_json with { left: {...}, right: {...} }
        │
"Publish" → buildCompareDraftPdf()       ← generates PDF client-side
        │
        → publishComparisonDrafts()      ← POST /api/reports/comparison-drafts/publish
              sends: PDF blob + draft_ids_json (array of draft IDs to consolidate)
        │
All selected drafts deleted, single Report created
PDF auto-downloaded
```

Multiple comparison drafts can be consolidated into one published report. The PDF is generated by `lib/compareDraftPdfFromState.ts`.

## File location reference


| File                                   | Purpose                                                                                |
| -------------------------------------- | -------------------------------------------------------------------------------------- |
| `components/reports/ReportBuilder.tsx` | Sidebar panel for viewer reports                                                       |
| `lib/engineeringReportPdf.ts`          | jsPDF builder for field observation reports                                            |
| `lib/compareDraftPdfFromState.ts`      | jsPDF builder for comparison reports                                                   |
| `lib/observationReportFlags.ts`        | Flag string constants and boolean→string conversion                                    |
| `services/apiClient.ts`                | All report/draft API calls (`createViewerFieldDraft`, `publishViewerFieldDraft`, etc.) |


