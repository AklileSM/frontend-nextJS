'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Plus, MapPin, Settings, LogOut, FolderOpen, ChevronRight } from 'lucide-react';
import { listProjects } from '@/services/apiClient';
import { useAuth } from '@/context/AuthContext';
import { Logo } from '@/components/landing/Logo';
import { CreateProjectWizard } from '@/components/projects/CreateProjectWizard';
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
  const { user, isAuthenticated, isLoading, logout } = useAuth();
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
  const active = projects.filter((p) => p.status === 'active').length;

  return (
    <div className="relative min-h-screen bg-base-950 text-white">
      <BackgroundGrid />

      {/* ── Top bar ── */}
      <header className="relative z-10 flex h-14 items-center justify-between border-b border-base-800/60 px-6 sm:px-10">
        <Logo />
        <div className="flex items-center gap-4">
          <span className="hidden font-mono text-[12px] text-ink-400 sm:block">
            {user?.username}
          </span>
          <button
            type="button"
            onClick={() => { logout(); router.replace('/login'); }}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-mono text-[12px] text-ink-400 transition-colors hover:bg-base-800 hover:text-white"
          >
            <LogOut size={13} />
            Sign out
          </button>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="relative z-10 mx-auto max-w-[1280px] px-6 py-14 sm:px-10 lg:py-20">

        {/* Hero row */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-wrap items-end justify-between gap-6"
        >
          <div>
            <p className="inline-flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-amber-500">
              <span className="h-px w-6 bg-amber-500/60" />
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

          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
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
            <EmptyState isAdmin={isAdmin} onNew={() => setShowCreate(true)} />
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
                />
              ))}
            </motion.div>
          )}
        </div>
      </main>

      <AnimatePresence>
        {showCreate && (
          <CreateProjectWizard
            onClose={() => { setShowCreate(false); load(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ProjectCard({ project, isAdmin }: { project: ApiProject; isAdmin: boolean }) {
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

      {/* Settings gear — admins only */}
      {isAdmin && (
        <Link
          href={`/projects/${project.slug}/settings`}
          aria-label={`Settings for ${project.name}`}
          onClick={(e) => e.stopPropagation()}
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-md text-ink-600 opacity-0 transition-all hover:bg-base-800 hover:text-white group-hover:opacity-100"
        >
          <Settings size={13} />
        </Link>
      )}
    </motion.div>
  );
}

function EmptyState({ isAdmin, onNew }: { isAdmin: boolean; onNew: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center justify-center rounded-xl border border-dashed border-base-700 bg-base-900/20 px-6 py-24 text-center"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-base-700 bg-base-900">
        <FolderOpen size={22} className="text-ink-400" />
      </div>
      <h2 className="mt-5 font-display text-[22px] font-semibold text-white">No projects yet</h2>
      <p className="mt-2 max-w-[34ch] text-[14px] leading-[1.65] text-ink-300">
        Projects organise your site documentation by location and team.
      </p>
      {isAdmin && (
        <button
          type="button"
          onClick={onNew}
          className="mt-8 inline-flex items-center gap-2 rounded-md bg-amber-500 px-5 py-2.5 text-[13px] font-semibold text-base-950 transition-all hover:bg-amber-400"
        >
          <Plus size={14} />
          Create your first project
        </button>
      )}
    </motion.div>
  );
}

function BackgroundGrid() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 h-full w-full opacity-[0.35]"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <pattern id="proj-grid" width="56" height="56" patternUnits="userSpaceOnUse">
          <path d="M 56 0 L 0 0 0 56" fill="none" stroke="rgba(255,255,255,0.035)" strokeWidth="1" />
        </pattern>
        <radialGradient id="proj-glow-top" cx="80%" cy="0%" r="55%">
          <stop offset="0%" stopColor="rgba(245,158,11,0.08)" />
          <stop offset="100%" stopColor="rgba(245,158,11,0)" />
        </radialGradient>
        <radialGradient id="proj-glow-bottom" cx="10%" cy="100%" r="45%">
          <stop offset="0%" stopColor="rgba(245,158,11,0.05)" />
          <stop offset="100%" stopColor="rgba(245,158,11,0)" />
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#proj-grid)" />
      <rect width="100%" height="100%" fill="url(#proj-glow-top)" />
      <rect width="100%" height="100%" fill="url(#proj-glow-bottom)" />
    </svg>
  );
}
