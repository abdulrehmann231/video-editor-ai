import { describe, it, expect } from 'vitest';
import { parseEdl } from '../edl/schema';
import { motionFromEdl, type EffectStyle } from '../motion/ir';

/**
 * Per-effect style overrides (project.effectStyle) make the non-caption overlays
 * (lower-third, stat, title card) dynamic: size, position, colors, fonts.
 */

const CANVAS = { width: 1280, height: 720, fps: 30 };

type Child = { id: string; fill?: string; radius?: number; font?: { size?: number; family?: string }; opacity?: { value?: number }; transform?: { position?: { value?: number[] } } };

function children(opType: string, op: Record<string, unknown>, effectStyle?: EffectStyle): Child[] {
  const { edl } = parseEdl({ ops: [{ id: 'x', type: opType, start: 0, end: 2, reason: 'r', ...op }] }, { durationSec: 5 });
  const { compositions } = motionFromEdl(edl, [], 5, CANVAS, undefined, undefined, effectStyle);
  const group = compositions.find((c) => c.metadata?.sourceOpType === opType)!.layers[0] as unknown as { children: Child[] };
  return group.children;
}

describe('stat (metric_pop) style overrides', () => {
  const stat = (s?: EffectStyle['stat']) => children('stat_callout', { value: '43%', label: 'growth' }, s ? { stat: s } : undefined);

  it('defaults come from the brand', () => {
    const c = stat();
    expect(c.find((x) => x.id.endsWith('_bar'))?.fill).toBe('#ffd60a'); // accent underline bar
    expect(c.find((x) => x.id.endsWith('_val'))?.font?.size).toBe(Math.round(1280 * 0.082));
  });

  it('scale multiplies size; colors + position are dynamic', () => {
    const c = stat({ scale: 1.5, accent: '#00ff00', textColor: '#ff00ff' });
    expect(c.find((x) => x.id.endsWith('_val'))?.font?.size).toBe(Math.round(1280 * 0.082 * 1.5));
    expect(c.find((x) => x.id.endsWith('_bar'))?.fill).toBe('#00ff00'); // accent bar
    expect(c.find((x) => x.id.endsWith('_val'))?.fill).toBe('#ff00ff');

    const corner = stat({ position: 'corner' });
    expect(corner.find((x) => x.id.endsWith('_val'))?.transform?.position?.value?.[0]).toBe(0.8); // corner
  });
});

describe('lower_third style overrides', () => {
  const lt = (s?: EffectStyle['lowerThird']) => children('lower_third', { title: 'Jane', subtitle: 'CEO' }, s ? { lowerThird: s } : undefined);

  it('align moves the block; scale resizes; colors/boxOpacity dynamic', () => {
    const c = lt({ align: 'center', scale: 1.2, accent: '#00ffcc', textColor: '#ffffff', boxColor: '#101820', boxOpacity: 0.4 });
    expect(c.find((x) => x.id.endsWith('_title'))?.transform?.position?.value?.[0]).toBeCloseTo(0.51, 5); // center (+ stripe offset)
    expect(c.find((x) => x.id.endsWith('_title'))?.font?.size).toBe(Math.round(1280 * 0.03 * 1.2));
    expect(c.find((x) => x.id.endsWith('_title'))?.fill).toBe('#ffffff');
    expect(c.find((x) => x.id.endsWith('_sub'))?.fill).toBe('#00ffcc');
    const bg = c.find((x) => x.id.endsWith('_bg'))!;
    expect(bg.fill).toBe('#101820');
    expect(bg.opacity?.value).toBe(0.4);
  });
});

describe('title_card style overrides', () => {
  const tc = (s?: EffectStyle['titleCard']) => children('title_card', { heading: 'Q3', variant: 'intro' }, s ? { titleCard: s } : undefined);

  it('scale/textColor/dim are dynamic', () => {
    const c = tc({ scale: 1.25, textColor: '#00ff00', dim: 0.3 });
    expect(c.find((x) => x.id.endsWith('_head'))?.font?.size).toBe(Math.round(1280 * 0.08 * 1.25));
    expect(c.find((x) => x.id.endsWith('_head'))?.fill).toBe('#00ff00');
    expect(c.find((x) => x.id.endsWith('_cbg'))?.opacity?.value).toBe(0.3);
  });
});
