import type { CaptionPlacement, CaptionStyle } from './ir/types';

/**
 * Caption style config + named presets. Every user can pick a look (or fully
 * customize it) — size, placement, font, colors, weight, tracking, phrase length,
 * and the animation style are all tunable. Presets are just convenient bundles;
 * a project can also supply a partial config to override any field.
 */

export interface CaptionConfig {
  style?: CaptionStyle;
  /** Font size as a fraction of frame width. */
  size?: number;
  placement?: CaptionPlacement;
  fill?: string;
  /** Active/emphasis word color. */
  highlight?: string;
  fontFamily?: string;
  weight?: number;
  /** Letter-spacing in px. */
  tracking?: number;
  /** Max words per on-screen phrase. */
  maxWords?: number;
  /** Draw a background box behind the caption. */
  box?: boolean;
  /** Box fill color (hex incl. 8-digit alpha). */
  boxColor?: string;
  /** Backdrop blur behind the box, in px. */
  boxBlur?: number;
  /** Caption block max width as a fraction of frame width (0..1). */
  maxWidth?: number;
  /** Text outline (stroke) color. */
  outlineColor?: string;
  /** Outline width as a fraction of font size. */
  outlineWidth?: number;
}

/** Built-in caption looks. Users pick one by name (project.captionStyle: 'youtube'). */
export const CAPTION_PRESETS: Record<string, CaptionConfig> = {
  // Classic reveal, accent-highlighted active word (default).
  word_highlight: { style: 'word_highlight', size: 0.05, placement: 'lower', maxWords: 3 },
  // YouTube auto-caption look: whole phrase, clean body font, white text on a
  // rounded dark box. Small + understated.
  youtube: { style: 'youtube', size: 0.032, placement: 'lower', maxWords: 6, weight: 500, fontFamily: 'Inter' },
  // Even smaller / tighter YouTube captions.
  youtube_small: { style: 'youtube', size: 0.026, placement: 'lower', maxWords: 7, weight: 500, fontFamily: 'Inter' },
  // YouTube captions with a frosted (blurred) background box.
  youtube_blur: { style: 'youtube', size: 0.03, placement: 'lower', maxWords: 6, weight: 500, fontFamily: 'Inter', boxBlur: 10, boxColor: '#0b0d1266' },
  // Big single word centered — TikTok / Hormozi punch.
  tiktok: { style: 'single_word', size: 0.11, placement: 'middle', maxWords: 1 },
  // Rounded accent sticker on the active word.
  bold_pop: { style: 'bold_pop', size: 0.055, placement: 'lower', maxWords: 3 },
  // Fill words with accent as spoken.
  karaoke: { style: 'karaoke', size: 0.05, placement: 'lower', maxWords: 4 },
  // Character-by-character build-up.
  typewriter: { style: 'typewriter', size: 0.045, placement: 'lower', maxWords: 5 },
  // Reveal with an accent underline bar under the active word.
  underline: { style: 'underline', size: 0.05, placement: 'lower', maxWords: 3 },
  // Bouncy elastic entrance.
  bounce: { style: 'bounce', size: 0.055, placement: 'lower', maxWords: 3 },
  // Small, restrained, thin — minimal lower-thirds subtitle.
  minimal: { style: 'word_highlight', size: 0.034, placement: 'lower', weight: 600, maxWords: 4 },
};

export const CAPTION_PRESET_IDS = Object.keys(CAPTION_PRESETS);

/** Resolve a preset name or partial config into a full config (falling back to
 * the default preset for any unset field). */
export function resolveCaptionConfig(input?: string | CaptionConfig): CaptionConfig {
  const base = CAPTION_PRESETS.word_highlight;
  if (!input) return { ...base };
  if (typeof input === 'string') return { ...base, ...(CAPTION_PRESETS[input] ?? {}) };
  // A partial config: if it names a style with a preset, layer over that preset.
  const preset = input.style && CAPTION_PRESETS[input.style] ? CAPTION_PRESETS[input.style] : base;
  return { ...preset, ...input };
}
