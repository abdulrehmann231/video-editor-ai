import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

/**
 * Mix a looping background-music bed under the video's voice track with
 * sidechain compression (ducking): the music automatically dips when the
 * speaker talks and swells in the gaps. Video stream is copied (no re-encode).
 */

export interface MusicOptions {
  /** Base music level before ducking (0..1). */
  musicVolume?: number;
  timeoutMs?: number;
}

/** Default bundled bed. Drop real royalty-free tracks in public/music/. */
export function defaultMusicPath(): string | null {
  const p = join(process.cwd(), 'public', 'music', 'ambient.m4a');
  return existsSync(p) ? p : null;
}

export function mixMusicDucked(
  videoPath: string,
  musicPath: string,
  outPath: string,
  opts: MusicOptions = {},
): Promise<void> {
  const vol = opts.musicVolume ?? 0.18;
  const timeoutMs = opts.timeoutMs ?? 5 * 60_000;

  // Pad the voice with trailing silence so the sidechain (and therefore the
  // ducked music) keeps flowing after the speaker stops; the looped music fills
  // the tail. The outer -shortest trims the whole output to the VIDEO length, so
  // there's never a silent gap and never runaway length.
  const filter =
    `[0:a]apad,asplit=2[v1][v2];` +
    `[1:a]volume=${vol}[m];` +
    `[m][v2]sidechaincompress=threshold=0.02:ratio=6:attack=5:release=250[duck];` +
    `[v1][duck]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0[a]`;

  const args = [
    '-hide_banner', '-nostats', '-y',
    '-i', videoPath,
    '-stream_loop', '-1', '-i', musicPath,
    '-filter_complex', filter,
    '-map', '0:v', '-map', '[a]',
    '-c:v', 'copy',
    '-c:a', 'aac', '-b:a', '192k',
    '-shortest',
    '-movflags', '+faststart',
    outPath,
  ];

  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error(`music mix timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    proc.stderr.on('data', (d) => {
      stderr += d;
      if (stderr.length > 20_000) stderr = stderr.slice(-10_000);
    });
    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`ffmpeg music mix failed to start: ${err.message}`));
    });
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg music mix exited ${code}: ${stderr.slice(-400).trim()}`));
    });
  });
}
