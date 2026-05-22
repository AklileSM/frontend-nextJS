'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Plus, MapPin, FolderOpen, ChevronRight, Camera, ScanLine, FileText, ArrowRight } from 'lucide-react';
import { listProjects } from '@/services/apiClient';
import { useAuth } from '@/context/AuthContext';
import { StandaloneShell } from '@/components/layout/StandaloneShell';
import { CreateProjectWizard } from '@/components/projects/CreateProjectWizard';
import { FirstTimeUserTour } from '@/components/onboarding/FirstTimeUserTour';
import type { ApiProject } from '@/types/api';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  on_hold: 'On hold',
  completed: 'Completed',
  archived: 'Archived',
};

const STATUS_DOT: Record<string, string> = {
  active: 'bg-green-400',
  on_hold: 'bg-amber-400',
  completed: 'bg-steel-400',
  archived: 'bg-base-600',
};

function timeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function ProjectsHubPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [fetching, setFetching] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) router.replace('/login');
  }, [isAuthenticated, isLoading, router]);

  const load = useCallback(async () => {
    setFetching(true);
    try {
      setProjects(await listProjects());
    } catch {
      toast.error('Failed to load projects');
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) load();
  }, [isAuthenticated, load]);

  if (isLoading || !isAuthenticated) return null;

  const isAdmin = user?.is_admin ?? false;
  const userId = user?.id ?? '';
  const active = projects.filter((p) => p.status === 'active').length;

  return (
    <StandaloneShell maxWidth="1280px">

        {/* Hero row */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-wrap items-end justify-between gap-6"
        >
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-amber-500">
              Projects
            </p>
            <h1 className="mt-3 font-display text-[38px] font-semibold leading-[1.06] tracking-[-0.02em] text-white sm:text-[52px]">
              {timeGreeting()},<br />
              <span className="text-amber-400">{user?.username}</span>.
            </h1>
            {!fetching && (
              <p className="mt-3 font-mono text-[13px] text-ink-300">
                {projects.length === 0
                  ? 'No projects yet.'
                  : `${projects.length} ${projects.length === 1 ? 'project' : 'projects'}${active > 0 ? ` · ${active} active` : ''}`}
              </p>
            )}
          </div>

          {!fetching && projects.length > 0 && (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              data-tour="new-project"
              className="inline-flex items-center gap-2 rounded-md bg-amber-500 px-5 py-2.5 text-[13px] font-semibold text-base-950 shadow-[0_8px_24px_-10px_rgba(245,158,11,0.5)] transition-all hover:bg-amber-400 hover:shadow-[0_8px_32px_-8px_rgba(245,158,11,0.65)]"
            >
              <Plus size={15} strokeWidth={2.5} />
              New project
            </button>
          )}
        </motion.div>

        {/* Divider */}
        <div className="mt-10 h-px bg-gradient-to-r from-base-800 via-base-700/40 to-transparent" />

        {/* Grid */}
        <div className="mt-10">
          {fetching ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-44 animate-pulse rounded-xl border border-base-800 bg-base-900/40"
                  style={{ animationDelay: `${i * 60}ms` }}
                />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <EmptyState onNew={() => setShowCreate(true)} />
          ) : (
            <motion.div
              initial="hidden"
              animate="visible"
              variants={{ visible: { transition: { staggerChildren: 0.045 } } }}
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  isAdmin={isAdmin}
                  userId={userId}
                />
              ))}
            </motion.div>
          )}
        </div>

      <AnimatePresence>
        {showCreate && (
          <CreateProjectWizard
            onClose={() => { setShowCreate(false); load(); }}
          />
        )}
      </AnimatePresence>

      {!fetching && <FirstTimeUserTour />}
    </StandaloneShell>
  );
}

function ProjectCard({ project, isAdmin, userId }: { project: ApiProject; isAdmin: boolean; userId: string }) {
  const canManage = isAdmin || project.owner_id === userId;
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 14 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] } },
      }}
      className="group relative flex flex-col rounded-xl border border-base-800 bg-base-900/40 backdrop-blur-sm transition-all duration-200 hover:border-base-600 hover:bg-base-900/70 hover:shadow-[0_4px_32px_-8px_rgba(0,0,0,0.6)]"
    >
      <Link href={`/app/projects/${project.slug}`} className="flex flex-1 flex-col gap-3 p-6">
        {/* Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[project.status] ?? STATUS_DOT.archived}`}
            />
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-400">
              {STATUS_LABEL[project.status] ?? project.status}
            </span>
          </div>
          <FolderOpen size={15} className="text-base-700 transition-colors group-hover:text-amber-500/60" />
        </div>

        {/* Name + description */}
        <div className="flex-1">
          <h2 className="font-display text-[18px] font-semibold leading-snug tracking-[-0.01em] text-white transition-colors group-hover:text-amber-400">
            {project.name}
          </h2>
          {project.description && (
            <p className="mt-1.5 line-clamp-2 text-[13px] leading-[1.6] text-ink-300">
              {project.description}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-1">
          {project.location ? (
            <p className="flex items-center gap-1.5 font-mono text-[11px] text-ink-500">
              <MapPin size={10} />
              {project.location}
            </p>
          ) : (
            <span />
          )}
          <ChevronRight
            size={14}
            className="text-ink-600 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-amber-500"
          />
        </div>
      </Link>      
    </motion.div>
  );
}

const FEATURES = [
  { icon: Camera, label: 'Photos & video', body: 'Capture every corner of the site organised by room and date.' },
  { icon: ScanLine, label: '3D point clouds', body: 'Upload LiDAR scans and explore them in the browser.' },
  { icon: FileText, label: 'Field reports', body: 'Annotate captures and publish PDF reports in one click.' },
];

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-2xl border border-base-800 bg-base-900/30"
    >
      {/* Amber glow */}
      <div className="pointer-events-none absolute -top-32 left-1/2 h-64 w-[480px] -translate-x-1/2 rounded-full bg-amber-500/10 blur-3xl" />

      <div className="relative px-8 py-20 text-center sm:px-16">
        {/* Icon badge */}
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-500/25 bg-amber-500/10 shadow-[0_0_32px_-8px_rgba(245,158,11,0.3)]">
          <FolderOpen size={26} className="text-amber-400" />
        </div>

        {/* Heading */}
        <h2 className="mt-6 font-display text-[28px] font-semibold leading-tight tracking-[-0.018em] text-white sm:text-[34px]">
          Create your first project
        </h2>
        <p className="mx-auto mt-3 max-w-[42ch] text-[14px] leading-[1.7] text-ink-300">
          A project groups all the rooms, captures, and reports for one construction site. Set one up to get started.
        </p>

        <button
          type="button"
          onClick={onNew}
          data-tour="new-project"
          className="mt-8 inline-flex items-center gap-2 rounded-lg bg-amber-500 px-6 py-3 text-[14px] font-semibold text-base-950 shadow-[0_8px_24px_-10px_rgba(245,158,11,0.55)] transition-all hover:bg-amber-400 hover:shadow-[0_8px_32px_-8px_rgba(245,158,11,0.7)]"
        >
          <Plus size={15} strokeWidth={2.5} />
          New project
          <ArrowRight size={14} className="ml-0.5 opacity-70" />
        </button>

        {/* Feature strip */}
        <div className="mx-auto mt-14 grid max-w-2xl gap-px overflow-hidden rounded-xl border border-base-800 sm:grid-cols-3">
            {FEATURES.map(({ icon: Icon, label, body }) => (
              <div key={label} className="flex flex-col items-start gap-2 bg-base-900/60 px-5 py-5 text-left">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-base-700 bg-base-800">
                  <Icon size={15} className="text-amber-400" />
                </div>
                <p className="font-display text-[13px] font-semibold text-white">{label}</p>
                <p className="text-[12px] leading-[1.6] text-ink-400">{body}</p>
              </div>
            ))}
          </div>
      </div>
    </motion.div>
  );
}

