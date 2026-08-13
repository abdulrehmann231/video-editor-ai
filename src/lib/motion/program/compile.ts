import type { TranscriptWord } from '../../analyze/transcribe';
import { computeKeepSegments } from '../../render/segments';
import { remapRange, buildAutoCaptions } from '../../render/timeline';
import { IR_VERSION } from '../ir/version';
import type { Camera, MotionComposition, MotionLayer } from '../ir/types';
import { resolveTemplate } from '../compiler/resolveTemplates';
import { templateForOp } from '../ir/fromEdl';
import type { BuildCtx } from '../templates/helpers';
import { DEFAULT_BRAND, type BrandProfile } from '../brand';
import { resolveCaptionConfig, type CaptionConfig } from '../captions';
import type { EffectStyle } from '../effects';
import type { MotionProgram } from './schema';

/**
 * MotionProgram → Motion IR (Phase 6). Each SCENE compiles into ONE composition
 * whose layers are all of the scene's ELEMENTS composited together (staggered by
 * each element's cut-time offset within the scene). Reuses the exact same
 * source→cut remap (computeKeepSegments/remapRange) and template compiler as the
 * EDL path, so both engines share one timeline authority. Dense word captions are
 * generated from the transcript exactly as in the EDL path.
 */

export interface CanvasSpec {
  width: number;
  height: number;
  fps: number;
}

export interface ProgramToMotionResult {
  compositions: MotionComposition[];
  warnings: string[];
}

const round = (n: number): number => Math.round(n * 1000) / 1000;

/** Offset a layer (and only the top level — group children are parent-relative
 * in the renderer) so it reveals at `offset` seconds into the scene composition. */
function shiftLayer(layer: MotionLayer, offset: number): MotionLayer {
  return { ...layer, start: round(layer.start + offset) };
}

export function programToMotion(
  program: MotionProgram,
  transcript: TranscriptWord[],
  sourceDurationSec: number,
  canvas: CanvasSpec,
  brand: BrandProfile = DEFAULT_BRAND,
  captionConfig?: string | CaptionConfig,
  effectStyle?: EffectStyle,
): ProgramToMotionResult {
  const cfg = captionConfig != null ? resolveCaptionConfig(captionConfig) : undefined;
  const keep = computeKeepSegments(sourceDurationSec, program.cuts, { minKeepSec: 0.05 });
  const warnings: string[] = [];
  const compositions: MotionComposition[] = [];

  const captionStyleRanges: { start: number; end: number; style: 'word_highlight' | 'bold_pop' | 'karaoke' | 'typewriter' }[] = [];
  const captionEmphasis = new Set<string>();

  for (const scene of program.scenes) {
    const sceneCut = remapRange({ start: scene.start, end: scene.end }, keep);
    if (!sceneCut) {
      warnings.push(`Dropped scene ${scene.id} — collapsed into a removed segment`);
      continue;
    }
    const sceneDur = round(sceneCut.end - sceneCut.start);
    const layers: MotionLayer[] = [];
    let sceneCamera: Camera | undefined;

    for (const op of scene.elements) {
      if (op.type === 'caption') {
        const m = remapRange({ start: op.start, end: op.end }, keep);
        if (m) {
          captionStyleRanges.push({ start: m.start, end: m.end, style: op.style });
          for (const w of op.emphasis ?? []) captionEmphasis.add(w);
        }
        continue;
      }
      const mapped = remapRange({ start: op.start, end: op.end }, keep);
      if (!mapped) {
        warnings.push(`Dropped element ${op.id} (${op.type}) — collapsed into a removed segment`);
        continue;
      }
      const elemDur = round(mapped.end - mapped.start);
      const offset = round(Math.max(0, mapped.start - sceneCut.start));
      const ctx: BuildCtx = { idPrefix: op.id, dur: elemDur, canvas, brand };
      const { templateId, params } = templateForOp(op, effectStyle);
      const { layers: elemLayers, camera, warnings: tw } = resolveTemplate(templateId, params, ctx);
      warnings.push(...tw);
      if (camera) sceneCamera = camera; // e.g. a zoom_punch element drives the scene camera
      for (const l of elemLayers) layers.push(offset > 0 ? shiftLayer(l, offset) : l);
    }

    if (layers.length === 0 && !sceneCamera) {
      warnings.push(`Scene ${scene.id} produced no renderable layers`);
      continue;
    }

    compositions.push({
      schemaVersion: IR_VERSION,
      id: `scene_${scene.id}`,
      start: sceneCut.start,
      end: sceneCut.end,
      timeBasis: 'cut',
      coordinateSpace: 'normalized',
      canvas,
      ...(sceneCamera ? { camera: sceneCamera } : {}),
      layers,
      metadata: {
        sourceOpId: scene.id,
        sourceOpType: 'scene',
        reason: scene.reason,
        purpose: scene.intent,
      },
    });
    void sceneDur;
  }

  // Dense word-by-word captions across the whole spoken content (identical to the
  // EDL path); scene caption elements only apply a STYLE over their range.
  const captions = buildAutoCaptions(transcript, keep, captionStyleRanges, { maxWords: cfg?.maxWords ?? 3 });
  captions.forEach((c, i) => {
    const dur = round(c.end - c.start);
    const words = c.words.map((w) => ({ word: w.word, start: round(w.start - c.start), end: round(w.end - c.start) }));
    const ctx: BuildCtx = { idPrefix: `cap_${i}`, dur, canvas, brand, input: { words, emphasis: captionEmphasis.size > 0 ? [...captionEmphasis] : undefined } };
    const params: Record<string, unknown> = {
      style: cfg?.style ?? c.style,
      placement: cfg?.placement ?? program.captionPlacement ?? 'lower',
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
    const { layers, warnings: tw } = resolveTemplate('kinetic_text', params, ctx);
    warnings.push(...tw);
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
