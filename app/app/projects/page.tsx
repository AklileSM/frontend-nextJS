'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Plus, Folder, MapPin, Settings } from 'lucide-react';
import { listProjects } from '@/services/apiClient';
import { useAuth } from '@/context/AuthContext';
import { CreateProjectWizard } from '@/components/projects/CreateProjectWizard';
import type { ApiProject } from '@/types/api';

export const dynamic = 'force-dynamic';

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-green-500/15 text-green-400',
  on_hold: 'bg-amber-500/15 text-amber-400',
  completed: 'bg-steel-500/15 text-steel-400',
  archived: 'bg-base-800 text-ink-400',
};

export default function ProjectsDashboardPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listProjects();
      setProjects(data);
    } catch {
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);


  return (
    <div className="px-6 py-10 sm:px-10 lg:px-12 xl:px-16">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-wrap items-end justify-between gap-4"
      >
        <div>
          <p className="inline-flex items-center gap-3 font-mono text-[12px] uppercase tracking-[0.22em] text-amber-500">
            <span className="h-px w-8 bg-amber-500/60" />
            Projects
          </p>
          <h1 className="mt-3 font-display text-[36px] font-semibold leading-[1.08] tracking-[-0.018em] text-white sm:text-[44px]">
            All projects
          </h1>
          <p className="mt-2 font-mono text-[12px] text-ink-300">
            {projects.length} {projects.length === 1 ? 'project' : 'projects'}
          </p>
        </div>

        {user?.is_admin && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-md bg-amber-500 px-4 py-2 text-[13px] font-semibold text-base-950 hover:bg-amber-400 transition-colors"
          >
            <Plus size={14} />
            New project
          </button>
        )}
      </motion.section>

      {loading ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-lg bg-base-800/60" />
          ))}
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <div
              key={project.id}
              className="group relative flex flex-col rounded-lg border border-base-800 bg-base-900/40 transition-colors hover:border-base-700 hover:bg-base-900/70"
            >
              <Link
                href={`/app/projects/${project.slug}`}
                className="flex flex-1 flex-col gap-4 p-5"
              >
                <div className="flex items-start justify-between gap-2">
                  <Folder size={18} className="mt-0.5 shrink-0 text-amber-500" />
                  <span
                    className={`rounded-sm px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ${
                      STATUS_BADGE[project.status] ?? STATUS_BADGE.archived
                    }`}
                  >
                    {project.status}
                  </span>
                </div>
                <div className="flex-1">
                  <h2 className="text-[16px] font-semibold text-white transition-colors group-hover:text-amber-400">
                    {project.name}
                  </h2>
                  {project.description && (
                    <p className="mt-1 line-clamp-2 text-[13px] text-ink-300">{project.description}</p>
                  )}
                </div>
                {project.location && (
                  <p className="flex items-center gap-1.5 font-mono text-[11px] text-ink-400">
                    <MapPin size={11} />
                    {project.location}
                  </p>
                )}
              </Link>

              {user?.is_admin && (
                <Link
                  href={`/app/projects/${project.slug}/settings`}
                  aria-label={`Settings for ${project.name}`}
                  className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded text-ink-500 opacity-0 transition-all hover:bg-base-800 hover:text-white group-hover:opacity-100"
                >
                  <Settings size={14} />
                </Link>
              )}
            </div>
          ))}
          {projects.length === 0 && (
            <div className="col-span-full rounded-lg border border-dashed border-base-700 bg-base-900/20 px-6 py-12 text-center text-[13px] text-ink-300">
              No projects yet.
              {user?.is_admin && (
                <button
                  type="button"
                  onClick={() => setShowCreate(true)}
                  className="ml-2 text-amber-500 hover:text-amber-400 transition-colors"
                >
                  Create one
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {showCreate && (
          <CreateProjectWizard onClose={() => setShowCreate(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
