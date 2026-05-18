'use client';

/** Annotation create/edit modal.
 *
 *  The pin's (x, y) is stored on the form state. In edit mode, clicking the
 *  underlying image (handled by the parent) updates the pin coords on the
 *  open form — the modal doesn't own that logic.
 *
 *  Backed by the shared `<Modal>` shell — same dismissal affordances
 *  (Escape, backdrop click, X button) as everywhere else.
 */

import type { Dispatch, SetStateAction } from 'react';
import { Paperclip, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import type { ApiAnnotation } from '@/types/api';
import { FLAG_META, FLAG_ORDER } from './annotationStyles';
import type { AnnotationFormState } from './types';

type Props = {
  form: AnnotationFormState | null;
  setForm: Dispatch<SetStateAction<AnnotationFormState | null>>;
  /** All annotations on the current file — used to populate the "related
   *  annotation" picker (excluding the one being edited). */
  annotations: ApiAnnotation[];
  saving: boolean;
  onSave: () => void;
  onClose: () => void;
};

export function AnnotationFormModal({
  form,
  setForm,
  annotations,
  saving,
  onSave,
  onClose,
}: Props) {
  // Render nothing when no form is active — `Modal` itself guards `open`
  // but reading form.* below would crash, so the early return keeps the
  // JSX simple.
  if (!form) {
    return (
      <Modal open={false} onClose={onClose}>
        {null}
      </Modal>
    );
  }

  const linkable = annotations.filter((a) => a.id !== form.annotationId);
  const showExisting =
    form.existingAttachmentUrl && !form.removeExistingAttachment && !form.newAttachment;
  const previewSrc = form.newAttachment
    ? URL.createObjectURL(form.newAttachment)
    : showExisting
      ? form.existingAttachmentUrl
      : null;

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={form.mode === 'create' ? 'New annotation' : 'Edit annotation'}
      subtitle={form.mode === 'edit' ? 'Click the image to move this marker.' : undefined}
      size="lg"
      busy={saving}
      footer={
        <button
          type="button"
          disabled={!form.text.trim() || saving}
          onClick={onSave}
          className="rounded-md bg-amber-500 px-3.5 py-1.5 text-[13px] font-semibold text-base-950 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      }
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="annotation-form-text" className="block font-mono text-[10px] uppercase tracking-[0.18em] text-ink-300">
            Note
          </label>
          <textarea
            id="annotation-form-text"
            value={form.text}
            onChange={(e) =>
              setForm((prev) => (prev ? { ...prev, text: e.target.value } : null))
            }
            placeholder="Describe what you observed at this point..."
            rows={5}
            className="mt-1.5 w-full rounded-md border border-base-700 bg-base-950 px-3 py-2 text-[13px] text-white outline-none focus:border-amber-500"
          />
        </div>

        {/* Flag picker — pins inherit the flag colour. None is allowed (the
            original neutral pin). */}
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-300">Category</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setForm((prev) => (prev ? { ...prev, flag: null } : null))}
              className={`rounded-full border px-3 py-1 text-[12px] font-medium transition-colors ${
                form.flag === null
                  ? 'border-amber-500 bg-amber-500/10 text-amber-300'
                  : 'border-base-700 bg-base-950 text-ink-300 hover:border-ink-300'
              }`}
            >
              None
            </button>
            {FLAG_ORDER.map((f) => {
              const meta = FLAG_META[f];
              const active = form.flag === f;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setForm((prev) => (prev ? { ...prev, flag: f } : null))}
                  className={`rounded-full border px-3 py-1 text-[12px] font-medium transition-colors ${
                    active
                      ? `${meta.chip} border-transparent`
                      : 'border-base-700 bg-base-950 text-ink-300 hover:border-ink-300'
                  }`}
                >
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Same-file link picker. Excludes the row being edited. */}
        {linkable.length > 0 && (
          <div>
            <label htmlFor="annotation-form-link" className="block font-mono text-[10px] uppercase tracking-[0.18em] text-ink-300">
              Related annotation (optional)
            </label>
            <select
              id="annotation-form-link"
              value={form.linkedAnnotationId ?? ''}
              onChange={(e) =>
                setForm((prev) =>
                  prev ? { ...prev, linkedAnnotationId: e.target.value || null } : null,
                )
              }
              className="mt-1.5 w-full rounded-md border border-base-700 bg-base-950 px-3 py-2 text-[13px] text-white outline-none focus:border-amber-500"
            >
              <option value="">— none —</option>
              {linkable.map((a) => {
                // Use the page-wide index (1-based) so the label matches the
                // number on the pin.
                const idx = annotations.findIndex((x) => x.id === a.id);
                const preview = (a.text || '').slice(0, 50);
                return (
                  <option key={a.id} value={a.id}>
                    #{idx + 1}{preview ? ` — ${preview}` : ''}
                  </option>
                );
              })}
            </select>
          </div>
        )}

        {/* Image attachment. `newAttachment` and `removeExistingAttachment`
            are tracked separately so the parent can post both calls. */}
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-300">Attachment</p>
          <div className="mt-1.5 space-y-2">
            {previewSrc && (
              <div className="relative inline-block">
                <img
                  src={previewSrc}
                  alt="Attachment preview"
                  className="max-h-32 rounded-md border border-base-700 object-cover"
                />
                <button
                  type="button"
                  onClick={() =>
                    setForm((prev) =>
                      prev
                        ? {
                            ...prev,
                            newAttachment: null,
                            removeExistingAttachment: !!prev.existingAttachmentUrl,
                          }
                        : null,
                    )
                  }
                  aria-label="Remove attachment"
                  className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-base-950/85 text-ink-200 hover:bg-red-600 hover:text-white"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            )}
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-base-700 bg-base-950 px-3 py-1.5 text-[12px] text-white hover:border-ink-300">
              <Paperclip size={13} />
              {previewSrc ? 'Replace image' : 'Attach image'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setForm((prev) =>
                    prev
                      ? {
                          ...prev,
                          newAttachment: f,
                          removeExistingAttachment: false,
                        }
                      : null,
                  );
                  e.target.value = '';
                }}
              />
            </label>
          </div>
        </div>
      </div>
    </Modal>
  );
}
