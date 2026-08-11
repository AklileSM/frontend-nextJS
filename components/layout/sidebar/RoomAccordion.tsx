'use client';

/** Per-room expandable node in the sidebar. Open/closed state persists per
 *  room in sessionStorage so coming back to the sidebar doesn't reset the
 *  tree the user just opened. Lazily loads the date list from the API the
 *  first time it expands. */

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Box, ChevronRight, FileText, Image as ImageIcon, Video, type LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getExplorerByRoom } from '@/services/apiClient';
import type { ApiRoom, ApiRoomMediaGroup } from '@/types/api';

const roomOpenKey = (roomId: string) => `sitescope.sidebar.roomOpen.${roomId}`;

export function RoomAccordion({ room, projectSlug }: { room: ApiRoom; projectSlug: string }) {
  const params = useSearchParams();
  const isActive =
    params.get('room') === room.slug &&
    (params.get('project') === projectSlug || params.get('project') === null);
  const [open, setOpen] = useState(() => {
    try { return sessionStorage.getItem(roomOpenKey(room.id)) === '1'; } catch { return false; }
  });
  const [dates, setDates] = useState<Array<[string, ApiRoomMediaGroup]> | null>(null);

  // Fetch dates whenever the accordion opens for the first time.
  useEffect(() => {
    if (!open || dates) return;
    getExplorerByRoom(room.slug, room.project_id).then((res) => {
      setDates(Object.entries(res.dates).sort(([a], [b]) => b.localeCompare(a)));
    }).catch(() => {});
  }, [open, dates, room.project_id, room.slug]);

  const toggle = () => {
    setOpen((v) => {
      const next = !v;
      try {
        if (next) sessionStorage.setItem(roomOpenKey(room.id), '1');
        else sessionStorage.removeItem(roomOpenKey(room.id));
      } catch { /* ignore */ }
      return next;
    });
  };

  return (
    <div>
      <div
        className={`group relative flex items-center gap-1 rounded-md text-[12.5px] transition-colors ${
          isActive ? 'text-amber-500' : 'text-ink-200 hover:text-white'
        }`}
      >
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="flex h-7 w-5 shrink-0 items-center justify-center text-ink-400"
        >
          <ChevronRight
            size={11}
            className={`transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
          />
        </button>
        <Link
          href={`/app/room-explorer?project=${encodeURIComponent(projectSlug)}&room=${encodeURIComponent(room.slug)}`}
          className="flex flex-1 items-center justify-between gap-2 rounded py-1.5 pr-2 transition-colors hover:bg-base-800/50"
        >
          <span className="truncate">{room.name}</span>
          {isActive && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />}
        </Link>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.ul
            key="dates"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden pl-5"
          >
            {!dates && (
              <li className="px-2 py-1 font-mono text-[10.5px] text-ink-400">Loading…</li>
            )}
            {dates && dates.length === 0 && (
              <li className="px-2 py-1 font-mono text-[10.5px] text-ink-400">No captures yet</li>
            )}
            {dates?.map(([date, group]) => (
              <li key={date}>
                <DateNode projectSlug={projectSlug} roomSlug={room.slug} date={date} group={group} />
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

function DateNode({
  projectSlug,
  roomSlug,
  date,
  group,
}: {
  projectSlug: string;
  roomSlug: string;
  date: string;
  group: ApiRoomMediaGroup;
}) {
  const total =
    group.images.length + group.videos.length + group.pointclouds.length + group.pdfs.length;
  return (
    <Link
      href={`/app/room-explorer?project=${encodeURIComponent(projectSlug)}&room=${encodeURIComponent(roomSlug)}&date=${encodeURIComponent(date)}`}
      className="flex items-center justify-between gap-2 rounded px-2 py-1 font-mono text-[11px] text-ink-300 transition-colors hover:bg-base-800/40 hover:text-white"
    >
      <span className="flex items-center gap-2">
        <span>{date}</span>
        <MediaGlyphs group={group} />
      </span>
      <span className="text-ink-400">{total}</span>
    </Link>
  );
}

function MediaGlyphs({ group }: { group: ApiRoomMediaGroup }) {
  const items: Array<{ Icon: LucideIcon; n: number; key: string }> = [
    { Icon: ImageIcon, n: group.images.length,      key: 'img' },
    { Icon: Video,     n: group.videos.length,      key: 'vid' },
    { Icon: Box,       n: group.pointclouds.length, key: 'pcd' },
    { Icon: FileText,  n: group.pdfs.length,        key: 'pdf' },
  ];
  return (
    <span className="flex items-center gap-1">
      {items.filter((i) => i.n > 0).map(({ Icon, key }) => (
        <Icon key={key} size={10} />
      ))}
    </span>
  );
}
