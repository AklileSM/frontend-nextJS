/**
 * Delayed-interpolation buffer for the live robot marker.
 *
 * Telemetry frames arrive as discrete network events (5–10 Hz on a good day, with WAN
 * jitter), but the marker renders at 60fps. Drawing each frame the moment it arrives is
 * what made the robot teleport across the map. Instead the renderer asks for the pose as
 * of a moment slightly in the past, and this buffer answers by interpolating between the
 * two real samples that straddle that moment — the same entity-interpolation technique
 * multiplayer games use. As long as the delay exceeds the gap between frames, motion is
 * continuous no matter how unevenly the frames arrive.
 *
 * Timestamps are client receive times, so server/robot clock skew cannot bend the result.
 * The buffer never extrapolates: past the newest real sample it holds position, and the
 * staleness banner takes over from there.
 */

export type TweenPose = { x: number; y: number; z: number; yaw: number | null };
type Sample = TweenPose & { t: number };

/** How far behind real time the marker renders. Must exceed one frame interval. */
export const INTERPOLATION_DELAY_MS = 350;
const BUFFER_LIMIT = 64;

export type PoseTween = {
  push: (pose: TweenPose, t?: number) => void;
  sample: (now?: number) => TweenPose | null;
  clear: () => void;
};

function lerp(a: number, b: number, k: number): number {
  return a + (b - a) * k;
}

/** Shortest-arc blend so a heading crossing ±π does not spin the marker the long way. */
function lerpYaw(a: number | null, b: number | null, k: number): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;
}

export function createPoseTween(): PoseTween {
  let samples: Sample[] = [];

  return {
    push(pose: TweenPose, t: number = performance.now()) {
      const last = samples[samples.length - 1];
      if (last && t <= last.t) return;
      samples.push({ ...pose, t });
      if (samples.length > BUFFER_LIMIT) samples = samples.slice(-BUFFER_LIMIT);
    },

    sample(now: number = performance.now()): TweenPose | null {
      if (samples.length === 0) return null;
      const target = now - INTERPOLATION_DELAY_MS;
      const newest = samples[samples.length - 1];
      if (target >= newest.t) return newest;
      if (target <= samples[0].t) return samples[0];

      let after = samples.length - 1;
      while (after > 0 && samples[after - 1].t > target) after -= 1;
      const b = samples[after];
      const a = samples[after - 1];
      const k = (target - a.t) / Math.max(1, b.t - a.t);
      return {
        x: lerp(a.x, b.x, k),
        y: lerp(a.y, b.y, k),
        z: lerp(a.z, b.z, k),
        yaw: lerpYaw(a.yaw, b.yaw, k),
      };
    },

    clear() {
      samples = [];
    },
  };
}
