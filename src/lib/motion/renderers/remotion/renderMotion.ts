import { join } from 'node:path';
import { readFile, stat, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { selectComposition, renderMedia, ensureBrowser } from '@remotion/renderer';
import { putObject, publicUrl } from '../../../r2';
import { mixMusicDucked } from '../../../render/music';
import type { FinalRenderMeta, OutputLayout } from '../../../render/renderFinal';
import { useLambda, renderOnLambda } from '../../../render/lambda';
import { getRemotionBundle } from '../../../render/remotionBundle';
import type { MotionComposition, MotionLayer } from '../../ir/types';
import { buildMotionProps } from '../../render/props';

/**
 * Node-side orchestrator for the parallel Motion (IR-driven) render path. Mirrors
 * renderFinal.ts but selects the "Motion" composition and feeds it Motion IR
 * compositions. Kept separate so the default "Edit" path stays byte-identical.
 */

export interface MotionRenderInput {
  projectId: string;
  /** Public URL of the Phase-2 cut video (the base layer). */
  cutUrl: string;
  editMedia: { width?: number; height?: number; fps?: number; hasAudio?: boolean };
  compositions: MotionComposition[];
  /** Cut-timeline duration in seconds. */
  outputDurationSec: number;
  layout?: OutputLayout;
  progressBar?: boolean;
  /** If set (and audio present), mix this background-music file (ducked). */
  musicPath?: string;
  hasAudio?: boolean;
}

export interface MotionRenderResult {
  finalKey: string;
  url: string;
  meta: FinalRenderMeta;
}

/** Count compositions by their originating EDL op type (for the meta panel). */
function countByType(comps: MotionComposition[], type: string): number {
  return comps.filter((c) => c.metadata?.sourceOpType === type).length;
}

/** True if any layer (recursively) is a 3D (three) layer — needs a GL backend. */
function hasThree(comps: MotionComposition[]): boolean {
  const scan = (layers: MotionLayer[]): boolean =>
    layers.some((l) => l.type === 'three' || (l.type === 'group' && scan(l.children)));
  return comps.some((c) => scan(c.layers));
}

export async function renderFinalMotion(input: MotionRenderInput): Promise<MotionRenderResult> {
  const layout: OutputLayout = input.layout ?? 'landscape';
  const progressBar = input.progressBar ?? true;

  const inputProps = buildMotionProps({
    cutUrl: input.cutUrl,
    editMedia: input.editMedia,
    layout,
    compositions: input.compositions,
    outputDurationSec: input.outputDurationSec,
    progressBar,
  }) as unknown as Record<string, unknown>;

  const fetchTimeoutMs = Number(process.env.REMOTION_TIMEOUT_MS) || 180_000;
  const dir = await mkdtemp(join(tmpdir(), 'edit-ai-motion-'));
  const renderedPath = join(dir, 'render.mp4');

  const durationInFrames = Math.max(1, Math.round(input.outputDurationSec * (input.editMedia.fps ?? 30)));

  if (useLambda()) {
    // Parallel cloud render on the "Motion" composition.
    await renderOnLambda(inputProps, renderedPath, { durationInFrames, frameTimeoutMs: fetchTimeoutMs, compositionId: 'Motion' });
  } else {
    // 3D (three) layers need a GL backend; 'swangle' is software WebGL (no GPU).
    const chromiumOptions = hasThree(input.compositions) ? ({ gl: 'swangle' } as const) : undefined;
    await ensureBrowser();
    const serveUrl = await getRemotionBundle();
    const composition = await selectComposition({
      serveUrl,
      id: 'Motion',
      inputProps,
      timeoutInMilliseconds: fetchTimeoutMs,
      chromiumOptions,
    });
    await renderMedia({
      composition,
      serveUrl,
      codec: 'h264',
      outputLocation: renderedPath,
      inputProps,
      timeoutInMilliseconds: fetchTimeoutMs,
      chromiumOptions,
      offthreadVideoCacheSizeInBytes: 512 * 1024 * 1024,
    });
  }

  // Optional background-music ducking pass (same as the Edit path).
  let outPath = renderedPath;
  let musicApplied = false;
  if (input.musicPath && input.hasAudio) {
    const mixed = join(dir, 'final.mp4');
    try {
      await mixMusicDucked(renderedPath, input.musicPath, mixed);
      outPath = mixed;
      musicApplied = true;
    } catch {
      outPath = renderedPath;
    }
  }

  const [buf, fileStat] = await Promise.all([readFile(outPath), stat(outPath)]);
  const suffix = layout === 'shorts' ? 'shorts' : 'final';
  const finalKey = `renders/${input.projectId}/${suffix}-motion-${Date.now()}.mp4`;
  await putObject(finalKey, buf, 'video/mp4');

  const comps = input.compositions;
  const meta: FinalRenderMeta = {
    kind: 'final',
    layout,
    createdAt: new Date().toISOString(),
    durationSec: input.outputDurationSec,
    width: (inputProps as { width: number }).width,
    height: (inputProps as { height: number }).height,
    fps: (inputProps as { fps: number }).fps,
    zooms: countByType(comps, 'zoom_punch'),
    captions: countByType(comps, 'caption'),
    lowerThirds: countByType(comps, 'lower_third'),
    brolls: countByType(comps, 'broll'),
    brollsResolved: 0, // b-roll resolution into the IR is a later phase
    titleCards: countByType(comps, 'title_card'),
    statCallouts: countByType(comps, 'stat_callout'),
    transitions: countByType(comps, 'transition'),
    lotties: countByType(comps, 'lottie'),
    threes: countByType(comps, 'three'),
    progressBar,
    music: musicApplied,
    sizeBytes: fileStat.size,
  };

  return { finalKey, url: publicUrl(finalKey), meta };
}
