'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Check, FileText, Image as ImageIcon, Box, Video } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useState, type MouseEvent as ReactMouseEvent } from 'react';
import { toast } from 'sonner';
import { setViewerContext, viewerHrefFor } from './viewerContext';
import { AssetDetailsModal } from './AssetDetailsModal';
import { MoreMenu } from '@/components/ui/MoreMenu';
import type { ApiMediaFile } from '@/types/api';

type Props = {
  file: ApiMediaFile;
  roomSlug: string;
  projectSlug?: string;
  date: string;
  origin: 'project' | 'room';
  canDelete: boolean;
  onDelete: (file: ApiMediaFile) => void;
  index?: number;
  // Multi-select. Each tile owns a checkbox in its corner. When `batchActive`
  // is true (at least one tile in the page-level batch), the checkbox stays
  // visible and a plain tile-body click also toggles selection, otherwise
  // the checkbox shows on hover only and the tile body opens the file.
  batchActive?: boolean;
  selected?: boolean;
  onToggleSelect?: (file: ApiMediaFile, opts: { range: boolean }) => void;
};

const TYPE_META: Record<
  ApiMediaFile['type'],
  { label: string; gradient: string; tint: string; Icon: typeof ImageIcon }
> = {
  image:      { label: 'IMG', gradient: 'from-amber-500/20 via-amber-500/5 to-base-900',   tint: 'text-amber-500',  Icon: ImageIcon },
  video:      { label: 'VID', gradient: 'from-steel-500/25 via-steel-500/5 to-base-900',   tint: 'text-steel-400',  Icon: Video     },
  pointcloud: { label: 'PCD', gradient: 'from-violet-500/25 via-violet-500/5 to-base-900', tint: 'text-violet-300', Icon: Box       },
  pdf:        { label: 'PDF', gradient: 'from-base-700/60 via-base-800 to-base-900',        tint: 'text-ink-200',    Icon: FileText  },
};

export function Thumbnail({
  file,
  roomSlug,
  projectSlug = '',
  date,
  origin,
  canDelete,
  onDelete,
  index = 0,
  batchActive = false,
  selected = false,
  onToggleSelect,
}: Props) {
  const router = useRouter();
  const meta = TYPE_META[file.type];
  const [thumbFailed, setThumbFailed] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const conversionStatus = file.conversion_status ?? null;
  const isPointcloud = file.type === 'pointcloud';
  const isPointcloudReady = !isPointcloud || conversionStatus === 'ready';
  const showThumbnail =
    !thumbFailed && (file.type === 'image' || file.type === 'video' || file.type === 'pdf') && !!file.src;

  const open = () => {
    if (isPointcloud && !isPointcloudReady) {
      if (conversionStatus === 'failed') {
        toast.error(file.conversion_error || 'Point cloud conversion failed. Retry upload or conversion.');
      } else {
        toast.info('Point cloud is still converting. Please wait until status is READY.');
      }
      return;
    }
    setViewerContext({ file, roomSlug, projectSlug, date, origin });
    router.push(viewerHrefFor(file));
  };

  const handleTileClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    // While a batch is in progress, the whole tile is a selection target —
    // plain click toggles, shift-click range-extends. Only when no batch is
    // active does the body click open the file in the viewer.
    if (batchActive && onToggleSelect) {
      e.preventDefault();
      onToggleSelect(file, { range: e.shiftKey });
      return;
    }
    open();
  };

  const handleCheckboxClick = (e: ReactMouseEvent<HTMLButtonElement>) => {
    // The corner checkbox always toggles, regardless of batch state, that's
    // how the first selection is bootstrapped. Stop propagation so the tile
    // body's onClick doesn't also fire and double-toggle.
    if (!onToggleSelect) return;
    e.stopPropagation();
    e.preventDefault();
    onToggleSelect(file, { range: e.shiftKey });
  };

  // Corner checkbox visibility: always on while a batch is active or this
  // tile is already in the batch; otherwise it fades in on hover.
  const checkboxVisible = batchActive || selected;

  const menuItems = [
    { label: 'Details', onClick: () => setDetailsOpen(true) },
    ...(canDelete ? [{ label: 'Delete', danger: true, onClick: () => onDelete(file) }] : []),
  ];

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.48), ease: [0.22, 1, 0.36, 1] }}
        whileHover={{ y: -3 }}
        onClick={handleTileClick}
        aria-selected={selected}
        className={`group relative cursor-pointer rounded-lg border bg-base-900 transition-colors ${menuOpen ? 'z-30' : 'z-0'} ${
          selected
            ? 'border-amber-500 ring-2 ring-amber-500/40'
            : 'border-base-800 hover:border-amber-500/40'
        }`}
      >
        <div className={`relative aspect-[4/3] overflow-hidden rounded-[7px] bg-gradient-to-br ${meta.gradient}`}>

        {/* Selection checkbox, corner widget. Hidden by default, fades in on
            tile hover. Once a batch is active or this tile is selected, it
            stays visible. Click toggles; shift-click range-extends. */}
        {onToggleSelect && (
          <button
            type="button"
            role="checkbox"
            aria-checked={selected}
            aria-label={selected ? `Deselect ${file.file_name}` : `Select ${file.file_name}`}
            onClick={handleCheckboxClick}
            className={`absolute left-2 top-2 z-10 inline-flex h-6 w-6 items-center justify-center rounded-full border-2 shadow-md transition-opacity ${
              selected
                ? 'border-amber-500 bg-amber-500 text-base-950'
                : 'border-white/80 bg-base-950/60 text-transparent hover:border-amber-500 hover:bg-base-950/80'
            } ${checkboxVisible ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
          >
            <Check size={13} strokeWidth={3} />
          </button>
        )}

        {/* Real thumbnail */}
        {showThumbnail && (
          <img
            src={file.src}
            alt={file.file_name}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
            onError={() => setThumbFailed(true)}
          />
        )}

        {/* Icon fallback, large centered icon + label */}
        {!showThumbnail && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5">
            <meta.Icon size={44} strokeWidth={1.25} className={meta.tint} />
            <span className={`font-mono text-[10px] font-semibold uppercase tracking-[0.2em] opacity-60 ${meta.tint}`}>
              {meta.label}
            </span>
          </div>
        )}

        {/* PCD dot scatter */}
        {isPointcloud && (
          <span className="pointer-events-none absolute inset-3 grid grid-cols-8 gap-1 opacity-50">
            {Array.from({ length: 24 }).map((_, i) => (
              <span
                key={i}
                className="block h-0.5 w-0.5 rounded-full bg-amber-500/60"
                style={{ opacity: 0.3 + ((i * 13) % 7) * 0.1 }}
              />
            ))}
          </span>
        )}

        {/* Type badge, only when showing a real thumbnail */}
        {showThumbnail && (
          <span className="absolute right-1.5 top-1.5 rounded-sm bg-base-950/80 px-1.5 py-0.5 font-mono text-[9px] font-medium tracking-widest text-ink-200">
            {meta.label}
          </span>
        )}

        {/* Conversion status badge */}
        {isPointcloud && conversionStatus && conversionStatus !== 'ready' && (
          <span className="absolute left-2 top-2 rounded-sm bg-base-950/85 px-1.5 py-0.5 font-mono text-[9px] font-medium tracking-widest text-amber-300">
            {conversionStatus === 'processing' || conversionStatus === 'uploading' || conversionStatus === 'pending'
              ? 'PROCESSING'
              : conversionStatus.toUpperCase()}
          </span>
        )}

        {/* Bottom info overlay */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-base-950/95 via-base-950/50 to-transparent pb-3 pl-3 pr-12 pt-10">
          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-[12px] font-medium leading-snug text-white" title={file.file_name}>
                {file.file_name}
              </p>
              <p className="mt-0.5 font-mono text-[10px] text-ink-400">
                {format(parseISO(file.capture_date), 'MMM d, yyyy')}
              </p>
            </div>
          </div>
        </div>

        </div>
        <div
          className="absolute bottom-2 right-2 z-20"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <MoreMenu items={menuItems} onOpenChange={setMenuOpen} placement="top" />
        </div>
      </motion.div>
      <AssetDetailsModal file={file} open={detailsOpen} onClose={() => setDetailsOpen(false)} />
    </>
  );
}
