/** Small pure helpers shared between the explorer page and its
 *  sub-components. */

import type { ApiMediaFile, ApiRoom, ApiRoomMediaGroup } from '@/types/api';
import type { MediaTab } from '@/components/explorer/MediaTabs';

/** The explorer endpoint may key rooms by name OR slug — try both. */
export function pickGroup(
  rooms: Record<string, ApiRoomMediaGroup>,
  room: ApiRoom,
): ApiRoomMediaGroup | null {
  return rooms[room.name] ?? rooms[room.slug] ?? null;
}

export function emptyGroup(): ApiRoomMediaGroup {
  return { images: [], videos: [], pointclouds: [], pdfs: [] };
}

export function filesForTab(group: ApiRoomMediaGroup, tab: MediaTab): ApiMediaFile[] {
  return group[tab];
}

/** Map the API's file type to the explorer's tab id. Used by the uploader's
 *  `onUploaded` callback so the user lands on the tab containing their new
 *  file. */
export const TYPE_TO_TAB: Record<ApiMediaFile['type'], MediaTab> = {
  image: 'images',
  video: 'videos',
  pointcloud: 'pointclouds',
  pdf: 'pdfs',
};
