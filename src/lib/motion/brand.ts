/**
 * Brand profile — per-project colors + fonts the templates read from, instead of
 * a hardcoded palette. Templates use these as the fallback when a specific param
 * isn't provided, so a project (or the AI) can restyle every effect at once.
 *
 * DEFAULT_BRAND intentionally mirrors the legacy palette (theme.ts COLORS /
 * helpers PALETTE) so unstyled projects render exactly as before.
 */

export interface BrandColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
}

export interface BrandFonts {
  /** Display/heading face (captions, stat figures, headings). */
  heading: string;
  /** UI/body face (labels, subtitles). */
  body: string;
}

export interface BrandProfile {
  colors: BrandColors;
  fonts: BrandFonts;
}

export const DEFAULT_BRAND: BrandProfile = {
  colors: {
    primary: '#3b82f6',
    secondary: '#1e40af',
    accent: '#ffd60a',
    background: '#0b0d12',
    text: '#ffffff',
  },
  fonts: {
    heading: 'Anton',
    body: 'Inter',
  },
};
