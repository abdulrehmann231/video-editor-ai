import { loadFont as loadAnton } from '@remotion/google-fonts/Anton';
import { loadFont as loadInter } from '@remotion/google-fonts/Inter';

/**
 * Shared look & feel for the motion-graphics layer. Fonts are loaded via
 * @remotion/google-fonts (bundled, no network at render time) so the output uses
 * a proper heavy display face — the "YouTube editor" feel starts with typography.
 */
const anton = loadAnton();
const inter = loadInter('normal', { weights: ['600', '700', '800'] });

/** Heavy condensed display face for captions / headings / stat figures. */
export const FONT_DISPLAY = anton.fontFamily;
/** Clean UI face for labels / lower-third subtitles. */
export const FONT_BODY = `${inter.fontFamily}, Inter, system-ui, Arial, sans-serif`;

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
