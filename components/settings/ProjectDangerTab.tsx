'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';
import { updateProject, deleteProject } from '@/services/apiClient';
import type { ApiProject } from '@/types/api';

function ConfirmModal({
  title,
  description,
  confirmLabel,
  projectName,
  destructive,
  onConfirm,
  onCancel,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  projectName: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState('');
  const match = typed === projectName;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-base-950/80 backdrop-blur-sm px-4"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="w-full max-w-md rounded-xl border border-base-700 bg-base-900 shadow-2xl">
        <div className="flex items-start gap-3 border-b border-base-800 px-6 py-4">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-400" />
          <div>
            <h2 className="text-[15px] font-semibold text-white">{title}</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-300">{description}</p>
          </div>
        </div>
        <div className="space-y-4 p-6">
          <div>
            <label className="mb-1.5 block text-[12px] text-ink-300">
              Type <span className="font-mono text-white">{projectName}</span> to confirm
            </label>
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoFocus
              className="w-full rounded-md border border-base-700 bg-base-950 px-3 py-2 text-[13px] text-white outline-none focus:border-red-500"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-base-700 px-4 py-2 text-[13px] text-white hover:border-ink-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={!match}
              className={`rounded-md px-4 py-2 text-[13px] font-semibold transition-colors disabled:opacity-40 ${
                destructive
                  ? 'bg-red-600 text-white hover:bg-red-500'
                  : 'bg-amber-500 text-base-950 hover:bg-amber-400'
              }`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProjectDangerTab({
  project,
  onUpdated,
}: {
  project: ApiProject;
  onUpdated: (p: ApiProject) => void;
}) {
  const router = useRouter();
  const [modal, setModal] = useState<'archive' | 'delete' | null>(null);
  const [busy, setBusy] = useState(false);

  const isArchived = project.status === 'archived';

  const handleArchive = async () => {
    setModal(null);
    setBusy(true);
    try {
      const updated = await updateProject(project.id, { status: 'archived' });
      onUpdated(updated);
      toast.success('Project archived');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Archive failed');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setModal(null);
    setBusy(true);
    try {
      await deleteProject(project.id);
      toast.success(`Project "${project.name}" deleted`);
      router.push('/projects');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
      setBusy(false);
    }
  };

  return (
    <div className="max-w-lg space-y-6">
      {!isArchived && (
        <DangerCard
          title="Archive project"
          description="Archived projects are visible to members but no new files or reports can be added. You can restore an archived project from the Edit tab at any time."
          action="Archive project"
          disabled={busy}
          onClick={() => setModal('archive')}
        />
      )}

      <DangerCard
        title="Delete project"
        description="Permanently removes this project, all its rooms, and all associated files and reports. This cannot be undone."
        action="Delete project"
        destructive
        disabled={busy}
        onClick={() => setModal('delete')}
      />

      {modal === 'archive' && (
        <ConfirmModal
          title="Archive project"
          description="The project will be set to archived. Members can still view content but cannot upload or create reports."
          confirmLabel="Archive"
          projectName={project.name}
          onConfirm={handleArchive}
          onCancel={() => setModal(null)}
        />
      )}

      {modal === 'delete' && (
        <ConfirmModal
          title="Delete project"
          description="All rooms, files, and reports will be permanently deleted. This cannot be undone."
          confirmLabel="Delete project"
          projectName={project.name}
          destructive
          onConfirm={handleDelete}
          onCancel={() => setModal(null)}
        />
      )}
    </div>
  );
}

function DangerCard({
  title,
  description,
  action,
  destructive,
  disabled,
  onClick,
}: {
  title: string;
  description: string;
  action: string;
  destructive?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <div className="rounded-lg border border-red-900/50 bg-red-950/10 p-5">
      <h3 className="text-[14px] font-semibold text-white">{title}</h3>
      <p className="mt-1 text-[13px] leading-relaxed text-ink-300">{description}</p>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`mt-4 rounded-md px-4 py-2 text-[13px] font-semibold transition-colors disabled:opacity-40 ${
          destructive
            ? 'bg-red-600 text-white hover:bg-red-500'
            : 'border border-amber-500/60 text-amber-400 hover:bg-amber-500/10'
        }`}
      >
        {action}
      </button>
    </div>
  );
}
