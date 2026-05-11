'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { FloorplanUploader } from './FloorplanUploader';
import { RoomManager } from './RoomManager';
import { HotspotEditor } from './HotspotEditor';
import type { ApiProject, ApiRoom } from '@/types/api';

type Step = 0 | 1 | 2;

const STEPS = [
  { label: 'Floorplan', hint: 'Upload the site floorplan image' },
  { label: 'Rooms', hint: 'Define the rooms for this project' },
  { label: 'Hotspots', hint: 'Place interactive zones on the floorplan' },
];

function StepBar({ active, project, rooms }: { active: Step; project: ApiProject; rooms: ApiRoom[] }) {
  const done: boolean[] = [
    !!project.floorplan_url,
    rooms.length > 0,
    rooms.some((r) => !!r.floor_plan_coordinates),
  ];

  return (
    <div className="flex items-start gap-0">
      {STEPS.map((step, i) => {
        const isCurrent = i === active;
        const isDone = done[i] && !isCurrent;
        return (
          <div key={step.label} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full border-2 font-mono text-[11px] font-semibold transition-colors ${
                  isDone
                    ? 'border-amber-500 bg-amber-500 text-base-950'
                    : isCurrent
                      ? 'border-amber-500 bg-base-950 text-amber-500'
                      : 'border-base-700 bg-base-950 text-ink-500'
                }`}
              >
                {isDone ? <Check size={12} /> : i + 1}
              </div>
              <p className={`mt-1.5 text-[11px] font-medium ${isCurrent ? 'text-white' : isDone ? 'text-ink-300' : 'text-ink-500'}`}>
                {step.label}
              </p>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`mb-3.5 mx-2 h-px w-12 sm:w-20 flex-shrink-0 ${done[i] ? 'bg-amber-500/60' : 'bg-base-800'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ProjectSetupTab({
  project,
  onProjectUpdated,
}: {
  project: ApiProject;
  onProjectUpdated: (p: ApiProject) => void;
}) {
  const [step, setStep] = useState<Step>(
    !project.floorplan_url ? 0 : 1,
  );
  const [rooms, setRooms] = useState<ApiRoom[]>([]);

  const handleFloorplanUploaded = (updated: ApiProject) => {
    onProjectUpdated(updated);
    setStep(1);
  };

  const handleRoomsChanged = (next: ApiRoom[]) => {
    setRooms(next);
  };

  const handleRoomUpdated = (updated: ApiRoom) => {
    setRooms((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  };

  return (
    <div className="max-w-2xl space-y-8">
      <StepBar active={step} project={project} rooms={rooms} />

      <div className="rounded-lg border border-base-800 bg-base-900/30 p-6">
        <h3 className="mb-1 text-[14px] font-semibold text-white">
          {STEPS[step].label}
        </h3>
        <p className="mb-5 text-[13px] text-ink-400">{STEPS[step].hint}</p>

        {step === 0 && (
          <FloorplanUploader project={project} onUploaded={handleFloorplanUploaded} />
        )}

        {step === 1 && (
          <RoomManager
            projectId={project.id}
            onRoomsChanged={handleRoomsChanged}
          />
        )}

        {step === 2 && project.floorplan_url && (
          <HotspotEditor
            projectId={project.id}
            floorplanUrl={project.floorplan_url}
            rooms={rooms}
            onRoomUpdated={handleRoomUpdated}
          />
        )}

        {step === 2 && !project.floorplan_url && (
          <p className="text-[13px] text-ink-400">
            Upload a floorplan first before placing hotspots.
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        {step > 0 && (
          <button
            type="button"
            onClick={() => setStep((s) => (s - 1) as Step)}
            className="rounded-md border border-base-700 px-4 py-2 text-[13px] text-white hover:border-ink-300 transition-colors"
          >
            Back
          </button>
        )}
        {step < 2 && (
          <button
            type="button"
            onClick={() => setStep((s) => (s + 1) as Step)}
            disabled={step === 0 && !project.floorplan_url}
            className="rounded-md bg-amber-500 px-4 py-2 text-[13px] font-semibold text-base-950 hover:bg-amber-400 transition-colors disabled:opacity-40"
          >
            Next
          </button>
        )}
        {step === 2 && (
          <p className="text-[13px] text-ink-400">
            Draw rectangles on the floorplan to place hotspots.
          </p>
        )}
      </div>
    </div>
  );
}
