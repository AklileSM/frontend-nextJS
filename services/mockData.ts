// Central in-memory fixtures for the frontend-only build phases. Future phases extend
// these collections; the mock apiClient reads and writes them directly so flows like
// upload, draft save, and PDF publish behave end-to-end without a backend.

import type {
  ApiAnnotation,
  ApiComparisonDraftDetail,
  ApiMediaFile,
  ApiProject,
  ApiReport,
  ApiRoom,
  ApiRoomMediaGroup,
  ApiViewerFieldDraftDetail,
  AuthUser,
} from '@/types/api';

export const mockAdminUser: AuthUser = {
  id: 'mock-admin-1',
  username: 'admin',
  email: 'admin@sitescope.local',
  is_admin: true,
};

const _now = new Date().toISOString();

export const mockProjects: ApiProject[] = [
  {
    id: 'p-a6',
    name: 'A6-Stern',
    slug: 'a6-stern',
    description: 'Main construction site',
    location: 'Berlin, Germany',
    status: 'active',
    owner_id: 'mock-admin-1',
    created_at: _now,
    updated_at: _now,
  },
  {
    id: 'p-x',
    name: 'Project X',
    slug: 'projectx',
    description: null,
    location: null,
    status: 'active',
    owner_id: 'mock-admin-1',
    created_at: _now,
    updated_at: _now,
  },
  {
    id: 'p-y',
    name: 'Project Y',
    slug: 'projecty',
    description: null,
    location: null,
    status: 'active',
    owner_id: 'mock-admin-1',
    created_at: _now,
    updated_at: _now,
  },
];

export const mockRooms: ApiRoom[] = [
  { id: 'r-1', name: 'Room 1', slug: 'room1', project_id: 'p-a6' },
  { id: 'r-2', name: 'Room 2', slug: 'room2', project_id: 'p-a6' },
  { id: 'r-3', name: 'Room 3', slug: 'room3', project_id: 'p-a6' },
  { id: 'r-4', name: 'Room 4', slug: 'room4', project_id: 'p-a6' },
  { id: 'r-5', name: 'Room 5', slug: 'room5', project_id: 'p-a6' },
  { id: 'r-6', name: 'Room 6', slug: 'room6', project_id: 'p-a6' },
];

export const mockCaptureDates: string[] = [
  '2024-10-07',
  '2024-10-09',
  '2024-10-11',
  '2024-10-14',
  '2024-10-16',
  '2024-10-18',
];

function makeFile(
  id: string,
  fileName: string,
  type: ApiMediaFile['type'],
  captureDate: string,
): ApiMediaFile {
  return {
    id,
    file_name: fileName,
    type,
    src: `/Images/${captureDate.replace(/-/g, '')}/${fileName}`,
    full_src: `/Images/${captureDate.replace(/-/g, '')}/${fileName}`,
    capture_date: captureDate,
    uploaded_by_user_id: mockAdminUser.id,
    conversion_status: type === 'pointcloud' ? 'ready' : null,
  };
}

// roomFiles[roomSlug][captureDate] = group
export const mockRoomFiles: Record<string, Record<string, ApiRoomMediaGroup>> = {};

let fileIdCounter = 1;
const nextId = () => `f-${fileIdCounter++}`;

for (const room of mockRooms) {
  mockRoomFiles[room.slug] = {};
  for (const date of mockCaptureDates) {
    const compact = date.replace(/-/g, '');
    const group: ApiRoomMediaGroup = {
      images: [
        makeFile(nextId(), `${room.slug}_${compact}_01.jpg`, 'image', date),
        makeFile(nextId(), `${room.slug}_${compact}_02.jpg`, 'image', date),
      ],
      videos:
        (room.slug === 'room3' && date === '2024-10-14') ||
        (room.slug === 'room4' && date === '2024-10-18') ||
        (room.slug === 'room5' && date === '2024-10-11')
          ? [makeFile(nextId(), `${room.slug}_${compact}_walkthrough.mp4`, 'video', date)]
          : [],
      pointclouds:
        (room.slug === 'room2' && date === '2024-10-18') ||
        (room.slug === 'room4' && date === '2024-10-16')
          ? [makeFile(nextId(), `${room.slug}_${compact}_scan.las`, 'pointcloud', date)]
          : [],
      pdfs:
        date === '2024-10-18'
          ? [makeFile(nextId(), `${room.slug}_${compact}_field-notes.pdf`, 'pdf', date)]
          : [],
    };
    mockRoomFiles[room.slug][date] = group;
  }
}

// In-memory mutable stores — exported so the mock apiClient can mutate them.
export const mockReports: ApiReport[] = [];
export const mockViewerDrafts: ApiViewerFieldDraftDetail[] = [];
export const mockComparisonDrafts: ApiComparisonDraftDetail[] = [];
export const mockAnnotations: ApiAnnotation[] = [];

export function makeMockId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}
