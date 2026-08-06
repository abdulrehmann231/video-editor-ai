import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { putFile, objectExists, publicUrl } from '../r2';
import type { BrollOverlay } from './timeline';

/**
 * Normalize resolved b-roll clips to the composition's integer frame rate.
 *
 * Stock clips (e.g. Pexels) are often 23.976 fps with an odd time_base. Played
 * inside an integer-fps composition, Remotion's <OffthreadVideo> seeks
 * source-time = frame/fps, which never lands on the 23.976 grid, and the render
 * dies with "No frame found at position …". Re-encoding each clip to CONSTANT
 * integer fps (matching the composition) gives a 1:1 frame mapping and fixes it
 * — the same treatment renderCut applies to the base video.
 *
 * Results are cached in R2 keyed by (source URL + fps), so a given clip is
 * normalized once and reused across renders. Best-effort per clip: if a clip
 * can't be normalized it is dropped (src cleared) so the render still completes
 * rather than crashing on the raw, mismatched source.
 */
export async function normalizeBrollClips(
  brolls: BrollOverlay[],
  targetFps: number,
  opts: { timeoutMs?: number } = {},
): Promise<{ brolls: BrollOverlay[]; warnings: string[] }> {
  const fps = Math.max(1, Math.round(targetFps));
  const warnings: string[] = [];

  const out = await Promise.all(
    brolls.map(async (b) => {
      if (!b.src) return b;
      try {
        const src = await normalizeOne(b.src, fps, opts.timeoutMs);
        return { ...b, src };
      } catch (err) {
        warnings.push(`B-roll normalize failed for "${b.query}" — dropping it: ${(err as Error).message}`);
        // Drop rather than fall back to the raw source: the raw fractional-fps
        // clip is exactly what crashes the render.
        return { ...b, src: undefined };
      }
    }),
  );

  return { brolls: out, warnings };
}

/** Normalize a single remote clip to `fps` CFR, caching the result in R2. */
async function normalizeOne(srcUrl: string, fps: number, timeoutMs = 3 * 60_000): Promise<string> {
  const hash = createHash('sha1').update(`${srcUrl}@${fps}`).digest('hex').slice(0, 16);
  const key = `broll-cache/${hash}-${fps}fps.mp4`;

  if (await objectExists(key)) return publicUrl(key);

  const dir = await mkdtemp(join(tmpdir(), 'edit-ai-broll-'));
  const inPath = join(dir, 'in.mp4');
  const outPath = join(dir, 'out.mp4');
  try {
    const res = await fetch(srcUrl);
    if (!res.ok) throw new Error(`download HTTP ${res.status}`);
    await writeFile(inPath, Buffer.from(await res.arrayBuffer()));

    await reencodeCfr(inPath, outPath, fps, timeoutMs);
    await putFile(key, outPath, 'video/mp4');
    return publicUrl(key);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/** Re-encode `input` to constant integer `fps` (muted — b-roll plays silent). */
function reencodeCfr(input: string, output: string, fps: number, timeoutMs: number): Promise<void> {
  const args = [
    '-hide_banner', '-nostats', '-y',
    '-i', input,
    '-vf', `fps=${fps}`,
    '-r', String(fps),
    '-fps_mode', 'cfr',
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '22',
    '-pix_fmt', 'yuv420p',
    '-an',
    '-movflags', '+faststart',
    output,
  ];

  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error(`ffmpeg b-roll normalize timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    proc.stderr.on('data', (d) => {
      stderr += d;
      if (stderr.length > 20_000) stderr = stderr.slice(-10_000);
    });
    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`ffmpeg failed to start: ${err.message}`));
    });
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-400).trim()}`));
    });
  });
}
