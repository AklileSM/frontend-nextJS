'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Bot, ChevronsLeft, ChevronsRight, Home, LayoutGrid, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSidebar } from './SidebarContext';
import { MiniCalendar } from './MiniCalendar';
import { useAuth } from '@/context/AuthContext';
import { listProjects, listRooms } from '@/services/apiClient';
import type { ApiProject, ApiRoom } from '@/types/api';
import { NavLink, SectionLabel } from './sidebar/NavAtoms';
import { ProjectAccordion } from './sidebar/ProjectAccordion';
import { UserFooter } from './sidebar/UserFooter';

const PERSIST_KEY = 'sidebar.lastProjectSlug';

export function Sidebar() {
  const { open, close, toggle } = useSidebar();
  const { user } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [projects, setProjects] = useState<ApiProject[] | null>(null);
  const [allRooms, setAllRooms] = useState<ApiRoom[] | null>(null);

  // Seed from sessionStorage so the correct project shows instantly on pages
  // that don't carry the slug in their URL (viewers, compare, /app home, etc.).
  const [lastSlug, setLastSlug] = useState<string | null>(() => {
    try { return sessionStorage.getItem(PERSIST_KEY); } catch { return null; }
  });

  useEffect(() => {
    let cancelled = false;
    Promise.all([listProjects(), listRooms()]).then(([ps, rs]) => {
      if (!cancelled) {
        setProjects(ps);
        setAllRooms(rs);
      }
    });
    return () => { cancelled = true; };
  }, []);

  // Derive slug from URL — most reliable sources first.
  const slugFromPath = pathname.match(/\/app\/projects\/([^/]+)/)?.[1] ?? null;
  const roomSlug = searchParams.get('room');
  const roomFromQuery = roomSlug && allRooms ? allRooms.find((r) => r.slug === roomSlug) : null;
  const slugFromRoom = roomFromQuery && projects
    ? (projects.find((p) => p.id === roomFromQuery.project_id)?.slug ?? null)
    : null;

  // Persist whenever a URL-derived slug is available so it survives to pages
  // like viewers and /app home where the slug isn't in the URL.
  useEffect(() => {
    const slug = slugFromPath ?? slugFromRoom;
    if (slug && slug !== lastSlug) {
      try { sessionStorage.setItem(PERSIST_KEY, slug); } catch { /* ignore */ }
      setLastSlug(slug);
    }
  }, [slugFromPath, slugFromRoom, lastSlug]);

  const currentSlug = slugFromPath ?? slugFromRoom ?? lastSlug ?? null;
  const currentProject = currentSlug ? (projects?.find((p) => p.slug === currentSlug) ?? null) : null;
  const currentRooms = currentProject && allRooms
    ? allRooms
        .filter((r) => r.project_id === currentProject.id)
        .sort((a, b) => a.sort_order - b.sort_order)
    : null;

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
        {/* Header */}
        <div
          className={`flex items-center justify-between gap-2 border-b border-base-800 px-4 py-4 ${
            open ? '' : 'lg:flex-col lg:items-center lg:gap-3 lg:px-2'
          }`}
        >
          <Link
            href="/projects"
            aria-label="All projects"
            className={`flex items-center gap-2.5 ${open ? '' : 'lg:gap-0'}`}
          >
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[5px] bg-amber-500 font-display text-[11px] font-bold text-base-950">
              SS
            </span>
            <span className={`font-display text-[15px] font-semibold tracking-tight text-white ${open ? 'inline' : 'lg:hidden'}`}>
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

        <nav data-tour="sidebar-nav" className="flex-1 overflow-y-auto px-3 py-4">
          {/* Home — always shown, links to current project home if known */}
          <NavLink
            href={currentSlug ? `/app/projects/${currentSlug}` : '/projects'}
            icon={<Home size={14} />}
            label="Home"
            expanded={open}
            isActive={!!currentSlug && pathname === `/app/projects/${currentSlug}`}
          />

          {/* All projects hub — always shown */}
          <NavLink
            href="/projects"
            icon={<LayoutGrid size={14} />}
            label="All projects"
            expanded={open}
            isActive={false}
          />

          <NavLink
            href="/app/robots"
            icon={<Bot size={14} />}
            label="Robot missions"
            expanded={open}
            isActive={pathname === '/app/robots'}
          />

          {/* Current project accordion — always shown */}
          <div data-tour="sidebar-project-accordion" className="mt-2">
            {currentProject && currentRooms !== null ? (
              <ul className="space-y-0.5">
                <li>
                  <ProjectAccordion
                    project={currentProject}
                    rooms={currentRooms}
                    expanded={open}
                  />
                </li>
              </ul>
            ) : (
              /* Loading state or no project in URL yet */
              open ? (
                <p className="px-3 py-2 font-mono text-[11px] text-ink-400">
                  {!projects ? 'Loading…' : 'No project selected'}
                </p>
              ) : null
            )}
          </div>

          {/* Admin — conditional */}
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

        <div data-tour="sidebar-calendar" className={`border-t border-base-800 ${open ? 'block' : 'hidden lg:hidden'}`}>
          <SectionLabel expanded={open} className="pt-3">
            Calendar
          </SectionLabel>
          <MiniCalendar projectId={currentProject?.id} />
        </div>

        <UserFooter
          expanded={open}
          username={user?.username ?? '—'}
          role={user?.is_admin ? 'admin' : 'member'}
        />
      </aside>
    </>
  );
}
