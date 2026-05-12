'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { FolderOpen, Settings } from 'lucide-react';
import Link from 'next/link';
import { listProjects, listRooms } from '@/services/apiClient';
import { useAuth } from '@/context/AuthContext';
import { useMyProjectRole } from '@/hooks/useMyProjectRole';
import { Floorplan } from '@/components/home/Floorplan';
import { ChartAll } from '@/components/home/ChartAll';
import { ChartLocation } from '@/components/home/ChartLocation';
import { MiniCalendar } from '@/components/layout/MiniCalendar';
import type { ApiProject, ApiRoom } from '@/types/api';

export const dynamic = 'force-dynamic';

type Tab = 'rooms' | 'calendar';
const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'rooms', label: 'Data overview' },
  { id: 'calendar', label: 'Calendar' },
];

export default function ProjectHomePage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();

  const [project, setProject] = useState<ApiProject | null>(null);
  const [rooms, setRooms] = useState<ApiRoom[]>([]);
  const [hoveredRoom, setHoveredRoom] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('rooms');

  const isAdmin = user?.is_admin ?? false;
  const { canManageSettings } = useMyProjectRole(project?.id);
  const showSettings = isAdmin || canManageSettings;

  useEffect(() => {
    let cancelled = false;
    Promise.all([listProjects(), listRooms()]).then(([ps, rs]) => {
      if (cancelled) return;
      const p = ps.find((x) => x.slug === slug);
      setProject(p ?? null);
      setRooms(p ? rs.filter((r) => r.project_id === p.id) : []);
    });
    return () => { cancelled = true; };
  }, [slug]);

  const placedRooms = useMemo(
    () => rooms.filter((r) => r.floor_plan_coordinates !== null),
    [rooms],
  );

  const hasFloorplan = Boolean(project?.floorplan_url);

  if (!project) {
    return (
      <div className="px-6 py-10 sm:px-8 lg:px-12 xl:px-16">
        <div className="h-8 w-40 animate-pulse rounded bg-base-800" />
        <div className="mt-3 h-12 w-64 animate-pulse rounded bg-base-800/60" />
      </div>
    );
  }

  return (
    <div className="px-6 py-10 sm:px-8 lg:px-12 xl:px-16">
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-wrap items-end justify-between gap-4 max-w-none"
      >
        <div>
          <p className="inline-flex items-center gap-3 font-mono text-[12px] uppercase tracking-[0.22em] text-amber-500">
            <span className="h-px w-8 bg-amber-500/60" />
            Project · {project.slug}
          </p>
          <h1 className="mt-4 font-display text-[40px] font-semibold leading-[1.08] tracking-[-0.018em] text-white sm:text-[48px]">
            {project.name}
          </h1>
          {project.description && (
            <p className="mt-3 max-w-[60ch] text-[15px] leading-[1.7] text-ink-200">
              {project.description}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/app/projects/${slug}/files`}
            className="inline-flex items-center gap-2 rounded-md bg-amber-500 px-3 py-1.5 text-[13px] font-semibold text-base-950 transition-colors hover:bg-amber-400"
          >
            <FolderOpen size={14} />
            File explorer
          </Link>
          {showSettings && (
            <Link
              href={`/projects/${slug}/settings`}
              className="inline-flex items-center gap-2 rounded-md border border-base-700 px-3 py-1.5 text-[13px] font-medium text-ink-200 transition-colors hover:border-ink-400 hover:text-white"
            >
              <Settings size={13} />
              Settings
            </Link>
          )}
        </div>
      </motion.section>

      <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr] lg:gap-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
        >
          {hasFloorplan ? (
            <Floorplan
              floorplanUrl={project.floorplan_url!}
              projectSlug={slug}
              rooms={rooms}
              hoveredRoom={hoveredRoom}
              onHoverChange={setHoveredRoom}
            />
          ) : (
            <NoFloorplanCTA slug={slug} showSettings={showSettings} />
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-5"
        >
          <ChartAll projectId={project.id} />

          <div className="rounded-lg border border-base-800 bg-base-900/30">
            <div role="tablist" className="flex items-stretch border-b border-base-800 px-2">
              {TABS.map((t) => {
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    role="tab"
                    aria-selected={active}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={`relative flex-1 px-3 py-3 text-[13px] font-medium transition-colors ${
                      active ? 'text-white' : 'text-ink-300 hover:text-white'
                    }`}
                  >
                    {t.label}
                    {active && (
                      <motion.span
                        layoutId={`project-tab-rail-${slug}`}
                        className="absolute inset-x-3 -bottom-px h-[2px] bg-amber-500"
                      />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="min-h-[320px] p-5">
              <AnimatePresence mode="wait">
                <motion.div
                  key={tab}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                >
                  {tab === 'rooms' ? (
                    <ChartLocation projectId={project.id} hoveredRoom={hoveredRoom} />
                  ) : (
                    <div className="-mx-2">
                      <MiniCalendar projectId={project.id} />
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function NoFloorplanCTA({ slug, showSettings }: { slug: string; showSettings: boolean }) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center rounded-lg border border-dashed border-base-700 bg-base-900/30 p-10 text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-400">
        No floorplan uploaded
      </p>
      <p className="mt-2 max-w-[36ch] text-[14px] leading-[1.6] text-ink-300">
        Upload a floorplan image and draw room hotspots to enable the interactive floor view.
      </p>
      {showSettings && (
        <Link
          href={`/projects/${slug}/settings?tab=setup`}
          className="mt-5 inline-flex items-center gap-2 rounded-md bg-amber-500 px-4 py-2 text-[13px] font-semibold text-base-950 transition-colors hover:bg-amber-400"
        >
          <Settings size={13} />
          Go to Setup
        </Link>
      )}
    </div>
  );
}
