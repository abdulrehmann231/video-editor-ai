import type { Edl, EditOp } from '../../edl/schema';
import type { TranscriptWord } from '../../analyze/transcribe';
import { computeKeepSegments, cutRangesFromEdl } from '../../render/segments';
import { remapRange, buildAutoCaptions } from '../../render/timeline';
import { IR_VERSION } from './version';
import type { CaptionStyle, MotionComposition } from './types';
import { resolveTemplate } from '../compiler/resolveTemplates';
import type { BuildCtx } from '../templates/helpers';
import { DEFAULT_BRAND, type BrandProfile } from '../brand';

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

/** Map a non-caption EDL op to the effect template + params that realize it.
 * (Captions are generated densely from the transcript, not per-op.) */
function templateForOp(op: EditOp): { templateId: string; params: Record<string, unknown> } {
  switch (op.type) {
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
  brand: BrandProfile = DEFAULT_BRAND,
): MotionFromEdlResult {
  const keep = computeKeepSegments(sourceDurationSec, cutRangesFromEdl(edl), { minKeepSec: 0.05 });
  const warnings: string[] = [];
  const compositions: MotionComposition[] = [];
  // Caption ops become STYLE hints over cut-time ranges; the actual dense caption
  // coverage is generated from the full transcript below (matches the EDL path).
  const captionStyleRanges: { start: number; end: number; style: CaptionStyle }[] = [];

  for (const op of edl.ops) {
    if (op.type === 'silence_cut') continue; // consumed into the timeline

    const mapped = remapRange({ start: op.start, end: op.end }, keep);
    if (!mapped) {
      warnings.push(`Dropped ${op.type} (${op.id}) — collapsed into a removed segment`);
      continue;
    }

    if (op.type === 'caption') {
      captionStyleRanges.push({ start: mapped.start, end: mapped.end, style: op.style });
      continue; // consumed as a style hint
    }

    const dur = round(mapped.end - mapped.start);
    const ctx: BuildCtx = { idPrefix: op.id, dur, canvas, brand };
    const { templateId, params } = templateForOp(op);
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

  // Dense word-by-word captions across the whole spoken content (like a real
  // YouTube edit); Gemini caption ops apply their style over their ranges.
  // Punchy phrases (≤3 words) so few words are on screen at once — reads better
  // and lets the per-word reveal animation breathe.
  const captions = buildAutoCaptions(transcript, keep, captionStyleRanges, { maxWords: 3 });
  captions.forEach((c, i) => {
    const dur = round(c.end - c.start);
    const words = c.words.map((w) => ({ word: w.word, start: round(w.start - c.start), end: round(w.end - c.start) }));
    const ctx: BuildCtx = { idPrefix: `cap_${i}`, dur, canvas, brand, input: { words } };
    const { layers, warnings: tplWarnings } = resolveTemplate(
      'kinetic_text',
      { style: c.style, placement: edl.captionPlacement ?? 'lower' },
      ctx,
    );
    warnings.push(...tplWarnings);
    compositions.push({
      schemaVersion: IR_VERSION,
      id: `comp_cap_${i}`,
      start: c.start,
      end: c.end,
      timeBasis: 'cut',
      coordinateSpace: 'normalized',
      canvas,
      layers,
      metadata: { sourceOpType: 'caption', reason: 'Auto caption from transcript', template: 'kinetic_text' },
    });
  });

  return { compositions, warnings };
}
