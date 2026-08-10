import type { BlendMode, Mask } from '../../lib/motion/ir/types';

/**
 * Pure (no React) helpers that turn IR blend/mask fields into CSS values. Shared
 * by the layer renderers and the golden render-description tests.
 */

/** Map an IR blend mode to a CSS `mix-blend-mode` value (undefined = normal). */
export function cssBlendMode(blend?: BlendMode): React.CSSProperties['mixBlendMode'] {
  switch (blend) {
    case 'multiply':
      return 'multiply';
    case 'screen':
      return 'screen';
    case 'overlay':
      return 'overlay';
    case 'soft_light':
      return 'soft-light';
    case 'darken':
      return 'darken';
    case 'lighten':
      return 'lighten';
    case 'add':
      return 'plus-lighter';
    case 'normal':
    case undefined:
    default:
      return undefined;
  }
}

/** Build a CSS `clip-path` for a mask, or undefined if there's no mask. */
export function clipPathFromMask(mask?: Mask): string | undefined {
  if (!mask) return undefined;
  const r = mask.rect ?? { x: 0, y: 0, width: 1, height: 1 };

  if (mask.shape === 'circle') {
    const cx = (r.x + r.width / 2) * 100;
    const cy = (r.y + r.height / 2) * 100;
    const rad = (mask.radius ?? r.width / 2) * 100;
    return `circle(${round(rad)}% at ${round(cx)}% ${round(cy)}%)`;
  }

  const top = r.y * 100;
  const left = r.x * 100;
  const right = (1 - (r.x + r.width)) * 100;
  const bottom = (1 - (r.y + r.height)) * 100;
  const roundPart = mask.shape === 'rounded_rectangle' ? ` round ${round((mask.radius ?? 0.02) * 100)}%` : '';
  return `inset(${round(top)}% ${round(right)}% ${round(bottom)}% ${round(left)}%${roundPart})`;
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}
