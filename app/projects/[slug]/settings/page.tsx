'use client';

import { useCallback, useEffect, useState, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, LogOut } from 'lucide-react';
import { listProjects, listProjectMembers } from '@/services/apiClient';
import { useAuth } from '@/context/AuthContext';
import { Logo } from '@/components/landing/Logo';
import { ProjectEditTab } from '@/components/settings/ProjectEditTab';
import { ProjectMembersTab } from '@/components/settings/ProjectMembersTab';
import { ProjectSetupTab } from '@/components/settings/ProjectSetupTab';
import { ProjectDangerTab } from '@/components/settings/ProjectDangerTab';
import type { ApiProject, ApiProjectMember } from '@/types/api';

export const dynamic = 'force-dynamic';

type Tab = 'edit' | 'members' | 'setup' | 'danger';

const TABS: { id: Tab; label: string }[] = [
  { id: 'edit', label: 'Edit' },
  { id: 'members', label: 'Members' },
  { id: 'setup', label: 'Setup' },
  { id: 'danger', label: 'Manage' },
];

export default function ProjectSettingsPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const { slug } = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout } = useAuth();

  const [project, setProject] = useState<ApiProject | null>(null);
  const [myRole, setMyRole] = useState<ApiProjectMember['role'] | null>(null);
  const [loading, setLoading] = useState(true);

  const activeTab = (searchParams.get('tab') as Tab | null) ?? 'edit';

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) router.replace('/login');
  }, [isAuthenticated, isLoading, router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = (await listProjects()).find((x) => x.slug === slug);
      if (!p) { router.replace('/projects'); return; }
      setProject(p);
      const ms = await listProjectMembers(p.id);
      setMyRole(ms.find((m) => m.user_id === user?.id)?.role ?? null);
    } catch {
      toast.error('Failed to load project');
    } finally {
      setLoading(false);
    }
  }, [slug, user?.id, router]);

  useEffect(() => {
    if (isAuthenticated) load();
  }, [isAuthenticated, load]);

  const setTab = (tab: Tab) => {
    const p = new URLSearchParams(searchParams.toString());
    p.set('tab', tab);
    router.replace(`?${p.toString()}`);
  };

  const canManage = user?.is_admin || myRole === 'owner';

  if (isLoading || !isAuthenticated) return null;

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

      {/* ── Content ── */}
      <main className="relative z-10 mx-auto max-w-[900px] px-6 py-14 sm:px-10">
        {loading || !project ? (
          <div className="flex items-center gap-2 text-[13px] text-ink-400">
            <Loader2 size={14} className="animate-spin" />
            Loading settings…
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Back + heading */}
            <div className="mb-10">
              <button
                type="button"
                onClick={() => { router.refresh(); router.push(`/app/projects/${slug}`); }}
                className="inline-flex items-center gap-1.5 font-mono text-[12px] text-ink-400 transition-colors hover:text-white"
              >
                <ArrowLeft size={12} />
                Back to {project.name}
              </button>
              <div className="mt-5 flex items-baseline gap-3">
                <h1 className="font-display text-[32px] font-semibold leading-tight tracking-[-0.015em] text-white sm:text-[38px]">
                  {project.name}
                </h1>
                <span className="font-mono text-[16px] text-ink-500">Settings</span>
              </div>
            </div>

            {/* Tab rail */}
            <div className="mb-10 flex gap-1 border-b border-base-800">
              {TABS.map((tab) => {
                const active = tab.id === activeTab;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setTab(tab.id)}
                    className={`px-4 py-2.5 text-[13px] font-medium transition-colors border-b-2 -mb-px ${
                      active
                        ? 'border-amber-500 text-white'
                        : 'border-transparent text-ink-400 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Tab content */}
            {activeTab === 'edit' && (
              <ProjectEditTab project={project} onUpdated={setProject} />
            )}
            {activeTab === 'members' && (
              <ProjectMembersTab projectId={project.id} canManage={canManage} />
            )}
            {activeTab === 'setup' && (
              <ProjectSetupTab project={project} onProjectUpdated={setProject} />
            )}
            {activeTab === 'danger' && canManage && (
              <ProjectDangerTab project={project} onUpdated={setProject} />
            )}
            {activeTab === 'danger' && !canManage && (
              <p className="text-[13px] text-ink-400">
                Only project owners and admins can access the danger zone.
              </p>
            )}
          </motion.div>
        )}
      </main>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-base-950">
      <Loader2 size={18} className="animate-spin text-ink-500" />
    </div>
  );
}

function BackgroundGrid() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 h-full w-full opacity-[0.3]"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <pattern id="settings-grid" width="56" height="56" patternUnits="userSpaceOnUse">
          <path d="M 56 0 L 0 0 0 56" fill="none" stroke="rgba(255,255,255,0.035)" strokeWidth="1" />
        </pattern>
        <radialGradient id="settings-glow" cx="100%" cy="0%" r="60%">
          <stop offset="0%" stopColor="rgba(245,158,11,0.07)" />
          <stop offset="100%" stopColor="rgba(245,158,11,0)" />
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#settings-grid)" />
      <rect width="100%" height="100%" fill="url(#settings-glow)" />
    </svg>
  );
}
