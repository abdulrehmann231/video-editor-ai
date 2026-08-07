import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { presignGet, putFile } from '../r2';
import { probeMedia, type MediaInfo } from '../ingest';

/**
 * Derive small working files from a (possibly huge, 4K/10 GB+) source in a
 * SINGLE streaming ffmpeg pass — the source is read once straight from R2 over
 * HTTP (byte-range), never fully stored on disk:
 *
 *   ① proxy      480p, low bitrate, mono  → Gemini + Whisper (the "brain")
 *   ② mezzanine  1080p, delivery quality  → the cut + Remotion (the render)
 *
 * Neither ever upscales past the source. The original 4K stays in R2 untouched.
 */

export interface DeriveResult {
  proxyKey: string;
  mezzanineKey: string;
  mezzanineMedia: MediaInfo;
}

export interface DeriveInput {
  projectId: string;
  sourceKey: string;
  hasAudio: boolean;
  timeoutMs?: number;
}

export async function deriveProxies(input: DeriveInput): Promise<DeriveResult> {
  const url = await presignGet(input.sourceKey, 6 * 3600);
  const dir = await mkdtemp(join(tmpdir(), 'edit-ai-derive-'));
  const proxyPath = join(dir, 'proxy.mp4');
  const mezzPath = join(dir, 'mezzanine.mp4');
  const audioMaps = input.hasAudio ? ['-map', '0:a?'] : ['-an'];

  // One input read -> split -> two scaled encodes. min(ih,N) avoids upscaling.
  const args = [
    '-hide_banner', '-nostats', '-y',
    '-i', url,
    '-filter_complex', "[0:v]split=2[v1][v2];[v1]scale=-2:'min(ih,1080)'[mezz];[v2]scale=-2:'min(ih,480)'[proxy]",
    // mezzanine (1080p)
    '-map', '[mezz]', ...audioMaps,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart',
    mezzPath,
    // proxy (480p, mono, 15fps) — only feeds Gemini/Whisper, so encode it as
    // cheaply as possible (ultrafast + low fps) to cut total derive time.
    '-map', '[proxy]', ...audioMaps,
    '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '30', '-pix_fmt', 'yuv420p', '-r', '15',
    '-c:a', 'aac', '-b:a', '96k', '-ac', '1', '-movflags', '+faststart',
    proxyPath,
  ];

  try {
    // Big 4K sources are read from R2 over HTTP and re-encoded twice on CPU, which
    // can exceed 30 min. Default 60 min; override with DERIVE_TIMEOUT_MS.
    const timeoutMs = input.timeoutMs ?? Number(process.env.DERIVE_TIMEOUT_MS) || 60 * 60_000;
    await runFfmpeg(args, timeoutMs);

    const mezzanineMedia = await probeMedia(mezzPath);
    const proxyKey = `derived/${input.projectId}/proxy.mp4`;
    const mezzanineKey = `derived/${input.projectId}/mezzanine.mp4`;
    await Promise.all([
      putFile(proxyKey, proxyPath, 'video/mp4'),
      putFile(mezzanineKey, mezzPath, 'video/mp4'),
    ]);

    return { proxyKey, mezzanineKey, mezzanineMedia };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

function runFfmpeg(args: string[], timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error(`derive ffmpeg timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    proc.stderr.on('data', (d) => {
      stderr += d;
      if (stderr.length > 20_000) stderr = stderr.slice(-10_000);
    });
    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`derive ffmpeg failed to start: ${err.message}`));
    });
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`derive ffmpeg exited ${code}: ${stderr.slice(-500).trim()}`));
    });
  });
}
