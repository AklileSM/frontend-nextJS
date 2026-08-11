'use client';

/** Sidebar's current-project accordion: project header (folder icon + name)
 *  with the room list expanded by default. When the sidebar is collapsed
 *  (icon-only rail), this collapses to a 2-letter project initial chip. */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight, Folder } from 'lucide-react';
import { useState } from 'react';
import type { ApiProject, ApiRoom } from '@/types/api';
import { RoomAccordion } from './RoomAccordion';

export function ProjectAccordion({
  project,
  rooms,
  expanded,
}: {
  project: ApiProject;
  rooms: ApiRoom[];
  expanded: boolean;
}) {
  const pathname = usePathname();
  const isActive = pathname === `/app/projects/${project.slug}`;
  const [open, setOpen] = useState(true);

  if (!expanded) {
    return (
      <Link
        href={`/app/projects/${project.slug}`}
        title={project.name}
        className={`group relative hidden h-9 items-center justify-center rounded-md font-mono text-[12px] uppercase transition-colors lg:flex ${
          isActive
            ? 'bg-base-800/70 text-amber-500'
            : 'text-ink-300 hover:bg-base-800/50 hover:text-white'
        }`}
      >
        {isActive && (
          <span className="absolute inset-y-1 left-0 w-[2px] rounded-r-sm bg-amber-500" />
        )}
        {project.slug.slice(0, 2).toUpperCase()}
      </Link>
    );
  }

  return (
    <div>
      <div
        className={`group relative flex items-center gap-1 rounded-md text-[13px] transition-colors ${
          isActive
            ? 'bg-base-800/70 text-white'
            : 'text-ink-100 hover:bg-base-800/50 hover:text-white'
        }`}
      >
        {isActive && (
          <span className="absolute inset-y-1 left-0 w-[2px] rounded-r-sm bg-amber-500" />
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex h-9 w-7 shrink-0 items-center justify-center text-ink-300"
        >
          <ChevronRight
            size={13}
            className={`transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
          />
        </button>
        <Link
          href={`/app/projects/${project.slug}`}
          className="flex flex-1 items-center gap-2 py-2 pr-3"
        >
          <Folder size={14} className="text-ink-300" />
          <span className="truncate">{project.name}</span>
        </Link>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.ul
            key="rooms"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden pl-7"
          >
            {rooms.length === 0 ? (
              <li className="px-2 py-1.5 font-mono text-[11px] text-ink-400">No rooms yet</li>
            ) : (
              rooms.map((r) => (
                <li key={r.id}>
                  <RoomAccordion room={r} projectSlug={project.slug} />
                </li>
              ))
            )}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
