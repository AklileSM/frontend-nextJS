'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Loader2, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { getAccessToken } from '@/auth/authSession';
import { Tabs } from '@/components/ui/Tabs';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { setViewerContext } from '@/components/explorer/viewerContext';
import { ActivityFeed } from '@/components/home/ActivityFeed';
import { useMyProjectRole } from '@/hooks/useMyProjectRole';
import {
  deleteFileAsset,
  deleteReport,
  listComparisonDrafts,
  listMyUploads,
  listProjects,
  listReports,
  listViewerFieldDrafts,
  resendVerificationEmail,
} from '@/services/apiClient';
import type {
  ApiComparisonDraft,
  ApiMediaFile,
  ApiMyUpload,
  ApiProject,
  ApiReport,
  ApiViewerFieldDraft,
} from '@/types/api';
import { ReportsTab } from './_components/ReportsTab';
import { DraftsTab, type DraftRow, type DraftSide } from './_components/DraftsTab';
import { FilesTab, type FileSide } from './_components/FilesTab';

export const dynamic = 'force-dynamic';

const SIDEBAR_SLUG_KEY = 'sidebar.lastProjectSlug';
type TopTab = 'reports' | 'drafts' | 'files' | 'activity';

export default function ProfilePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [tab, setTab] = useState<TopTab>('reports');
  const [draftSide, setDraftSide] = useState<DraftSide>('viewer');
  const [fileSide, setFileSide] = useState<FileSide>('image');
  const [reports, setReports] = useState<ApiReport[]>([]);
  const [viewerDrafts, setViewerDrafts] = useState<ApiViewerFieldDraft[]>([]);
  const [comparisonDrafts, setComparisonDrafts] = useState<ApiComparisonDraft[]>([]);
  const [myUploads, setMyUploads] = useState<ApiMyUpload[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDeleteReportId, setPendingDeleteReportId] = useState<string | null>(null);
  const [pendingDeleteFileId, setPendingDeleteFileId] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  // Profile page is reached after the user enters a project, so we trust the
  // last-visited slug to scope the Files tab. If sessionStorage is empty the
  // tab shows a "no project context" hint.
  const [projectSlug, setProjectSlug] = useState<string | null>(null);
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const currentProject = useMemo(
    () => (projectSlug ? projects.find((p) => p.slug === projectSlug) ?? null : null),
    [projectSlug, projects],
  );

  // Same predicate the backend's GET /activity uses: owner / editor / admin.
  // Viewers don't get an Activity tab.
  const { canUpload } = useMyProjectRole(currentProject?.id);
  const showActivity = canUpload && !!projectSlug;

  useEffect(() => {
    try {
      setProjectSlug(sessionStorage.getItem(SIDEBAR_SLUG_KEY));
    } catch {
      /* ignore */
    }
  }, []);

  // If the user's role no longer permits Activity (or they leave the
  // project context entirely) while they're sitting on the Activity tab,
  // bounce them back to Reports.
  useEffect(() => {
    if (tab === 'activity' && !showActivity) setTab('reports');
  }, [tab, showActivity]);

  // Reports/drafts are scoped to the project the user is currently in (same
  // rule as the Files tab). When projectSlug is null we still load the
  // projects list so the hint can render, but skip the per-project queries.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const calls = projectSlug
      ? Promise.all([
          listReports({ projectSlug }),
          listViewerFieldDrafts({ projectSlug }),
          listComparisonDrafts({ projectSlug }),
          listProjects(),
        ])
      : Promise.all([
          Promise.resolve([] as ApiReport[]),
          Promise.resolve([] as ApiViewerFieldDraft[]),
          Promise.resolve([] as ApiComparisonDraft[]),
          listProjects(),
        ]);
    calls
      .then(([r, vd, cd, ps]) => {
        if (cancelled) return;
        setReports(r);
        setViewerDrafts(vd);
        setComparisonDrafts(cd);
        setProjects(ps);
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(err instanceof Error ? err.message : 'Could not load profile data.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectSlug]);

  // Lazy-load uploads only when the Files tab is open and we know the project.
  const loadMyUploads = useCallback(
    async (slug: string) => {
      setFilesLoading(true);
      try {
        const items = await listMyUploads({ projectSlug: slug });
        setMyUploads(items);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not load your uploads.');
      } finally {
        setFilesLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (tab !== 'files' || !projectSlug) return;
    void loadMyUploads(projectSlug);
  }, [tab, projectSlug, loadMyUploads]);

  const continueHrefForViewerDraft = (draft: ApiViewerFieldDraft): string => {
    if (draft.viewer_kind === 'panorama') return `/app/viewer/panorama?draft=${encodeURIComponent(draft.id)}`;
    if (draft.viewer_kind === 'point-cloud' || draft.viewer_kind === 'static_pcd') {
      return `/app/viewer/point-cloud?draft=${encodeURIComponent(draft.id)}`;
    }
    return `/app/viewer/static?draft=${encodeURIComponent(draft.id)}`;
  };

  const viewerDraftRows = useMemo<DraftRow[]>(
    () =>
      viewerDrafts
        .map((d) => ({
          id: d.id,
          kind: 'viewer' as const,
          viewerKind: d.viewer_kind,
          label: d.label,
          createdAt: d.created_at,
          flags: d.flags,
          href: continueHrefForViewerDraft(d),
        }))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [viewerDrafts],
  );

  const comparisonDraftRows = useMemo<DraftRow[]>(
    () =>
      comparisonDrafts
        .map((d) => ({
          id: d.id,
          kind: 'comparison' as const,
          viewerKind: 'compare',
          label: d.label,
          createdAt: d.created_at,
          flags: d.flags,
          href: `/app/compare?draft=${encodeURIComponent(d.id)}`,
        }))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [comparisonDrafts],
  );

  const onDeleteReport = async () => {
    if (!pendingDeleteReportId || deletingId) return;
    const id = pendingDeleteReportId;
    setPendingDeleteReportId(null);
    setDeletingId(id);
    try {
      await deleteReport(id);
      setReports((prev) => prev.filter((r) => r.id !== id));
      toast.success('Report deleted.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete report.');
    } finally {
      setDeletingId(null);
    }
  };

  const onDeleteFile = async () => {
    if (!pendingDeleteFileId || deletingId) return;
    const id = pendingDeleteFileId;
    setPendingDeleteFileId(null);
    setDeletingId(id);
    try {
      await deleteFileAsset(id);
      setMyUploads((prev) => prev.filter((u) => u.id !== id));
      toast.success('File deleted.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete file.');
    } finally {
      setDeletingId(null);
    }
  };

  const onOpenUpload = (upload: ApiMyUpload) => {
    if (!currentProject) {
      toast.error('Lost project context.');
      return;
    }
    // Convert ApiMyUpload → ApiMediaFile so we can use the standard viewer
    // handoff (setViewerContext + push to viewer route).
    const file: ApiMediaFile = {
      id: upload.id,
      src: upload.src,
      type: upload.media_type as ApiMediaFile['type'],
      file_name: upload.file_name,
      full_src: upload.full_src,
      capture_date: upload.capture_date,
      uploaded_by_user_id: user?.id ?? null,
      conversion_status: upload.conversion_status ?? null,
    };
    setViewerContext({
      file,
      roomSlug: upload.room_slug,
      projectSlug: currentProject.slug,
      date: upload.capture_date,
      origin: 'project',
    });
    if (upload.media_type === 'pdf') {
      router.push('/app/pdf-viewer');
    } else {
      router.push('/app/viewer/static');
    }
  };

  const onDownloadUpload = async (upload: ApiMyUpload) => {
    try {
      const token = getAccessToken();
      const url = upload.full_src ?? upload.src;
      const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error(`Download failed (${res.status})`);
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = upload.file_name;
      a.click();
      URL.revokeObjectURL(objUrl);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not download file.');
    }
  };

  const fetchReportPdfBlob = async (report: ApiReport): Promise<Blob> => {
    if (!report.pdf_url) {
      throw new Error('This report has no PDF URL.');
    }
    const token = getAccessToken();
    const res = await fetch(report.pdf_url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`Failed to load PDF (${res.status})`);
    return res.blob();
  };

  const onOpenReport = async (report: ApiReport) => {
    if (!report.pdf_url) {
      toast.error('This report has no PDF URL.');
      return;
    }
    const name = `report-${report.id}.pdf`;
    router.push(`/app/pdf-viewer?src=${encodeURIComponent(report.pdf_url)}&name=${encodeURIComponent(name)}`);
  };

  const onDownloadReport = async (report: ApiReport) => {
    try {
      const blob = await fetchReportPdfBlob(report);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-${report.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not download report.');
    }
  };

  const projectName = currentProject?.name ?? null;

  return (
    <div className="px-6 py-10 sm:px-10 lg:px-12 xl:px-16">
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="font-mono text-[12px] uppercase tracking-[0.22em] text-amber-500">
          Profile
        </p>
        <h1 className="mt-4 font-display text-[40px] font-semibold leading-[1.08] tracking-[-0.018em] text-white sm:text-[48px]">
          {user?.username}
        </h1>
        <p className="mt-3 text-[16px] text-ink-300">
          {user?.email ?? 'no email on file'} · <span className="text-white">{user?.is_admin ? 'admin' : 'member'}</span>
        </p>

        {user && user.email && !user.email_verified && (
          <div className="mt-8 flex items-start gap-3 rounded-md border border-amber-500/30 bg-amber-500/5 px-4 py-3">
            <Mail size={15} className="mt-0.5 shrink-0 text-amber-400" />
            <div className="min-w-0 flex-1 text-[13px]">
              <span className="font-medium text-white">Verify your email address. </span>
              <span className="text-ink-300">
                We sent a link to <span className="text-white">{user.email}</span>. Check your inbox and click it to enable password reset.
              </span>
            </div>
            <button
              type="button"
              disabled={resending}
              onClick={async () => {
                setResending(true);
                try {
                  await resendVerificationEmail();
                  toast.success('Verification email sent.');
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Could not resend email.');
                } finally {
                  setResending(false);
                }
              }}
              className="shrink-0 inline-flex items-center gap-1.5 rounded border border-amber-500/40 px-2.5 py-1 text-[12px] text-amber-300 transition-colors hover:border-amber-400/60 hover:text-amber-200 disabled:opacity-50"
            >
              {resending && <Loader2 size={11} className="animate-spin" />}
              Resend
            </button>
          </div>
        )}

        <div className="mt-8">
          <Tabs<TopTab>
            tabs={[
              { id: 'reports', label: `Reports (${reports.length})` },
              { id: 'drafts',  label: `Drafts (${viewerDraftRows.length + comparisonDraftRows.length})` },
              { id: 'files',   label: 'Files' },
              // Activity is appended only when the current project + role
              // grant access. Matches the backend's 403 rule on /activity.
              ...(showActivity ? [{ id: 'activity' as TopTab, label: 'Activity' }] : []),
            ]}
            active={tab}
            onChange={setTab}
            railId="profile-tab"
          />
        </div>

        {loading ? (
          <div className="mt-6 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex animate-pulse items-center gap-3 rounded-md border border-base-800 bg-base-900/40 px-4 py-3"
                style={{ animationDelay: `${i * 55}ms` }}
              >
                <div className="h-8 w-8 shrink-0 rounded border border-base-700 bg-base-800" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-2/5 rounded bg-base-800" />
                  <div className="h-3 w-1/4 rounded bg-base-800/70" />
                </div>
                <div className="flex gap-2">
                  <div className="h-7 w-12 rounded border border-base-800 bg-base-800/50" />
                  <div className="h-7 w-18 rounded border border-base-800 bg-base-800/50" />
                  <div className="h-7 w-12 rounded border border-base-800 bg-base-800/50" />
                </div>
              </div>
            ))}
          </div>
        ) : tab === 'reports' ? (
          <div className="mt-6 space-y-2">
            <ReportsTab
              reports={reports}
              projectSlug={projectSlug}
              currentProjectName={projectName}
              onOpen={(r) => void onOpenReport(r)}
              onDownload={(r) => void onDownloadReport(r)}
              onDelete={setPendingDeleteReportId}
            />
          </div>
        ) : tab === 'drafts' ? (
          <div className="mt-6">
            <DraftsTab
              viewerDraftRows={viewerDraftRows}
              comparisonDraftRows={comparisonDraftRows}
              draftSide={draftSide}
              setDraftSide={setDraftSide}
              projectSlug={projectSlug}
              currentProjectName={projectName}
            />
          </div>
        ) : tab === 'files' ? (
          <div className="mt-6">
            <FilesTab
              uploads={myUploads}
              fileSide={fileSide}
              setFileSide={setFileSide}
              filesLoading={filesLoading}
              projectSlug={projectSlug}
              currentProjectName={projectName}
              onOpen={onOpenUpload}
              onDownload={(u) => void onDownloadUpload(u)}
              onDelete={setPendingDeleteFileId}
            />
          </div>
        ) : (
          // tab === 'activity'. Only reachable when showActivity is true,
          // which already requires a projectSlug, but we guard once more
          // here so a stale URL or race can't render the feed without one.
          <div className="mt-6">
            {projectSlug ? (
              <ActivityFeed projectSlug={projectSlug} limit={100} />
            ) : (
              <p className="text-[13px] text-ink-300">
                Open a project from the projects page to see its activity.
              </p>
            )}
          </div>
        )}
      </motion.section>

      <ConfirmDialog
        open={!!pendingDeleteReportId}
        title="Delete this report?"
        body="This report will be permanently removed. Any published PDFs already shared remain available."
        confirmLabel="Delete report"
        danger
        onConfirm={onDeleteReport}
        onCancel={() => setPendingDeleteReportId(null)}
      />

      <ConfirmDialog
        open={!!pendingDeleteFileId}
        title="Delete this file?"
        body="The file will be removed from the project for everyone. This cannot be undone."
        confirmLabel="Delete file"
        danger
        onConfirm={onDeleteFile}
        onCancel={() => setPendingDeleteFileId(null)}
      />
    </div>
  );
}
