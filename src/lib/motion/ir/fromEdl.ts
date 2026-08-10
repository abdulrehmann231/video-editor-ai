import type { Edl, EditOp } from '../../edl/schema';
import type { TranscriptWord } from '../../analyze/transcribe';
import { computeKeepSegments, cutRangesFromEdl } from '../../render/segments';
import { remapRange } from '../../render/timeline';
import { IR_VERSION } from './version';
import type { MotionComposition } from './types';
import { resolveTemplate } from '../compiler/resolveTemplates';
import type { BuildCtx } from '../templates/helpers';

/**
 * EDL -> Motion IR adapter (engine plan §50 compatibility layer).
 *
 * Reuses the SAME source-time -> cut-time remap that buildOverlayPlan uses
 * (computeKeepSegments + remapRange), so IR compositions live on the identical
 * compressed timeline as today's overlays. Silence cuts are consumed into the
 * timeline; every other op maps to a { templateId, params } instance that the
 * template compiler expands into layers (+ camera). This is the Phase-3 form:
 * the adapter no longer hand-builds layers — it selects templates, exactly as
 * the AI will.
 */

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

function wordsInRange(transcript: TranscriptWord[], start: number, end: number): string {
  return transcript
    .filter((w) => w.end > start && w.start < end)
    .map((w) => w.word.trim())
    .filter(Boolean)
    .join(' ');
}

/** Map an EDL op to the effect template + params that realize it. */
function templateForOp(op: EditOp, transcript: TranscriptWord[]): { templateId: string; params: Record<string, unknown> } {
  switch (op.type) {
    case 'caption':
      return { templateId: 'kinetic_text', params: { text: wordsInRange(transcript, op.start, op.end), style: op.style } };
    case 'zoom_punch':
      return { templateId: 'camera_punch', params: { scale: op.scale, focus: op.focus } };
    case 'lower_third':
      return { templateId: 'lower_third', params: { title: op.title, subtitle: op.subtitle } };
    case 'stat_callout':
      return { templateId: 'metric_pop', params: { value: op.value, label: op.label, position: op.position } };
    case 'title_card':
      return { templateId: 'title_card', params: { heading: op.heading, sub: op.sub, variant: op.variant } };
    case 'transition':
      return { templateId: 'transition', params: { variant: op.variant } };
    case 'broll':
      return { templateId: 'broll', params: { layout: op.layout } };
    case 'lottie':
    case 'three':
      return { templateId: 'placeholder', params: {} };
    default:
      return { templateId: 'placeholder', params: {} };
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
    const ctx: BuildCtx = { idPrefix: op.id, dur, canvas };
    const { templateId, params } = templateForOp(op, transcript);
    const { layers, camera, warnings: tplWarnings } = resolveTemplate(templateId, params, ctx);
    warnings.push(...tplWarnings);

    compositions.push({
      schemaVersion: IR_VERSION,
      id: `comp_${op.id}`,
      start: mapped.start,
      end: mapped.end,
      timeBasis: 'cut',
      coordinateSpace: 'normalized',
      canvas,
      ...(camera ? { camera } : {}),
      layers,
      metadata: {
        sourceOpId: op.id,
        sourceOpType: op.type,
        reason: op.reason,
        template: templateId,
        ...(op.type === 'transition' ? { variant: op.variant } : {}),
        ...(op.type === 'broll' ? { query: op.query } : {}),
        ...(op.type === 'lottie' || op.type === 'three' ? { template: op.template } : {}),
      },
    });
  }

  return { compositions, warnings };
}
