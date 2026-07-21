/**
 * Turns a raw robot/backend failure string into one plain sentence a non-technical operator
 * can act on. The robot reports failures as Python exception text (ffmpeg output, ROS errors,
 * stack-trace messages), which travels verbatim all the way to the screen. This maps the
 * recognizable ones to human language; anything unmatched falls back to a safe generic line.
 *
 * The raw text is never discarded, callers keep it and show it behind a "technical details"
 * toggle, so this only changes what is shown first, not what is available for debugging.
 */

type Rule = { tokens: string[]; message: string };

// Ordered most-specific first: the first rule whose token appears in the (lowercased) raw
// string wins, so put narrow categories above broad ones.
const RULES: Rule[] = [
  {
    tokens: ['ffmpeg', 'insta360', 'camera', 'panorama', '/dev/video', 'v4l', 'gstreamer', 'sdk'],
    message: "Couldn't take the photo, the camera didn't respond.",
  },
  {
    tokens: ['pointcloud', 'point cloud', 'lidar', 'laz', 'pcd', '3d scan'],
    message: "Couldn't complete the 3D scan.",
  },
  {
    tokens: ['not safe for task', 'health check', 'is not safe', 'costmap', 'health failure'],
    message: "The robot couldn't safely start moving. Check that its path is clear.",
  },
  {
    tokens: ['aborted', 'unreachable', 'could not reach', 'failed to navigate', 'nav goal', 'planner', 'controller', 'no valid path'],
    message: "The robot couldn't reach this point.",
  },
  {
    tokens: ['amcl', 'localiz', 'pose', 'transform', 'tf ', 'could not confirm'],
    message: "The robot couldn't confirm where it is.",
  },
  {
    tokens: ['upload', 'connection', 'network', 'refused', 'ssl', 'http', '502', '503', 'timed out sending', 'sitescope'],
    message: "Couldn't send the capture to SiteScope. Check the connection.",
  },
  {
    tokens: ['one or more', 'task step', 'steps failed'],
    message: 'Some stops on the route could not be captured.',
  },
];

const GENERIC = 'Something went wrong at this stop.';

/** Plain-English version of a raw failure string, or null if there is no failure text. */
export function friendlyError(raw: string | null | undefined): string | null {
  if (!raw || !raw.trim()) return null;
  const text = raw.toLowerCase();
  for (const rule of RULES) {
    if (rule.tokens.some((token) => text.includes(token))) return rule.message;
  }
  return GENERIC;
}

/** True when the raw text carries detail worth exposing behind the toggle. */
export function hasTechnicalDetail(raw: string | null | undefined, friendly: string | null): boolean {
  return Boolean(raw && raw.trim() && raw.trim() !== friendly);
}
