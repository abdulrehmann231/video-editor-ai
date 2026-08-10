import { interpolate, spring } from 'remotion';
import { toRemotionEasing } from './easing';
import type { Animated, Vec3 } from '../../../lib/motion/ir/types';

/**
 * Sample Animated<T> values at a given frame (layer-relative). Supports the
 * Phase-1 kinds: constant | keyframes | spring. Reuses Remotion's interpolate /
 * spring so motion matches the rest of the app.
 */

function springProgress(cfg: Animated<unknown>['spring'], frame: number, fps: number): number {
  return spring({
    frame,
    fps,
    from: 0,
    to: 1,
    config: cfg ? { mass: cfg.mass, stiffness: cfg.stiffness, damping: cfg.damping } : undefined,
  });
}

function sampleNumberKeyframes(kfs: NonNullable<Animated<number>['keyframes']>, frame: number, fps: number, fallback: number): number {
  if (kfs.length === 0) return fallback;
  const t = frame / fps;
  if (t <= kfs[0].time) return kfs[0].value;
  const last = kfs[kfs.length - 1];
  if (t >= last.time) return last.value;
  for (let i = 0; i < kfs.length - 1; i++) {
    const a = kfs[i];
    const b = kfs[i + 1];
    if (t >= a.time && t <= b.time) {
      if (b.time <= a.time) return b.value; // guard duplicate/zero-length segment
      return interpolate(t, [a.time, b.time], [a.value, b.value], {
        easing: toRemotionEasing(a.easing),
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
    }
  }
  return last.value;
}

export function sampleNumber(a: Animated<number> | undefined, frame: number, fps: number, fallback: number): number {
  if (!a) return fallback;
  switch (a.kind) {
    case 'constant':
      return typeof a.value === 'number' ? a.value : fallback;
    case 'keyframes':
      return a.keyframes ? sampleNumberKeyframes(a.keyframes, frame, fps, fallback) : fallback;
    case 'spring': {
      const from = typeof a.from === 'number' ? a.from : 0;
      const to = typeof a.value === 'number' ? a.value : fallback;
      return from + (to - from) * springProgress(a.spring, frame, fps);
    }
    default:
      return fallback;
  }
}

export function sampleVec3(a: Animated<Vec3> | undefined, frame: number, fps: number, fallback: Vec3): Vec3 {
  if (!a) return fallback;
  switch (a.kind) {
    case 'constant':
      return Array.isArray(a.value) ? a.value : fallback;
    case 'keyframes': {
      if (!a.keyframes || a.keyframes.length === 0) return fallback;
      const t = frame / fps;
      const kfs = a.keyframes;
      if (t <= kfs[0].time) return kfs[0].value;
      const last = kfs[kfs.length - 1];
      if (t >= last.time) return last.value;
      for (let i = 0; i < kfs.length - 1; i++) {
        const ka = kfs[i];
        const kb = kfs[i + 1];
        if (t >= ka.time && t <= kb.time) {
          if (kb.time <= ka.time) return kb.value;
          const ease = toRemotionEasing(ka.easing);
          const opts = { easing: ease, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
          return [
            interpolate(t, [ka.time, kb.time], [ka.value[0], kb.value[0]], opts),
            interpolate(t, [ka.time, kb.time], [ka.value[1], kb.value[1]], opts),
            interpolate(t, [ka.time, kb.time], [ka.value[2], kb.value[2]], opts),
          ];
        }
      }
      return last.value;
    }
    case 'spring': {
      const from: Vec3 = Array.isArray(a.from) ? a.from : [0, 0, 0];
      const to: Vec3 = Array.isArray(a.value) ? a.value : fallback;
      const p = springProgress(a.spring, frame, fps);
      return [from[0] + (to[0] - from[0]) * p, from[1] + (to[1] - from[1]) * p, from[2] + (to[2] - from[2]) * p];
    }
    default:
      return fallback;
  }
}
