import type { VaultRef } from '../../vault';
import type { EffectFamily } from './mappings';

/**
 * Extract per-reference visual params from a vault reference's text so different
 * references in the same family render DISTINCTLY (accent color, size, font, box)
 * instead of collapsing to one default look. Heuristic keyword parsing — a
 * starting point the AI/humans can refine.
 */

export function searchable(ref: VaultRef): string {
  return [ref.name, ref.what, ref.use, ref.motion, (ref.tags ?? []).join(' '), ref.b2b, ref.cat]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

// Color words → hex. Ordered so compound words (yellow-green) win before parts.
const COLORS: [RegExp, string][] = [
  [/yellow[-\s]?green|lime|chartreuse/, '#c6f135'],
  [/gold|golden|amber/, '#f5c518'],
  [/yellow/, '#ffd60a'],
  [/orange/, '#f97316'],
  [/(?:^|\W)red|crimson|scarlet/, '#ef4444'],
  [/pink|rose|fuchsia|magenta/, '#ec4899'],
  [/purple|violet|lilac|lavender/, '#7c3aed'],
  [/indigo|navy/, '#4f46e5'],
  [/cyan|aqua|turquoise/, '#22d3ee'],
  [/teal/, '#14b8a6'],
  [/(?:^|\W)green|emerald|mint/, '#34d399'],
  [/(?:^|\W)blue|azure|sky/, '#3b82f6'],
  [/white/, '#ffffff'],
];

/** First color word found → hex accent, else undefined. */
export function firstColor(s: string): string | undefined {
  for (const [re, hex] of COLORS) if (re.test(s)) return hex;
  return undefined;
}

/** Size multiplier from emphasis words (1 = default). */
export function scaleWord(s: string): number {
  if (/\b(bold|big|huge|giant|massive|oversized|slam|xl|jumbo)\b/.test(s)) return 1.3;
  if (/\b(subtle|minimal|small|clean|understated|tiny|compact|delicate)\b/.test(s)) return 0.82;
  return 1;
}

/** Font family from style words (must be a loaded family — see theme.FONTS). */
export function fontWord(s: string): string | undefined {
  if (/\bcondensed|impact|tall\b/.test(s)) return 'BebasNeue';
  if (/\boswald\b/.test(s)) return 'Oswald';
  if (/\bgeometric|modern|rounded\b/.test(s)) return 'Poppins';
  if (/\bclean|corporate|neutral|ui\b/.test(s)) return 'Montserrat';
  return undefined;
}

/** Per-family enriched params extracted from the reference. */
export function enrichParams(ref: VaultRef, family: EffectFamily): Record<string, unknown> {
  const s = searchable(ref);
  const accent = firstColor(s);
  const scale = scaleWord(s);
  const font = fontWord(s);
  const p: Record<string, unknown> = {};

  switch (family) {
    case 'stat':
    case 'three':
      if (accent) p.accent = accent;
      if (scale !== 1) p.scale = scale;
      break;
    case 'lower_third':
    case 'title_card':
      if (accent) p.accent = accent;
      if (font) p.fontFamily = font;
      if (scale !== 1) p.scale = scale;
      break;
    case 'caption':
      if (accent) p.highlight = accent;
      if (font) p.fontFamily = font;
      if (/\bbox|boxed|pill|plate|panel|background bar|caption bar\b/.test(s)) p.box = true;
      break;
    default:
      break;
  }
  return p;
}
