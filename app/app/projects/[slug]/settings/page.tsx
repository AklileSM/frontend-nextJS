'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { listProjects, listProjectMembers } from '@/services/apiClient';
import { useAuth } from '@/context/AuthContext';
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
  { id: 'danger', label: 'Danger zone' },
];

export default function ProjectSettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center gap-2 px-6 py-10 text-[13px] text-ink-400">
          <Loader2 size={14} className="animate-spin" />
          Loading…
        </div>
      }
    >
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const { slug } = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  const [project, setProject] = useState<ApiProject | null>(null);
  const [myRole, setMyRole] = useState<ApiProjectMember['role'] | null>(null);
  const [loading, setLoading] = useState(true);

  const activeTab = (searchParams.get('tab') as Tab | null) ?? 'edit';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [projects, members] = await Promise.all([
        listProjects(),
        // We resolve members after we have the project ID — done in effect below.
        Promise.resolve([] as ApiProjectMember[]),
      ]);
      const p = projects.find((x) => x.slug === slug);
      if (!p) { router.replace('/projects'); return; }
      setProject(p);

      // Resolve current user's role.
      const ms = await listProjectMembers(p.id);
      const me = ms.find((m) => m.user_id === user?.id);
      setMyRole(me?.role ?? null);
    } catch {
      toast.error('Failed to load project');
    } finally {
      setLoading(false);
    }
  }, [slug, user?.id, router]);

  useEffect(() => { load(); }, [load]);

  const setTab = (tab: Tab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    router.replace(`?${params.toString()}`);
  };

  const canManage = user?.is_admin || myRole === 'owner';

  if (loading || !project) {
    return (
      <div className="flex items-center gap-2 px-6 py-10 text-[13px] text-ink-400">
        <Loader2 size={14} className="animate-spin" />
        Loading settings…
      </div>
    );
  }

  return (
    <div className="px-6 py-10 sm:px-8 lg:px-12 xl:px-16">
      <div className="mb-8">
        <Link
          href={`/app/projects/${slug}`}
          className="inline-flex items-center gap-1.5 font-mono text-[12px] text-ink-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={12} />
          Back to {project.name}
        </Link>
        <h1 className="mt-4 font-display text-[32px] font-semibold leading-tight tracking-tight text-white sm:text-[38px]">
          {project.name}
          <span className="ml-3 font-mono text-[18px] font-normal text-ink-400">Settings</span>
        </h1>
      </div>

      {/* Tab rail */}
      <div className="mb-8 flex gap-1 border-b border-base-800">
        {TABS.map((tab) => {
          const active = tab.id === activeTab;
          const isDanger = tab.id === 'danger';
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTab(tab.id)}
              className={`px-4 py-2.5 text-[13px] font-medium transition-colors border-b-2 -mb-px ${
                active
                  ? isDanger
                    ? 'border-red-500 text-red-400'
                    : 'border-amber-500 text-white'
                  : isDanger
                    ? 'border-transparent text-ink-400 hover:text-red-400'
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
    </div>
  );
}
