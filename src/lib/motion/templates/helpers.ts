import type { Animated, AnnotationLayer, CaptionWord, MeterLayer, MotionLayer, ShapeLayer, TextLayer, Vec2, Vec3 } from '../ir/types';
import type { BrandProfile } from '../brand';

/**
 * Pure builder helpers shared by effect templates (and the EDL adapter). Kept
 * dependency-free (no Remotion/theme import) so templates stay renderer-neutral;
 * the palette mirrors src/remotion/theme.ts COLORS.
 */

export const PALETTE = {
  white: '#ffffff',
  ink: '#0b0d12',
  accent: '#ffd60a',
} as const;

/** Context passed to a template's build() so it can size/place/id its layers. */
export interface BuildCtx {
  /** Prefix for layer ids (usually the source op id) — keeps ids stable. */
  idPrefix: string;
  /** Composition duration in seconds. */
  dur: number;
  canvas: { width: number; height: number; fps: number };
  /** Brand colors/fonts; resolveTemplate injects DEFAULT_BRAND when unset. */
  brand?: BrandProfile;
  /** Pipeline-injected structured inputs (not AI-tunable params), e.g. transcript
   * words for kinetic captions and emphasis words. */
  input?: { words?: CaptionWord[]; emphasis?: string[] };
}

export interface TextOpts {
  fill?: string;
  family?: string;
  weight?: number;
  /** Letter-spacing in px. */
  tracking?: number;
  italic?: boolean;
  textCase?: 'upper' | 'lower' | 'none';
  align?: 'left' | 'center' | 'right';
  /** Text outline (stroke) — pass width 0 to disable the default ink outline. */
  stroke?: { color: string; width: number };
}

export const constant = <T>(value: T): Animated<T> => ({ kind: 'constant', value });

/** Fade in over the first ~250ms, then hold. Times clamped to [0, dur]. */
export function fadeIn(dur: number): Animated<number> {
  const mid = Math.min(0.25, dur);
  return {
    kind: 'keyframes',
    keyframes: [
      { time: 0, value: 0, easing: { type: 'easeOut' } },
      { time: mid, value: 1 },
      { time: dur, value: 1 },
    ],
  };
}

/** Spring scale-pop from 0 to `target`. */
export function scalePop(target = 1): Animated<Vec3> {
  return {
    kind: 'spring',
    from: [0, 0, 0],
    value: [target, target, target],
    spring: { mass: 1, stiffness: 180, damping: 16 },
  };
}

/** Punch-in scale 1 -> target (hold) -> 1, keyframed within `dur`. */
export function punchScale(target: number, dur: number): Animated<Vec3> {
  const ramp = Math.min(0.15, dur * 0.3);
  return {
    kind: 'keyframes',
    keyframes: [
      { time: 0, value: [1, 1, 1], easing: { type: 'easeOut' } },
      { time: ramp, value: [target, target, target] },
      { time: Math.max(ramp, dur - ramp), value: [target, target, target] },
      { time: dur, value: [1, 1, 1] },
    ],
  };
}

export function textLayer(
  id: string,
  content: string,
  pos: [number, number],
  size: number,
  dur: number,
  opts: TextOpts = {},
): TextLayer {
  return {
    id,
    type: 'text',
    content,
    start: 0,
    duration: dur,
    opacity: fadeIn(dur),
    transform: { position: constant<Vec3>([pos[0], pos[1], 0]) },
    font: {
      family: opts.family ?? 'Anton',
      weight: opts.weight ?? 800,
      size,
      ...(opts.tracking != null ? { tracking: opts.tracking } : {}),
    },
    align: opts.align ?? 'center',
    fill: opts.fill ?? PALETTE.white,
    ...(opts.italic ? { italic: true } : {}),
    ...(opts.textCase ? { textCase: opts.textCase } : {}),
    ...(opts.stroke ? { stroke: opts.stroke } : {}),
  };
}

export function shapeLayer(
  id: string,
  extra: Omit<ShapeLayer, 'id' | 'type' | 'start' | 'duration'>,
  dur: number,
): ShapeLayer {
  return { id, type: 'shape', start: 0, duration: dur, ...extra };
}

/** Slide + fade a layer up into place over ~220ms (subtle, professional). */
export function slideUp(dur: number, from = 0.03): Animated<Vec3> {
  const t = Math.min(0.22, dur);
  return {
    kind: 'keyframes',
    keyframes: [
      { time: 0, value: [0, from, 0], easing: { type: 'back', amount: 1.4 } },
      { time: t, value: [0, 0, 0] },
      { time: dur, value: [0, 0, 0] },
    ],
  };
}

export function annotationLayer(
  id: string,
  extra: Omit<AnnotationLayer, 'id' | 'type' | 'start' | 'duration'>,
  dur: number,
  start = 0,
): AnnotationLayer {
  return { id, type: 'annotation', start, duration: Math.max(0.1, dur - start), ...extra };
}

/** Shift a layer to reveal at `start`, clamping its duration so its window never
 * exceeds the composition (the validator rejects overflow). */
export function reveal<T extends MotionLayer>(layer: T, start: number): T {
  return { ...layer, start, duration: Math.max(0.1, layer.duration - start) };
}

export function meterLayer(
  id: string,
  extra: Omit<MeterLayer, 'id' | 'type' | 'start' | 'duration'>,
  dur: number,
  start = 0,
): MeterLayer {
  return { id, type: 'meter', start, duration: Math.max(0.1, dur - start), ...extra };
}

export type { Vec2 };

/** Convenience for templates that build nothing visible (e.g. camera-only). */
export const NO_LAYERS: MotionLayer[] = [];
