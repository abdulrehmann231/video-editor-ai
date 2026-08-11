import type { VaultRef } from '../../vault';
import { LOTTIE_IDS } from '../../render/lottieRegistry';
import { THREE_IDS } from '../../render/threeRegistry';
import { searchable, enrichParams } from './params';

/**
 * Phase 5 — map each Inspiration Vault reference to an EXECUTABLE template family
 * (or flag it "requires advanced backend"). The vault's `motion` field is free
 * text, so we classify by scanning all of a reference's text (name/what/use/
 * motion/tags/b2b/cat) with ordered keyword rules and pick the first match.
 *
 * The mapping is deterministic and drives: (a) which registry template realizes a
 * reference, (b) default params (style/variant/template), (c) whether it renders
 * today or needs WebGL/3D (Phase 8+). This is the starting map; it can be refined.
 */

export type EffectFamily =
  | 'lower_third'
  | 'title_card'
  | 'lottie'
  | 'transition'
  | 'stat'
  | 'three'
  | 'caption'
  | 'camera'
  | 'broll'
  | 'advanced'
  | 'other';

export type ReferenceRenderer = 'remotion' | 'three' | 'webgl' | 'blender';

export interface ReferenceMapping {
  family: EffectFamily;
  /** Registry template id (undefined for advanced/other-non-executable). */
  templateId?: string;
  /** Default params for the template (style/variant/template selection). */
  params?: Record<string, unknown>;
  renderer: ReferenceRenderer;
  /** True when it can't render in the current (Remotion+basic 3D) engine. */
  requiresAdvanced: boolean;
  /** Coarse classification (§39). */
  complexity: 'low' | 'medium' | 'high';
}

const has = (s: string, ...words: string[]): boolean => words.some((w) => s.includes(w));

const lottieId = (s: string): string => {
  if (has(s, 'confetti', 'celebration', 'party')) return 'confetti';
  if (has(s, 'checkmark', 'check mark', 'tick', 'success check')) return 'checkmark';
  if (has(s, 'trophy', 'award', 'medal', 'winner')) return 'trophy';
  if (has(s, 'underline', 'highlight sweep', 'marker', 'scribble')) return 'underline';
  return 'swipe_wipe';
};

const captionStyle = (s: string): string => {
  if (has(s, 'typewriter', 'type-on', 'type on', 'hard-cut')) return 'typewriter';
  if (has(s, 'karaoke')) return 'karaoke';
  if (has(s, 'scramble')) return 'scramble';
  if (has(s, 'character', 'char reveal', 'per-letter', 'letter-by-letter')) return 'char_reveal';
  if (has(s, 'word-swap', 'word pop', 'pop', 'punch')) return 'bold_pop';
  return 'word_highlight';
};

/** Classify one vault reference into a base template family + params. */
function classifyBase(ref: VaultRef): ReferenceMapping {
  const s = searchable(ref);
  const is3d = has(s, '3d', 'orb', 'sphere', 'glass', 'extrude', 'volumetric', 'three-dimensional');
  const isHeavy = has(s, 'particle', 'bokeh', 'light leak', 'light streak', 'plexus', 'smoke', 'fluid', 'liquid simulation', 'chromatic', 'rgb split', 'film grain', 'shader', 'displacement', 'parallax', 'depth of field', 'ray trace', 'lens flare');

  // 1. Lower third / name tag.
  if (has(s, 'lower third', 'lower-third', 'name tag', 'nameplate', 'chyron', 'name bar', 'speaker name', 'title bar'))
    return { family: 'lower_third', templateId: 'lower_third', params: {}, renderer: 'remotion', requiresAdvanced: false, complexity: 'low' };

  // 2. Title / intro / CTA card.
  if (has(s, 'title card', 'intro card', 'end screen', 'end card', 'outro', 'call to action', 'cta', 'subscribe', 'cover card', 'section title')) {
    const variant = has(s, 'outro', 'cta', 'subscribe', 'end screen', 'end card') ? 'cta' : 'intro';
    return { family: 'title_card', templateId: 'title_card', params: { variant }, renderer: 'remotion', requiresAdvanced: false, complexity: 'low' };
  }

  // 3. Lottie-style animated icons / celebrations.
  if (has(s, 'confetti', 'celebration', 'checkmark', 'check mark', 'tick', 'trophy', 'award', 'medal', 'underline', 'highlight sweep', 'sticker', 'emoji doodle')) {
    const template = lottieId(s);
    return { family: 'lottie', templateId: 'lottie', params: { template }, renderer: 'remotion', requiresAdvanced: !LOTTIE_IDS.includes(template), complexity: 'low' };
  }

  // 4. Transitions.
  if (has(s, 'transition', 'whip pan', 'glitch', 'flash cut', 'zoom blur', 'seamless transition', 'swipe transition', 'wipe transition')) {
    const variant = has(s, 'glitch') ? 'glitch' : has(s, 'zoom blur', 'blur') ? 'zoom_blur' : 'flash';
    return { family: 'transition', templateId: 'transition', params: { variant }, renderer: 'remotion', requiresAdvanced: false, complexity: 'low' };
  }

  // 5. Captions / kinetic typography (strong text signals, before stats).
  if (has(s, 'caption', 'subtitle', 'kinetic typography', 'kinetic text', 'word-by-word', 'word pop', 'typewriter', 'text reveal', 'text build', 'karaoke', 'word-swap', 'word-sync', 'highlight word', 'text-in', 'text build-on', 'kinetic title', 'quote', 'hook text'))
    return { family: 'caption', templateId: 'kinetic_text', params: { style: captionStyle(s) }, renderer: 'remotion', requiresAdvanced: false, complexity: 'low' };

  // 6. Stats / metrics (+ premium 3D orb variant).
  if (has(s, 'stat', 'metric', 'percentage', '%', 'kpi', 'data point', 'count-up', 'countup', 'odometer', 'money orb', 'revenue', 'statistic', 'growth number', 'big number', 'number reveal')) {
    if (is3d && THREE_IDS.includes('stat_orb'))
      return { family: 'three', templateId: 'three', params: { template: 'stat_orb' }, renderer: 'three', requiresAdvanced: false, complexity: 'high' };
    return { family: 'stat', templateId: 'metric_pop', params: {}, renderer: 'remotion', requiresAdvanced: false, complexity: 'medium' };
  }

  // 7. 3D cards / reveals.
  if (is3d) {
    if (has(s, 'card', 'flip') && THREE_IDS.includes('card_3d'))
      return { family: 'three', templateId: 'three', params: { template: 'card_3d' }, renderer: 'three', requiresAdvanced: false, complexity: 'high' };
    // Extruded text / product mesh / volumetric → needs a full 3D backend.
    return { family: 'advanced', renderer: 'blender', requiresAdvanced: true, complexity: 'high' };
  }

  // 8. Camera / zoom moves.
  if (has(s, 'zoom', 'punch-in', 'punch in', 'push-in', 'push in', 'camera shake', 'dolly', 'camera move'))
    return { family: 'camera', templateId: 'camera_punch', params: {}, renderer: 'remotion', requiresAdvanced: false, complexity: 'low' };

  // 9. B-roll / stock footage overlays.
  if (has(s, 'b-roll', 'broll', 'stock footage', 'overlay footage', 'screen recording', 'background footage'))
    return { family: 'broll', templateId: 'broll', params: {}, renderer: 'remotion', requiresAdvanced: false, complexity: 'low' };

  // 10. Heavy GPU visuals → advanced (Phase 8 WebGL / particles).
  if (isHeavy) return { family: 'advanced', renderer: 'webgl', requiresAdvanced: true, complexity: 'high' };

  // 11. Named badge / icon / callout reveal → metric badge (conservative: only when
  //     it clearly reads like a badge/number, not an arbitrary graphic).
  if (has(s, 'badge', 'icon reveal', 'callout', 'label reveal', 'tag reveal', 'number', 'counter', 'figure'))
    return { family: 'stat', templateId: 'metric_pop', params: {}, renderer: 'remotion', requiresAdvanced: false, complexity: 'medium' };

  // Otherwise: an arbitrary graphic reveal we don't confidently map — leave it for
  // the advanced/custom backend rather than forcing a wrong template.
  return { family: 'other', renderer: 'remotion', requiresAdvanced: true, complexity: 'medium' };
}

/**
 * Classify a reference AND extract its per-reference params (accent color, size,
 * font, box) so different references in the same family render distinctly.
 */
export function classifyReference(ref: VaultRef): ReferenceMapping {
  const base = classifyBase(ref);
  if (!base.templateId) return base;
  return { ...base, params: { ...(base.params ?? {}), ...enrichParams(ref, base.family) } };
}
