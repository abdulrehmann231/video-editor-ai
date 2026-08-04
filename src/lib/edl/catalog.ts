import { SchemaType, type Schema } from '@google/generative-ai';
import type { EditOpType } from './schema';
import { LOTTIE_TEMPLATES, LOTTIE_IDS } from '../render/lottieRegistry';

/**
 * The Effect Catalog — the fixed menu of edits the brain may choose from.
 * Codified from the B2B talking-head style of the Inspiration Vault
 * (tight jump-cut pacing, bold captions, punch-in zooms, b-roll, lower thirds).
 *
 * This drives BOTH the prompt (human-readable guidance) and the Gemini
 * structured-output schema, so the two never drift apart.
 */
export interface CatalogEntry {
  type: EditOpType;
  title: string;
  whenToUse: string;
  params: string;
}

export const CATALOG: CatalogEntry[] = [
  {
    type: 'silence_cut',
    title: 'Silence / filler jump-cut',
    whenToUse:
      'Remove dead air, long pauses, breaths, filler ("um", "uh", "like"), and false starts to tighten pacing. This is the backbone of the edit.',
    params: 'start, end = the segment to REMOVE.',
  },
  {
    type: 'caption',
    title: 'Animated word captions',
    whenToUse:
      'Add bold word-by-word captions over spoken passages, especially the hook and key points. Captions are expected in B2B/YouTube edits.',
    params:
      'style: word_highlight | bold_pop | karaoke. emphasis: optional array of the most important words to accent.',
  },
  {
    type: 'zoom_punch',
    title: 'Punch-in zoom',
    whenToUse:
      'Snap a quick zoom-in on emphasis, a strong claim, or the first ~5s hook to add energy and mark importance. Keep them short.',
    params: 'scale: 1.05–1.4 (subtle). focus: center | face | left | right | top.',
  },
  {
    type: 'lower_third',
    title: 'Lower third',
    whenToUse:
      "Introduce the speaker (name + title/role) early, or label a topic/section. Clean and brief.",
    params: 'title (name or label), subtitle (role/context, optional).',
  },
  {
    type: 'broll',
    title: 'Stock b-roll overlay',
    whenToUse:
      'When the speaker references a concrete thing/place/action, overlay stock b-roll to illustrate it and add visual variety. Use sparingly and only when it clearly matches.',
    params:
      'query: 2–5 keyword search for stock footage. layout: full (cover frame) | pip (picture-in-picture).',
  },
  {
    type: 'title_card',
    title: 'Intro / CTA title card',
    whenToUse:
      "Optionally overlay a bold full-screen card over the first ~2s (variant 'intro': the video's topic/title) and/or the last ~3s (variant 'cta': a call to action like 'Subscribe for more'). At most one intro and one cta. Overlays existing footage — does not add time.",
    params: "variant: intro | cta. heading (big line), sub (optional smaller line).",
  },
  {
    type: 'stat_callout',
    title: 'Animated stat / metric badge',
    whenToUse:
      'When the speaker states a number, metric, price, multiple or percentage, pop an animated badge showing it. Great for finance/growth points. Keep it short (1–2s).',
    params: "value (e.g. \"$1.2M\", \"3x\", \"+40%\"), label (optional short caption), position: center | corner.",
  },
  {
    type: 'transition',
    title: 'Scene transition',
    whenToUse:
      'A brief transition at a strong topic/section boundary (keep it short, ~0.3–0.6s, and rare — a few at most). Adds energy between segments.',
    params: 'variant: glitch | flash | zoom_blur.',
  },
  {
    type: 'lottie',
    title: 'Pro animated overlay (Lottie)',
    whenToUse:
      'Drop a polished animated graphic on a specific beat. Available templates:\n' +
      LOTTIE_TEMPLATES.map((t) => `      • ${t.id} — ${t.label}: ${t.whenToUse}`).join('\n') +
      '\n    Use sparingly, only when the moment clearly fits one.',
    params: `template: one of [${LOTTIE_IDS.join(', ')}]. position (optional): full | center | corner.`,
  },
];

export function buildCatalogText(): string {
  return CATALOG.map(
    (c) =>
      `- ${c.type} — ${c.title}\n    When: ${c.whenToUse}\n    Params: ${c.params}`,
  ).join('\n');
}

/**
 * Gemini structured-output schema. We use a single flat op object (type enum +
 * all params optional) rather than a discriminated union, because the Gemini
 * schema subset handles that far more reliably. Zod then narrows/validates each
 * op precisely on our side (see parseEdl).
 */
export const EDL_RESPONSE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    version: { type: SchemaType.NUMBER },
    summary: {
      type: SchemaType.STRING,
      description: 'One-paragraph editorial summary of the approach.',
    },
    ops: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          id: { type: SchemaType.STRING, description: 'Unique short id.' },
          type: {
            type: SchemaType.STRING,
            format: 'enum',
            enum: CATALOG.map((c) => c.type),
            description: 'One of the catalog op types.',
          },
          start: { type: SchemaType.NUMBER, description: 'Start time in seconds.' },
          end: { type: SchemaType.NUMBER, description: 'End time in seconds.' },
          reason: {
            type: SchemaType.STRING,
            description: 'Short justification for this edit (shown to the user).',
          },
          // op-specific params (only fill the ones relevant to `type`)
          style: { type: SchemaType.STRING, format: 'enum', enum: ['word_highlight', 'bold_pop', 'karaoke', 'typewriter'] },
          emphasis: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          scale: { type: SchemaType.NUMBER },
          focus: { type: SchemaType.STRING, format: 'enum', enum: ['center', 'face', 'left', 'right', 'top'] },
          title: { type: SchemaType.STRING },
          subtitle: { type: SchemaType.STRING },
          query: { type: SchemaType.STRING },
          layout: { type: SchemaType.STRING, format: 'enum', enum: ['full', 'pip'] },
          variant: { type: SchemaType.STRING, format: 'enum', enum: ['intro', 'cta', 'glitch', 'flash', 'zoom_blur'] },
          heading: { type: SchemaType.STRING },
          sub: { type: SchemaType.STRING },
          value: { type: SchemaType.STRING },
          label: { type: SchemaType.STRING },
          position: { type: SchemaType.STRING, format: 'enum', enum: ['center', 'corner', 'full'] },
          template: { type: SchemaType.STRING, format: 'enum', enum: LOTTIE_IDS },
        },
        required: ['id', 'type', 'start', 'end', 'reason'],
      },
    },
  },
  required: ['ops'],
};
