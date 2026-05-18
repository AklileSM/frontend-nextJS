/** Local types for the Static viewer's annotation UI. */

import type { AnnotationFlag } from '@/types/api';

export type AnnotationFormState = {
  mode: 'create' | 'edit';
  annotationId?: string;
  pin: { x: number; y: number };
  text: string;
  flag: AnnotationFlag | null;
  linkedAnnotationId: string | null;
  /** The user-selected file for upload. Cleared after a successful save. */
  newAttachment: File | null;
  /** Set in edit mode when the annotation already has an attachment in MinIO. */
  existingAttachmentUrl: string | null;
  /** Edit-mode flag set when the user wants to drop an existing attachment. */
  removeExistingAttachment: boolean;
};
