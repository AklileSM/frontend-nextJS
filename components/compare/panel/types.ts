/** Shared types for the Compare panel and its sub-components. */

export type Side = 'left' | 'right';

export type PanelState = 'calendar' | 'explorer' | 'viewer360' | 'viewerPCD';

export type FileSelection = {
  fileUrl: string;
  fileId: string;
  displayFileName: string;
  roomSlug: string;
  roomLabel: string;
  captureDate: string;
  mediaType: string;
  isPCD: boolean;
};

export type ScreenshotNotes = { images: string[]; text: string };

export type SideFlags = { safety: boolean; quality: boolean; delayed: boolean };

export type NoticeState = { title: string; message: string; variant: 'info' | 'error' };
