'use client';

import { useCallback, useEffect, useState, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { listProjects, listProjectMembers } from '@/services/apiClient';
import { useAuth } from '@/context/AuthContext';
import { StandaloneShell } from '@/components/layout/StandaloneShell';
import { Tabs } from '@/components/ui/Tabs';
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
  const { user, isAuthenticated, isLoading } = useAuth();

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
    <StandaloneShell maxWidth="900px">
        {loading || !project ? (
          <div className="animate-pulse space-y-10">
            <div>
              <div className="h-3 w-24 rounded bg-base-800/80" />
              <div className="mt-5 h-10 w-72 rounded bg-base-800" />
            </div>
            <div className="flex gap-6 border-b border-base-800 pb-1">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-4 w-16 rounded bg-base-800/70" />
              ))}
            </div>
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 rounded-md bg-base-800/50" style={{ width: `${70 + i * 7}%` }} />
              ))}
            </div>
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
            <div className="mb-10">
              <Tabs<Tab> tabs={TABS} active={activeTab} onChange={setTab} railId="settings-tab" />
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
    </StandaloneShell>
  );
}

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-base-950">
      <Loader2 size={18} className="animate-spin text-ink-500" />
    </div>
  );
}
