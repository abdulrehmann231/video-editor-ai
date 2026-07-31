import { getEnv } from '../env';
import { isRateLimit, isRetryable } from '../gemini';
import { keyCount, markRateLimited, nextKey } from '../geminiKeys';
import { deleteVideo, generateStructured, generateStructuredText, uploadVideo } from '../ai/geminiVideo';
import { EDL_RESPONSE_SCHEMA } from '../edl/catalog';
import { parseEdl, type AnalysisMeta, type Edl } from '../edl/schema';
import { detectSilence, type SilenceSegment } from './silence';
import { transcribe, type TranscriptWord } from './transcribe';
import { buildAnalysisPrompt, buildRepairPrompt } from './prompt';
import { retrieveReferences } from '../vault';
import { downloadToTemp, cleanupTemp } from '../media/download';
import type { MediaInfo } from '../ingest';

export interface AnalyzeResult {
  edl: Edl;
  meta: AnalysisMeta;
  transcript: TranscriptWord[];
  silence: SilenceSegment[];
  warnings: string[];
}

export interface AnalyzeInput {
  /** Object to analyze — the small 480p proxy when available, else the source. */
  sourceKey: string;
  contentType: string;
  filename: string;
  media: MediaInfo;
  /** Optional user guidance that steers the edit. */
  userPrompt?: string;
  /** Set false to skip local Whisper (faster, no captions timing). */
  transcribe?: boolean;
}

/**
 * Full analysis: R2 source -> silence + transcript -> Gemini File API -> EDL.
 * Rotates Gemini keys with failover on rate limits (re-uploads under a new key).
 */
export async function analyzeVideo(input: AnalyzeInput): Promise<AnalyzeResult> {
  const env = getEnv();
  const { path, dir } = await downloadToTemp(input.sourceKey, input.filename || 'source');
  const warnings: string[] = [];

  try {
    const silence = await detectSilence(path).catch((e) => {
      warnings.push(`silencedetect failed: ${(e as Error).message}`);
      return [] as SilenceSegment[];
    });

    let transcript: TranscriptWord[] = [];
    const wantTranscribe = input.transcribe !== false && input.media.hasAudio;
    if (wantTranscribe) {
      transcript = await transcribe(path).catch((e) => {
        warnings.push(`transcription failed: ${(e as Error).message}`);
        return [] as TranscriptWord[];
      });
    }

    // Retrieve vault references relevant to this video's content + user intent.
    const query = [
      input.userPrompt ?? '',
      transcript.map((w) => w.word).join(' '),
    ].join(' ');
    const references = retrieveReferences(query, { limit: 16 });

    const prompt = buildAnalysisPrompt({
      media: input.media,
      silence,
      transcript,
      userPrompt: input.userPrompt,
      references,
    });
    const { edl, meta, repaired } = await runGemini(
      path,
      input.contentType,
      input.filename,
      prompt,
      input.media.durationSec ?? null,
      env.GEMINI_MODEL,
    );

    return {
      edl,
      meta: {
        ...meta,
        transcriptWords: transcript.length,
        silenceSegments: silence.length,
        referencesUsed: references.length,
        repaired,
      },
      transcript,
      silence,
      warnings,
    };
  } finally {
    await cleanupTemp(dir);
  }
}

async function runGemini(
  localPath: string,
  contentType: string,
  filename: string,
  prompt: string,
  durationSec: number | null,
  model: string,
): Promise<{ edl: Edl; meta: AnalysisMeta; repaired: boolean }> {
  const keys = getEnv().GEMINI_API_KEYS;
  // At least 2 attempts so a single-key transient error still retries.
  const attempts = Math.max(2, keyCount());
  let lastErr: unknown;

  for (let i = 0; i < attempts; i++) {
    const key = nextKey();
    const keyIndex = keys.indexOf(key);
    try {
      const file = await uploadVideo(key, localPath, contentType || 'video/mp4', filename);
      let text: string;
      try {
        text = await generateStructured(key, model, file, prompt, EDL_RESPONSE_SCHEMA);
      } finally {
        await deleteVideo(key, file.name).catch(() => {});
      }

      // Validate, with a single repair pass on failure.
      try {
        const { edl } = parseEdl(safeJson(text), { durationSec });
        return { edl, meta: baseMeta(model, keyIndex), repaired: false };
      } catch (validationErr) {
        const repairText = await generateStructuredText(
          key,
          model,
          buildRepairPrompt(text, (validationErr as Error).message),
          EDL_RESPONSE_SCHEMA,
        );
        const { edl } = parseEdl(safeJson(repairText), { durationSec });
        return { edl, meta: baseMeta(model, keyIndex), repaired: true };
      }
    } catch (err) {
      lastErr = err;
      if (isRetryable(err)) {
        if (isRateLimit(err)) markRateLimited(key); // cooldown only true rate limits
        continue; // failover to next key / retry
      }
      throw err; // non-retryable (bad request, auth, etc.)
    }
  }
  throw new Error(
    `Gemini analysis failed after ${attempts} attempt(s): ${(lastErr as Error)?.message ?? lastErr}`,
  );
}

function baseMeta(model: string, keyIndex: number): AnalysisMeta {
  return { model, generatedAt: new Date().toISOString(), keyIndex };
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    // Models occasionally wrap JSON in fences despite responseMimeType; strip and retry.
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced) return JSON.parse(fenced[1]);
    const first = text.indexOf('{');
    const last = text.lastIndexOf('}');
    if (first >= 0 && last > first) return JSON.parse(text.slice(first, last + 1));
    throw new Error('Model did not return parseable JSON');
  }
}
