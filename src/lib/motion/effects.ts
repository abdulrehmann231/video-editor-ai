/**
 * Per-effect style overrides for the non-caption overlay effects. Like the
 * caption config, every knob is optional and layered over the brand defaults, so
 * a project can restyle lower-thirds / stats / title cards (size, position,
 * colors, fonts, box) without touching code.
 */

export interface LowerThirdStyle {
  /** Text size multiplier (1 = default). */
  scale?: number;
  align?: 'left' | 'center' | 'right';
  accent?: string;
  textColor?: string;
  boxColor?: string;
  /** Box opacity 0..1. */
  boxOpacity?: number;
  fontFamily?: string;
}

export interface StatStyle {
  scale?: number;
  position?: 'center' | 'corner';
  accent?: string;
  textColor?: string;
  fontFamily?: string;
}

export interface TitleCardStyle {
  scale?: number;
  accent?: string;
  textColor?: string;
  /** Background dim opacity 0..1. */
  dim?: number;
  fontFamily?: string;
}

export interface EffectStyle {
  lowerThird?: LowerThirdStyle;
  stat?: StatStyle;
  titleCard?: TitleCardStyle;
}

/** Drop undefined values so template param merges stay clean. */
export function compact(obj: object | undefined): Record<string, unknown> {
  if (!obj) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v;
  return out;
}
