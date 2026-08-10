import { describe, it, expect } from 'vitest';
import {
  IR_VERSION,
  parseMotionComposition,
  validateComposition,
  type MotionComposition,
} from '../motion/ir';

/**
 * Phase 1 — Motion Graphics IR foundation.
 * These tests lock the contract for the IR schema parser + semantic validator.
 * Nothing here touches the render path; the IR is data-only in Phase 1.
 */

/** A minimal, fully-valid composition used as the base for mutation tests. */
function validComp(): MotionComposition {
  return {
    schemaVersion: IR_VERSION,
    id: 'c1',
    start: 0,
    end: 2,
    timeBasis: 'cut',
    coordinateSpace: 'normalized',
    canvas: { width: 1280, height: 720, fps: 30 },
    layers: [
      {
        id: 'l1',
        type: 'text',
        content: '43%',
        start: 0,
        duration: 2,
        opacity: { kind: 'constant', value: 1 },
        transform: {
          position: { kind: 'constant', value: [0.5, 0.5, 0] },
          scale: {
            kind: 'spring',
            from: [0, 0, 0],
            value: [1, 1, 1],
            spring: { mass: 1, stiffness: 180, damping: 16 },
          },
        },
        font: { family: 'Anton', weight: 800, size: 96 },
        align: 'center',
        fill: '#ffffff',
      },
    ],
  };
}

describe('parseMotionComposition', () => {
  it('parses a well-formed composition with no warnings', () => {
    const { comp, warnings } = parseMotionComposition(validComp());
    expect(warnings).toHaveLength(0);
    expect(comp.schemaVersion).toBe(IR_VERSION);
    expect(comp.layers).toHaveLength(1);
    expect(comp.layers[0].type).toBe('text');
  });

  it('drops an individually-invalid layer with a warning (self-healing, like parseEdl)', () => {
    const raw = validComp() as unknown as { layers: unknown[] };
    raw.layers = [
      raw.layers[0],
      // unknown shape enum value -> this layer fails, but the comp survives
      { id: 'bad', type: 'shape', shape: 'triangle', start: 0, duration: 1 },
    ];
    const { comp, warnings } = parseMotionComposition(raw);
    expect(comp.layers).toHaveLength(1);
    expect(warnings.length).toBe(1);
  });

  it('throws when the top-level composition shape is invalid', () => {
    expect(() => parseMotionComposition({ id: 'x' })).toThrow();
  });

  it('round-trips a bezier easing on a keyframe', () => {
    const c = validComp();
    c.layers[0].transform = {
      position: {
        kind: 'keyframes',
        keyframes: [
          { time: 0, value: [0, 0, 0], easing: { type: 'bezier', x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 } },
          { time: 1, value: [0.5, 0.5, 0] },
        ],
      },
    };
    const { comp } = parseMotionComposition(c);
    const kf = comp.layers[0].transform?.position?.keyframes?.[0];
    expect(kf?.easing).toMatchObject({ type: 'bezier', x1: 0.25, y2: 1 });
  });
});

describe('validateComposition', () => {
  it('accepts a valid composition', () => {
    const res = validateComposition(validComp());
    expect(res.errors).toHaveLength(0);
    expect(res.ok).toBe(true);
  });

  it('flags start >= end', () => {
    const c = validComp();
    c.end = c.start;
    const res = validateComposition(c);
    expect(res.ok).toBe(false);
  });

  it('flags opacity outside [0,1]', () => {
    const c = validComp();
    c.layers[0].opacity = { kind: 'constant', value: 1.5 };
    const res = validateComposition(c);
    expect(res.ok).toBe(false);
  });

  it('flags a scale outside safe bounds', () => {
    const c = validComp();
    c.layers[0].transform = { scale: { kind: 'constant', value: [999, 999, 1] } };
    const res = validateComposition(c);
    expect(res.ok).toBe(false);
  });

  it('flags a layer whose window exceeds the composition duration', () => {
    const c = validComp();
    c.layers[0].duration = 5; // comp is only 2s long
    const res = validateComposition(c);
    expect(res.ok).toBe(false);
  });

  it('flags a parentId cycle', () => {
    const c = validComp();
    c.layers = [
      { id: 'a', type: 'text', content: 'A', start: 0, duration: 2, parentId: 'b' },
      { id: 'b', type: 'text', content: 'B', start: 0, duration: 2, parentId: 'a' },
    ];
    const res = validateComposition(c);
    expect(res.ok).toBe(false);
  });

  it('flags an unresolved assetId reference', () => {
    const c = validComp();
    c.layers = [{ id: 'v', type: 'video', assetId: 'missing', start: 0, duration: 2 }];
    const res = validateComposition(c);
    expect(res.ok).toBe(false);
  });

  it('flags an invalid background color', () => {
    const c = validComp();
    c.background = 'not-a-color';
    const res = validateComposition(c);
    expect(res.ok).toBe(false);
  });
});
