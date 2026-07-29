import { spawn } from 'node:child_process';

/**
 * ffprobe-based media inspection. Accepts a local path OR an https URL
 * (ffprobe reads remote inputs directly, so we can probe an R2 presigned URL
 * without downloading the whole file).
 */

export interface MediaInfo {
  durationSec: number | null;
  width: number | null;
  height: number | null;
  fps: number | null;
  hasAudio: boolean;
  videoCodec: string | null;
  audioCodec: string | null;
  sizeBytes: number | null;
  container: string | null;
}

interface FfprobeStream {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  avg_frame_rate?: string;
  r_frame_rate?: string;
}

interface FfprobeOutput {
  streams?: FfprobeStream[];
  format?: { duration?: string; size?: string; format_name?: string };
}

function parseFps(str?: string): number | null {
  if (!str || str === '0/0') return null;
  const [n, d] = str.split('/').map(Number);
  if (!d) return null;
  const fps = n / d;
  return Number.isFinite(fps) ? Math.round(fps * 100) / 100 : null;
}

export function runFfprobe(input: string, timeoutMs = 60_000): Promise<FfprobeOutput> {
  return new Promise((resolve, reject) => {
    const args = [
      '-v', 'error',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      input,
    ];
    const proc = spawn('ffprobe', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error(`ffprobe timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    proc.stdout.on('data', (d) => (stdout += d));
    proc.stderr.on('data', (d) => (stderr += d));
    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`ffprobe failed to start: ${err.message} (is ffmpeg installed?)`));
    });
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`ffprobe exited ${code}: ${stderr.trim()}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout) as FfprobeOutput);
      } catch {
        reject(new Error(`ffprobe returned invalid JSON: ${stdout.slice(0, 200)}`));
      }
    });
  });
}

export function toMediaInfo(probe: FfprobeOutput): MediaInfo {
  const streams = probe.streams ?? [];
  const video = streams.find((s) => s.codec_type === 'video');
  const audio = streams.find((s) => s.codec_type === 'audio');
  const duration = probe.format?.duration ? Number(probe.format.duration) : null;
  const size = probe.format?.size ? Number(probe.format.size) : null;
  return {
    durationSec: duration != null && Number.isFinite(duration) ? Math.round(duration * 100) / 100 : null,
    width: video?.width ?? null,
    height: video?.height ?? null,
    fps: parseFps(video?.avg_frame_rate) ?? parseFps(video?.r_frame_rate),
    hasAudio: Boolean(audio),
    videoCodec: video?.codec_name ?? null,
    audioCodec: audio?.codec_name ?? null,
    sizeBytes: size != null && Number.isFinite(size) ? size : null,
    container: probe.format?.format_name ?? null,
  };
}

export async function probeMedia(input: string): Promise<MediaInfo> {
  return toMediaInfo(await runFfprobe(input));
}
