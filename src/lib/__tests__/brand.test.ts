import { describe, it, expect } from 'vitest';
import { parseEdl } from '../edl/schema';
import { motionFromEdl, resolveTemplate, DEFAULT_BRAND, type BrandProfile } from '../motion/ir';

/**
 * Brand profile + dynamic caption styling. Templates read colors/fonts from the
 * brand (falling back to DEFAULT_BRAND which mirrors the legacy palette), and
 * captions expose size/placement/tracking/font/color params.
 */

const CANVAS = { width: 1280, height: 720, fps: 30 };
const CTX = { idPrefix: 'x', dur: 2, canvas: CANVAS };

const BRAND: BrandProfile = {
  colors: { primary: '#111111', secondary: '#222222', accent: '#00ff00', background: '#000000', text: '#ff00ff' },
  fonts: { heading: 'Oswald', body: 'Roboto' },
};

type AnyLayer = { id: string; fill?: string; font?: { family?: string; size?: number; tracking?: number }; transform?: { position?: { value?: number[] } }; children?: AnyLayer[] };

describe('DEFAULT_BRAND', () => {
  it('mirrors the legacy palette (no visual regression at defaults)', () => {
    expect(DEFAULT_BRAND.colors.accent).toBe('#ffd60a');
    expect(DEFAULT_BRAND.colors.text).toBe('#ffffff');
    expect(DEFAULT_BRAND.colors.background).toBe('#0b0d12');
    expect(DEFAULT_BRAND.fonts.heading).toBe('Anton');
  });
});

describe('brand-driven templates', () => {
  it('lower_third uses brand text/accent/background/font', () => {
    const { layers } = resolveTemplate('lower_third', { title: 'Jane', subtitle: 'CEO' }, { ...CTX, brand: BRAND });
    const g = layers[0] as AnyLayer;
    const title = g.children!.find((c) => c.id.endsWith('_title'))!;
    const sub = g.children!.find((c) => c.id.endsWith('_sub'))!;
    const bg = g.children!.find((c) => c.id.endsWith('_bg'))!;
    expect(title.fill).toBe('#ff00ff'); // brand text
    expect(title.font?.family).toBe('Oswald'); // brand heading
    expect(sub.fill).toBe('#00ff00'); // brand accent
    expect(bg.fill).toBe('#000000'); // brand background
  });

  it('an explicit param still overrides the brand', () => {
    const { layers } = resolveTemplate('metric_pop', { value: '3x', accent: '#123456' }, { ...CTX, brand: BRAND });
    const g = layers[0] as AnyLayer;
    expect(g.children!.find((c) => c.id.endsWith('_accent'))?.fill).toBe('#123456');
  });
});

describe('dynamic caption styling (kinetic_text)', () => {
  const cap = (params: Record<string, unknown>) => resolveTemplate('kinetic_text', { text: 'hi', ...params }, CTX).layers[0] as AnyLayer;

  it('defaults to a smaller size than before (0.042 of width)', () => {
    expect(cap({}).font?.size).toBe(Math.round(1280 * 0.042)); // 54 (was 64)
    expect(cap({}).font!.size!).toBeLessThan(64);
  });

  it('honors size / tracking / fontFamily / fill params', () => {
    const c = cap({ size: 0.1, tracking: 12, fontFamily: 'Oswald', fill: '#00ff00' });
    expect(c.font?.size).toBe(128);
    expect(c.font?.tracking).toBe(12);
    expect(c.font?.family).toBe('Oswald');
    expect(c.fill).toBe('#00ff00');
  });

  it('maps placement to a vertical position', () => {
    expect(cap({ placement: 'lower' }).transform?.position?.value?.[1]).toBe(0.82);
    expect(cap({ placement: 'middle' }).transform?.position?.value?.[1]).toBe(0.5);
    expect(cap({ placement: 'upper' }).transform?.position?.value?.[1]).toBe(0.15);
  });
});

describe('adapter threads brand + caption placement', () => {
  it("applies the EDL's captionPlacement to caption compositions", () => {
    const { edl } = parseEdl(
      { captionPlacement: 'upper', ops: [{ id: 'c', type: 'caption', start: 0, end: 1, reason: 'hook', style: 'bold_pop' }] },
      { durationSec: 5 },
    );
    const { compositions } = motionFromEdl(edl, [{ word: 'hi', start: 0.1, end: 0.5 }], 5, CANVAS);
    const cap = compositions[0].layers[0] as AnyLayer;
    expect(cap.transform?.position?.value?.[1]).toBe(0.15); // upper
  });

  it('passes a custom brand through to templates', () => {
    const { edl } = parseEdl(
      { ops: [{ id: 'lt', type: 'lower_third', start: 0, end: 2, reason: 'name', title: 'Jane' }] },
      { durationSec: 5 },
    );
    const { compositions } = motionFromEdl(edl, [], 5, CANVAS, BRAND);
    const g = compositions[0].layers[0] as AnyLayer;
    expect(g.children!.find((c) => c.id.endsWith('_title'))?.fill).toBe('#ff00ff');
  });
});
