import { describe, it, expect } from 'vitest';
import { sampleNumber, sampleVec3 } from '../anim/resolveAnimated';
import { toRemotionEasing } from '../anim/easing';
import type { Animated, Vec3 } from '../../../lib/motion/ir/types';

/**
 * Phase 1.5/2 — the animation sampler that the generic Motion renderer uses to
 * evaluate Animated<T> values at a given frame. Runs in the Remotion bundle but
 * is pure enough to unit-test in node.
 */

const FPS = 30;

describe('sampleNumber', () => {
  it('returns the fallback when undefined', () => {
    expect(sampleNumber(undefined, 0, FPS, 0.7)).toBe(0.7);
  });

  it('returns the constant value', () => {
    const a: Animated<number> = { kind: 'constant', value: 0.5 };
    expect(sampleNumber(a, 15, FPS, 1)).toBe(0.5);
  });

  it('interpolates keyframes and clamps outside the range', () => {
    const a: Animated<number> = {
      kind: 'keyframes',
      keyframes: [
        { time: 0, value: 0 },
        { time: 1, value: 10 },
      ],
    };
    expect(sampleNumber(a, 0, FPS, 0)).toBeCloseTo(0, 3);
    expect(sampleNumber(a, 15, FPS, 0)).toBeCloseTo(5, 1); // 0.5s -> ~5
    expect(sampleNumber(a, 60, FPS, 0)).toBeCloseTo(10, 3); // past last -> clamped
  });

  it('springs from `from` toward `value`', () => {
    const a: Animated<number> = {
      kind: 'spring',
      from: 0,
      value: 100,
      spring: { mass: 1, stiffness: 100, damping: 10 },
    };
    expect(sampleNumber(a, 0, FPS, 0)).toBeCloseTo(0, 0); // starts near `from`
    expect(sampleNumber(a, 15, FPS, 0)).toBeGreaterThan(10); // moves toward target
  });
});

describe('sampleVec3', () => {
  it('returns the fallback when undefined', () => {
    expect(sampleVec3(undefined, 0, FPS, [1, 1, 1])).toEqual([1, 1, 1]);
  });

  it('returns a constant vector', () => {
    const a: Animated<Vec3> = { kind: 'constant', value: [1, 2, 3] };
    expect(sampleVec3(a, 10, FPS, [0, 0, 0])).toEqual([1, 2, 3]);
  });

  it('interpolates each component of keyframed vectors', () => {
    const a: Animated<Vec3> = {
      kind: 'keyframes',
      keyframes: [
        { time: 0, value: [0, 0, 0] },
        { time: 1, value: [10, 20, 0] },
      ],
    };
    const v = sampleVec3(a, 15, FPS, [0, 0, 0]);
    expect(v[0]).toBeCloseTo(5, 1);
    expect(v[1]).toBeCloseTo(10, 1);
  });
});

describe('toRemotionEasing', () => {
  it('maps each easing type to a callable', () => {
    for (const e of [
      { type: 'linear' },
      { type: 'easeIn' },
      { type: 'easeOut' },
      { type: 'easeInOut' },
      { type: 'bezier', x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 },
      { type: 'back', amount: 1.5 },
      { type: 'elastic', amplitude: 1, period: 0.3 },
    ] as const) {
      const fn = toRemotionEasing(e);
      expect(typeof fn(0.5)).toBe('number');
    }
  });

  it('defaults to linear-ish when undefined', () => {
    const fn = toRemotionEasing(undefined);
    expect(fn(0)).toBeCloseTo(0, 3);
    expect(fn(1)).toBeCloseTo(1, 3);
  });
});
