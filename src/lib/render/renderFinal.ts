import { join } from 'node:path';
import { readFile, stat, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { bundle } from '@remotion/bundler';
import { selectComposition, renderMedia, ensureBrowser } from '@remotion/renderer';
import { putObject, publicUrl } from '../r2';
import type { OverlayPlan } from './timeline';

export interface FinalRenderMeta {
  kind: 'final';
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
  sizeBytes: number | null;
}

export interface FinalRenderInput {
  projectId: string;
  /** Public URL of the Phase-2 cut video (the base layer). */
  cutUrl: string;
  width: number;
  height: number;
  fps: number;
  plan: OverlayPlan;
}

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
  await ensureBrowser();
  const serveUrl = await getBundle();

  const fps = Math.max(1, Math.round(input.fps));
  const durationInFrames = Math.max(1, Math.round(input.plan.outputDurationSec * fps));

  const inputProps = {
    videoSrc: input.cutUrl,
    fps,
    width: input.width,
    height: input.height,
    durationInFrames,
    zooms: input.plan.zooms,
    captions: input.plan.captions,
    lowerThirds: input.plan.lowerThirds,
    brolls: input.plan.brolls,
  };

  const composition = await selectComposition({ serveUrl, id: 'Edit', inputProps });

  const dir = await mkdtemp(join(tmpdir(), 'edit-ai-final-'));
  const outPath = join(dir, 'final.mp4');

  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation: outPath,
    inputProps,
    // Let Remotion pick concurrency from the host's core count.
  });

  const [buf, fileStat] = await Promise.all([readFile(outPath), stat(outPath)]);
  const finalKey = `renders/${input.projectId}/final-${Date.now()}.mp4`;
  await putObject(finalKey, buf, 'video/mp4');

  const meta: FinalRenderMeta = {
    kind: 'final',
    createdAt: new Date().toISOString(),
    durationSec: input.plan.outputDurationSec,
    width: input.width,
    height: input.height,
    fps,
    zooms: input.plan.zooms.length,
    captions: input.plan.captions.length,
    lowerThirds: input.plan.lowerThirds.length,
    brolls: input.plan.brolls.length,
    brollsResolved: input.plan.brolls.filter((b) => b.src).length,
    sizeBytes: fileStat.size,
  };

  return { finalKey, url: publicUrl(finalKey), meta };
}
