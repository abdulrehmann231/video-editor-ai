import { loadFont as loadAnton } from '@remotion/google-fonts/Anton';
import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import { loadFont as loadOswald } from '@remotion/google-fonts/Oswald';
import { loadFont as loadRoboto } from '@remotion/google-fonts/Roboto';
import { loadFont as loadMontserrat } from '@remotion/google-fonts/Montserrat';
import { loadFont as loadPoppins } from '@remotion/google-fonts/Poppins';
import { loadFont as loadBebas } from '@remotion/google-fonts/BebasNeue';

/**
 * Shared look & feel for the motion-graphics layer. Fonts are loaded via
 * @remotion/google-fonts so the output uses proper typography. Several families
 * are bundled so `fontFamily` in the IR actually renders (resolveFontFamily maps
 * a family name to its loaded face).
 */
const anton = loadAnton();
const inter = loadInter('normal', { weights: ['400', '500', '600', '700', '800'] });
const oswald = loadOswald('normal', { weights: ['400', '500', '600', '700'] });
const roboto = loadRoboto('normal', { weights: ['400', '500', '700'] });
const montserrat = loadMontserrat('normal', { weights: ['500', '600', '700', '800'] });
const poppins = loadPoppins('normal', { weights: ['500', '600', '700'] });
const bebas = loadBebas();

/** Heavy condensed display face for captions / headings / stat figures. */
export const FONT_DISPLAY = anton.fontFamily;
/** Clean UI face for labels / lower-third subtitles. */
export const FONT_BODY = `${inter.fontFamily}, Inter, system-ui, Arial, sans-serif`;

/** Registry of loaded font families (lower-cased name -> CSS family). */
export const FONTS: Record<string, string> = {
  anton: anton.fontFamily,
  inter: inter.fontFamily,
  oswald: oswald.fontFamily,
  roboto: roboto.fontFamily,
  montserrat: montserrat.fontFamily,
  poppins: poppins.fontFamily,
  bebasneue: bebas.fontFamily,
  bebas: bebas.fontFamily,
};

/** Map a requested font-family name to a loaded face (so custom fonts actually
 * render); unknown names pass through with a sensible fallback. */
export function resolveFontFamily(name?: string, fallback: string = FONT_DISPLAY): string {
  if (!name) return fallback;
  const loaded = FONTS[name.toLowerCase().replace(/\s+/g, '')];
  return loaded ? `${loaded}, ${fallback}` : `${name}, ${fallback}`;
}

export const COLORS = {
  accent: '#ffd60a', // signature caption-highlight yellow
  accentAlt: '#34d399', // green pop
  blue: '#3b82f6',
  blueDeep: '#1e40af',
  ink: '#0b0d12',
  white: '#ffffff',
};

/** Thick outline + drop shadow that reads on any footage (the caption "sticker" look). */
export function outlineStyle(strokePx: number): React.CSSProperties {
  return {
    WebkitTextStroke: `${strokePx}px ${COLORS.ink}`,
    paintOrder: 'stroke fill',
    textShadow: '0 6px 22px rgba(0,0,0,0.55), 0 2px 3px rgba(0,0,0,0.8)',
  } as React.CSSProperties;
}
