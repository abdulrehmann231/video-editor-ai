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
  /**
   * Source frame rate. When set, the cut is written as constant-frame-rate video
   * pinned to this fps. This is REQUIRED for correctness with variable-frame-rate
   * sources (phone/screen recordings): `select` passes through the source's
   * irregular timestamps, and a VFR output makes Remotion's <OffthreadVideo>
   * throw "No frame found at position …" because there is no frame at the exact
   * position it seeks. Forcing CFR guarantees a frame at every position.
   */
  fps?: number | null;
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
  // The cut is an intermediate base that gets re-encoded in the final render, so
  // a lighter crf keeps the file small (faster for Remotion to fetch) with no
  // visible loss on talking-head content.
  const crf = opts.crf ?? 23;
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
  // Force constant frame rate so the cut has a decodable frame at every
  // position — otherwise a VFR source yields a VFR cut and Remotion's
  // <OffthreadVideo> fails with "No frame found at position …". `-fps_mode cfr`
  // (ffmpeg >= 5.0; the deploy image is Debian Bookworm / ffmpeg 5.1) resamples
  // to a constant grid; `-r <fps>` pins that grid to the source rate when known.
  const cfr = ['-fps_mode', 'cfr'];
  if (opts.fps && opts.fps > 0) cfr.push('-r', String(opts.fps));

  args.push(
    '-c:v', 'libx264',
    '-preset', preset,
    '-crf', String(crf),
    '-pix_fmt', 'yuv420p',
    ...cfr,
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
