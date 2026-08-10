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
    expect(g.children.find((c) => c.id.endsWith('_accent'))?.fill).toBe('#ffd60a');
  });

  it('clamps a fractional size param', () => {
    const t = getTemplate('kinetic_text')!;
    expect(clampParams(t, { size: 0.99 }).size).toBe(0.1); // max
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
    const accentShape = group.children.find((c) => c.id.endsWith('_accent'));
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
