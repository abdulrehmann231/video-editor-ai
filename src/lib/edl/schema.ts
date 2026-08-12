import { z } from 'zod';

/**
 * Edit Decision List (EDL) — the structured, deterministic output of the
 * "brain" (Gemini). It never touches pixels; it describes WHAT to edit and
 * WHERE (in seconds), choosing only op types from the Effect Catalog.
 *
 * Every op carries a `reason` (Gemini's short justification) which powers the
 * persisted decision log surfaced to the user.
 */

/** Seconds from the start of the source video. */
const TimeSec = z.number().min(0);

const BaseOp = z.object({
  id: z.string().min(1),
  /** Where this decision came from. */
  source: z.enum(['gemini', 'silence-detector']).default('gemini'),
  start: TimeSec,
  end: TimeSec,
  /** Short human-readable justification, shown in the decision log. */
  reason: z.string().min(1).max(400),
});

/** Remove a segment of dead air / filler ("jump cut"). */
export const SilenceCutOp = BaseOp.extend({
  type: z.literal('silence_cut'),
});

/** Animated word-by-word captions over a spoken segment. */
export const CaptionOp = BaseOp.extend({
  type: z.literal('caption'),
  style: z.enum(['word_highlight', 'bold_pop', 'karaoke', 'typewriter']).default('word_highlight'),
  /** Words to visually emphasize (optional). */
  emphasis: z.array(z.string()).max(20).optional(),
});

/** Punch-in zoom to add energy / mark emphasis or a hook. */
export const ZoomPunchOp = BaseOp.extend({
  type: z.literal('zoom_punch'),
  scale: z.number().min(1.02).max(1.6).default(1.15),
  focus: z.enum(['center', 'face', 'left', 'right', 'top']).default('center'),
});

/** Lower-third name/title card. */
export const LowerThirdOp = BaseOp.extend({
  type: z.literal('lower_third'),
  title: z.string().min(1).max(80),
  subtitle: z.string().max(120).optional(),
});

/** Overlay stock b-roll (Pexels) illustrating what's being said. */
export const BrollOp = BaseOp.extend({
  type: z.literal('broll'),
  /** Search concept for Pexels, 2-5 keywords. */
  query: z.string().min(2).max(120),
  layout: z.enum(['full', 'pip']).default('full'),
});

/** Full-screen intro or CTA title card overlaid on the footage. */
export const TitleCardOp = BaseOp.extend({
  type: z.literal('title_card'),
  variant: z.enum(['intro', 'cta']).default('intro'),
  heading: z.string().min(1).max(80),
  sub: z.string().max(120).optional(),
});

/** Animated stat / metric badge (scale-pop) for a number or key figure. */
export const StatCalloutOp = BaseOp.extend({
  type: z.literal('stat_callout'),
  /** The headline figure, e.g. "$1.2M", "3x", "+40%". */
  value: z.string().min(1).max(24),
  /** Short label under the value, e.g. "revenue growth". */
  label: z.string().max(60).optional(),
  position: z.enum(['center', 'corner']).default('center'),
});

/** Short transition effect at a scene boundary. */
export const TransitionOp = BaseOp.extend({
  type: z.literal('transition'),
  variant: z.enum(['glitch', 'flash', 'zoom_blur']).default('flash'),
});

/** Pro Lottie animation overlay chosen from the bundled registry. */
export const LottieOp = BaseOp.extend({
  type: z.literal('lottie'),
  /** Registry template id (see LOTTIE_TEMPLATES). */
  template: z.string().min(1),
  position: z.enum(['full', 'center', 'corner']).optional(),
});

/** Real 3D effect (Three.js) chosen from the 3D registry. */
export const ThreeOp = BaseOp.extend({
  type: z.literal('three'),
  /** 3D template id (see THREE_TEMPLATES): stat_orb | card_3d. */
  template: z.string().min(1),
  value: z.string().max(24).optional(),
  label: z.string().max(60).optional(),
});

/** Hand-drawn marker annotation on the frame (arrow/circle/underline/etc). */
export const AnnotateOp = BaseOp.extend({
  type: z.literal('annotate'),
  annotation: z.enum(['arrow', 'circle', 'underline', 'box', 'strike', 'scribble', 'checkmark', 'cross']).default('arrow'),
  /** Target region (normalized 0..1): what to point at / circle / underline. */
  x: z.number().min(0).max(1).default(0.35),
  y: z.number().min(0).max(1).default(0.35),
  w: z.number().min(0.02).max(1).default(0.3),
  h: z.number().min(0.02).max(1).default(0.3),
  /** Arrow tail (arrow only). */
  fromX: z.number().min(0).max(1).optional(),
  fromY: z.number().min(0).max(1).optional(),
  color: z.string().optional(),
});

/** Bright pill label + arrow pointing at a person/object ("YOUNG MARK"). */
export const NameTagOp = BaseOp.extend({
  type: z.literal('name_tag'),
  text: z.string().min(1).max(40),
  targetX: z.number().min(0).max(1).default(0.5),
  targetY: z.number().min(0).max(1).default(0.35),
  side: z.enum(['below', 'left', 'right']).default('below'),
});

/** Row-by-row checklist / do-and-dont with check, cross, or dot markers. */
export const ChecklistOp = BaseOp.extend({
  type: z.literal('checklist'),
  title: z.string().max(40).optional(),
  items: z.array(z.object({ text: z.string().min(1).max(48), mark: z.enum(['check', 'cross', 'dot']).default('dot') })).min(1).max(6),
  position: z.enum(['center', 'left']).default('center'),
});

/** Two-column side-by-side comparison with up/down arrows. */
export const ComparisonOp = BaseOp.extend({
  type: z.literal('comparison'),
  leftTitle: z.string().max(28).optional(),
  rightTitle: z.string().max(28).optional(),
  leftItems: z.array(z.string().min(1).max(40)).max(4).default([]),
  rightItems: z.array(z.string().min(1).max(40)).max(4).default([]),
  leftTone: z.enum(['bad', 'good', 'neutral']).default('bad'),
  rightTone: z.enum(['bad', 'good', 'neutral']).default('good'),
});

/** Vertical stacking list — outlined pills, numbered steps, or a to-do list. */
export const StackListOp = BaseOp.extend({
  type: z.literal('stack_list'),
  /** Rows of the list (distinct name avoids clashing with checklist `items`). */
  listItems: z.array(z.string().min(1).max(48)).min(1).max(6),
  variant: z.enum(['outline', 'number', 'bullet']).default('outline'),
  position: z.enum(['center', 'left', 'topleft']).default('center'),
});

/** Animated data widget — progress bar, red→green gauge, or count up/down. */
export const ProgressOp = BaseOp.extend({
  type: z.literal('progress'),
  variant: z.enum(['bar', 'gauge', 'counter']).default('bar'),
  /** Fill % (0–100) for bar/gauge; the end number for counter. Named `amount`
   * so it stays numeric (the shared `value` field is a string for stat/three). */
  amount: z.number().default(70),
  /** Counter start value (counter only). */
  from: z.number().optional(),
  label: z.string().max(40).optional(),
  /** Counter suffix, e.g. "%", "x", "s". */
  suffix: z.string().max(4).optional(),
  position: z.enum(['lower', 'center', 'corner', 'left', 'right']).default('lower'),
});

/** Animated data chart — bar / line / area / donut. */
export const ChartOp = BaseOp.extend({
  type: z.literal('chart'),
  variant: z.enum(['bar', 'line', 'area', 'donut']).default('bar'),
  data: z.array(z.object({ label: z.string().max(24).optional(), value: z.number() })).min(1).max(8),
  title: z.string().max(40).optional(),
  prefix: z.string().max(4).optional(),
  suffix: z.string().max(4).optional(),
  position: z.enum(['center', 'left', 'right']).default('center'),
});

export const EditOp = z.discriminatedUnion('type', [
  SilenceCutOp,
  CaptionOp,
  ZoomPunchOp,
  LowerThirdOp,
  BrollOp,
  TitleCardOp,
  StatCalloutOp,
  TransitionOp,
  LottieOp,
  ThreeOp,
  AnnotateOp,
  NameTagOp,
  ChecklistOp,
  ComparisonOp,
  StackListOp,
  ProgressOp,
  ChartOp,
]);
export type EditOp = z.infer<typeof EditOp>;
export type EditOpType = EditOp['type'];

export const EDL_VERSION = 1 as const;

export const Edl = z.object({
  version: z.literal(EDL_VERSION).default(EDL_VERSION),
  /** One-paragraph editorial summary of the approach taken. */
  summary: z.string().max(1000).optional(),
  /** AI-chosen caption position (from the PLAN stage). Defaults to 'lower' at render. */
  captionPlacement: z.enum(['lower', 'middle', 'upper']).optional(),
  ops: z.array(EditOp),
});
export type Edl = z.infer<typeof Edl>;

/** Analysis metadata stored alongside the EDL on a project. */
export interface AnalysisMeta {
  model: string;
  generatedAt: string;
  /** Which configured Gemini key index produced it (for debugging). */
  keyIndex?: number;
  transcriptWords?: number;
  silenceSegments?: number;
  /** How many Inspiration Vault references informed the edit. */
  referencesUsed?: number;
  /** Multi-stage brain: number of planned beats. */
  beats?: number;
  /** Whether the web-research (Google Search grounding) stage ran. */
  researched?: boolean;
  repaired?: boolean;
}

/** A single decision-log row (derived view over EDL ops). */
export interface DecisionLogEntry {
  type: EditOpType;
  start: number;
  end: number;
  reason: string;
  source: string;
}

export function toDecisionLog(edl: Edl): DecisionLogEntry[] {
  return [...edl.ops]
    .sort((a, b) => a.start - b.start || a.end - b.end)
    .map((op) => ({
      type: op.type,
      start: op.start,
      end: op.end,
      reason: op.reason,
      source: op.source,
    }));
}

/**
 * Validate + normalize raw JSON from the model. Drops ops with end <= start or
 * end beyond the video duration (clamps), returning the parsed EDL plus any
 * non-fatal warnings for logging.
 */
/**
 * Strip null / empty-string values so the discriminated-union parse doesn't
 * choke on irrelevant params the flat response schema emits (e.g. `scale: null`
 * on a caption op).
 */
function stripEmpty(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripEmpty);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === null || v === undefined || v === '') continue;
      out[k] = stripEmpty(v);
    }
    return out;
  }
  return value;
}

export function parseEdl(
  raw: unknown,
  opts: { durationSec?: number | null } = {},
): { edl: Edl; warnings: string[] } {
  const cleaned = stripEmpty(raw) as { summary?: unknown; ops?: unknown };
  const warnings: string[] = [];
  const dur = opts.durationSec ?? null;

  const rawOps = Array.isArray(cleaned?.ops) ? cleaned.ops : [];

  // Validate each op independently so one malformed op (e.g. a lower_third the
  // model emitted without a title) is dropped rather than failing the whole edit.
  const valid: EditOp[] = [];
  for (const op of rawOps) {
    const res = EditOp.safeParse(op);
    if (!res.success) {
      const t = (op as { type?: string })?.type ?? 'unknown';
      warnings.push(`Dropped invalid ${t} op: ${res.error.issues[0]?.message ?? 'schema error'}`);
      continue;
    }
    valid.push(res.data);
  }

  // If the model returned ops but none survived, treat as a failure so the
  // caller's repair/failover can retry.
  if (rawOps.length > 0 && valid.length === 0) {
    throw new Error(`All ${rawOps.length} ops failed validation: ${warnings.join('; ')}`);
  }

  // Normalize timing: drop ops that start beyond the video, clamp ends to the
  // duration, then drop anything left with end <= start. (Gemini can drift and
  // emit timestamps past the real duration on longer videos.)
  const clamped: EditOp[] = [];
  for (const op of valid) {
    if (dur != null && op.start >= dur) {
      warnings.push(`Dropped ${op.type} starting past duration (${op.start} >= ${dur})`);
      continue;
    }
    let end = op.end;
    if (dur != null && end > dur + 0.5) {
      warnings.push(`Clamped ${op.type} end ${op.end} -> ${dur}`);
      end = dur;
    }
    if (end <= op.start) {
      warnings.push(`Dropped ${op.type} with end<=start (${op.start}->${op.end})`);
      continue;
    }
    clamped.push(end === op.end ? op : ({ ...op, end } as EditOp));
  }

  const summary = typeof cleaned?.summary === 'string' ? cleaned.summary : undefined;
  const cp = (cleaned as { captionPlacement?: unknown }).captionPlacement;
  const captionPlacement =
    cp === 'lower' || cp === 'middle' || cp === 'upper' ? cp : undefined;
  return { edl: { version: EDL_VERSION, summary, captionPlacement, ops: clamped }, warnings };
}
