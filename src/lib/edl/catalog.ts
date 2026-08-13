import { SchemaType, type Schema } from '@google/generative-ai';
import type { EditOpType } from './schema';
import { LOTTIE_TEMPLATES, LOTTIE_IDS } from '../render/lottieRegistry';
import { THREE_TEMPLATES, THREE_IDS } from '../render/threeRegistry';
import { ILLUSTRATIONS, ILLUSTRATION_IDS } from '../motion/illustrations';

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
  {
    type: 'three',
    title: 'Real 3D effect (Three.js)',
    whenToUse:
      'A premium 3D moment (rendered in real 3D, not fake). Templates:\n' +
      THREE_TEMPLATES.map((t) => `      • ${t.id} — ${t.label}: ${t.whenToUse}`).join('\n') +
      '\n    Use rarely — only for a standout number or headline. Keep it ~1.5–2.5s.',
    params: `template: one of [${THREE_IDS.join(', ')}]. value (big text/number), label (small text).`,
  },
  {
    type: 'annotate',
    title: 'Hand-drawn marker annotation',
    whenToUse:
      'THE signature vault move — draw ON the frame like a human editor. A curved ARROW pointing at the speaker/an object, a rough CIRCLE around a face/thing, an UNDERLINE/BOX/STRIKE, a bright CHECKMARK or CROSS, or a highlighter SCRIBBLE. Use whenever the speaker points at, references, or emphasizes something on screen.',
    params:
      'annotation: arrow | circle | underline | box | strike | scribble | checkmark | cross. x,y,w,h: normalized 0–1 target region to point at / circle / mark. fromX,fromY: arrow tail (arrow only). color (optional hex).',
  },
  {
    type: 'name_tag',
    title: 'Name-tag callout',
    whenToUse:
      'Label a person or object on screen: a bright pill tag (e.g. "YOUNG MARK", "S&P 500") with a hand-drawn arrow pointing at them. Great for naming a subject or flagging a detail.',
    params: 'text (the label). targetX,targetY: normalized 0–1 point the arrow points at. side: below | left | right.',
  },
  {
    type: 'checklist',
    title: 'Checklist / do-and-dont (✓/✗)',
    whenToUse:
      'A punchy list that reveals row-by-row, each with a bright green CHECK, red CROSS, or DOT — e.g. "EXPERTISE ✓ / LABOUR ✗", good-vs-bad, or a set of points. High-retention vault staple. Bold italic text, no card.',
    params:
      'items: array of { text, mark } where mark is check | cross | dot (2–5 rows). title (optional). position: center | left.',
  },
  {
    type: 'comparison',
    title: 'Two-column comparison',
    whenToUse:
      'Contrast two things side-by-side with directional arrows — e.g. "You lose $$$" (red, down) vs "They make $$$" (green, up), old vs new, us vs them. Reveals both panels.',
    params:
      'leftTitle, rightTitle. leftItems, rightItems: arrays of short strings (≤4 each). leftTone, rightTone: bad | good | neutral (sets color + arrow direction).',
  },
  {
    type: 'stack_list',
    title: 'Stacking list (steps / options / to-do)',
    whenToUse:
      'A vertical list that stacks in row-by-row — outlined pills (an enumeration like "OLD B2B / SOFTWARE / LOGISTICS"), a NUMBERED steps list, or a top-left to-do checklist. Use for agendas, steps, options, or lists of things.',
    params:
      'listItems: array of short strings (2–6). variant: outline | number | bullet. position: center | left | topleft (topleft = to-do style).',
  },
  {
    type: 'progress',
    title: 'Progress bar / gauge / counter / timeline / scale / slider',
    whenToUse:
      'Animate a data widget: a horizontal PROGRESS BAR ("70% happy customers"), a vertical red→green GAUGE ("CONFIDENCE"), a big COUNTER (countdowns / growing numbers), a TIMELINE of milestones, a labeled SCALE / number-line with a marker ("$ … $$$", a 1–10 rating), or a SLIDER with a knob. Use for stats, momentum, roadmaps, tension.',
    params:
      'variant: bar | gauge | counter | timeline | scale | slider. amount: fill/marker % 0–100 (or end number for counter). from: counter start. label. suffix: "%","x","s". ticks: array of {label, at} (at 0–1) for timeline/scale. minLabel/maxLabel: end labels for scale/slider. position: lower | center | corner | left | right.',
  },
  {
    type: 'chart',
    title: 'Animated data chart',
    whenToUse:
      'Visualize a set of numbers: a BAR chart (compare categories), LINE or AREA chart (a trend over time — rising revenue, falling cost), or DONUT (share of a whole). Bars grow, the line draws on, values count up. Use when the speaker compares figures or describes a trend/breakdown.',
    params:
      'variant: bar | line | area | donut. data: array of { label, value } (2–8 points). title (optional). prefix/suffix: e.g. "$" / "%". position: center | left | right.',
  },
  {
    type: 'illustration',
    title: 'Vector illustration / sticker',
    whenToUse:
      'Pop a bundled vector illustration to visualize a concept the speaker mentions (money, growth, launch, a goal, an idea, business, winning, a bonus, security, property, time, trending). Use as a sticker beside the speaker or a centered concept icon. Available ids:\n' +
      ILLUSTRATIONS.map((i) => `      • ${i.id} — ${i.label}: ${i.whenToUse}`).join('\n'),
    params: `name: one of [${ILLUSTRATION_IDS.join(', ')}]. label (optional caption). position: center | left | right | corner. size: small | medium | large. animate: pop | float | draw | none.`,
  },
  {
    type: 'flow',
    title: 'Flow / process diagram',
    whenToUse:
      'Show a PROCESS or CHAIN as connected nodes with arrows — "gift → $ → more gifts", a funnel, input→output, or step→step→step. Each node is an illustration icon and/or a short label; they reveal and connect in sequence. Use when the speaker describes how something flows, converts, compounds, or leads to a result.',
    params: `nodes: array of { illustration, label } (2–5 steps; illustration is an id like ${ILLUSTRATION_IDS.slice(0, 4).join('/')}). direction: horizontal | vertical. connector: arrow | line. position: center | lower.`,
  },
  {
    type: 'quote',
    title: 'Quote card',
    whenToUse:
      'Display a memorable QUOTE or highlighted statement with attribution — a famous quote, an expert line, or a bold claim — as large quotation text over a dimmed backdrop. Use for a powerful cited line or a mic-drop statement.',
    params: 'text (the quote). author (attribution, optional).',
  },
];

export function buildCatalogText(): string {
  return CATALOG.map(
    (c) =>
      `- ${c.type} — ${c.title}\n    When: ${c.whenToUse}\n    Params: ${c.params}`,
  ).join('\n');
}

const OP_TYPE_ENUM = CATALOG.map((c) => c.type);

/**
 * Shared flat effect-param properties (all optional). Reused by BOTH the EDL op
 * schema and the Phase-6 program element schema. We use a single flat object
 * (type enum + all params optional) rather than a discriminated union, because
 * the Gemini schema subset handles that far more reliably. Zod then narrows /
 * validates each op precisely on our side (parseEdl / parseProgram).
 */
const EFFECT_PARAM_PROPS: Record<string, Schema> = {
          // op-specific params (only fill the ones relevant to `type`)
          style: { type: SchemaType.STRING, format: 'enum', enum: ['word_highlight', 'bold_pop', 'karaoke', 'typewriter'] },
          emphasis: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          scale: { type: SchemaType.NUMBER },
          focus: { type: SchemaType.STRING, format: 'enum', enum: ['center', 'face', 'left', 'right', 'top'] },
          title: { type: SchemaType.STRING },
          subtitle: { type: SchemaType.STRING },
          query: { type: SchemaType.STRING },
          layout: { type: SchemaType.STRING, format: 'enum', enum: ['full', 'pip'] },
          variant: { type: SchemaType.STRING, format: 'enum', enum: ['intro', 'cta', 'glitch', 'flash', 'zoom_blur', 'outline', 'number', 'bullet', 'bar', 'gauge', 'counter', 'line', 'area', 'donut', 'timeline', 'scale', 'slider'] },
          heading: { type: SchemaType.STRING },
          sub: { type: SchemaType.STRING },
          value: { type: SchemaType.STRING },
          label: { type: SchemaType.STRING },
          position: { type: SchemaType.STRING, format: 'enum', enum: ['center', 'corner', 'full', 'left', 'right', 'topleft', 'lower'] },
          template: { type: SchemaType.STRING, format: 'enum', enum: [...LOTTIE_IDS, ...THREE_IDS] },
          // annotate
          annotation: { type: SchemaType.STRING, format: 'enum', enum: ['arrow', 'circle', 'underline', 'box', 'strike', 'scribble', 'checkmark', 'cross'] },
          x: { type: SchemaType.NUMBER },
          y: { type: SchemaType.NUMBER },
          w: { type: SchemaType.NUMBER },
          h: { type: SchemaType.NUMBER },
          fromX: { type: SchemaType.NUMBER },
          fromY: { type: SchemaType.NUMBER },
          color: { type: SchemaType.STRING, description: 'Hex color like #ffd60a.' },
          // name_tag
          text: { type: SchemaType.STRING },
          targetX: { type: SchemaType.NUMBER },
          targetY: { type: SchemaType.NUMBER },
          side: { type: SchemaType.STRING, format: 'enum', enum: ['below', 'left', 'right'] },
          // checklist
          items: {
            type: SchemaType.ARRAY,
            description: 'checklist rows',
            items: {
              type: SchemaType.OBJECT,
              properties: {
                text: { type: SchemaType.STRING },
                mark: { type: SchemaType.STRING, format: 'enum', enum: ['check', 'cross', 'dot'] },
              },
              required: ['text'],
            },
          },
          // comparison
          leftTitle: { type: SchemaType.STRING },
          rightTitle: { type: SchemaType.STRING },
          leftItems: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          rightItems: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          leftTone: { type: SchemaType.STRING, format: 'enum', enum: ['bad', 'good', 'neutral'] },
          rightTone: { type: SchemaType.STRING, format: 'enum', enum: ['bad', 'good', 'neutral'] },
          // stack_list
          listItems: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: 'stacking-list rows' },
          // progress
          amount: { type: SchemaType.NUMBER, description: 'progress fill % (0-100) or counter end number' },
          from: { type: SchemaType.NUMBER, description: 'counter start value' },
          suffix: { type: SchemaType.STRING, description: 'counter suffix e.g. %, x, s' },
          // chart
          data: {
            type: SchemaType.ARRAY,
            description: 'chart data points',
            items: {
              type: SchemaType.OBJECT,
              properties: {
                label: { type: SchemaType.STRING },
                value: { type: SchemaType.NUMBER },
              },
              required: ['value'],
            },
          },
          prefix: { type: SchemaType.STRING, description: 'chart value prefix e.g. $' },
          // progress timeline/scale
          ticks: {
            type: SchemaType.ARRAY,
            description: 'timeline milestones / scale ticks',
            items: {
              type: SchemaType.OBJECT,
              properties: {
                label: { type: SchemaType.STRING },
                at: { type: SchemaType.NUMBER, description: '0..1 position along the track' },
              },
              required: ['at'],
            },
          },
          minLabel: { type: SchemaType.STRING, description: 'scale/slider left end label' },
          maxLabel: { type: SchemaType.STRING, description: 'scale/slider right end label' },
          // illustration
          name: { type: SchemaType.STRING, format: 'enum', enum: ILLUSTRATION_IDS, description: 'illustration id' },
          size: { type: SchemaType.STRING, format: 'enum', enum: ['small', 'medium', 'large'] },
          animate: { type: SchemaType.STRING, format: 'enum', enum: ['pop', 'float', 'draw', 'none'] },
          // flow
          nodes: {
            type: SchemaType.ARRAY,
            description: 'flow diagram nodes (2–5)',
            items: {
              type: SchemaType.OBJECT,
              properties: {
                illustration: { type: SchemaType.STRING, format: 'enum', enum: ILLUSTRATION_IDS },
                label: { type: SchemaType.STRING },
              },
            },
          },
          direction: { type: SchemaType.STRING, format: 'enum', enum: ['horizontal', 'vertical'] },
          connector: { type: SchemaType.STRING, format: 'enum', enum: ['arrow', 'line'] },
          // quote
          author: { type: SchemaType.STRING, description: 'quote attribution' },
};

/** EDL structured-output schema (flat ops with absolute timing). */
export const EDL_RESPONSE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    version: { type: SchemaType.NUMBER },
    summary: { type: SchemaType.STRING, description: 'One-paragraph editorial summary of the approach.' },
    ops: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          id: { type: SchemaType.STRING, description: 'Unique short id.' },
          type: { type: SchemaType.STRING, format: 'enum', enum: OP_TYPE_ENUM, description: 'One of the catalog op types.' },
          start: { type: SchemaType.NUMBER, description: 'Start time in seconds.' },
          end: { type: SchemaType.NUMBER, description: 'End time in seconds.' },
          reason: { type: SchemaType.STRING, description: 'Short justification for this edit (shown to the user).' },
          ...EFFECT_PARAM_PROPS,
        },
        required: ['id', 'type', 'start', 'end', 'reason'],
      },
    },
  },
  required: ['ops'],
};

/**
 * Phase-6 MotionProgram structured-output schema. The AI designs SCENES, each a
 * composed moment with 1–6 coordinated ELEMENTS. Elements reuse the SAME flat
 * effect params as EDL ops (proven reliable) but drop their own id/timing —
 * inherited from the scene, offset by an optional `delay`. Silence is expressed
 * once at the top level via `cuts`.
 */
export const PROGRAM_RESPONSE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    summary: { type: SchemaType.STRING, description: 'One-paragraph editorial summary of the composition approach.' },
    captionPlacement: { type: SchemaType.STRING, format: 'enum', enum: ['lower', 'middle', 'upper'] },
    cuts: {
      type: SchemaType.ARRAY,
      description: 'Silence/filler ranges to REMOVE (seconds).',
      items: {
        type: SchemaType.OBJECT,
        properties: { start: { type: SchemaType.NUMBER }, end: { type: SchemaType.NUMBER } },
        required: ['start', 'end'],
      },
    },
    scenes: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          id: { type: SchemaType.STRING, description: 'Short unique scene id.' },
          start: { type: SchemaType.NUMBER, description: 'Scene start (seconds).' },
          end: { type: SchemaType.NUMBER, description: 'Scene end (seconds).' },
          intent: { type: SchemaType.STRING, description: 'What this moment communicates + why these elements.' },
          reason: { type: SchemaType.STRING, description: 'Justification incl. the vault ref, e.g. "(ref: #123 …)".' },
          elements: {
            type: SchemaType.ARRAY,
            description: '1–6 coordinated effects composited in this scene.',
            items: {
              type: SchemaType.OBJECT,
              properties: {
                type: { type: SchemaType.STRING, format: 'enum', enum: OP_TYPE_ENUM, description: 'The effect type.' },
                delay: { type: SchemaType.NUMBER, description: 'Seconds after the scene start to reveal this element (stagger).' },
                ...EFFECT_PARAM_PROPS,
              },
              required: ['type'],
            },
          },
        },
        required: ['id', 'start', 'end', 'intent', 'reason', 'elements'],
      },
    },
  },
  required: ['scenes'],
};
