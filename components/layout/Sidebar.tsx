'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Folder,
  FolderOpen,
  Home,
  Image as ImageIcon,
  FileText,
  Box,
  ShieldCheck,
  Video,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Logo } from '@/components/landing/Logo';
import { useSidebar } from './SidebarContext';
import { MiniCalendar } from './MiniCalendar';
import { useAuth } from '@/context/AuthContext';
import { getExplorerByRoom, listProjects, listRooms } from '@/services/apiClient';
import type { ApiProject, ApiRoom, ApiRoomMediaGroup } from '@/types/api';

export function Sidebar() {
  const { open, close, toggle } = useSidebar();
  const { user } = useAuth();
  const [projects, setProjects] = useState<ApiProject[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    listProjects().then((p) => {
      if (!cancelled) setProjects(p);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={close}
            className="fixed inset-0 z-30 bg-base-950/70 backdrop-blur-sm lg:hidden"
            aria-hidden
          />
        )}
      </AnimatePresence>

      <aside
        data-open={open}
        className={`fixed inset-y-0 left-0 z-40 flex h-screen w-[260px] flex-col border-r border-base-800 bg-base-900/95 backdrop-blur transition-[width,transform] duration-200 ease-out
          ${open ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
          ${open ? 'lg:w-[260px]' : 'lg:w-[68px]'}
        `}
      >
        <div
          className={`flex items-center justify-between gap-2 border-b border-base-800 px-4 py-4 ${
            open ? '' : 'lg:flex-col lg:items-center lg:gap-3 lg:px-2'
          }`}
        >
          <Link
            href="/app"
            aria-label="App home"
            className={`flex items-center gap-2.5 ${open ? '' : 'lg:gap-0'}`}
          >
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[5px] bg-amber-500 font-display text-[11px] font-bold text-base-950">
              SS
            </span>
            <span
              className={`font-display text-[15px] font-semibold tracking-tight text-white ${
                open ? 'inline' : 'lg:hidden'
              }`}
            >
              SiteScope
            </span>
          </Link>
          <button
            type="button"
            onClick={toggle}
            aria-label={open ? 'Collapse sidebar' : 'Expand sidebar'}
            title={open ? 'Collapse sidebar' : 'Expand sidebar'}
            className="hidden h-7 w-7 items-center justify-center rounded text-ink-300 transition-colors hover:bg-base-800 hover:text-white lg:inline-flex"
          >
            {open ? <ChevronsLeft size={14} /> : <ChevronsRight size={14} />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <NavLink href="/app" icon={<Home size={14} />} label="Home" expanded={open} />
          <NavLink
            href="/projects"
            icon={<FolderOpen size={14} />}
            label="Projects"
            expanded={open}
            isActive={false}
          />

          <SectionLabel expanded={open}>Projects</SectionLabel>
          <ul className="space-y-0.5">
            {projects?.map((p) => (
              <li key={p.id}>
                <ProjectAccordion project={p} expanded={open} />
              </li>
            ))}
            {!projects && <li className="px-3 py-2 font-mono text-[11px] text-ink-400">Loading…</li>}
          </ul>

          {user?.is_admin && (
            <>
              <SectionLabel expanded={open}>Platform</SectionLabel>
              <NavLink
                href="/app/admin"
                icon={<ShieldCheck size={14} />}
                label="Admin panel"
                expanded={open}
              />
            </>
          )}
        </nav>

        <div className={`border-t border-base-800 ${open ? 'block' : 'hidden lg:hidden'}`}>
          <SectionLabel expanded={open} className="pt-3">
            Calendar
          </SectionLabel>
          <MiniCalendar />
        </div>

        <UserFooter expanded={open} username={user?.username ?? '—'} role={user?.is_admin ? 'admin' : 'member'} />
      </aside>
    </>
  );
}

function SectionLabel({
  children,
  expanded,
  className = '',
}: {
  children: React.ReactNode;
  expanded: boolean;
  className?: string;
}) {
  if (!expanded) return null;
  return (
    <p
      className={`mt-5 mb-2 px-3 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-400 ${className}`}
    >
      {children}
    </p>
  );
}

function NavLink({
  href,
  icon,
  label,
  expanded,
  isActive,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  expanded: boolean;
  isActive?: boolean;
}) {
  const pathname = usePathname();
  const active = isActive ?? pathname === href;
  return (
    <Link
      href={href}
      className={`group relative flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] transition-colors ${
        active
          ? 'bg-base-800/70 text-white'
          : 'text-ink-200 hover:bg-base-800/50 hover:text-white'
      } ${expanded ? '' : 'lg:justify-center'}`}
    >
      {active && (
        <motion.span
          layoutId="active-rail"
          className="absolute inset-y-1 left-0 w-[2px] rounded-r-sm bg-amber-500"
        />
      )}
      <span className="shrink-0 text-ink-300 group-hover:text-white">{icon}</span>
      <span className={expanded ? 'inline' : 'lg:hidden'}>{label}</span>
    </Link>
  );
}

// --- Projects accordion -----------------------------------------------------

function ProjectAccordion({ project, expanded }: { project: ApiProject; expanded: boolean }) {
  const pathname = usePathname();
  const isActive = pathname === `/app/projects/${project.slug}`;
  const [open, setOpen] = useState(false);
  const [rooms, setRooms] = useState<ApiRoom[] | null>(null);

  const toggle = async () => {
    setOpen((v) => !v);
    if (!rooms) {
      const all = await listRooms();
      setRooms(all.filter((r) => r.project_id === project.id));
    }
  };

  if (!expanded) {
    return (
      <Link
        href={`/app/projects/${project.slug}`}
        title={project.name}
        className={`group relative hidden h-9 items-center justify-center rounded-md text-[12px] font-mono uppercase transition-colors lg:flex ${
          isActive ? 'bg-base-800/70 text-amber-500' : 'text-ink-300 hover:bg-base-800/50 hover:text-white'
        }`}
      >
        {isActive && <span className="absolute inset-y-1 left-0 w-[2px] rounded-r-sm bg-amber-500" />}
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
        {isActive && <span className="absolute inset-y-1 left-0 w-[2px] rounded-r-sm bg-amber-500" />}
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="flex h-9 w-7 shrink-0 items-center justify-center text-ink-300 transition-transform"
        >
          <ChevronRight size={13} className={`transition-transform duration-150 ${open ? 'rotate-90' : ''}`} />
        </button>
        <Link href={`/app/projects/${project.slug}`} className="flex flex-1 items-center gap-2 py-2 pr-3">
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
            {!rooms && <li className="px-2 py-1.5 font-mono text-[11px] text-ink-400">Loading…</li>}
            {rooms && rooms.length === 0 && (
              <li className="px-2 py-1.5 font-mono text-[11px] text-ink-400">No rooms yet</li>
            )}
            {rooms?.map((r) => (
              <li key={r.id}>
                <RoomAccordion room={r} />
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

function RoomAccordion({ room }: { room: ApiRoom }) {
  const params = useSearchParams();
  const isActive = params.get('room') === room.slug;
  const [open, setOpen] = useState(false);
  const [dates, setDates] = useState<Array<[string, ApiRoomMediaGroup]> | null>(null);

  const toggle = async () => {
    setOpen((v) => !v);
    if (!dates) {
      const res = await getExplorerByRoom(room.slug);
      setDates(Object.entries(res.dates).sort(([a], [b]) => b.localeCompare(a)));
    }
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
          <ChevronRight size={11} className={`transition-transform duration-150 ${open ? 'rotate-90' : ''}`} />
        </button>
        <Link
          href={`/app/room-explorer?room=${room.slug}`}
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
            {!dates && <li className="px-2 py-1 font-mono text-[10.5px] text-ink-400">Loading…</li>}
            {dates && dates.length === 0 && (
              <li className="px-2 py-1 font-mono text-[10.5px] text-ink-400">No captures yet</li>
            )}
            {dates?.map(([date, group]) => (
              <li key={date}>
                <DateNode roomSlug={room.slug} date={date} group={group} />
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

function DateNode({
  roomSlug,
  date,
  group,
}: {
  roomSlug: string;
  date: string;
  group: ApiRoomMediaGroup;
}) {
  const total = group.images.length + group.videos.length + group.pointclouds.length + group.pdfs.length;
  return (
    <Link
      href={`/app/room-explorer?room=${roomSlug}&date=${date}`}
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
    { Icon: ImageIcon, n: group.images.length, key: 'img' },
    { Icon: Video, n: group.videos.length, key: 'vid' },
    { Icon: Box, n: group.pointclouds.length, key: 'pcd' },
    { Icon: FileText, n: group.pdfs.length, key: 'pdf' },
  ];
  return (
    <span className="flex items-center gap-1">
      {items
        .filter((i) => i.n > 0)
        .map(({ Icon, key }) => (
          <Icon key={key} size={10} />
        ))}
    </span>
  );
}

// --- User footer ------------------------------------------------------------

function UserFooter({
  expanded,
  username,
  role,
}: {
  expanded: boolean;
  username: string;
  role: string;
}) {
  const initials = (() => {
    const parts = username.split(/[\s._-]/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return username.slice(0, 2).toUpperCase();
  })();

  return (
    <div className={`border-t border-base-800 px-3 py-3 ${expanded ? '' : 'lg:px-2 lg:py-3'}`}>
      <div className={`flex items-center gap-3 ${expanded ? '' : 'lg:justify-center'}`}>
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-amber-500 font-display text-[12px] font-bold text-base-950">
          {initials}
        </span>
        <div className={`min-w-0 flex-1 ${expanded ? 'block' : 'lg:hidden'}`}>
          <div className="truncate text-[13px] font-medium text-white">{username}</div>
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-300">{role}</div>
        </div>
      </div>
    </div>
  );
}
