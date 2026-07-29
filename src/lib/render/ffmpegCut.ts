import { spawn } from 'node:child_process';
import type { Range } from './segments';

/**
 * Frame-accurate "remove segments" render in a SINGLE ffmpeg pass using the
 * select/aselect filters. Kept ranges are concatenated with reset PTS, then the
 * whole thing is re-encoded (and audio loudness-normalized). This is the
 * standard, reliable way to drop arbitrary ranges without temp files.
 */

export interface CutOptions {
  hasAudio: boolean;
  /** EBU R128 loudness normalization on the audio. Default true. */
  normalizeAudio?: boolean;
  crf?: number;
  preset?: string;
  timeoutMs?: number;
}

/** Build the select expression: between(t,s1,e1)+between(t,s2,e2)+… */
export function buildSelectExpr(segments: Range[]): string {
  if (segments.length === 0) return '0';
  return segments.map((s) => `between(t,${s.start},${s.end})`).join('+');
}

export function buildFilterComplex(segments: Range[], opts: CutOptions): string {
  const expr = buildSelectExpr(segments);
  const vChain = `[0:v]select='${expr}',setpts=N/FRAME_RATE/TB[v]`;
  if (!opts.hasAudio) return vChain;

  const loud = opts.normalizeAudio === false ? '' : ',loudnorm=I=-16:TP=-1.5:LRA=11';
  const aChain = `[0:a]aselect='${expr}',asetpts=N/SR/TB${loud}[a]`;
  return `${vChain};${aChain}`;
}

export function buildFfmpegArgs(input: string, output: string, segments: Range[], opts: CutOptions): string[] {
  const crf = opts.crf ?? 20;
  const preset = opts.preset ?? 'veryfast';
  const filter = buildFilterComplex(segments, opts);

  const args = [
    '-hide_banner', '-nostats', '-y',
    '-i', input,
    '-filter_complex', filter,
    '-map', '[v]',
  ];
  if (opts.hasAudio) {
    args.push('-map', '[a]', '-c:a', 'aac', '-b:a', '192k');
  } else {
    args.push('-an');
  }
  args.push(
    '-c:v', 'libx264',
    '-preset', preset,
    '-crf', String(crf),
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    output,
  );
  return args;
}

/** Run the cut render. Resolves when the output file is written. */
export function renderCutFile(
  input: string,
  output: string,
  segments: Range[],
  opts: CutOptions,
): Promise<void> {
  if (segments.length === 0) {
    return Promise.reject(new Error('No keep-segments to render (everything was cut?)'));
  }
  const args = buildFfmpegArgs(input, output, segments, opts);
  const timeoutMs = opts.timeoutMs ?? 10 * 60_000;

  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error(`ffmpeg cut render timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    proc.stderr.on('data', (d) => {
      stderr += d;
      if (stderr.length > 20_000) stderr = stderr.slice(-10_000); // cap memory
    });
    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`ffmpeg failed to start: ${err.message}`));
    });
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-600).trim()}`));
    });
  });
}
