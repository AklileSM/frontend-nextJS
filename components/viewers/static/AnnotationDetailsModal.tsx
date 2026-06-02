'use client';

/** Annotation details modal — shown when the user clicks a pin.
 *
 *  Surfaces the full text, the flag chip, the linked-annotation reference
 *  (resolved to the linked pin's number), and the attachment (if any).
 *  Footer has Edit and Delete buttons; the actual Edit / Delete state
 *  transitions are owned by the parent and surfaced via callback props.
 */

import { Modal } from '@/components/ui/Modal';
import type { ApiAnnotation } from '@/types/api';
import { FLAG_META } from './annotationStyles';

type Props = {
  annotation: ApiAnnotation | null;
  /** 1-based index of `annotation` within the parent's full annotation list,
   *  used for the title and for resolving the "linked" cross-reference. */
  index: number;
  annotations: ApiAnnotation[];
  /** When false the Edit/Delete actions are hidden (viewer role, or not the
   *  annotation's creator). Read-only view in that case. */
  canModify: boolean;
  onClose: () => void;
  onEdit: (a: ApiAnnotation) => void;
  onDelete: (a: ApiAnnotation) => void;
  /** Jump to a different annotation (the one this one is linked to). */
  onJumpToLinked: (linkedId: string) => void;
};

export function AnnotationDetailsModal({
  annotation,
  index,
  annotations,
  canModify,
  onClose,
  onEdit,
  onDelete,
  onJumpToLinked,
}: Props) {
  if (!annotation || index < 0) {
    return (
      <Modal open={false} onClose={onClose}>
        {null}
      </Modal>
    );
  }

  const linkedIdx = annotation.linked_annotation_id
    ? annotations.findIndex((a) => a.id === annotation.linked_annotation_id)
    : -1;

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <span>Annotation {index + 1}</span>
          {annotation.flag && (
            <span
              className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] ${FLAG_META[annotation.flag].chip}`}
            >
              {FLAG_META[annotation.flag].label}
            </span>
          )}
        </div>
      }
      size="lg"
      footer={
        canModify ? (
          <>
            <button
              type="button"
              onClick={() => onEdit(annotation)}
              className="rounded-md border border-base-700 px-3.5 py-1.5 text-[13px] font-medium text-white transition-colors hover:border-ink-300 hover:bg-base-800"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => onDelete(annotation)}
              className="rounded-md border border-red-800/50 px-3.5 py-1.5 text-[13px] font-medium text-red-200 transition-colors hover:border-red-600/60 hover:bg-red-950/50"
            >
              Delete
            </button>
          </>
        ) : undefined
      }
    >
      <div className="space-y-4 text-[13px] leading-relaxed text-ink-200">
        <p className="whitespace-pre-wrap">{annotation.text}</p>

        {/* Linked annotation reference — resolved to the pin number on the
            image. If the linked row was deleted (FK set null on the
            backend), `linkedIdx` will be -1 and we don't render the line. */}
        {annotation.linked_annotation_id && linkedIdx >= 0 && (
          <p className="text-[12px] text-ink-300">
            Related:{' '}
            <button
              type="button"
              onClick={() => onJumpToLinked(annotations[linkedIdx].id)}
              className="font-medium text-amber-300 underline-offset-2 hover:underline"
            >
              annotation #{linkedIdx + 1}
            </button>
          </p>
        )}

        {annotation.attachment_url && (
          <div>
            <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-300">
              Attachment
            </p>
            <a href={annotation.attachment_url} target="_blank" rel="noopener noreferrer">
              <img
                src={annotation.attachment_url}
                alt="Annotation attachment"
                className="max-h-64 rounded-md border border-base-700 object-cover"
              />
            </a>
          </div>
        )}
      </div>
    </Modal>
  );
}
