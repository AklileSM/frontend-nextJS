'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { PDFDocument } from 'pdf-lib';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Camera,
  GitCompareArrows,
  Link2,
  Link2Off,
  Loader2,
  X,
} from 'lucide-react';
import Compare360Viewer, { type CameraSyncState } from './Compare360Viewer';
import { CompareCalendar } from './panel/CompareCalendar';
import { PanelFileExplorer } from './panel/PanelFileExplorer';
import { PublishModal } from './panel/PublishModal';
import { isPCDUrl } from './panel/helpers';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Modal } from '@/components/ui/Modal';
import { CoachmarkTour, type CoachmarkStep } from '@/components/onboarding/CoachmarkTour';
import type {
  FileSelection,
  NoticeState,
  PanelState,
  ScreenshotNotes,
  Side,
  SideFlags,
} from './panel/types';
import {
  API_BASE,
  createComparisonDraft,
  deleteComparisonDraft,
  getComparisonDraft,
  getExplorerDatesSummaryForProject,
  listComparisonDrafts,
  listProjects,
  publishComparisonDrafts,
  updateComparisonDraft,
} from '@/services/apiClient';
import { getAccessToken } from '@/auth/authSession';
import {
  buildCompareDraftPdfBlob,
  isCompareDraftStateV1,
  type CompareDraftSideV1,
  type CompareDraftStateV1,
} from '@/lib/compareDraftPdfFromState';
import { flagsFromObservationBooleans } from '@/lib/observationReportFlags';
import type { ApiComparisonDraft, ApiProject } from '@/types/api';

export function ComparePanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramSlug = searchParams.get('project');
  const storageSlug = (() => {
    try { return sessionStorage.getItem('sidebar.lastProjectSlug'); } catch { return null; }
  })();
  const projectSlug = paramSlug ?? storageSlug ?? null;

  // Project + dates
  const [project, setProject] = useState<ApiProject | null>(null);
  const [loadingProject, setLoadingProject] = useState(true);
  const [availableDates, setAvailableDates] = useState<ReadonlySet<string>>(new Set());

  // Per-side panel state machine
  const [leftPanel, setLeftPanel] = useState<PanelState>('calendar');
  const [rightPanel, setRightPanel] = useState<PanelState>('calendar');
  const [leftSelectedDate, setLeftSelectedDate] = useState<string | null>(null);
  const [rightSelectedDate, setRightSelectedDate] = useState<string | null>(null);
  const [leftFile, setLeftFile] = useState<FileSelection | null>(null);
  const [rightFile, setRightFile] = useState<FileSelection | null>(null);

  // Camera sync
  const [isSynchronized, setIsSynchronized] = useState(false);
  const [lockLeader, setLockLeader] = useState<Side | null>(null);
  const [sharedCameraState, setSharedCameraState] = useState<CameraSyncState | null>(null);
  const [lastLeftCameraState, setLastLeftCameraState] = useState<CameraSyncState | null>(null);
  const [lastRightCameraState, setLastRightCameraState] = useState<CameraSyncState | null>(null);

  // Screenshot callbacks, stored via setState(() => fn) so functions are not called as lazy initializers
  const [leftTakeScreenshot, setLeftTakeScreenshot] = useState<(() => string | null) | null>(null);
  const [rightTakeScreenshot, setRightTakeScreenshot] = useState<(() => string | null) | null>(null);

  // Screenshot modal
  const [isScreenshotModalOpen, setIsScreenshotModalOpen] = useState(false);
  const [leftScreenshot, setLeftScreenshot] = useState<string | null>(null);
  const [rightScreenshot, setRightScreenshot] = useState<string | null>(null);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  // Bottom section (progressive disclosure)
  const [isBottomSectionVisible, setIsBottomSectionVisible] = useState(false);
  const [leftNotes, setLeftNotes] = useState('');
  const [rightNotes, setRightNotes] = useState('');
  const [leftAnnex, setLeftAnnex] = useState<ScreenshotNotes>({ images: [], text: '' });
  const [rightAnnex, setRightAnnex] = useState<ScreenshotNotes>({ images: [], text: '' });
  const [leftFlags, setLeftFlags] = useState<SideFlags>({ safety: false, quality: false, delayed: false });
  const [rightFlags, setRightFlags] = useState<SideFlags>({ safety: false, quality: false, delayed: false });

  // Draft
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [comparisonDrafts, setComparisonDrafts] = useState<ApiComparisonDraft[]>([]);
  const [saveDraftBusy, setSaveDraftBusy] = useState(false);

  // Publish modal
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [publishSelectedIds, setPublishSelectedIds] = useState<string[]>([]);
  const [publishFilterDateKeys, setPublishFilterDateKeys] = useState<string[]>([]);
  const [publishBusy, setPublishBusy] = useState(false);
  const [publishModalLoading, setPublishModalLoading] = useState(false);

  // Dialogs
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [isBackModalOpen, setIsBackModalOpen] = useState(false);

  // Coachmark tour targets
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const lockBtnRef = useRef<HTMLButtonElement>(null);
  const snapshotBtnRef = useRef<HTMLButtonElement>(null);

  const tourSteps: CoachmarkStep[] = [
    {
      targetRef: leftPanelRef,
      title: 'Pick a starting file',
      body: "Pick a date on the calendar, then a file from the explorer. The left panel is the 'before' side of your comparison.",
      placement: 'right',
    },
    {
      targetRef: rightPanelRef,
      title: 'Pick what to compare against',
      body: 'Same drill on the right. The file must be from the same room as the left.',
      placement: 'left',
    },
    {
      targetRef: lockBtnRef,
      title: 'Sync the cameras',
      body: 'Once both viewers are open, click Lock views to make dragging either camera move both viewers together.',
      placement: 'top',
    },
    {
      targetRef: snapshotBtnRef,
      title: 'Capture the comparison',
      body: 'Snapshot captures both viewers and reveals a notes section below, where you add per-side notes and flags (safety / quality / delayed).',
      placement: 'top',
    },
    {
      targetRef: snapshotBtnRef,
      title: 'One report from many drafts',
      body: 'Comparison reports are built from multiple drafts. Save each comparison as a draft, then come back later and save more. Generate Report combines all of them into one consolidated PDF.',
      placement: 'top',
    },
  ];

  // Load project + available dates
  useEffect(() => {
    if (!projectSlug) { setLoadingProject(false); return; }
    let cancelled = false;
    setLoadingProject(true);
    void (async () => {
      try {
        const projects = await listProjects();
        if (cancelled) return;
        const found = projects.find((p) => p.slug === projectSlug) ?? null;
        setProject(found);
        if (!found) return;
        const summary = await getExplorerDatesSummaryForProject(found.id);
        if (cancelled) return;
        setAvailableDates(new Set(Object.keys(summary.dates)));
      } catch (e) {
        if (!cancelled) toast.error(e instanceof Error ? e.message : 'Could not load project.');
      } finally {
        if (!cancelled) setLoadingProject(false);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectSlug]);

  // Load drafts list on mount
  useEffect(() => {
    listComparisonDrafts().then(setComparisonDrafts).catch(() => {});
  }, []);

  // Hydrate from ?draft= URL param
  useEffect(() => {
    const draftQueryId = searchParams.get('draft');
    if (!draftQueryId) { setEditingDraftId(null); return; }
    let cancelled = false;

    void (async () => {
      try {
        const d = await getComparisonDraft(draftQueryId);
        if (cancelled) return;
        const raw = d.state_json;
        if (!isCompareDraftStateV1(raw)) {
          setNotice({
            title: 'Draft unavailable',
            message: 'This draft has no saved comparison session. Start a new comparison.',
            variant: 'info',
          });
          setEditingDraftId(null);
          return;
        }
        const s = raw;
        setLeftNotes(s.leftNotes);
        setRightNotes(s.rightNotes);
        setLeftAnnex({ ...s.leftAnnex });
        setRightAnnex({ ...s.rightAnnex });
        setLeftFlags({ ...s.leftFlags });
        setRightFlags({ ...s.rightFlags });

        const applySide = (side: CompareDraftSideV1 | null, which: Side) => {
          if (!side) return;
          const url = side.fileUrl || `${API_BASE}/files/${side.fileId}/content`;
          const usePcd = side.viewerKind === 'pcd' || side.mediaType === 'pointcloud' || isPCDUrl(url);
          const sel: FileSelection = {
            fileUrl: url,
            fileId: side.fileId,
            displayFileName: side.displayFileName,
            roomSlug: side.roomLabel,
            roomLabel: side.roomLabel,
            captureDate: side.captureDate,
            mediaType: side.mediaType ?? (usePcd ? 'pointcloud' : 'image'),
            isPCD: usePcd,
          };
          if (which === 'left') {
            setLeftSelectedDate(side.captureDate.slice(0, 10) || null);
            setLeftFile(sel);
            setLeftPanel(usePcd ? 'viewerPCD' : 'viewer360');
          } else {
            setRightSelectedDate(side.captureDate.slice(0, 10) || null);
            setRightFile(sel);
            setRightPanel(usePcd ? 'viewerPCD' : 'viewer360');
          }
        };
        applySide(s.left, 'left');
        applySide(s.right, 'right');
        setIsBottomSectionVisible(true);
        setEditingDraftId(d.id);
      } catch (e) {
        if (!cancelled) {
          setNotice({
            title: 'Error',
            message: e instanceof Error ? e.message : 'Could not load comparison draft.',
            variant: 'error',
          });
        }
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Camera sync
  const toggleSynchronization = () => {
    setIsSynchronized((prev) => {
      const next = !prev;
      if (next) {
        const seed = lastLeftCameraState ?? lastRightCameraState;
        if (seed) {
          setSharedCameraState({ ...seed, source: lastLeftCameraState ? 'left' : 'right', seq: seed.seq + 1 });
          setLockLeader(lastLeftCameraState ? 'left' : 'right');
        }
      } else {
        setLockLeader(null);
      }
      return next;
    });
  };

  const handleCameraStateChange = useCallback(
    (side: Side, state: { position: [number, number, number]; target: [number, number, number] }) => {
      const full: CameraSyncState = { ...state, source: side, seq: Date.now() };
      if (side === 'left') setLastLeftCameraState(full);
      else setLastRightCameraState(full);
      if (!isSynchronized) return;
      if (lockLeader && lockLeader !== side) return;
      if (!lockLeader) setLockLeader(side);
      setSharedCameraState(full);
    },
    [isSynchronized, lockLeader],
  );

  const handleLeftScreenshotAssignment = useCallback((fn: () => string | null) => {
    setLeftTakeScreenshot(() => fn);
  }, []);

  const handleRightScreenshotAssignment = useCallback((fn: () => string | null) => {
    setRightTakeScreenshot(() => fn);
  }, []);

  // File selection with room validation
  const handleFileSelect = (side: Side, sel: FileSelection) => {
    const other = side === 'left' ? rightFile : leftFile;
    if (sel.fileUrl === other?.fileUrl) {
      setNotice({ title: 'Cannot select', message: 'This file is already selected for the other view.', variant: 'info' });
      return;
    }
    if (other && other.roomSlug !== sel.roomSlug) {
      setNotice({ title: 'Cannot compare', message: 'Please select files from the same room.', variant: 'info' });
      return;
    }
    if (side === 'left') {
      setLeftFile(sel);
      setLeftPanel(sel.isPCD ? 'viewerPCD' : 'viewer360');
    } else {
      setRightFile(sel);
      setRightPanel(sel.isPCD ? 'viewerPCD' : 'viewer360');
    }
  };

  const handleCloseViewer = (side: Side) => {
    if (side === 'left') {
      setLeftFile(null);
      setLeftPanel(leftSelectedDate ? 'explorer' : 'calendar');
    } else {
      setRightFile(null);
      setRightPanel(rightSelectedDate ? 'explorer' : 'calendar');
    }
  };

  // Snapshot & Compare
  const handleSnapshot = () => {
    setIsBottomSectionVisible(true);
    const leftImg = leftTakeScreenshot?.();
    const rightImg = rightTakeScreenshot?.();
    if (leftImg && rightImg) {
      setLeftScreenshot(leftImg);
      setRightScreenshot(rightImg);
      setIsScreenshotModalOpen(true);
    }
    if (leftImg) setLeftAnnex((p) => ({ ...p, images: [...p.images, leftImg] }));
    if (rightImg) setRightAnnex((p) => ({ ...p, images: [...p.images, rightImg] }));
  };

  // Build draft state snapshot
  const buildCompareDraftState = (): CompareDraftStateV1 => ({
    version: 1,
    left: leftFile
      ? {
          captureDate: leftFile.captureDate,
          fileId: leftFile.fileId,
          fileUrl: leftFile.fileUrl,
          displayFileName: leftFile.displayFileName,
          roomLabel: leftFile.roomLabel,
          mediaType: leftFile.mediaType,
          viewerKind: leftFile.isPCD ? 'pcd' : '360',
        }
      : null,
    right: rightFile
      ? {
          captureDate: rightFile.captureDate,
          fileId: rightFile.fileId,
          fileUrl: rightFile.fileUrl,
          displayFileName: rightFile.displayFileName,
          roomLabel: rightFile.roomLabel,
          mediaType: rightFile.mediaType,
          viewerKind: rightFile.isPCD ? 'pcd' : '360',
        }
      : null,
    leftNotes,
    rightNotes,
    leftAnnex: { ...leftAnnex },
    rightAnnex: { ...rightAnnex },
    leftFlags,
    rightFlags,
  });

  const saveComparisonDraft = async () => {
    const primaryFileId = leftFile?.fileId ?? rightFile?.fileId;
    if (!primaryFileId) { toast.error('Select at least one file before saving.'); return; }
    setSaveDraftBusy(true);
    try {
      const state = buildCompareDraftState();
      const mergedNotes = [leftNotes, rightNotes].filter(Boolean).join('\n\n');
      const annexNotes = [leftAnnex.text, rightAnnex.text].filter(Boolean).join('\n\n');
      const manualObservations = [mergedNotes, annexNotes].filter(Boolean).join('\n\n') || null;
      const flags = flagsFromObservationBooleans(
        leftFlags.safety || rightFlags.safety,
        leftFlags.quality || rightFlags.quality,
        leftFlags.delayed || rightFlags.delayed,
      );
      if (editingDraftId) {
        const updated = await updateComparisonDraft({
          draftId: editingDraftId,
          fileId: primaryFileId,
          manualObservations,
          flags,
          state: state as unknown as Record<string, unknown>,
        });
        setComparisonDrafts((prev) => prev.map((x) => x.id === updated.id ? { ...x, ...updated } : x));
        setEditingDraftId(null);
        toast.success('Comparison draft updated.');
      } else {
        const draft = await createComparisonDraft({
          fileId: primaryFileId,
          manualObservations,
          flags,
          state: state as unknown as Record<string, unknown>,
        });
        setComparisonDrafts((prev) => [...prev, draft]);
        toast.success('Comparison draft saved.');
      }
      setLeftNotes('');
      setRightNotes('');
      setLeftAnnex({ images: [], text: '' });
      setRightAnnex({ images: [], text: '' });
      setLeftFlags({ safety: false, quality: false, delayed: false });
      setRightFlags({ safety: false, quality: false, delayed: false });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save comparison draft.');
    } finally {
      setSaveDraftBusy(false);
    }
  };

  // Publish helpers
  const openPublishModal = async () => {
    setPublishModalLoading(true);
    try {
      const drafts = await listComparisonDrafts();
      setComparisonDrafts(drafts);
      const dayKeys = [...new Set(drafts.map((d) => {
        const t = new Date(d.created_at);
        if (Number.isNaN(t.getTime())) return '';
        return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
      }).filter(Boolean))].sort();
      setPublishFilterDateKeys(dayKeys);
      setPublishSelectedIds(drafts.map((d) => d.id));
      setIsPublishModalOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not load comparison drafts.');
    } finally {
      setPublishModalLoading(false);
    }
  };

  const publishReportsWithIds = async (draftIds: string[]) => {
    const idSet = new Set(draftIds);
    const ordered = comparisonDrafts.filter((d) => idSet.has(d.id));
    if (!ordered.length) throw new Error('No matching drafts to publish.');
    const token = getAccessToken() ?? '';
    const consolidatedPdf = await PDFDocument.create();
    for (const draft of ordered) {
      let bytes: ArrayBuffer;
      if (draft.pdf_url) {
        const res = await fetch(draft.pdf_url, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error(`Failed to load draft PDF (${res.status})`);
        bytes = await res.arrayBuffer();
      } else {
        const detail = await getComparisonDraft(draft.id);
        const raw = detail.state_json;
        if (!isCompareDraftStateV1(raw)) {
          throw new Error(`Draft "${draft.label?.trim() || draft.id.slice(0, 8) + '…'}" has no saved comparison data.`);
        }
        const blob = buildCompareDraftPdfBlob(raw, {
          projectName: project?.name ?? 'Project',
          preparedBy: 'Inspector',
          issueDate: new Date(draft.created_at),
        });
        bytes = await blob.arrayBuffer();
      }
      const existing = await PDFDocument.load(bytes);
      const copied = await consolidatedPdf.copyPages(existing, existing.getPageIndices());
      copied.forEach((p) => consolidatedPdf.addPage(p));
    }
    const pdfBytes = await consolidatedPdf.save();
    const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
    const primaryFileId = ordered[0]?.file_id ?? leftFile?.fileId ?? rightFile?.fileId ?? comparisonDrafts[0]?.file_id;
    if (!primaryFileId) throw new Error('Cannot publish without a file reference.');
    await publishComparisonDrafts({ pdfBlob: blob, fileId: primaryFileId, draftIds: ordered.map((d) => d.id), filename: 'Consolidated_Comparison_Report.pdf', manualObservations: null, flags: [] });
    setComparisonDrafts((prev) => prev.filter((d) => !idSet.has(d.id)));
    setPublishSelectedIds([]);
    setIsPublishModalOpen(false);
    if (editingDraftId && idSet.has(editingDraftId)) setEditingDraftId(null);
    toast.success('Published consolidated comparison report.');
  };

  const handlePublishConfirm = async () => {
    if (!publishSelectedIds.length) { toast.error('Select at least one draft.'); return; }
    setPublishBusy(true);
    try { await publishReportsWithIds(publishSelectedIds); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Publish failed.'); }
    finally { setPublishBusy(false); }
  };

  const handleDeleteDraftFromPublishModal = async (id: string) => {
    try {
      await deleteComparisonDraft(id);
      setComparisonDrafts((p) => p.filter((x) => x.id !== id));
      setPublishSelectedIds((p) => p.filter((x) => x !== id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not delete draft.');
    }
  };

  // Empty state
  if (!loadingProject && !project) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-16 text-center">
        <GitCompareArrows size={28} className="text-ink-500" />
        <p className="font-display text-[18px] font-semibold text-white">No project selected</p>
        <p className="max-w-[36ch] text-[13px] leading-relaxed text-ink-400">
          Open a project first, then click Compare to scope the viewer.
        </p>
        <Link href="/projects" className="mt-2 rounded-md bg-amber-500 px-4 py-2 text-[13px] font-semibold text-base-950 hover:bg-amber-400">
          Go to projects
        </Link>
      </div>
    );
  }


  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-base-800 bg-base-900/40 px-5 py-4">
        <div>
          <p className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-amber-500">
            <GitCompareArrows size={11} />
            {project?.name ?? '—'}
          </p>
          <h1 className="mt-1 font-display text-[24px] font-semibold leading-tight tracking-[-0.015em] text-white">
            Compare View
          </h1>
          {editingDraftId && (
            <p className="mt-0.5 text-[12px] text-amber-400">
              Editing draft:{' '}
              <span className="font-medium">
                {comparisonDrafts.find((d) => d.id === editingDraftId)?.label?.trim() || `${editingDraftId.slice(0, 8)}…`}
              </span>
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setIsBackModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md border border-base-700 bg-base-900 px-3 py-1.5 text-[12px] font-medium text-ink-200 transition-colors hover:border-base-600 hover:bg-base-800 hover:text-white"
        >
          <ArrowLeft size={12} />
          Back
        </button>
      </div>

      {loadingProject ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={20} className="animate-spin text-ink-500" />
        </div>
      ) : (
        <>
          {/* Dual panels */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {(['left', 'right'] as Side[]).map((side) => {
              const panel = side === 'left' ? leftPanel : rightPanel;
              const selectedDate = side === 'left' ? leftSelectedDate : rightSelectedDate;
              const file = side === 'left' ? leftFile : rightFile;
              const otherFile = side === 'left' ? rightFile : leftFile;

              return (
                <div
                  key={side}
                  ref={side === 'left' ? leftPanelRef : rightPanelRef}
                  className="flex h-[70vh] flex-col overflow-hidden rounded-xl border border-base-800 bg-base-900"
                >
                  {panel === 'calendar' && (
                    <CompareCalendar
                      availableDates={availableDates}
                      onDateSelect={(date) => {
                        if (side === 'left') { setLeftSelectedDate(date); setLeftPanel('explorer'); }
                        else { setRightSelectedDate(date); setRightPanel('explorer'); }
                      }}
                    />
                  )}

                  {panel === 'explorer' && selectedDate && (
                    <PanelFileExplorer
                      projectId={project?.id ?? ''}
                      projectSlug={project?.slug}
                      selectedDate={selectedDate}
                      disabledFileUrl={otherFile?.fileUrl ?? null}
                      onFileSelect={(sel) => handleFileSelect(side, sel)}
                      onBackToCalendar={() => {
                        if (side === 'left') setLeftPanel('calendar');
                        else setRightPanel('calendar');
                      }}
                      tabRailId={`compare-${side}-tab`}
                    />
                  )}

                  {panel === 'viewer360' && file && (
                    <Compare360Viewer
                      viewerSide={side}
                      imageUrl={file.fileUrl}
                      displayFileName={file.displayFileName}
                      roomLabel={file.roomLabel}
                      captureDate={file.captureDate}
                      onClose={() => handleCloseViewer(side)}
                      sharedCameraState={sharedCameraState}
                      onCameraStateChange={handleCameraStateChange}
                      isSynchronized={isSynchronized}
                      onTakeScreenshot={
                        side === 'left' ? handleLeftScreenshotAssignment : handleRightScreenshotAssignment
                      }
                    />
                  )}

                  {panel === 'viewerPCD' && file && (
                    <div className="relative h-full w-full">
                      <iframe
                        src={`/potree/examples/viewer.html?url=${encodeURIComponent(file.fileUrl)}`}
                        title={file.displayFileName}
                        className="h-full w-full border-0"
                      />
                      <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-lg border border-base-700 bg-base-900/90 px-3 py-2 text-center backdrop-blur-sm">
                        <p className="max-w-[200px] truncate text-[12px] font-medium text-white">{file.displayFileName}</p>
                        {(file.roomLabel || file.captureDate) && (
                          <p className="mt-0.5 text-[11px] text-ink-400">
                            {file.roomLabel}{file.roomLabel && file.captureDate ? ' · ' : ''}{file.captureDate}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCloseViewer(side)}
                        className="absolute left-3 top-3 z-10 rounded-full border border-base-700 bg-base-900/90 p-1.5 text-ink-300 backdrop-blur-sm transition-colors hover:text-white"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Camera lock + Snapshot button */}
          <div className="flex items-center justify-between rounded-xl border border-base-800 bg-base-900/40 px-4 py-3">
            <button
              ref={lockBtnRef}
              type="button"
              onClick={toggleSynchronization}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors ${
                isSynchronized
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                  : 'border-base-700 text-ink-400 hover:border-base-600 hover:text-white'
              }`}
            >
              {isSynchronized ? <Link2 size={13} /> : <Link2Off size={13} />}
              {isSynchronized ? 'Views locked' : 'Lock views'}
            </button>

            <button
              ref={snapshotBtnRef}
              type="button"
              onClick={handleSnapshot}
              disabled={leftPanel !== 'viewer360' && rightPanel !== 'viewer360'}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-[13px] font-semibold text-base-950 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Camera size={14} />
              {isBottomSectionVisible ? 'Snapshot' : 'Snapshot & Compare'}
            </button>
          </div>

          {/* Bottom section */}
          {isBottomSectionVisible && (
            <div className="space-y-5 rounded-xl border border-base-800 bg-base-900/40 p-5">
              {/* Notes */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {(['left', 'right'] as Side[]).map((side) => (
                  <div key={side} className="space-y-1.5">
                    <label className="block font-mono text-[10px] uppercase tracking-[0.18em] text-amber-500">
                      {side} view notes
                    </label>
                    <textarea
                      value={side === 'left' ? leftNotes : rightNotes}
                      onChange={(e) =>
                        side === 'left' ? setLeftNotes(e.target.value) : setRightNotes(e.target.value)
                      }
                      rows={4}
                      placeholder={`Add notes for the ${side} view here…`}
                      className="w-full rounded-lg border border-base-700 bg-base-950/60 px-3 py-2.5 text-[13px] text-white placeholder-ink-600 focus:border-base-600 focus:outline-none"
                    />
                  </div>
                ))}
              </div>

              {/* Annex screenshots */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {(['left', 'right'] as Side[]).map((side) => {
                  const annex = side === 'left' ? leftAnnex : rightAnnex;
                  const setAnnex = side === 'left' ? setLeftAnnex : setRightAnnex;
                  return (
                    <div key={side} className="space-y-2">
                      <label className="block text-[11px] font-medium text-ink-400">
                        {side === 'left' ? 'Left' : 'Right'} screenshot notes
                      </label>
                      <div className="rounded-lg border border-base-700 bg-base-950/40 p-3">
                        {annex.images.length > 0 && (
                          <div className="mb-3 flex flex-wrap gap-2">
                            {annex.images.map((img, idx) => (
                              <div key={idx} className="group relative">
                                <img
                                  src={img}
                                  alt={`Screenshot ${idx + 1}`}
                                  className="h-20 w-auto cursor-pointer rounded-md object-cover"
                                  onClick={() => setExpandedImage(img)}
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    setAnnex((p) => ({ ...p, images: p.images.filter((_, i) => i !== idx) }))
                                  }
                                  className="absolute right-0.5 top-0.5 hidden rounded-full bg-base-950/80 p-0.5 text-ink-300 group-hover:flex"
                                >
                                  <X size={10} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <textarea
                          rows={3}
                          placeholder={`Comments for the ${side} screenshot…`}
                          value={annex.text}
                          onChange={(e) => setAnnex((p) => ({ ...p, text: e.target.value }))}
                          className="w-full rounded-lg border border-base-700 bg-base-950/60 px-3 py-2 text-[12px] text-white placeholder-ink-600 focus:border-base-600 focus:outline-none"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Flags */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {(['left', 'right'] as Side[]).map((side) => {
                  const flags = side === 'left' ? leftFlags : rightFlags;
                  const setFlags = side === 'left' ? setLeftFlags : setRightFlags;
                  return (
                    <div key={side} className="space-y-2">
                      <label className="block text-[11px] font-medium text-ink-400">
                        {side === 'left' ? 'Left' : 'Right'} view flags
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {(
                          [
                            ['safety', 'Safety Issue'],
                            ['quality', 'Quality Issue'],
                            ['delayed', 'Delayed'],
                          ] as [keyof SideFlags, string][]
                        ).map(([key, label]) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setFlags((p) => ({ ...p, [key]: !p[key] }))}
                            className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                              flags[key]
                                ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40'
                                : 'border border-base-700 text-ink-400 hover:border-base-600 hover:text-white'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Action buttons */}
              <div className="flex justify-end gap-3 border-t border-base-800 pt-4">
                <button
                  type="button"
                  disabled={saveDraftBusy || publishModalLoading || publishBusy}
                  onClick={() => void saveComparisonDraft()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-base-700 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:border-base-600 hover:bg-base-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saveDraftBusy ? <Loader2 size={13} className="animate-spin" /> : null}
                  {saveDraftBusy ? (editingDraftId ? 'Updating…' : 'Saving…') : 'Save'}
                </button>
                <button
                  type="button"
                  disabled={publishModalLoading || saveDraftBusy || publishBusy}
                  onClick={() => void openPublishModal()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-[13px] font-semibold text-base-950 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {publishModalLoading ? <Loader2 size={13} className="animate-spin" /> : null}
                  {publishModalLoading ? 'Loading…' : 'Generate Report'}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Screenshot modal ───────────────────────────────────────────────── */}
      <Modal
        open={isScreenshotModalOpen}
        onClose={() => setIsScreenshotModalOpen(false)}
        title="Snapshots"
        size="xl"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {([['Left', leftScreenshot], ['Right', rightScreenshot]] as [string, string | null][]).map(([label, img]) => (
            <div key={label} className="space-y-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-amber-500">{label}</p>
              {img ? (
                <>
                  <img
                    src={img}
                    alt={`${label} snapshot`}
                    className="max-h-[40vh] w-full cursor-pointer rounded-lg bg-black/30 object-contain"
                    onClick={() => setExpandedImage(img)}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const a = document.createElement('a');
                      a.href = img;
                      a.download = `${label.toLowerCase()}_snapshot.png`;
                      a.click();
                    }}
                    className="rounded-md border border-base-700 px-3 py-1.5 text-[12px] text-white transition-colors hover:bg-base-800"
                  >
                    Download
                  </button>
                </>
              ) : (
                <p className="text-[12px] text-ink-500">No snapshot for this side.</p>
              )}
            </div>
          ))}
        </div>
      </Modal>

      {/* ── Expanded image ─────────────────────────────────────────────────── */}
      {expandedImage && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setExpandedImage(null)}
        >
          <img src={expandedImage} alt="Expanded" className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain" />
          <button
            type="button"
            onClick={() => setExpandedImage(null)}
            className="absolute right-6 top-6 rounded-full border border-base-700 bg-base-900/90 p-2 text-ink-300 transition-colors hover:text-white"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── Publish modal ──────────────────────────────────────────────────── */}
      <PublishModal
        isOpen={isPublishModalOpen}
        onClose={() => setIsPublishModalOpen(false)}
        drafts={comparisonDrafts}
        selectedIds={publishSelectedIds}
        setSelectedIds={setPublishSelectedIds}
        filterDateKeys={publishFilterDateKeys}
        setFilterDateKeys={setPublishFilterDateKeys}
        isBusy={publishBusy}
        onPublishConfirm={() => void handlePublishConfirm()}
        onDeleteDraft={handleDeleteDraftFromPublishModal}
      />

      {/* ── Notice dialog ──────────────────────────────────────────────────── */}
      <Modal
        open={!!notice}
        onClose={() => setNotice(null)}
        title={notice?.title ?? ''}
        size="sm"
        footer={
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="rounded-md bg-amber-500 px-3.5 py-1.5 text-[13px] font-semibold text-base-950 transition-colors hover:bg-amber-400"
          >
            OK
          </button>
        }
      >
        <p className={`text-[13px] leading-[1.6] ${notice?.variant === 'error' ? 'text-red-300' : 'text-ink-200'}`}>
          {notice?.message}
        </p>
      </Modal>

      {/* ── Back confirmation modal ────────────────────────────────────────── */}
      <ConfirmDialog
        open={isBackModalOpen}
        title="Leave Compare?"
        body="Unsaved changes will be lost. Are you sure you want to leave?"
        confirmLabel="Leave"
        danger
        onConfirm={() => {
          setIsBackModalOpen(false);
          router.push(project ? `/app/projects/${project.slug}` : '/projects');
        }}
        onCancel={() => setIsBackModalOpen(false)}
      />

      <CoachmarkTour
        id="compare"
        steps={tourSteps}
        enabled={!loadingProject && !!project}
      />
    </div>
  );
}
