import { describe, it, expect } from 'vitest';
import { parseEdl } from '../../../lib/edl/schema';
import { motionFromEdl, validateComposition, type MotionComposition } from '../../../lib/motion/ir';
import { describeComposition, describeLayer } from '../describe';

/**
 * Golden render-graph tests (CI-safe, no browser). They pin the resolved render
 * description (transform sampling + blend + mask) for representative IR, so any
 * change to the renderer math shows up as a snapshot diff. The optional pixel
 * golden (visual.golden.test.ts, RUN_VISUAL=1) verifies actual frames on top.
 */

const CANVAS = { width: 1280, height: 720, fps: 30 };
const FPS = 30;

// A rich EDL covering every renderable op type.
const RICH_EDL = parseEdl(
  {
    ops: [
      { id: 'c', type: 'caption', start: 0, end: 2, reason: 'hook', style: 'bold_pop' },
      { id: 'z', type: 'zoom_punch', start: 2, end: 3, reason: 'punch', scale: 1.2, focus: 'face' },
      { id: 'lt', type: 'lower_third', start: 3, end: 6, reason: 'name', title: 'Jane', subtitle: 'CEO' },
      { id: 'st', type: 'stat_callout', start: 6, end: 8, reason: 'metric', value: '43%', label: 'growth', position: 'center' },
      { id: 'tc', type: 'title_card', start: 8, end: 10, reason: 'intro', variant: 'intro', heading: 'Q3 Results' },
      { id: 'tr', type: 'transition', start: 10, end: 10.4, reason: 'wipe', variant: 'flash' },
      { id: 'brf', type: 'broll', start: 11, end: 14, reason: 'illustrate', query: 'city', layout: 'full' },
      { id: 'brp', type: 'broll', start: 14, end: 17, reason: 'pip', query: 'laptop', layout: 'pip' },
    ],
  },
  { durationSec: 30 },
).edl;

describe('golden render-graph — EDL→IR compositions', () => {
  const transcript = [
    { word: 'this', start: 0.1, end: 0.4 },
    { word: 'changes', start: 0.4, end: 0.8 },
    { word: 'everything', start: 0.8, end: 1.4 },
  ];
  const { compositions } = motionFromEdl(RICH_EDL, transcript, 30, CANVAS);

  for (const comp of compositions) {
    it(`describes ${comp.metadata?.sourceOpType} (${comp.id}) consistently`, () => {
      const durFrames = Math.round((comp.end - comp.start) * FPS);
      const frames = [0, Math.floor(durFrames / 2), Math.max(0, durFrames - 1)];
      expect(describeComposition(comp, frames, FPS)).toMatchSnapshot();
    });
  }

  it('carries the pip mask through the adapter (rounded_rectangle clip)', () => {
    const pip = compositions.find((c) => c.id === 'comp_brp')!;
    const d = describeLayer(pip.layers[0], 0.5, FPS);
    expect(d.clipPath).toMatch(/inset\(.*round/);
  });
});

describe('golden render-graph — blend + circle mask', () => {
  it('resolves a screen blend and a circular clip', () => {
    const comp: MotionComposition = {
      schemaVersion: '1.0',
      id: 'blend_mask',
      start: 0,
      end: 1,
      timeBasis: 'cut',
      coordinateSpace: 'normalized',
      canvas: CANVAS,
      layers: [
        {
          id: 's1',
          type: 'shape',
          shape: 'rectangle',
          start: 0,
          duration: 1,
          size: [0.5, 0.5],
          fill: '#3b82f6',
          blendMode: 'screen',
          mask: { shape: 'circle', rect: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 } },
          transform: { position: { kind: 'constant', value: [0.5, 0.5, 0] } },
        },
      ],
    };
    expect(validateComposition(comp).ok).toBe(true);
    const d = describeLayer(comp.layers[0], 0, FPS);
    expect(d.blendMode).toBe('screen');
    expect(d.clipPath).toMatch(/^circle\(/);
  });
});

describe('primitive-renderer acceptance — ≥20 compositions, one generic renderer', () => {
  it('builds and validates 20+ varied compositions with no per-composition component', () => {
    // 24 ops (3 each of 8 types) spaced 1s apart -> 24 compositions, all rendered
    // by the single generic LayerRenderer / describe path.
    const types = ['caption', 'zoom_punch', 'lower_third', 'stat_callout', 'title_card', 'transition', 'broll', 'broll'] as const;
    const ops = [] as unknown[];
    let t = 0;
    for (let round = 0; round < 3; round++) {
      for (const type of types) {
        const start = t;
        const end = t + 0.8;
        t += 1;
        const base = { id: `${type}_${round}_${start}`, type, start, end, reason: `r${round}` };
        if (type === 'caption') ops.push({ ...base, style: 'word_highlight' });
        else if (type === 'zoom_punch') ops.push({ ...base, scale: 1.15 });
        else if (type === 'lower_third') ops.push({ ...base, title: `Name ${round}` });
        else if (type === 'stat_callout') ops.push({ ...base, value: `${round}0%` });
        else if (type === 'title_card') ops.push({ ...base, variant: 'intro', heading: `H${round}` });
        else if (type === 'transition') ops.push({ ...base, variant: 'flash' });
        else ops.push({ ...base, query: 'stock', layout: round % 2 ? 'pip' : 'full' });
      }
    }
    const { edl } = parseEdl({ ops }, { durationSec: 60 });
    const { compositions } = motionFromEdl(edl, [], 60, CANVAS);

    expect(compositions.length).toBeGreaterThanOrEqual(20);
    for (const comp of compositions) {
      expect(validateComposition(comp).ok, `comp ${comp.id} invalid`).toBe(true);
      // Every composition is describable by the single generic path (no throw).
      expect(() => describeComposition(comp, [0], FPS)).not.toThrow();
    }
  });
});
