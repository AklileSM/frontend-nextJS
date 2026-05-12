'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { getAccessToken } from '@/auth/authSession';
import { formatTimestamp } from '@/lib/formatDate';
import { Tabs } from '@/components/ui/Tabs';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  deleteReport,
  listComparisonDrafts,
  listReports,
  listViewerFieldDrafts,
} from '@/services/apiClient';
import type { ApiComparisonDraft, ApiReport, ApiViewerFieldDraft } from '@/types/api';

export const dynamic = 'force-dynamic';

export default function ProfilePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [tab, setTab] = useState<'reports' | 'drafts'>('reports');
  const [reports, setReports] = useState<ApiReport[]>([]);
  const [viewerDrafts, setViewerDrafts] = useState<ApiViewerFieldDraft[]>([]);
  const [comparisonDrafts, setComparisonDrafts] = useState<ApiComparisonDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [r, vd, cd] = await Promise.all([
        listReports(),
        listViewerFieldDrafts(),
        listComparisonDrafts(),
      ]);
      setReports(r);
      setViewerDrafts(vd);
      setComparisonDrafts(cd);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not load profile data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const continueHrefForViewerDraft = (draft: ApiViewerFieldDraft): string => {
    if (draft.viewer_kind === 'panorama') return `/app/viewer/panorama?draft=${encodeURIComponent(draft.id)}`;
    if (draft.viewer_kind === 'point-cloud' || draft.viewer_kind === 'static_pcd') {
      return `/app/viewer/point-cloud?draft=${encodeURIComponent(draft.id)}`;
    }
    return `/app/viewer/static?draft=${encodeURIComponent(draft.id)}`;
  };

  const allDrafts = useMemo(
    () => [
      ...viewerDrafts.map((d) => ({
        id: d.id,
        kind: 'viewer' as const,
        viewerKind: d.viewer_kind,
        createdAt: d.created_at,
        flags: d.flags,
        href: continueHrefForViewerDraft(d),
      })),
      ...comparisonDrafts.map((d) => ({
        id: d.id,
        kind: 'comparison' as const,
        viewerKind: 'compare',
        createdAt: d.created_at,
        flags: d.flags,
        href: `/app/compare?draft=${encodeURIComponent(d.id)}`,
      })),
    ].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [viewerDrafts, comparisonDrafts],
  );

  const onDeleteReport = async () => {
    if (!pendingDeleteId || deletingId) return;
    const id = pendingDeleteId;
    setPendingDeleteId(null);
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

  const onOpen = async (report: ApiReport) => {
    if (!report.pdf_url) {
      toast.error('This report has no PDF URL.');
      return;
    }
    const name = `report-${report.id}.pdf`;
    router.push(`/app/pdf-viewer?src=${encodeURIComponent(report.pdf_url)}&name=${encodeURIComponent(name)}`);
  };

  const onDownload = async (report: ApiReport) => {
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

  return (
    <div className="px-6 py-10 sm:px-10 lg:px-12 xl:px-16">
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="inline-flex items-center gap-3 font-mono text-[12px] uppercase tracking-[0.22em] text-amber-500">
          <span className="h-px w-8 bg-amber-500/60" />
          Profile
        </p>
        <h1 className="mt-4 font-display text-[40px] font-semibold leading-[1.08] tracking-[-0.018em] text-white sm:text-[48px]">
          {user?.username}
        </h1>
        <p className="mt-3 text-[16px] text-ink-300">
          {user?.email ?? 'no email on file'} · <span className="text-white">{user?.is_admin ? 'admin' : 'member'}</span>
        </p>

        <div className="mt-8">
          <Tabs<'reports' | 'drafts'>
            tabs={[
              { id: 'reports', label: `Reports (${reports.length})` },
              { id: 'drafts',  label: `Drafts (${allDrafts.length})` },
            ]}
            active={tab}
            onChange={setTab}
            railId="profile-tab"
          />
        </div>

        {loading ? (
          <div className="mt-8 text-ink-300">Loading profile data...</div>
        ) : tab === 'reports' ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {reports.map((r) => (
              <article key={r.id} className="rounded-md border border-base-800 bg-base-900/40 p-4">
                <div className="mb-3 aspect-[4/3] overflow-hidden rounded border border-base-800 bg-black/20">
                  <div className="flex h-full items-center justify-center text-[12px] text-ink-400">
                    Report thumbnail
                  </div>
                </div>
                <p className="text-[13px] font-medium text-white">{formatTimestamp(r.created_at)}</p>
                <p className="mt-1 text-[12px] text-ink-300">Flags: {r.flags.join(', ') || '(none)'}</p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => void onOpen(r)}
                    className="rounded border border-base-700 px-2.5 py-1 text-[12px] text-white"
                  >
                    Open
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDownload(r)}
                    className="rounded border border-base-700 px-2.5 py-1 text-[12px] text-white"
                  >
                    Download
                  </button>
                  <button
                    type="button"
                    disabled={!!deletingId}
                    onClick={() => setPendingDeleteId(r.id)}
                    className="rounded border border-red-700/60 px-2.5 py-1 text-[12px] text-red-200 disabled:opacity-50"
                  >
                    {deletingId === r.id ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </article>
            ))}
            {reports.length === 0 && <p className="text-[13px] text-ink-300">No reports yet.</p>}
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {allDrafts.map((d) => (
              <article key={`${d.kind}-${d.id}`} className="flex items-center justify-between rounded-md border border-base-800 bg-base-900/40 p-4">
                <div>
                  <p className="text-[13px] font-medium text-white">
                    {d.kind === 'comparison' ? 'Comparison draft' : `${d.viewerKind} draft`}
                  </p>
                  <p className="mt-0.5 text-[12px] text-ink-300">
                    {formatTimestamp(d.createdAt)} · flags: {d.flags.join(', ') || '(none)'}
                  </p>
                </div>
                <Link href={d.href} className="rounded-md bg-amber-500 px-3 py-1.5 text-[12px] font-medium text-base-950">
                  Continue editing
                </Link>
              </article>
            ))}
            {allDrafts.length === 0 && <p className="text-[13px] text-ink-300">No drafts yet.</p>}
          </div>
        )}
      </motion.section>

      <ConfirmDialog
        open={!!pendingDeleteId}
        title="Delete this report?"
        body="This report will be permanently removed. Any published PDFs already shared remain available."
        confirmLabel="Delete report"
        danger
        onConfirm={onDeleteReport}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  );
}
