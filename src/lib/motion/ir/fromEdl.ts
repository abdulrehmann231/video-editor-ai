import type { Edl, EditOp } from '../../edl/schema';
import type { TranscriptWord } from '../../analyze/transcribe';
import { computeKeepSegments, cutRangesFromEdl } from '../../render/segments';
import { remapRange } from '../../render/timeline';
import { IR_VERSION } from './version';
import type {
  Animated,
  MotionComposition,
  MotionLayer,
  ShapeLayer,
  TextLayer,
  Vec3,
} from './types';

/**
 * EDL -> Motion IR adapter (engine plan §50 compatibility layer).
 *
 * Reuses the SAME source-time -> cut-time remap that buildOverlayPlan uses
 * (computeKeepSegments + remapRange), so IR compositions live on the identical
 * compressed timeline as today's overlays. Silence cuts are consumed into the
 * timeline; every other op becomes one composition ("motion program per moment",
 * §44) carrying provenance metadata for the decision log.
 *
 * Phase 1 is data-only: nothing here is wired into the render path. It exists so
 * the existing EDL can be losslessly expressed as valid Motion IR.
 */

// Local palette (kept in sync with src/remotion/theme.ts COLORS; inlined so this
// Node-side module doesn't import the Remotion/google-fonts bundle).
const WHITE = '#ffffff';
const INK = '#0b0d12';
const ACCENT = '#ffd60a';

export interface CanvasSpec {
  width: number;
  height: number;
  fps: number;
}

export interface MotionFromEdlResult {
  compositions: MotionComposition[];
  warnings: string[];
}

const round = (n: number): number => Math.round(n * 1000) / 1000;

const constant = <T>(value: T): Animated<T> => ({ kind: 'constant', value });

/** Fade in over the first ~250ms, then hold. Times clamped to [0, dur]. */
function fadeIn(dur: number): Animated<number> {
  const mid = Math.min(0.25, dur);
  return {
    kind: 'keyframes',
    keyframes: [
      { time: 0, value: 0, easing: { type: 'easeOut' } },
      { time: mid, value: 1 },
      { time: dur, value: 1 },
    ],
  };
}

/** Spring scale-pop from 0 to `target`. */
function scalePop(target = 1): Animated<Vec3> {
  return {
    kind: 'spring',
    from: [0, 0, 0],
    value: [target, target, target],
    spring: { mass: 1, stiffness: 180, damping: 16 },
  };
}

/** Punch-in scale: 1 -> target (hold) -> 1, keyframed within the duration. */
function punchScale(target: number, dur: number): Animated<Vec3> {
  const ramp = Math.min(0.15, dur * 0.3);
  return {
    kind: 'keyframes',
    keyframes: [
      { time: 0, value: [1, 1, 1], easing: { type: 'easeOut' } },
      { time: ramp, value: [target, target, target] },
      { time: Math.max(ramp, dur - ramp), value: [target, target, target] },
      { time: dur, value: [1, 1, 1] },
    ],
  };
}

function textLayer(
  id: string,
  content: string,
  pos: [number, number],
  size: number,
  dur: number,
  fill: string = WHITE,
): TextLayer {
  return {
    id,
    type: 'text',
    content,
    start: 0,
    duration: dur,
    opacity: fadeIn(dur),
    transform: { position: constant<Vec3>([pos[0], pos[1], 0]) },
    font: { family: 'Anton', weight: 800, size },
    align: 'center',
    fill,
  };
}

function shapeLayer(id: string, extra: Omit<ShapeLayer, 'id' | 'type' | 'start' | 'duration'>, dur: number): ShapeLayer {
  return { id, type: 'shape', start: 0, duration: dur, ...extra };
}

function wordsInRange(transcript: TranscriptWord[], start: number, end: number): string {
  return transcript
    .filter((w) => w.end > start && w.start < end)
    .map((w) => w.word.trim())
    .filter(Boolean)
    .join(' ');
}

/** Build the layers for a single (non-silence) op. */
function layersForOp(op: EditOp, dur: number, canvas: CanvasSpec, transcript: TranscriptWord[]): MotionLayer[] {
  const W = canvas.width;
  switch (op.type) {
    case 'caption':
      return [textLayer(`${op.id}_cap`, wordsInRange(transcript, op.start, op.end), [0.5, 0.82], Math.round(W * 0.05), dur)];

    case 'zoom_punch':
      // A group carrying the base-video punch transform (children filled by the
      // real renderer in a later phase).
      return [{ id: `${op.id}_punch`, type: 'group', start: 0, duration: dur, children: [], transform: { scale: punchScale(op.scale, dur) } }];

    case 'lower_third':
      return [
        {
          id: `${op.id}_lt`,
          type: 'group',
          start: 0,
          duration: dur,
          children: [
            shapeLayer(
              `${op.id}_bg`,
              {
                shape: 'rounded_rectangle',
                size: [0.42, 0.14],
                radius: 0.02,
                fill: INK,
                opacity: constant(0.72),
                transform: { position: constant<Vec3>([0.28, 0.82, 0]) },
              },
              dur,
            ),
            textLayer(`${op.id}_title`, op.title, [0.28, 0.8], Math.round(W * 0.03), dur),
            ...(op.subtitle ? [textLayer(`${op.id}_sub`, op.subtitle, [0.28, 0.86], Math.round(W * 0.02), dur, ACCENT)] : []),
          ],
        },
      ];

    case 'stat_callout': {
      const [cx, cy] = op.position === 'corner' ? [0.8, 0.2] : [0.5, 0.45];
      return [
        {
          id: `${op.id}_stat`,
          type: 'group',
          start: 0,
          duration: dur,
          children: [
            shapeLayer(
              `${op.id}_accent`,
              { shape: 'circle', radius: 0.12, fill: ACCENT, opacity: constant(0.18), transform: { position: constant<Vec3>([cx, cy, 0]), scale: scalePop(1) } },
              dur,
            ),
            {
              ...textLayer(`${op.id}_val`, op.value, [cx, cy], Math.round(W * 0.09), dur),
              transform: { position: constant<Vec3>([cx, cy, 0]), scale: scalePop(1) },
            },
            ...(op.label ? [textLayer(`${op.id}_lbl`, op.label, [cx, cy + 0.09], Math.round(W * 0.03), dur)] : []),
          ],
        },
      ];
    }

    case 'title_card':
      return [
        {
          id: `${op.id}_card`,
          type: 'group',
          start: 0,
          duration: dur,
          children: [
            shapeLayer(`${op.id}_cbg`, { shape: 'rectangle', size: [1, 1], fill: INK, opacity: constant(0.55), transform: { position: constant<Vec3>([0.5, 0.5, 0]) } }, dur),
            textLayer(`${op.id}_head`, op.heading, [0.5, 0.44], Math.round(W * 0.08), dur),
            ...(op.sub ? [textLayer(`${op.id}_csub`, op.sub, [0.5, 0.56], Math.round(W * 0.035), dur, ACCENT)] : []),
          ],
        },
      ];

    case 'transition':
      return [
        shapeLayer(
          `${op.id}_flash`,
          {
            shape: 'rectangle',
            size: [1, 1],
            fill: WHITE,
            transform: { position: constant<Vec3>([0.5, 0.5, 0]) },
            opacity: { kind: 'keyframes', keyframes: [{ time: 0, value: 0 }, { time: dur / 2, value: 0.9 }, { time: dur, value: 0 }] },
          },
          dur,
        ),
      ];

    case 'broll': {
      const full = op.layout === 'full';
      return [
        {
          id: `${op.id}_broll`,
          type: 'video',
          start: 0,
          duration: dur,
          fit: full ? 'cover' : 'contain',
          opacity: constant(1),
          // src left unresolved — Pexels resolution stays in resolveBroll.
          transform: {
            position: constant<Vec3>(full ? [0.5, 0.5, 0] : [0.72, 0.28, 0]),
            scale: constant<Vec3>(full ? [1, 1, 1] : [0.36, 0.36, 1]),
          },
        },
      ];
    }

    case 'lottie':
    case 'three':
      // Placeholder group; template->program mapping happens in Phase 5.
      return [{ id: `${op.id}_${op.type}`, type: 'group', start: 0, duration: dur, children: [], opacity: constant(1) }];

    case 'silence_cut':
      return []; // consumed into the timeline; never a composition

    default:
      return [];
  }
}

/**
 * Convert an EDL + transcript into a list of Motion IR compositions on the cut
 * (compressed) timeline. Ops that fall entirely inside a removed segment are
 * dropped with a warning.
 */
export function motionFromEdl(
  edl: Edl,
  transcript: TranscriptWord[],
  sourceDurationSec: number,
  canvas: CanvasSpec,
): MotionFromEdlResult {
  const keep = computeKeepSegments(sourceDurationSec, cutRangesFromEdl(edl), { minKeepSec: 0.05 });
  const warnings: string[] = [];
  const compositions: MotionComposition[] = [];

  for (const op of edl.ops) {
    if (op.type === 'silence_cut') continue; // consumed into the timeline

    const mapped = remapRange({ start: op.start, end: op.end }, keep);
    if (!mapped) {
      warnings.push(`Dropped ${op.type} (${op.id}) — collapsed into a removed segment`);
      continue;
    }
    const dur = round(mapped.end - mapped.start);
    const layers = layersForOp(op, dur, canvas, transcript);

    compositions.push({
      schemaVersion: IR_VERSION,
      id: `comp_${op.id}`,
      start: mapped.start,
      end: mapped.end,
      timeBasis: 'cut',
      coordinateSpace: 'normalized',
      canvas,
      layers,
      metadata: {
        sourceOpId: op.id,
        sourceOpType: op.type,
        reason: op.reason,
        ...(op.type === 'transition' ? { variant: op.variant } : {}),
        ...(op.type === 'broll' ? { query: op.query } : {}),
        ...(op.type === 'lottie' || op.type === 'three' ? { template: op.template } : {}),
      },
    });
  }

  return { compositions, warnings };
}
