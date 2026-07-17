import type { ApiRobotMap } from '@/types/api';

/** A point on the map image, normalised to 0..1 on both axes. */
export type MapMarker = {
  x: number;
  y: number;
  yaw?: number | null;
};

/** Normalised image coordinates → the robot's metric map frame. */
export function normalizedToMapPose(
  robotMap: ApiRobotMap,
  marker: { x: number; y: number },
): { x: number; y: number } {
  const pixelX = marker.x * robotMap.width;
  const pixelY = marker.y * robotMap.height;
  const localX = pixelX * robotMap.resolution;
  const localY = (robotMap.height - pixelY) * robotMap.resolution;
  const cos = Math.cos(robotMap.origin_yaw);
  const sin = Math.sin(robotMap.origin_yaw);
  return {
    x: robotMap.origin_x + localX * cos - localY * sin,
    y: robotMap.origin_y + localX * sin + localY * cos,
  };
}

/** The robot's metric map frame → normalised image coordinates. */
export function mapPoseToNormalized(
  robotMap: ApiRobotMap,
  pose: { x: number; y: number; yaw?: number | null },
): MapMarker {
  const dx = pose.x - robotMap.origin_x;
  const dy = pose.y - robotMap.origin_y;
  const cos = Math.cos(robotMap.origin_yaw);
  const sin = Math.sin(robotMap.origin_yaw);
  const localX = dx * cos + dy * sin;
  const localY = -dx * sin + dy * cos;
  const pixelX = localX / robotMap.resolution;
  const pixelY = robotMap.height - localY / robotMap.resolution;
  return {
    x: pixelX / robotMap.width,
    y: pixelY / robotMap.height,
    yaw: pose.yaw === null || pose.yaw === undefined ? null : pose.yaw - robotMap.origin_yaw,
  };
}

export function visibleMarker(marker: MapMarker | null): marker is MapMarker {
  return Boolean(marker && marker.x >= 0 && marker.x <= 1 && marker.y >= 0 && marker.y <= 1);
}

export function radiansToDegrees(value: number): number {
  return Math.round((value * 180) / Math.PI);
}

/** Timestamps arrive without a zone marker in places; assume UTC rather than local. */
export function parseUtcTimestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const normalized = /(?:z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : `${value}Z`;
  const timestamp = new Date(normalized).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function timestampAgeSeconds(value: string | null | undefined, nowMs: number): number | null {
  const timestamp = parseUtcTimestamp(value);
  if (timestamp === null) return null;
  return Math.max(0, (nowMs - timestamp) / 1000);
}
