'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { updateProject } from '@/services/apiClient';
import type { ApiProject } from '@/types/api';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[12px] font-medium text-ink-200">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  'w-full rounded-md border border-base-700 bg-base-950 px-3 py-2 text-[13px] text-white outline-none placeholder:text-ink-500 focus:border-amber-500 transition-colors';

export function ProjectEditTab({
  project,
  onUpdated,
}: {
  project: ApiProject;
  onUpdated: (p: ApiProject) => void;
}) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? '');
  const [location, setLocation] = useState(project.location ?? '');
  const [status, setStatus] = useState(project.status);
  const [saving, setSaving] = useState(false);

  const isDirty =
    name !== project.name ||
    description !== (project.description ?? '') ||
    location !== (project.location ?? '') ||
    status !== project.status;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const updated = await updateProject(project.id, {
        name: name.trim(),
        description: description.trim() || null,
        location: location.trim() || null,
        status,
      });
      onUpdated(updated);
      toast.success('Project updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-5">
      <Field label="Project name">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className={inputCls}
        />
      </Field>

      <Field label="Description">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Brief project description…"
          className={`${inputCls} resize-none`}
        />
      </Field>

      <Field label="Location">
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Berlin, Germany"
          className={inputCls}
        />
      </Field>

      <Field label="Status">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className={inputCls}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={saving || !isDirty || !name.trim()}
          className="rounded-md bg-amber-500 px-4 py-2 text-[13px] font-semibold text-base-950 hover:bg-amber-400 transition-colors disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        {isDirty && !saving && (
          <span className="text-[12px] text-ink-400">Unsaved changes</span>
        )}
      </div>
    </form>
  );
}
