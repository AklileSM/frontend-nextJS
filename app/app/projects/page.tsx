'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Plus, Folder, MapPin, X } from 'lucide-react';
import { listProjects, createProject } from '@/services/apiClient';
import { useAuth } from '@/context/AuthContext';
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

  const onCreated = (project: ApiProject) => {
    setProjects((prev) => [project, ...prev]);
    setShowCreate(false);
    toast.success(`Project "${project.name}" created`);
  };

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
            <Link
              key={project.id}
              href={`/app/projects/${project.slug}`}
              className="group flex flex-col gap-4 rounded-lg border border-base-800 bg-base-900/40 p-5 transition-colors hover:border-base-700 hover:bg-base-900/70"
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
                <h2 className="text-[16px] font-semibold text-white group-hover:text-amber-400 transition-colors">
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
          <CreateProjectModal onCreated={onCreated} onClose={() => setShowCreate(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[12px] font-medium text-ink-200">
        {label}
        {required && <span className="ml-1 text-amber-500">*</span>}
        {hint && <span className="ml-2 font-normal text-ink-400">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

function CreateProjectModal({
  onCreated,
  onClose,
}: {
  onCreated: (p: ApiProject) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);

  const autoSlug = (n: string) =>
    n
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

  const handleNameChange = (v: string) => {
    setName(v);
    if (!slugTouched) setSlug(autoSlug(v));
  };

  const handleSlugChange = (v: string) => {
    setSlugTouched(true);
    setSlug(v.toLowerCase().replace(/[^a-z0-9-]/g, ''));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) return;
    setSaving(true);
    try {
      const project = await createProject({
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim() || null,
        location: location.trim() || null,
      });
      onCreated(project);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create project');
      setSaving(false);
    }
  };

  return (
    <motion.div
      key="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-base-950/80 backdrop-blur-sm px-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[480px] rounded-xl border border-base-700 bg-base-900 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-base-800 px-6 py-4">
          <h2 className="text-[15px] font-semibold text-white">New project</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-ink-400 hover:bg-base-800 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <Field label="Project name" required>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="A6-Stern Extension"
              className="w-full rounded-md border border-base-700 bg-base-950 px-3 py-2 text-[13px] text-white outline-none placeholder:text-ink-500 focus:border-amber-500"
              required
            />
          </Field>

          <Field label="Slug (URL key)" required hint="Lowercase, numbers, hyphens">
            <input
              type="text"
              value={slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              placeholder="a6-stern-ext"
              pattern="^[a-z0-9-]+$"
              className="w-full rounded-md border border-base-700 bg-base-950 px-3 py-2 font-mono text-[13px] text-white outline-none placeholder:text-ink-500 focus:border-amber-500"
              required
            />
          </Field>

          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Brief project description…"
              className="w-full resize-none rounded-md border border-base-700 bg-base-950 px-3 py-2 text-[13px] text-white outline-none placeholder:text-ink-500 focus:border-amber-500"
            />
          </Field>

          <Field label="Location">
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Berlin, Germany"
              className="w-full rounded-md border border-base-700 bg-base-950 px-3 py-2 text-[13px] text-white outline-none placeholder:text-ink-500 focus:border-amber-500"
            />
          </Field>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-base-700 px-4 py-2 text-[13px] font-medium text-white hover:border-ink-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim() || !slug.trim()}
              className="rounded-md bg-amber-500 px-4 py-2 text-[13px] font-semibold text-base-950 hover:bg-amber-400 transition-colors disabled:opacity-50"
            >
              {saving ? 'Creating…' : 'Create project'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
