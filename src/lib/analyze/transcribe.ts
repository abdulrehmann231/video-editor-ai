import { spawn } from 'node:child_process';

/**
 * Local, key-free speech-to-text with word-level timestamps.
 *
 * Audio is decoded to 16 kHz mono float32 PCM via ffmpeg, then run through a
 * local Whisper model using Transformers.js (onnxruntime) — no external API and
 * no Python. The model is lazily loaded and cached across calls. Deployable as
 * part of the Node worker container.
 */

export interface TranscriptWord {
  word: string;
  start: number;
  end: number;
}

const SAMPLE_RATE = 16_000;

/** Extract mono 16 kHz float32 PCM from a media file. */
export function extractPcm(input: string, timeoutMs = 180_000): Promise<Float32Array> {
  return new Promise((resolve, reject) => {
    const args = [
      '-hide_banner', '-nostats', '-loglevel', 'error',
      '-i', input,
      '-ac', '1',
      '-ar', String(SAMPLE_RATE),
      '-f', 'f32le',
      '-',
    ];
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks: Buffer[] = [];
    let stderr = '';
    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error(`audio extraction timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    proc.stdout.on('data', (d: Buffer) => chunks.push(d));
    proc.stderr.on('data', (d) => (stderr += d));
    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`ffmpeg audio extract failed to start: ${err.message}`));
    });
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`ffmpeg audio extract exited ${code}: ${stderr.trim()}`));
        return;
      }
      const buf = Buffer.concat(chunks);
      // Copy into a properly-aligned Float32Array.
      const f32 = new Float32Array(buf.byteLength / 4);
      for (let i = 0; i < f32.length; i++) f32[i] = buf.readFloatLE(i * 4);
      resolve(f32);
    });
  });
}

/* eslint-disable @typescript-eslint/no-explicit-any */
let transcriberPromise: Promise<any> | null = null;

async function getTranscriber(model: string): Promise<any> {
  if (!transcriberPromise) {
    transcriberPromise = (async () => {
      const { pipeline } = await import('@xenova/transformers');
      return pipeline('automatic-speech-recognition', model);
    })();
  }
  return transcriberPromise;
}

export interface TranscribeOptions {
  /** HF model id. Default: a small English Whisper. */
  model?: string;
}

/**
 * Transcribe a media file to word-level timestamps. Returns [] if there is no
 * audio / nothing intelligible. Throws only on unexpected failures.
 */
export async function transcribe(
  input: string,
  opts: TranscribeOptions = {},
): Promise<TranscriptWord[]> {
  const model = opts.model ?? process.env.WHISPER_MODEL ?? 'Xenova/whisper-tiny.en';
  const audio = await extractPcm(input);
  if (audio.length === 0) return [];

  const transcriber = await getTranscriber(model);
  const output = await transcriber(audio, {
    return_timestamps: 'word',
    chunk_length_s: 30,
    stride_length_s: 5,
  });

  return normalizeChunks(output?.chunks ?? []);
}

/** Map Transformers.js ASR chunks -> TranscriptWord[], dropping malformed ones. */
export function normalizeChunks(
  chunks: Array<{ text?: string; timestamp?: [number | null, number | null] }>,
): TranscriptWord[] {
  const words: TranscriptWord[] = [];
  for (const c of chunks) {
    const text = (c.text ?? '').trim();
    const start = c.timestamp?.[0];
    const end = c.timestamp?.[1];
    if (!text || start == null) continue;
    words.push({
      word: text,
      start: Math.round(start * 100) / 100,
      end: Math.round((end ?? start) * 100) / 100,
    });
  }
  return words;
}
