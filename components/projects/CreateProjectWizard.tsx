'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { X, Check, ArrowRight } from 'lucide-react';
import { createProject } from '@/services/apiClient';
import { RoomManager } from '@/components/settings/RoomManager';
import { FloorplanUploader } from '@/components/settings/FloorplanUploader';
import { HotspotEditor } from '@/components/settings/HotspotEditor';
import type { ApiProject, ApiRoom } from '@/types/api';

type Step = 'details' | 'rooms' | 'floorplan' | 'hotspots';

const STEPS: { id: Step; label: string; optional?: true }[] = [
  { id: 'details', label: 'Details' },
  { id: 'rooms',   label: 'Rooms' },
  { id: 'floorplan', label: 'Floorplan', optional: true },
  { id: 'hotspots',  label: 'Hotspots',  optional: true },
];

function StepBar({ current }: { current: Step }) {
  const idx = STEPS.findIndex((s) => s.id === current);
  return (
    <div className="flex items-start">
      {STEPS.map((s, i) => {
        const done   = i < idx;
        const active = s.id === current;
        return (
          <div key={s.id} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full border-2 font-mono text-[10px] font-semibold transition-colors ${
                  done   ? 'border-amber-500 bg-amber-500 text-base-950'
                : active ? 'border-amber-500 bg-base-950 text-amber-500'
                :          'border-base-700 bg-base-950 text-ink-600'
                }`}
              >
                {done ? <Check size={11} /> : i + 1}
              </div>
              <p className={`mt-1 whitespace-nowrap text-[10px] font-medium ${
                active ? 'text-white' : done ? 'text-ink-300' : 'text-ink-600'
              }`}>
                {s.label}
                {s.optional && <span className="text-ink-600"> opt</span>}
              </p>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`mb-3.5 mx-2 h-px w-8 shrink-0 sm:w-12 ${done ? 'bg-amber-500/50' : 'bg-base-800'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

const inputCls =
  'w-full rounded-md border border-base-700 bg-base-950 px-3 py-2 text-[13px] text-white outline-none placeholder:text-ink-500 focus:border-amber-500 transition-colors';

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="mb-1.5 block text-[12px] font-medium text-ink-200">
      {children}
      {required && <span className="ml-1 text-amber-500">*</span>}
    </label>
  );
}

function SettingsNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border border-base-800 bg-base-900/40 px-3 py-2.5 text-[12px] text-ink-400">
      {children}
    </p>
  );
}

export function CreateProjectWizard({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('details');
  const [project, setProject] = useState<ApiProject | null>(null);
  const [rooms, setRooms] = useState<ApiRoom[]>([]);

  // Details form
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [creating, setCreating] = useState(false);

  const autoSlug = (n: string) =>
    n.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  const handleNameChange = (v: string) => {
    setName(v);
    if (!slugTouched) setSlug(autoSlug(v));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) return;
    setCreating(true);
    try {
      const p = await createProject({
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim() || null,
        location: location.trim() || null,
      });
      setProject(p);
      toast.success(`Project "${p.name}" created`);
      setStep('rooms');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  // Stable callbacks so RoomManager doesn't loop
  const handleRoomsChanged = useCallback((next: ApiRoom[]) => setRooms(next), []);
  const handleRoomUpdated  = useCallback(
    (updated: ApiRoom) => setRooms((prev) => prev.map((r) => (r.id === updated.id ? updated : r))),
    [],
  );

  const finish = () => {
    router.push(`/app/projects/${project!.slug}`);
    onClose();
  };

  const currentStep = STEPS.find((s) => s.id === step)!;

  return (
    <motion.div
      key="wizard-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-base-950/80 px-4 py-10 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-2xl rounded-xl border border-base-700 bg-base-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-base-800 px-6 py-4">
          <div>
            <h2 className="text-[15px] font-semibold text-white">New project</h2>
            <p className="mt-0.5 text-[12px] text-ink-400">{currentStep.label}{currentStep.optional ? ', optional' : ''}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-ink-400 transition-colors hover:bg-base-800 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        {/* Step bar */}
        <div className="border-b border-base-800 px-6 py-4">
          <StepBar current={step} />
        </div>

        {/* Body */}
        <div className="px-6 py-6">

          {/* ── Step 1: Details ── */}
          {step === 'details' && (
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <FieldLabel required>Project name</FieldLabel>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="A6-Stern Extension"
                  className={inputCls}
                  required
                  autoFocus
                />
              </div>
              <div>
                <FieldLabel required>Slug</FieldLabel>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                  }}
                  placeholder="a6-stern-ext"
                  pattern="^[a-z0-9-]+$"
                  className={`${inputCls} font-mono`}
                  required
                />
                <p className="mt-1 font-mono text-[11px] text-ink-500">
                  Lowercase, numbers, hyphens, used in URLs.
                </p>
              </div>
              <div>
                <FieldLabel>Description</FieldLabel>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Brief description…"
                  className={`${inputCls} resize-none`}
                />
              </div>
              <div>
                <FieldLabel>Location</FieldLabel>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Berlin, Germany"
                  className={inputCls}
                />
              </div>
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={creating || !name.trim() || !slug.trim()}
                  className="inline-flex items-center gap-2 rounded-md bg-amber-500 px-4 py-2 text-[13px] font-semibold text-base-950 transition-colors hover:bg-amber-400 disabled:opacity-50"
                >
                  {creating ? 'Creating…' : <><span>Create &amp; continue</span><ArrowRight size={13} /></>}
                </button>
              </div>
            </form>
          )}

          {/* ── Step 2: Rooms (mandatory) ── */}
          {step === 'rooms' && project && (
            <div className="space-y-5">
              <RoomManager projectId={project.id} onRoomsChanged={handleRoomsChanged} />
              <div className="flex items-center justify-between border-t border-base-800 pt-4">
                <p className={`text-[12px] ${rooms.length === 0 ? 'text-amber-500/80' : 'text-ink-400'}`}>
                  {rooms.length === 0
                    ? 'Add at least one room to continue.'
                    : `${rooms.length} room${rooms.length !== 1 ? 's' : ''} added.`}
                </p>
                <button
                  type="button"
                  onClick={() => setStep('floorplan')}
                  disabled={rooms.length === 0}
                  className="inline-flex items-center gap-2 rounded-md bg-amber-500 px-4 py-2 text-[13px] font-semibold text-base-950 transition-colors hover:bg-amber-400 disabled:opacity-40"
                >
                  Continue <ArrowRight size={13} />
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Floorplan (optional) ── */}
          {step === 'floorplan' && project && (
            <div className="space-y-5">
              <FloorplanUploader project={project} onUploaded={(p) => setProject(p)} />
              <SettingsNote>
                You can upload or replace the floorplan at any time via{' '}
                <span className="text-ink-200">Settings → Setup</span>.
              </SettingsNote>
              <div className="flex items-center justify-between border-t border-base-800 pt-4">
                <button
                  type="button"
                  onClick={finish}
                  className="text-[13px] text-ink-400 transition-colors hover:text-white"
                >
                  Skip for now
                </button>
                <button
                  type="button"
                  onClick={() => setStep('hotspots')}
                  disabled={!project.floorplan_url}
                  className="inline-flex items-center gap-2 rounded-md bg-amber-500 px-4 py-2 text-[13px] font-semibold text-base-950 transition-colors hover:bg-amber-400 disabled:opacity-40"
                >
                  Continue <ArrowRight size={13} />
                </button>
              </div>
            </div>
          )}

          {/* ── Step 4: Hotspots (optional, only if floorplan uploaded) ── */}
          {step === 'hotspots' && project?.floorplan_url && (
            <div className="space-y-5">
              <HotspotEditor
                projectId={project.id}
                floorplanUrl={project.floorplan_url}
                rooms={rooms}
                onRoomUpdated={handleRoomUpdated}
              />
              <SettingsNote>
                You can draw and edit hotspots at any time via{' '}
                <span className="text-ink-200">Settings → Setup</span>.
              </SettingsNote>
              <div className="flex items-center justify-between border-t border-base-800 pt-4">
                <button
                  type="button"
                  onClick={finish}
                  className="text-[13px] text-ink-400 transition-colors hover:text-white"
                >
                  Skip for now
                </button>
                <button
                  type="button"
                  onClick={finish}
                  className="inline-flex items-center gap-2 rounded-md bg-amber-500 px-4 py-2 text-[13px] font-semibold text-base-950 transition-colors hover:bg-amber-400"
                >
                  <Check size={13} />
                  Finish
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
