import { join } from 'node:path';
import { readFile, stat, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { bundle } from '@remotion/bundler';
import { selectComposition, renderMedia, ensureBrowser } from '@remotion/renderer';
import { putObject, publicUrl } from '../r2';
import type { OverlayPlan } from './timeline';
import { mixMusicDucked } from './music';
import { useLambda, renderOnLambda } from './lambda';

export type OutputLayout = 'landscape' | 'shorts';

export interface FinalRenderMeta {
  kind: 'final';
  layout: OutputLayout;
  createdAt: string;
  durationSec: number;
  width: number;
  height: number;
  fps: number;
  zooms: number;
  captions: number;
  lowerThirds: number;
  brolls: number;
  brollsResolved: number;
  titleCards: number;
  statCallouts: number;
  transitions: number;
  progressBar: boolean;
  music: boolean;
  sizeBytes: number | null;
}

export interface FinalRenderInput {
  projectId: string;
  /** Public URL of the Phase-2 cut video (the base layer). */
  cutUrl: string;
  /** Native source dimensions (used for landscape output). */
  width: number;
  height: number;
  fps: number;
  plan: OverlayPlan;
  layout?: OutputLayout;
  progressBar?: boolean;
  /** If set, mix this background-music file (ducked) under the audio. */
  musicPath?: string;
  /** Whether the base has a voice track (gates music ducking). */
  hasAudio?: boolean;
}

/** 9:16 target resolution for Shorts. 720×1280 keeps memory modest (same pixel
 * count as 720p landscape) while remaining a valid vertical export. */
const SHORTS_DIMS = { width: 720, height: 1280 };

export interface FinalRenderResult {
  finalKey: string;
  url: string;
  meta: FinalRenderMeta;
}

// Bundle once per process; Remotion serve URL is reusable across renders.
let bundlePromise: Promise<string> | null = null;
function getBundle(): Promise<string> {
  if (!bundlePromise) {
    bundlePromise = bundle({
      entryPoint: join(process.cwd(), 'src/remotion/index.ts'),
      // keep webpack defaults; Remotion handles tsx/ts
    });
  }
  return bundlePromise;
}

/**
 * Phase 3 render: composite captions/zooms/lower-thirds/b-roll over the cut
 * video with Remotion (headless Chromium) and upload the final mp4 to R2.
 */
export async function renderFinal(input: FinalRenderInput): Promise<FinalRenderResult> {
  const layout: OutputLayout = input.layout ?? 'landscape';
  const progressBar = input.progressBar ?? true;
  const dims = layout === 'shorts' ? SHORTS_DIMS : { width: input.width, height: input.height };

  const fps = Math.max(1, Math.round(input.fps));
  const durationInFrames = Math.max(1, Math.round(input.plan.outputDurationSec * fps));

  const inputProps = {
    videoSrc: input.cutUrl,
    fps,
    width: dims.width,
    height: dims.height,
    durationInFrames,
    layout,
    progressBar,
    zooms: input.plan.zooms,
    captions: input.plan.captions,
    lowerThirds: input.plan.lowerThirds,
    brolls: input.plan.brolls,
    titleCards: input.plan.titleCards,
    statCallouts: input.plan.statCallouts,
    transitions: input.plan.transitions,
  };

  // The base video (cut) can be 100+ MB and is fetched over the network by
  // OffthreadVideo — give it a generous timeout so a slow first fetch/seek
  // doesn't trip Remotion's default ~28s delayRender limit.
  const fetchTimeoutMs = Number(process.env.REMOTION_TIMEOUT_MS) || 180_000;

  const dir = await mkdtemp(join(tmpdir(), 'edit-ai-final-'));
  const renderedPath = join(dir, 'render.mp4');

  if (useLambda()) {
    // Parallel cloud render on AWS Lambda (fast, scales). Same inputProps.
    await renderOnLambda(inputProps, renderedPath);
  } else {
    await ensureBrowser();
    const serveUrl = await getBundle();
    const composition = await selectComposition({
      serveUrl,
      id: 'Edit',
      inputProps,
      timeoutInMilliseconds: fetchTimeoutMs,
    });
    await renderMedia({
      composition,
      serveUrl,
      codec: 'h264',
      outputLocation: renderedPath,
      inputProps,
      timeoutInMilliseconds: fetchTimeoutMs,
      // Cache decoded frames of the (large) base video across the render.
      offthreadVideoCacheSizeInBytes: 512 * 1024 * 1024,
      // Let Remotion pick concurrency from the host's core count.
    });
  }

  // Optional background-music ducking pass.
  let outPath = renderedPath;
  let musicApplied = false;
  if (input.musicPath && input.hasAudio) {
    const mixed = join(dir, 'final.mp4');
    try {
      await mixMusicDucked(renderedPath, input.musicPath, mixed);
      outPath = mixed;
      musicApplied = true;
    } catch {
      outPath = renderedPath; // fall back to un-mixed on failure
    }
  }

  const [buf, fileStat] = await Promise.all([readFile(outPath), stat(outPath)]);
  const suffix = layout === 'shorts' ? 'shorts' : 'final';
  const finalKey = `renders/${input.projectId}/${suffix}-${Date.now()}.mp4`;
  await putObject(finalKey, buf, 'video/mp4');

  const meta: FinalRenderMeta = {
    kind: 'final',
    layout,
    createdAt: new Date().toISOString(),
    durationSec: input.plan.outputDurationSec,
    width: dims.width,
    height: dims.height,
    fps,
    zooms: input.plan.zooms.length,
    captions: input.plan.captions.length,
    lowerThirds: input.plan.lowerThirds.length,
    brolls: input.plan.brolls.length,
    brollsResolved: input.plan.brolls.filter((b) => b.src).length,
    titleCards: input.plan.titleCards.length,
    statCallouts: input.plan.statCallouts.length,
    transitions: input.plan.transitions.length,
    progressBar,
    music: musicApplied,
    sizeBytes: fileStat.size,
  };

  return { finalKey, url: publicUrl(finalKey), meta };
}
