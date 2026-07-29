import { spawn } from 'node:child_process';

/**
 * Detect silent segments with ffmpeg's `silencedetect` filter. Cheap and
 * precise — used to seed silence-cut suggestions and to give the model an
 * accurate map of dead air (which it can reason about but not measure to the
 * millisecond at 1fps sampling).
 */

export interface SilenceSegment {
  start: number;
  end: number;
  durationSec: number;
}

export interface SilenceOptions {
  /** Noise floor; below this is "silent". Default -30 dB. */
  noiseDb?: number;
  /** Minimum silence duration to report, seconds. Default 0.6. */
  minDurationSec?: number;
  timeoutMs?: number;
}

export function detectSilence(input: string, opts: SilenceOptions = {}): Promise<SilenceSegment[]> {
  const noise = opts.noiseDb ?? -30;
  const minDur = opts.minDurationSec ?? 0.6;
  const timeoutMs = opts.timeoutMs ?? 120_000;

  return new Promise((resolve, reject) => {
    const args = [
      '-hide_banner',
      '-nostats',
      '-i', input,
      '-af', `silencedetect=noise=${noise}dB:d=${minDur}`,
      '-f', 'null',
      '-',
    ];
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error(`silencedetect timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    proc.stderr.on('data', (d) => (stderr += d));
    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`ffmpeg silencedetect failed to start: ${err.message}`));
    });
    proc.on('close', () => {
      clearTimeout(timer);
      resolve(parseSilenceLog(stderr));
    });
  });
}

/** Parse `silence_start` / `silence_end` lines from ffmpeg stderr. */
export function parseSilenceLog(log: string): SilenceSegment[] {
  const segments: SilenceSegment[] = [];
  let pendingStart: number | null = null;

  for (const line of log.split('\n')) {
    const startM = line.match(/silence_start:\s*(-?[\d.]+)/);
    if (startM) {
      pendingStart = Math.max(0, parseFloat(startM[1]));
      continue;
    }
    const endM = line.match(/silence_end:\s*(-?[\d.]+)(?:\s*\|\s*silence_duration:\s*([\d.]+))?/);
    if (endM && pendingStart != null) {
      const end = parseFloat(endM[1]);
      const dur = endM[2] ? parseFloat(endM[2]) : end - pendingStart;
      segments.push({
        start: Math.round(pendingStart * 100) / 100,
        end: Math.round(end * 100) / 100,
        durationSec: Math.round(dur * 100) / 100,
      });
      pendingStart = null;
    }
  }
  return segments;
}
