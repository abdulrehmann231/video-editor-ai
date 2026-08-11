import { writeFile } from 'node:fs/promises';
import { renderMediaOnLambda, getRenderProgress } from '@remotion/lambda/client';

/**
 * Remotion Lambda backend — renders the composition in parallel across AWS
 * Lambda (a 10-min video in ~1-3 min, pennies per render), instead of the local
 * headless-Chromium renderer. Selected when RENDER_BACKEND=lambda and the Lambda
 * env is configured. The rest of the pipeline (cut, music mix, R2 upload) is
 * unchanged — this only swaps the "render composition -> mp4 file" step.
 *
 * One-time setup: run `npm run lambda:deploy` (deploys the function + site) and
 * put the printed values in env. See DEPLOY-LAMBDA.md.
 */

export interface LambdaConfig {
  region: string;
  functionName: string;
  serveUrl: string;
}

const DEFAULT_MAX_LAMBDA_FUNCTIONS = 10;

function readPositiveInt(value: string | undefined): number | null {
  if (value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return null;
  return parsed;
}

/**
 * Frames each Lambda renders. Remotion has NO separate concurrency knob — the
 * number of renderer Lambdas invoked at once is exactly
 * `ceil(durationInFrames / framesPerLambda)` (+1 orchestrator). So to stay under
 * the AWS account concurrency limit (new accounts are capped at 10) we derive a
 * shard size from `REMOTION_MAX_LAMBDA_FUNCTIONS` and treat that as a HARD cap:
 * an explicit `REMOTION_FRAMES_PER_LAMBDA` may make shards bigger (fewer
 * Lambdas) but is never allowed to make them smaller than the cap requires —
 * otherwise it would silently spawn hundreds of Lambdas and trip AWS's
 * "Rate Exceeded" throttle.
 */
export function framesPerLambda(durationInFrames: number): number {
  const maxLambdaFunctions =
    readPositiveInt(process.env.REMOTION_MAX_LAMBDA_FUNCTIONS) ?? DEFAULT_MAX_LAMBDA_FUNCTIONS;
  // Reserve one concurrency slot for the orchestrator function.
  const rendererFunctions = Math.max(1, maxLambdaFunctions - 1);
  // Smallest shard that keeps the renderer count within the cap.
  const concurrencyFloor = Math.max(1, Math.ceil(durationInFrames / rendererFunctions));

  const explicit = readPositiveInt(process.env.REMOTION_FRAMES_PER_LAMBDA);
  // Honor a bigger explicit shard, but never let it push concurrency over the cap.
  return explicit !== null ? Math.max(explicit, concurrencyFloor) : concurrencyFloor;
}

export function lambdaConfig(): LambdaConfig | null {
  const region = process.env.REMOTION_AWS_REGION || process.env.AWS_REGION;
  const functionName = process.env.REMOTION_LAMBDA_FUNCTION_NAME;
  const serveUrl = process.env.REMOTION_SERVE_URL;
  const hasCreds =
    (process.env.REMOTION_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID) &&
    (process.env.REMOTION_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY);
  if (!region || !functionName || !serveUrl || !hasCreds) return null;
  return { region: region as string, functionName, serveUrl };
}

/** True when the pipeline should render on Lambda. */
export function useLambda(): boolean {
  return process.env.RENDER_BACKEND === 'lambda' && lambdaConfig() !== null;
}

/**
 * Render the 'Edit' composition on Lambda with the given inputProps, poll to
 * completion, and download the resulting mp4 to `outPath`.
 */
export async function renderOnLambda(
  inputProps: Record<string, unknown>,
  outPath: string,
  opts: { durationInFrames: number; pollMs?: number; timeoutMs?: number; frameTimeoutMs?: number; compositionId?: string } = {
    durationInFrames: 1,
  },
): Promise<void> {
  const cfg = lambdaConfig();
  if (!cfg) throw new Error('Lambda not configured (see DEPLOY-LAMBDA.md).');

  const { renderId, bucketName } = await renderMediaOnLambda({
    region: cfg.region as Parameters<typeof renderMediaOnLambda>[0]['region'],
    functionName: cfg.functionName,
    serveUrl: cfg.serveUrl,
    composition: opts.compositionId ?? 'Edit',
    inputProps,
    codec: 'h264',
    imageFormat: 'jpeg',
    privacy: 'public',
    maxRetries: 1,
    framesPerLambda: framesPerLambda(opts.durationInFrames),
    // Raise the per-frame delayRender timeout above Remotion's 28s default — the
    // 100+ MB cut is fetched/seeked over the network by <OffthreadVideo> and a
    // far seek (e.g. time=268s) can exceed 28s. Cache decoded frames of the big
    // base video so repeated seeks within a chunk don't re-fetch.
    timeoutInMilliseconds: opts.frameTimeoutMs ?? 120_000,
    offthreadVideoCacheSizeInBytes: 512 * 1024 * 1024,
    downloadBehavior: { type: 'download', fileName: 'final.mp4' },
  });

  const pollMs = opts.pollMs ?? 3000;
  // How long the client waits for the whole render before giving up. On a low
  // AWS concurrency quota the frames are split into a few large chunks that run
  // in parallel, so wall-clock can approach the Lambda function timeout (up to
  // 900s) plus overhead. Default 25 min; override with REMOTION_LAMBDA_RENDER_TIMEOUT_MS.
  const defaultDeadlineMs = readPositiveInt(process.env.REMOTION_LAMBDA_RENDER_TIMEOUT_MS) ?? 25 * 60_000;
  const deadline = Date.now() + (opts.timeoutMs ?? defaultDeadlineMs);
  for (;;) {
    const progress = await getRenderProgress({
      renderId,
      bucketName,
      functionName: cfg.functionName,
      region: cfg.region as Parameters<typeof getRenderProgress>[0]['region'],
    });
    if (progress.fatalErrorEncountered) {
      throw new Error(`Lambda render failed: ${progress.errors?.[0]?.message ?? 'unknown'}`);
    }
    if (progress.done) {
      const url = progress.outputFile;
      if (!url) throw new Error('Lambda render finished without an output file');
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to download Lambda output: HTTP ${res.status}`);
      await writeFile(outPath, Buffer.from(await res.arrayBuffer()));
      return;
    }
    if (Date.now() > deadline) throw new Error('Lambda render timed out');
    await new Promise((r) => setTimeout(r, pollMs));
  }
}
