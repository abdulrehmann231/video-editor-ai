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

/** Build a CSS `clip-path` for a simple (non-inverted, non-feathered) mask. */
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

/** SVG shape (in a 0..100 viewBox) for the mask region. */
function maskShapeSvg(mask: Mask, fill: string): string {
  const r = mask.rect ?? { x: 0, y: 0, width: 1, height: 1 };
  if (mask.shape === 'circle') {
    const cx = round((r.x + r.width / 2) * 100);
    const cy = round((r.y + r.height / 2) * 100);
    const rad = round((mask.radius ?? r.width / 2) * 100);
    return `<circle cx='${cx}' cy='${cy}' r='${rad}' fill='${fill}'/>`;
  }
  const rx = mask.shape === 'rounded_rectangle' ? round((mask.radius ?? 0.02) * 100) : 0;
  return `<rect x='${round(r.x * 100)}' y='${round(r.y * 100)}' width='${round(r.width * 100)}' height='${round(r.height * 100)}' rx='${rx}' fill='${fill}'/>`;
}

/**
 * CSS decoration for a mask. Simple masks use `clip-path`; inverted or feathered
 * masks use an SVG-`<mask>` data-URI (luminance) so we get holes + soft edges —
 * a lightweight luma-style matte. (True track-mattes that key off another
 * layer's content need the WebGL backend; that's Phase 8.)
 */
export function maskDecoration(mask?: Mask): React.CSSProperties {
  if (!mask) return {};
  const feather = mask.feather ?? 0;
  if (!feather && !mask.inverted) {
    const clip = clipPathFromMask(mask);
    return clip ? { clipPath: clip } : {};
  }

  const std = round(Math.max(0, feather) * 40); // feather (0..1) -> blur in viewBox units
  const blur = std > 0 ? `<filter id='f' x='-50%' y='-50%' width='200%' height='200%'><feGaussianBlur stdDeviation='${std}'/></filter>` : '';
  const filterAttr = std > 0 ? " filter='url(#f)'" : '';
  // Inside the SVG <mask>, white = keep, black = remove (luminance).
  const bg = mask.inverted ? 'white' : 'black';
  const shape = maskShapeSvg(mask, mask.inverted ? 'black' : 'white');
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'>` +
    `<defs>${blur}<mask id='m'><rect width='100' height='100' fill='${bg}'/><g${filterAttr}>${shape}</g></mask></defs>` +
    `<rect width='100' height='100' fill='white' mask='url(#m)'/></svg>`;
  const uri = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  return {
    WebkitMaskImage: uri,
    maskImage: uri,
    WebkitMaskSize: '100% 100%',
    maskSize: '100% 100%',
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
  } as React.CSSProperties;
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}
