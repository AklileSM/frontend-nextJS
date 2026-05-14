'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeftRight, FileText, Globe, Image as ImageIcon, ScanLine } from 'lucide-react';
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
        <p className="font-mono text-[12px] uppercase tracking-[0.22em] text-amber-500">
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
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-md border border-base-800 bg-base-900/40 p-4"
                style={{ animationDelay: `${i * 55}ms` }}
              >
                <div className="mb-3 aspect-[4/3] rounded border border-base-800 bg-base-800/60" />
                <div className="h-3.5 w-3/4 rounded bg-base-800" />
                <div className="mt-2 h-3 w-1/2 rounded bg-base-800/70" />
                <div className="mt-3 flex gap-2">
                  <div className="h-7 w-14 rounded border border-base-800 bg-base-800/50" />
                  <div className="h-7 w-20 rounded border border-base-800 bg-base-800/50" />
                  <div className="h-7 w-14 rounded border border-base-800 bg-base-800/50" />
                </div>
              </div>
            ))}
          </div>
        ) : tab === 'reports' ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {reports.map((r) => (
              <article key={r.id} className="rounded-md border border-base-800 bg-base-900/40 p-4">
                <div className="mb-3 aspect-[4/3] overflow-hidden rounded border border-base-800 bg-base-950">
                  {r.screenshots[0] ? (
                    <img
                      src={r.screenshots[0]}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-ink-700">
                      <FileText size={26} />
                      <span className="text-[11px]">No preview</span>
                    </div>
                  )}
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
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {allDrafts.map((d) => {
              const icon =
                d.viewerKind === 'interactive_360' ? <Globe size={26} /> :
                d.viewerKind === 'static_pcd' || d.viewerKind === 'point-cloud' ? <ScanLine size={26} /> :
                d.kind === 'comparison' ? <ArrowLeftRight size={26} /> :
                <ImageIcon size={26} />;
              const typeLabel =
                d.viewerKind === 'interactive_360' ? 'Panorama draft' :
                d.viewerKind === 'static_pcd' || d.viewerKind === 'point-cloud' ? 'Point cloud draft' :
                d.kind === 'comparison' ? 'Comparison draft' :
                'Image draft';
              return (
                <article key={`${d.kind}-${d.id}`} className="rounded-md border border-base-800 bg-base-900/40 p-4">
                  <div className="mb-3 flex aspect-[4/3] items-center justify-center overflow-hidden rounded border border-base-800 bg-base-950 text-ink-700">
                    {icon}
                  </div>
                  <p className="text-[13px] font-medium text-white">{typeLabel}</p>
                  <p className="mt-0.5 text-[12px] text-ink-300">{formatTimestamp(d.createdAt)}</p>
                  <p className="mt-0.5 text-[12px] text-ink-300">Flags: {d.flags.join(', ') || '(none)'}</p>
                  <div className="mt-3">
                    <Link
                      href={d.href}
                      className="rounded-md bg-amber-500 px-3 py-1.5 text-[12px] font-medium text-base-950 transition-colors hover:bg-amber-400"
                    >
                      Continue editing
                    </Link>
                  </div>
                </article>
              );
            })}
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
