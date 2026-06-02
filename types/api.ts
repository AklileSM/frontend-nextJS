// Mirror of the live backend response shapes.

export interface AuthUser {
  id: string;
  username: string;
  email: string | null;
  email_verified: boolean;
  is_admin: boolean;
}

export interface ApiTokenResponse {
  access_token: string;
  token_type: string;
  user: {
    id: string;
    username: string;
    email: string | null;
    email_verified: boolean;
    is_admin: boolean;
  };
}

export interface ApiProject {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  location: string | null;
  status: string;
  owner_id: string | null;
  floorplan_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiProjectMember {
  user_id: string;
  username: string;
  email: string | null;
  role: 'owner' | 'editor' | 'viewer';
  joined_at: string;
}

export interface AdminUser {
  id: string;
  username: string;
  email: string | null;
  is_admin: boolean;
  is_active: boolean;
  created_at: string;
}

export type Point = { x: number; y: number };

export type PolygonCoordinates = { type: 'polygon'; points: Point[] };
export type PinCoordinates    = { type: 'pin'; x: number; y: number };
export type RectCoordinates   = { x: number; y: number; width: number; height: number };

export type FloorPlanCoordinates = PolygonCoordinates | PinCoordinates | RectCoordinates;

export function isPolygonCoords(c: FloorPlanCoordinates): c is PolygonCoordinates {
  return 'type' in c && (c as PolygonCoordinates).type === 'polygon';
}
export function isPinCoords(c: FloorPlanCoordinates): c is PinCoordinates {
  return 'type' in c && (c as PinCoordinates).type === 'pin';
}
export function isRectCoords(c: FloorPlanCoordinates): c is RectCoordinates {
  return !('type' in c);
}

export interface ApiRoom {
  id: string;
  name: string;
  slug: string;
  project_id: string;
  sort_order: number;
  floor_plan_coordinates: FloorPlanCoordinates | null;
}

export type MediaType = 'image' | 'video' | 'pointcloud' | 'pdf';

export interface ApiMediaFile {
  id: string;
  src: string;
  type: MediaType;
  file_name: string;
  full_src?: string | null;
  capture_date: string;
  uploaded_by_user_id?: string | null;
  conversion_status?: string | null;
  conversion_error?: string | null;
}

export interface ApiRoomMediaGroup {
  images: ApiMediaFile[];
  videos: ApiMediaFile[];
  pointclouds: ApiMediaFile[];
  pdfs: ApiMediaFile[];
}

export interface ExplorerByDateResponse {
  date: string;
  rooms: Record<string, ApiRoomMediaGroup>;
}

export interface ExplorerByRoomResponse {
  room: string;
  room_name: string;
  dates: Record<string, ApiRoomMediaGroup>;
}

export interface DateMediaCounts {
  images: number;
  videos: number;
  pointclouds: number;
  pdfs: number;
}

export interface ExplorerDatesSummaryResponse {
  dates: Record<string, DateMediaCounts>;
}

export interface UploadSingleResponse {
  id: string;
  room: string;
  media_type: string;
  file_name: string;
  capture_date: string;
}

export interface ApiMyUpload {
  id: string;
  room_slug: string;
  room_name: string;
  media_type: string;
  file_name: string;
  capture_date: string;
  created_at: string;
  src: string;
  full_src: string | null;
  conversion_status?: string | null;
}

export interface ApiConversionStatus {
  status: 'pending' | 'processing' | 'ready' | 'failed' | 'unknown';
  error?: string | null;
}

export interface ApiPrecheckHash {
  duplicate: boolean;
  room_name?: string | null;
  capture_date?: string | null;
  display_name?: string | null;
}

export interface ApiBulkActionResult {
  affected: number;
  skipped: number;
}

export interface ApiProjectActivityEntry {
  id: string;
  project_id: string;
  user_id: string | null;
  username: string;
  // Dotted action key (e.g. 'upload.image', 'annotation.create',
  // 'report.publish', 'member.add', 'member.remove'). Kept as a string
  // (not a union) so new actions on the backend don't break the type.
  action: string;
  target_type: string | null;
  target_id: string | null;
  // Free-form bag of display fields written by the backend per action.
  // The feed component picks fields out of here by name; unknown actions
  // fall back to a generic rendering.
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface ApiReport {
  id: string;
  file_id: string;
  label: string | null;
  ai_description: string | null;
  manual_observations: string | null;
  flags: string[];
  screenshots: string[];
  created_by: string | null;
  pdf_url: string | null;
  created_at: string;
}

export interface ApiComparisonDraft {
  id: string;
  file_id: string;
  label: string | null;
  manual_observations: string | null;
  flags: string[];
  pdf_url: string | null;
  created_at: string;
}

export interface ApiComparisonDraftDetail extends ApiComparisonDraft {
  state_json: Record<string, unknown> | null;
}

export interface ApiViewerFieldDraft {
  id: string;
  file_id: string;
  viewer_kind: string;
  label: string | null;
  manual_observations: string | null;
  flags: string[];
  created_at: string;
}

export interface ApiViewerFieldDraftDetail extends ApiViewerFieldDraft {
  state_json: Record<string, unknown> | null;
}

export interface ApiAnnotation {
  id: string;
  file_id: string;
  x: number;
  y: number;
  text: string;
  // Optional category. The UI uses this to color the pin and render a
  // chip in the details modal. Same taxonomy as report flags.
  flag?: AnnotationFlag | null;
  // Same-file pointer to another annotation. Frontend resolves to the
  // annotation's index ("see #4") at render time.
  linked_annotation_id?: string | null;
  // Backend-served attachment URL when an image is attached. Null otherwise.
  attachment_url?: string | null;
  // The user who placed the annotation. Only the creator (or an admin) may
  // edit/delete it; null for legacy pins created before this was tracked.
  created_by_user_id?: string | null;
  created_at: string;
}

export type AnnotationFlag = 'safety' | 'quality' | 'delayed';
