'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { listAdminProjects, deleteAdminProject } from '@/services/apiClient';
import type { ApiProject } from '@/types/api';

export const dynamic = 'force-dynamic';

export default function AdminProjectsPage() {
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listAdminProjects();
      setProjects(data);
    } catch {
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, []);

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
              {projects.map((project, i) => (
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
                    {new Date(project.created_at).toLocaleDateString()}
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
      </div>
    </div>
  );
}
