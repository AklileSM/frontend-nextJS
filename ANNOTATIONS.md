# Annotations (frontend)

How annotations work in the UI. Pairs with `backend/ANNOTATIONS.md` for the data model and API contract.

## Where they live

Only the **Static viewer** (`/app/viewer/static`) supports annotation creation/editing today. The panorama and point cloud viewers can read them but not place new pins.

## Coordinate system

Annotation pin positions are stored as **normalized `[0, 1]` floats** relative to the displayed image's intrinsic dimensions:

```ts
{
  x: 0.4231,   // fraction of image width  (0 = left edge, 1 = right edge)
  y: 0.7812,   // fraction of image height (0 = top edge, 1 = bottom edge)
  text: "Crack in plaster near doorframe"
}
```

This is what's written into `Annotation.data` on the backend (the backend treats `data` as opaque JSON — only the frontend interprets `x`/`y`/`text`).

Normalized coords mean the pin stays in the right spot when the image is zoomed or the viewer is resized. Multiplied by the current rendered image dimensions, they become pixel offsets for the overlay.

## Flags

Three categorical flags, plus a neutral "no flag":

| `flag` value | UI chip color | Used for |
|---|---|---|
| `safety` | red | Visible safety hazard |
| `quality` | amber | Workmanship / quality concern |
| `delayed` | steel-blue | Schedule slip indicator |
| `null` | gray | Uncategorized note |

Defined in `FLAG_META` at the top of `components/viewers/StaticViewer.tsx`. The annotation render uses the same color across the pin marker, the list chip, and the focus ring on the selected pin.

> The annotation flag values (`safety`, `quality`, `delayed`) and the report flag values (`safety_concern`, `quality_concern`, `schedule_delayed`) are intentionally separate strings — same intent, two namespaces. The bridge is `lib/observationReportFlags.ts`.

## UI flow

### Placing a new annotation

1. User clicks the "Add annotation" toggle in the static viewer toolbar (`setPlacingAnnotation(true)`).
2. The cursor switches to a crosshair.
3. User clicks the image. The click coords are normalized and used to open `AnnotationFormState` in `mode: 'create'`.
4. User types text, optionally picks a flag and a "linked annotation".
5. Optionally attaches an image (multipart upload).
6. Submit calls:
   - `createAnnotation({ fileId, x, y, text, flag, linked_annotation_id })`
   - If an attachment was staged: `uploadAnnotationAttachment(annotationId, file)` immediately after.
7. Annotation list refreshes; new pin appears with the next sequential number.

### Editing

1. User clicks a pin → details panel opens (`detailsForId`).
2. "Edit" button → `AnnotationFormState` opens in `mode: 'edit'` with the existing values.
3. Submit calls `updateAnnotation(...)`. Backend ignores unchanged fields; `clear_link: true` removes the link without affecting other fields.

### Deleting

`AnnotationDeleteConfirm` (a `ConfirmDialog` variant) intercepts the delete button. On confirm:

- `deleteAnnotation(id)` removes the row.
- `deleteAnnotationAttachment(id)` is not needed — the delete cascades on the backend.

### Toggling visibility

The "Show/hide annotations" eye icon toggles `showAnnotations` locally — the pins disappear from the image but remain in the side list (and on the backend). Used when the user wants a clean view for a screenshot.

## Linked annotations

A "linked annotation" is a soft cross-reference between two pins **on the same file**. Used in the PDF render to insert *"See also: annotation #N"* lines.

- The form lets the user pick another annotation on the current file from a dropdown.
- The backend rejects:
  - Self-links → 400 ("can't link to itself")
  - Links to annotations on different files → 400
  - Links to non-existent annotations → 404

To clear an existing link: pass `clear_link: true` in the PATCH. Leaving `linked_annotation_id: null` means "no change".

## Attachments

Each annotation can have **one** image attachment. Accepted MIME types: `image/jpeg`, `image/png`, `image/webp`, `image/gif`.

### Upload

```ts
await uploadAnnotationAttachment(annotationId, file);
// → POST /api/annotations/{id}/attachment  (multipart)
// → returns the updated annotation with attachment_url set
```

Replacing an attachment is the same call — the backend drops the old object before storing the new one.

### Display

`attachment_url` from the API is a backend-proxied path like `/api/annotations/<id>/attachment`. It is **not** a presigned URL, so it doesn't expire and can be cached.

Use it directly as an `<img>` src, but include the auth header if you fetch it programmatically (PDF generation does this — see below).

### Deletion

```ts
await deleteAnnotationAttachment(annotationId);
// → DELETE /api/annotations/{id}/attachment
// → attachment removed, annotation kept
```

Deleting the annotation itself removes the attachment too.

## PDF rendering

When a report is published, `ReportBuilder.tsx` (`buildObservationPdf`) walks the annotations array and:

1. Calculates a 1-based `index` for each.
2. Resolves any `linked_annotation_id` to a `linkedIndex` (the number of the target annotation in this report).
3. For attachments: fetches the bytes with the auth header and converts to a base64 data URL. `jsPDF.addImage` is synchronous, so all network IO is resolved upfront.
4. Hands the enriched list to `buildFieldObservationPdf` (`lib/engineeringReportPdf.ts`).

Attachment fetch failures are silent — the PDF renders an italic "could not be embedded" note instead of crashing.

## State shape

```ts
type AnnotationFormState = {
  mode: 'create' | 'edit';
  annotationId?: string;
  x: number;          // normalized
  y: number;          // normalized
  text: string;
  flag: AnnotationFlag | null;
  linkedAnnotationId: string | null;
  attachmentFile?: File | null;     // staged for upload
  existingAttachmentUrl?: string;   // present in edit mode if already attached
};
```

Lives in `useState` on `StaticViewer.tsx`. Reset to `null` on submit / cancel / Escape / `file.id` change.

## Permissions reality check

Annotations are **not** owner-scoped on the backend. Any authenticated user can edit or delete any annotation. The frontend doesn't currently surface this — there's no "this isn't yours" message. If you want strict per-user authorship, see `backend/ANNOTATIONS.md` § "Adding author tracking".

## Where the code lives

| Concern | File |
|---|---|
| Annotation overlay, form, sidebar list | `components/viewers/StaticViewer.tsx` |
| Delete confirm modal | `components/viewers/AnnotationDeleteConfirm.tsx` |
| Flag taxonomy + bridge to report flags | `lib/observationReportFlags.ts` |
| API client wrappers | `services/apiClient.ts` (`createAnnotation`, `updateAnnotation`, `deleteAnnotation`, `uploadAnnotationAttachment`, `deleteAnnotationAttachment`, `listAnnotations`) |
| PDF render integration | `components/reports/ReportBuilder.tsx`, `lib/engineeringReportPdf.ts` |
| TypeScript types | `types/api.ts` (`ApiAnnotation`, `AnnotationFlag`) |
