import type { Edl, EditOp } from '../../edl/schema';
import type { TranscriptWord } from '../../analyze/transcribe';
import { computeKeepSegments, cutRangesFromEdl } from '../../render/segments';
import { remapRange, buildAutoCaptions } from '../../render/timeline';
import { IR_VERSION } from './version';
import type { MotionComposition } from './types';
import { resolveTemplate } from '../compiler/resolveTemplates';
import type { BuildCtx } from '../templates/helpers';
import { DEFAULT_BRAND, type BrandProfile } from '../brand';
import { resolveCaptionConfig, type CaptionConfig } from '../captions';
import { compact, type EffectStyle } from '../effects';

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
 * Per-project effectStyle overrides are merged in (they win over EDL values).
 * (Captions are generated densely from the transcript, not per-op.) */
function templateForOp(op: EditOp, effectStyle?: EffectStyle): { templateId: string; params: Record<string, unknown> } {
  switch (op.type) {
    case 'zoom_punch':
      return { templateId: 'camera_punch', params: { scale: op.scale, focus: op.focus } };
    case 'lower_third':
      return { templateId: 'lower_third', params: { title: op.title, subtitle: op.subtitle, ...compact(effectStyle?.lowerThird) } };
    case 'stat_callout':
      return { templateId: 'metric_pop', params: { value: op.value, label: op.label, position: op.position, ...compact(effectStyle?.stat) } };
    case 'title_card':
      return { templateId: 'title_card', params: { heading: op.heading, sub: op.sub, variant: op.variant, ...compact(effectStyle?.titleCard) } };
    case 'transition':
      return { templateId: 'transition', params: { variant: op.variant } };
    case 'broll':
      return { templateId: 'broll', params: { layout: op.layout } };
    case 'lottie':
      return { templateId: 'lottie', params: { template: op.template, position: op.position } };
    case 'three':
      return { templateId: 'three', params: { template: op.template, value: op.value, label: op.label } };
    case 'annotate':
      return { templateId: 'annotate', params: { annotation: op.annotation, x: op.x, y: op.y, w: op.w, h: op.h, fromX: op.fromX, fromY: op.fromY, color: op.color } };
    case 'name_tag':
      return { templateId: 'name_tag', params: { text: op.text, targetX: op.targetX, targetY: op.targetY, side: op.side } };
    case 'checklist':
      return { templateId: 'checklist', params: { title: op.title, items: op.items, position: op.position } };
    case 'comparison':
      return { templateId: 'comparison', params: { leftTitle: op.leftTitle, rightTitle: op.rightTitle, leftItems: op.leftItems, rightItems: op.rightItems, leftTone: op.leftTone, rightTone: op.rightTone } };
    case 'stack_list':
      return { templateId: 'stack_list', params: { items: op.listItems, variant: op.variant, position: op.position } };
    case 'progress':
      return { templateId: 'progress', params: { variant: op.variant, value: op.amount, from: op.from, label: op.label, suffix: op.suffix, position: op.position } };
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
  /** Per-project caption look (preset name or partial config). When set, it wins
   * over the per-op caption style so the whole video shares one caption style. */
  captionConfig?: string | CaptionConfig,
  /** Per-project overrides for the other overlay effects (size/colors/font/pos). */
  effectStyle?: EffectStyle,
): MotionFromEdlResult {
  const cfg = captionConfig != null ? resolveCaptionConfig(captionConfig) : undefined;
  const keep = computeKeepSegments(sourceDurationSec, cutRangesFromEdl(edl), { minKeepSec: 0.05 });
  const warnings: string[] = [];
  const compositions: MotionComposition[] = [];
  // Caption ops become STYLE hints over cut-time ranges; the actual dense caption
  // coverage is generated from the full transcript below (matches the EDL path).
  // Caption ops only carry the original 4 styles (matches buildAutoCaptions);
  // the richer preset styles arrive via captionConfig, not per-op hints.
  const captionStyleRanges: { start: number; end: number; style: 'word_highlight' | 'bold_pop' | 'karaoke' | 'typewriter' }[] = [];
  const captionEmphasis = new Set<string>();

  for (const op of edl.ops) {
    if (op.type === 'silence_cut') continue; // consumed into the timeline

    const mapped = remapRange({ start: op.start, end: op.end }, keep);
    if (!mapped) {
      warnings.push(`Dropped ${op.type} (${op.id}) — collapsed into a removed segment`);
      continue;
    }

    if (op.type === 'caption') {
      captionStyleRanges.push({ start: mapped.start, end: mapped.end, style: op.style });
      for (const w of op.emphasis ?? []) captionEmphasis.add(w);
      continue; // consumed as a style hint
    }

    const dur = round(mapped.end - mapped.start);
    const ctx: BuildCtx = { idPrefix: op.id, dur, canvas, brand };
    const { templateId, params } = templateForOp(op, effectStyle);
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
  // Punchy phrases so few words are on screen at once — reads better and lets the
  // per-word reveal animation breathe. Phrase length follows the chosen preset.
  const captions = buildAutoCaptions(transcript, keep, captionStyleRanges, { maxWords: cfg?.maxWords ?? 3 });
  captions.forEach((c, i) => {
    const dur = round(c.end - c.start);
    const words = c.words.map((w) => ({ word: w.word, start: round(w.start - c.start), end: round(w.end - c.start) }));
    const ctx: BuildCtx = { idPrefix: `cap_${i}`, dur, canvas, brand, input: { words, emphasis: captionEmphasis.size > 0 ? [...captionEmphasis] : undefined } };
    // Preset (if set) controls the look; otherwise use the per-op style + defaults.
    const params: Record<string, unknown> = {
      style: cfg?.style ?? c.style,
      placement: cfg?.placement ?? edl.captionPlacement ?? 'lower',
    };
    if (cfg?.size != null) params.size = cfg.size;
    if (cfg?.fill) params.fill = cfg.fill;
    if (cfg?.highlight) params.highlight = cfg.highlight;
    if (cfg?.fontFamily) params.fontFamily = cfg.fontFamily;
    if (cfg?.weight != null) params.weight = cfg.weight;
    if (cfg?.tracking != null) params.tracking = cfg.tracking;
    if (cfg?.box != null) params.box = cfg.box;
    if (cfg?.boxColor) params.boxColor = cfg.boxColor;
    if (cfg?.boxBlur != null) params.boxBlur = cfg.boxBlur;
    if (cfg?.maxWidth != null) params.maxWidth = cfg.maxWidth;
    if (cfg?.outlineColor) params.outlineColor = cfg.outlineColor;
    if (cfg?.outlineWidth != null) params.outlineWidth = cfg.outlineWidth;
    const { layers, warnings: tplWarnings } = resolveTemplate('kinetic_text', params, ctx);
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
