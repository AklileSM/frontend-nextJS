'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { listAdminProjects, deleteAdminProject } from '@/services/apiClient';
import { formatIsoDate } from '@/services/dateFormat';
import type { ApiProject } from '@/types/api';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 25;

export default function AdminProjectsPage() {
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listAdminProjects();
      setProjects(data);
      setPage(1);
    } catch {
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, []);

  const pageCount = Math.ceil(projects.length / PAGE_SIZE);
  const visibleProjects = useMemo(
    () => projects.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [projects, page],
  );

  useEffect(() => { load(); }, [load]);

  const handleDelete = useCallback(async (project: ApiProject) => {
    if (!confirm(`Delete project "${project.name}"? This cannot be undone.`)) return;
    setDeleting(project.id);
    try {
      await deleteAdminProject(project.id);
      setProjects((prev) => prev.filter((p) => p.id !== project.id));
      toast.success(`Deleted ${project.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeleting(null);
    }
  }, []);

  const statusColor: Record<string, string> = {
    active: 'text-green-400',
    on_hold: 'text-amber-400',
    completed: 'text-steel-400',
    archived: 'text-ink-500',
  };

  return (
    <div className="px-6 py-10 sm:px-10 lg:px-12 xl:px-16">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <p className="font-mono text-[12px] uppercase tracking-[0.22em] text-amber-500">
          Admin · Projects
        </p>
        <h1 className="mt-3 font-display text-[36px] font-semibold tracking-tight text-white">
          All projects
        </h1>
        <p className="mt-2 text-[14px] text-ink-300">
          {projects.length} {projects.length === 1 ? 'project' : 'projects'} on the platform
        </p>
      </motion.section>

      <div className="mt-8 overflow-x-auto rounded-lg border border-base-800">
        {loading ? (
          <div className="p-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="mb-3 h-10 animate-pulse rounded bg-base-800" />
            ))}
          </div>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-base-800 bg-base-900/60">
                <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-[0.18em] text-ink-400">
                  Name
                </th>
                <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-[0.18em] text-ink-400">
                  Slug
                </th>
                <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-[0.18em] text-ink-400">
                  Location
                </th>
                <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-[0.18em] text-ink-400">
                  Status
                </th>
                <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-[0.18em] text-ink-400">
                  Created
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {visibleProjects.map((project, i) => (
                <tr
                  key={project.id}
                  className={`border-b border-base-800/60 ${
                    i % 2 === 0 ? 'bg-base-900/20' : 'bg-transparent'
                  } hover:bg-base-800/30 transition-colors`}
                >
                  <td className="px-4 py-3 font-medium text-white">{project.name}</td>
                  <td className="px-4 py-3 font-mono text-[11px] text-ink-400">{project.slug}</td>
                  <td className="px-4 py-3 text-ink-300">{project.location ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`font-mono text-[11px] uppercase ${statusColor[project.status] ?? 'text-ink-400'}`}>
                      {project.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-ink-400">
                    {formatIsoDate(project.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      disabled={deleting === project.id}
                      onClick={() => handleDelete(project)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded text-ink-500 transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40"
                      title="Delete project"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
              {projects.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[13px] text-ink-400">
                    No projects yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
        {!loading && pageCount > 1 && (
          <div className="flex items-center justify-between border-t border-base-800 px-4 py-3">
            <span className="font-mono text-[11px] text-ink-400">
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, projects.length)} of {projects.length}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded border border-base-700 px-3 py-1 text-[12px] text-white disabled:opacity-40 hover:border-ink-400"
              >
                Prev
              </button>
              <button
                type="button"
                disabled={page === pageCount}
                onClick={() => setPage((p) => p + 1)}
                className="rounded border border-base-700 px-3 py-1 text-[12px] text-white disabled:opacity-40 hover:border-ink-400"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
