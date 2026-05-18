'use client';

/** Pin overlay rendered on top of the static image.
 *
 *  Numbered pins per annotation. The selected pin gets a larger size + ring.
 *  In edit mode, the pin being edited is rendered at the form's tentative
 *  (x, y) instead of the saved row — gives live feedback as the user clicks
 *  on the image to re-position.
 *
 *  In create mode, a green ghost circle is drawn at the proposed (x, y)
 *  while the form is open.
 */

import type { ApiAnnotation } from '@/types/api';
import { FLAG_META, UNFLAGGED_PIN, UNFLAGGED_RING } from './annotationStyles';

type Props = {
  annotations: ApiAnnotation[];
  show: boolean;
  selectedId: string | null;
  /** When set, the annotation with this id will be drawn at `editingPin`
   *  instead of its saved (x, y). Used for live-update during edit. */
  editingId?: string | null;
  editingPin?: { x: number; y: number } | null;
  /** When set, draws a green ghost circle at this position — used in
   *  create mode while the new-annotation form is open. */
  createPin?: { x: number; y: number } | null;
  onPinClick: (id: string) => void;
};

export function AnnotationPins({
  annotations,
  show,
  selectedId,
  editingId,
  editingPin,
  createPin,
  onPinClick,
}: Props) {
  return (
    <>
      {show &&
        annotations.map((a, idx) => {
          const active = selectedId === a.id;
          const isEditingThis = editingId === a.id && editingPin;
          const markerX = isEditingThis ? editingPin!.x : a.x;
          const markerY = isEditingThis ? editingPin!.y : a.y;
          const flagMeta = a.flag ? FLAG_META[a.flag] : null;
          const pinColor = flagMeta ? flagMeta.pin : UNFLAGGED_PIN;
          const ringColor = flagMeta ? flagMeta.ring : UNFLAGGED_RING;
          return (
            <button
              key={a.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPinClick(a.id);
              }}
              title={a.text}
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 text-[10px] font-semibold transition-all duration-150 ${pinColor} ${
                active
                  ? `z-20 h-7 w-7 shadow-lg ring-2 ${ringColor} hover:scale-110`
                  : 'z-10 h-5 w-5 hover:z-30 hover:scale-125'
              }`}
              style={{ left: `${markerX * 100}%`, top: `${markerY * 100}%` }}
            >
              {idx + 1}
            </button>
          );
        })}

      {createPin && (
        <span
          className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-emerald-300 bg-emerald-500/30"
          style={{ left: `${createPin.x * 100}%`, top: `${createPin.y * 100}%` }}
        />
      )}
    </>
  );
}
