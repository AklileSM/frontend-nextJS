/** Visual treatment for annotation flags.
 *  Pin colour flows from `pin`; the details modal uses `chip` for the small
 *  badge; the selected-pin ring uses `ring`. Keep additions in sync with the
 *  backend `_ALLOWED_FLAGS` taxonomy and `lib/observationReportFlags.ts`. */

import type { AnnotationFlag } from '@/types/api';

export const FLAG_META: Record<AnnotationFlag, { label: string; pin: string; chip: string; ring: string }> = {
  safety:  { label: 'Safety',  pin: 'bg-red-500 border-red-200 text-white',        chip: 'bg-red-500/15 text-red-300',     ring: 'ring-red-400/40'    },
  quality: { label: 'Quality', pin: 'bg-amber-400 border-amber-100 text-base-950', chip: 'bg-amber-500/15 text-amber-300', ring: 'ring-amber-400/40'  },
  delayed: { label: 'Delayed', pin: 'bg-sky-500 border-sky-200 text-white',        chip: 'bg-sky-500/15 text-sky-300',     ring: 'ring-sky-400/40'    },
};

export const FLAG_ORDER: AnnotationFlag[] = ['safety', 'quality', 'delayed'];

/** Neutral / unflagged annotation styling — matches the original amber pin. */
export const UNFLAGGED_PIN = 'bg-base-950 border-amber-400 text-amber-300';
export const UNFLAGGED_RING = 'ring-amber-400/40';
