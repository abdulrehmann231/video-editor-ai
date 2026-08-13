import { describe, it, expect } from 'vitest';
import { TEMPLATE_IDS, getTemplate, resolveTemplate, clampParams, validateComposition, type MotionComposition } from '../motion/ir';

/**
 * Phase 3 — effect template registry + compiler. Templates are the reusable,
 * parameterized effects the AI selects (it only emits { templateId, params });
 * params are clamped before the deterministic build() runs.
 */

const CTX = { idPrefix: 'x', dur: 2, canvas: { width: 1280, height: 720, fps: 30 } };

describe('template registry', () => {
  it('registers the migrated effects', () => {
    for (const id of ['kinetic_text', 'camera_punch', 'lower_third', 'metric_pop', 'title_card', 'transition', 'broll']) {
      expect(TEMPLATE_IDS).toContain(id);
      expect(getTemplate(id)).toBeDefined();
    }
  });
});

describe('clampParams', () => {
  it('clamps numbers to their declared range', () => {
    const t = getTemplate('camera_punch')!;
    expect(clampParams(t, { scale: 5 }).scale).toBe(1.6); // max
    expect(clampParams(t, { scale: 1.0 }).scale).toBe(1.02); // min
  });

  it('applies defaults for missing params', () => {
    const t = getTemplate('camera_punch')!;
    expect(clampParams(t, {}).scale).toBe(1.15);
    expect(clampParams(t, {}).focus).toBe('center');
  });

  it('coerces an invalid enum back to the default', () => {
    const t = getTemplate('metric_pop')!;
    expect(clampParams(t, { position: 'sideways' }).position).toBe('center');
  });

  it('validates color params (hex only); brand supplies the fallback at build time', () => {
    const t = getTemplate('metric_pop')!;
    expect(clampParams(t, {}).accent).toBeUndefined(); // no static default -> inherit brand
    expect(clampParams(t, { accent: 'reddish' }).accent).toBeUndefined(); // invalid -> undefined
    expect(clampParams(t, { accent: '#6D5DFB' }).accent).toBe('#6D5DFB'); // valid passes
    // With no accent param, the built layer uses the default brand accent.
    const { layers } = resolveTemplate('metric_pop', { value: '9%' }, CTX);
    const g = layers[0] as { children: { id: string; fill?: string }[] };
    expect(g.children.find((c) => c.id.endsWith('_bar'))?.fill).toBe('#ffd60a');
  });

  it('clamps a fractional size param', () => {
    const t = getTemplate('kinetic_text')!;
    expect(clampParams(t, { size: 0.99 }).size).toBe(0.15); // max
    expect(clampParams(t, { size: 0.001 }).size).toBe(0.02); // min
  });
});

describe('resolveTemplate', () => {
  it('builds a metric_pop group containing the value text', () => {
    const { layers, camera } = resolveTemplate('metric_pop', { value: '43%', label: 'growth' }, CTX);
    expect(camera).toBeUndefined();
    expect(layers[0].type).toBe('group');
    const group = layers[0] as { children: { type: string; content?: string }[] };
    expect(group.children.some((c) => c.type === 'text' && c.content === '43%')).toBe(true);
  });

  it('builds a camera (no overlay layers) for camera_punch', () => {
    const { layers, camera } = resolveTemplate('camera_punch', { scale: 1.3, focus: 'face' }, CTX);
    expect(layers).toHaveLength(0);
    expect(camera?.scale).toBeDefined();
    expect(camera?.focus).toBe('face');
  });

  it('builds a transition layer honoring the variant (and coercing bad variants)', () => {
    const glitch = resolveTemplate('transition', { variant: 'glitch' }, CTX);
    expect(glitch.layers[0].type).toBe('transition');
    expect((glitch.layers[0] as { variant?: string }).variant).toBe('glitch');
    const bad = resolveTemplate('transition', { variant: 'bogus' }, CTX);
    expect((bad.layers[0] as { variant?: string }).variant).toBe('flash'); // default
  });

  it('threads a brand accent color into metric_pop', () => {
    const { layers } = resolveTemplate('metric_pop', { value: '3x', accent: '#6D5DFB' }, CTX);
    const group = layers[0] as { children: { id: string; fill?: string }[] };
    const accentShape = group.children.find((c) => c.id.endsWith('_bar'));
    expect(accentShape?.fill).toBe('#6D5DFB');
  });

  it('returns a warning (not throw) for an unknown template', () => {
    const res = resolveTemplate('does_not_exist', {}, CTX);
    expect(res.layers).toHaveLength(0);
    expect(res.warnings.length).toBe(1);
  });

  it('produces layers that pass validation when wrapped in a composition', () => {
    const { layers } = resolveTemplate('lower_third', { title: 'Jane', subtitle: 'CEO' }, CTX);
    const comp: MotionComposition = {
      schemaVersion: '1.0',
      id: 'c',
      start: 0,
      end: CTX.dur,
      timeBasis: 'cut',
      coordinateSpace: 'normalized',
      canvas: CTX.canvas,
      layers,
    };
    expect(validateComposition(comp).ok).toBe(true);
  });
});

// deep-collect every layer (through group children) for assertions.
function flatten(layers: { type: string; children?: unknown[] }[]): { type: string; [k: string]: unknown }[] {
  const out: { type: string; [k: string]: unknown }[] = [];
  for (const l of layers as { type: string; children?: unknown[] }[]) {
    out.push(l as { type: string });
    if (Array.isArray(l.children)) out.push(...flatten(l.children as { type: string; children?: unknown[] }[]));
  }
  return out;
}

function wrap(layers: MotionComposition['layers']): MotionComposition {
  return { schemaVersion: '1.0', id: 'c', start: 0, end: CTX.dur, timeBasis: 'cut', coordinateSpace: 'normalized', canvas: CTX.canvas, layers };
}

describe('vault effect templates', () => {
  it('registers the new vault templates', () => {
    for (const id of ['annotate', 'name_tag', 'checklist', 'comparison', 'stack_list', 'progress']) {
      expect(TEMPLATE_IDS).toContain(id);
    }
  });

  it('checklist renders bold-italic rows with bright check/cross marks (no dark card)', () => {
    const { layers } = resolveTemplate('checklist', { items: [{ text: 'EXPERTISE', mark: 'check' }, { text: 'LABOUR', mark: 'cross' }] }, CTX);
    const all = flatten(layers);
    const texts = all.filter((l) => l.type === 'text');
    expect(texts.some((t) => t.content === 'EXPERTISE' && t.italic === true)).toBe(true);
    const marks = all.filter((l) => l.type === 'annotation');
    expect(marks.map((m) => m.annotation).sort()).toEqual(['checkmark', 'cross']);
    // green check + red cross
    expect(marks.find((m) => m.annotation === 'checkmark')?.color).toBe('#28d17c');
    expect(marks.find((m) => m.annotation === 'cross')?.color).toBe('#ff3b30');
    expect(validateComposition(wrap(layers)).ok).toBe(true);
  });

  it('stack_list builds one row per item, staggered, and validates', () => {
    const { layers } = resolveTemplate('stack_list', { items: ['ALPHA', 'BETA', 'GAMMA'], variant: 'number' }, CTX);
    const all = flatten(layers);
    // number variant → a numbered badge + index text + row text per item
    expect(all.filter((l) => l.type === 'text' && l.content === '1').length).toBe(1);
    expect(all.filter((l) => l.type === 'text' && ['ALPHA', 'BETA', 'GAMMA'].includes(l.content as string)).length).toBe(3);
    // rows reveal in sequence (increasing start times)
    const rowTexts = all.filter((l) => l.type === 'text' && ['ALPHA', 'BETA', 'GAMMA'].includes(l.content as string));
    expect((rowTexts[1].start as number) > (rowTexts[0].start as number)).toBe(true);
    expect(validateComposition(wrap(layers)).ok).toBe(true);
  });

  it('progress builds a meter layer per variant with the right fill/value', () => {
    // The template param is `value` (EDL maps op.amount→value); pass it directly.
    const barRes = resolveTemplate('progress', { variant: 'bar', value: 70 }, CTX);
    const meter = flatten(barRes.layers).find((l) => l.type === 'meter');
    expect(meter?.variant).toBe('bar');
    expect(meter?.value).toBeCloseTo(0.7); // 70% -> 0..1 fill
    const counter = flatten(resolveTemplate('progress', { variant: 'counter', value: 14, from: 23 }, CTX).layers).find((l) => l.type === 'meter');
    expect(counter?.value).toBe(14);
    expect(counter?.from).toBe(23);
    expect(validateComposition(wrap(barRes.layers)).ok).toBe(true);
  });

  it('progress supports timeline/scale/slider with ticks + end labels', () => {
    const tl = resolveTemplate('progress', { variant: 'timeline', value: 60, ticks: [{ label: 'A', at: 0 }, { label: 'B', at: 0.5 }, { at: 1.5 }] }, CTX);
    const meter = flatten(tl.layers).find((l) => l.type === 'meter') as { variant?: string; ticks?: { at: number }[]; value?: number } | undefined;
    expect(meter?.variant).toBe('timeline');
    expect(meter?.value).toBeCloseTo(0.6);
    expect(meter?.ticks?.length).toBe(3);
    expect(meter?.ticks?.[2].at).toBeCloseTo(0.015); // 1.5 treated as percent -> clamped/scaled
    const sc = resolveTemplate('progress', { variant: 'scale', value: 72, minLabel: '$', maxLabel: '$$$' }, CTX);
    const m2 = flatten(sc.layers).find((l) => l.type === 'meter') as { minLabel?: string; maxLabel?: string } | undefined;
    expect(m2?.minLabel).toBe('$');
    expect(m2?.maxLabel).toBe('$$$');
    expect(validateComposition(wrap(tl.layers)).ok).toBe(true);
    expect(validateComposition(wrap(sc.layers)).ok).toBe(true);
  });

  it('chart parses data into a chart layer and validates (bar/line/donut)', () => {
    for (const variant of ['bar', 'line', 'area', 'donut']) {
      const { layers } = resolveTemplate('chart', { variant, data: [{ label: 'A', value: 10 }, { label: 'B', value: 20 }, { label: 'C', value: 15 }] }, CTX);
      const chart = flatten(layers).find((l) => l.type === 'chart');
      expect(chart, variant).toBeDefined();
      expect(chart!.variant).toBe(variant);
      expect((chart!.data as unknown[]).length).toBe(3);
      expect(validateComposition(wrap(layers)).ok, variant).toBe(true);
    }
  });

  it('chart drops malformed data points but keeps valid ones', () => {
    const { layers } = resolveTemplate('chart', { variant: 'bar', data: [{ label: 'A', value: 10 }, { label: 'B' }, 'junk', { value: 5 }] }, CTX);
    const chart = flatten(layers).find((l) => l.type === 'chart');
    expect((chart!.data as unknown[]).length).toBe(2); // A(10) + the {value:5}
  });

  it('is portrait-aware: comparison stacks vertically + fonts scale up on 9:16', () => {
    const PORTRAIT = { idPrefix: 'p', dur: 2, canvas: { width: 720, height: 1280, fps: 30 } };
    const land = flatten(resolveTemplate('comparison', { leftTitle: 'A', rightTitle: 'B', leftItems: ['x'], rightItems: ['y'] }, CTX).layers);
    const port = flatten(resolveTemplate('comparison', { leftTitle: 'A', rightTitle: 'B', leftItems: ['x'], rightItems: ['y'] }, PORTRAIT).layers);
    const bgX = (ls: typeof land, id: string) => (ls.find((l) => typeof l.id === 'string' && l.id.endsWith(id)) as { transform?: { position?: { value?: number[] } } }).transform?.position?.value?.[0];
    // landscape: panels side-by-side (different x); portrait: stacked (same x = 0.5)
    expect(bgX(land, '_L_bg')).not.toBeCloseTo(bgX(land, '_R_bg')!, 2);
    expect(bgX(port, '_L_bg')).toBeCloseTo(0.5, 2);
    expect(bgX(port, '_R_bg')).toBeCloseTo(0.5, 2);
    // checklist row font is a larger FRACTION of width in portrait (fs=1.5) so it
    // reads on a tall 9:16 frame (absolute px is smaller because the frame is narrower).
    const rowFontFrac = (ctx: typeof CTX) => (flatten(resolveTemplate('checklist', { items: [{ text: 'HELLO', mark: 'check' }] }, ctx).layers).find((l) => l.type === 'text' && l.content === 'HELLO') as { font?: { size?: number } }).font!.size! / ctx.canvas.width;
    expect(rowFontFrac(PORTRAIT)).toBeGreaterThan(rowFontFrac(CTX) * 1.3);
  });

  it('illustration builds a square, tinted, animated illustration layer', () => {
    const { layers } = resolveTemplate('illustration', { name: 'rocket', label: 'LAUNCH', position: 'left', size: 'large', animate: 'float' }, CTX);
    const illo = flatten(layers).find((l) => l.type === 'illustration') as { name?: string; label?: string; animate?: string; size?: number[] } | undefined;
    expect(illo?.name).toBe('rocket');
    expect(illo?.label).toBe('LAUNCH');
    expect(illo?.animate).toBe('float');
    // size is kept square in pixels: sizeX*W === sizeY*H
    expect(illo!.size![0] * CTX.canvas.width).toBeCloseTo(illo!.size![1] * CTX.canvas.height, 3);
    expect(validateComposition(wrap(layers)).ok).toBe(true);
  });

  it('illustration coerces an unknown name via the enum default (never crashes)', () => {
    const { layers } = resolveTemplate('illustration', { name: 'not_a_real_illo' }, CTX);
    const illo = flatten(layers).find((l) => l.type === 'illustration') as { name?: string } | undefined;
    expect(illo?.name).toBe('lightbulb'); // enum default (renderer also has a fallback)
    expect(validateComposition(wrap(layers)).ok).toBe(true);
  });

  it('comparison reveals two toned columns with directional arrows', () => {
    const { layers } = resolveTemplate('comparison', { leftTitle: 'YOU', rightTitle: 'THEM', leftItems: ['a'], rightItems: ['b'], leftTone: 'bad', rightTone: 'good' }, CTX);
    const all = flatten(layers);
    const arrows = all.filter((l) => l.type === 'annotation' && l.annotation === 'arrow');
    expect(arrows.length).toBe(2);
    expect(validateComposition(wrap(layers)).ok).toBe(true);
  });
});
