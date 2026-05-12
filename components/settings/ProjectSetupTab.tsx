'use client';

import { useState } from 'react';
import { Check, ImageIcon, LayoutGrid, MousePointerSquareDashed } from 'lucide-react';
import { FloorplanUploader } from './FloorplanUploader';
import { ProjectRoomsTab } from './ProjectRoomsTab';
import { HotspotEditor } from './HotspotEditor';
import type { ApiProject, ApiRoom } from '@/types/api';

type Section = 'floorplan' | 'rooms' | 'hotspots';

const SECTIONS: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: 'floorplan', label: 'Floorplan', icon: <ImageIcon size={14} /> },
  { id: 'rooms',     label: 'Rooms',     icon: <LayoutGrid size={14} /> },
  { id: 'hotspots',  label: 'Hotspots',  icon: <MousePointerSquareDashed size={14} /> },
];

function statusFor(id: Section, project: ApiProject, rooms: ApiRoom[]): 'done' | 'empty' {
  if (id === 'floorplan') return project.floorplan_url ? 'done' : 'empty';
  if (id === 'rooms')     return rooms.length > 0 ? 'done' : 'empty';
  if (id === 'hotspots')  return rooms.some((r) => !!r.floor_plan_coordinates) ? 'done' : 'empty';
  return 'empty';
}

export function ProjectSetupTab({
  project,
  onProjectUpdated,
}: {
  project: ApiProject;
  onProjectUpdated: (p: ApiProject) => void;
}) {
  const [active, setActive] = useState<Section>('floorplan');
  const [rooms, setRooms] = useState<ApiRoom[]>([]);

  const handleRoomUpdated = (updated: ApiRoom) => {
    setRooms((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  };

  return (
    <div className="flex gap-8">
      {/* Side menu */}
      <nav className="w-40 shrink-0">
        <ul className="space-y-0.5">
          {SECTIONS.map(({ id, label, icon }) => {
            const isActive = active === id;
            const isDone = statusFor(id, project, rooms) === 'done';
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => setActive(id)}
                  className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-colors ${
                    isActive
                      ? 'bg-base-800 text-white'
                      : 'text-ink-400 hover:bg-base-800/50 hover:text-white'
                  }`}
                >
                  <span className={isActive ? 'text-amber-400' : 'text-ink-600'}>{icon}</span>
                  <span className="flex-1 text-left">{label}</span>
                  {isDone && (
                    <Check size={11} className="shrink-0 text-amber-500" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {active === 'floorplan' && (
          <div>
            <h3 className="mb-1 text-[14px] font-semibold text-white">Floorplan</h3>
            <p className="mb-5 text-[13px] text-ink-400">
              Upload the site floorplan image. Used as the background for hotspot placement.
            </p>
            <FloorplanUploader project={project} onUploaded={onProjectUpdated} />
          </div>
        )}

        {active === 'rooms' && (
          <div>
            <h3 className="mb-1 text-[14px] font-semibold text-white">Rooms</h3>
            <p className="mb-5 text-[13px] text-ink-400">
              Manage the rooms in this project. All file uploads are filed under a room.
            </p>
            <ProjectRoomsTab
              projectId={project.id}
              onRoomsLoaded={setRooms}
            />
          </div>
        )}

        {active === 'hotspots' && (
          <div>
            <h3 className="mb-1 text-[14px] font-semibold text-white">Hotspots</h3>
            <p className="mb-5 text-[13px] text-ink-400">
              Draw clickable zones on the floorplan and assign them to rooms.
            </p>
            {project.floorplan_url ? (
              <HotspotEditor
                projectId={project.id}
                floorplanUrl={project.floorplan_url}
                rooms={rooms}
                onRoomUpdated={handleRoomUpdated}
              />
            ) : (
              <p className="rounded-lg border border-dashed border-base-700 bg-base-900/20 px-4 py-8 text-center text-[13px] text-ink-400">
                Upload a floorplan first before placing hotspots.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
