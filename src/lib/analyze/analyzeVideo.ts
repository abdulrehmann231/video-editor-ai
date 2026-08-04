import { getEnv } from '../env';
import { isRateLimit, isRetryable } from '../gemini';
import { keyCount, markRateLimited, nextKey } from '../geminiKeys';
import { deleteVideo, generateStructured, generateStructuredText, uploadVideo } from '../ai/geminiVideo';
import { parseEdl, type AnalysisMeta, type Edl } from '../edl/schema';
import { detectSilence, type SilenceSegment } from './silence';
import { transcribe, type TranscriptWord } from './transcribe';
import { buildRepairPrompt } from './prompt';
import { buildPlanPrompt, parsePlan, PLAN_RESPONSE_SCHEMA, type EditorialPlan } from './plan';
import { buildBuildPrompt, EDL_RESPONSE_SCHEMA, countBeatRefs } from './build';
import { researchEnabled, researchTechniques } from './research';
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

    const { edl, meta, plan, repaired } = await runAgentic({
      localPath: path,
      contentType: input.contentType,
      filename: input.filename,
      media: input.media,
      silence,
      transcript,
      userPrompt: input.userPrompt,
      model: env.GEMINI_MODEL,
    });

    return {
      edl,
      meta: {
        ...meta,
        transcriptWords: transcript.length,
        silenceSegments: silence.length,
        referencesUsed: countBeatRefs(plan),
        beats: plan.beats.length,
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

interface AgenticInput {
  localPath: string;
  contentType: string;
  filename: string;
  media: MediaInfo;
  silence: SilenceSegment[];
  transcript: TranscriptWord[];
  userPrompt?: string;
  model: string;
}

/**
 * Multi-stage "editor brain": PLAN (watch video → editorial plan) →
 * [RESEARCH: web-grounded techniques] → per-moment vault search (inside BUILD's
 * prompt) → BUILD (plan + per-beat refs → EDL). Key rotation + failover wrap the
 * whole thing (re-plans under a new key on a rate limit).
 */
async function runAgentic(
  input: AgenticInput,
): Promise<{ edl: Edl; meta: AnalysisMeta; plan: EditorialPlan; repaired: boolean }> {
  const { model } = input;
  const durationSec = input.media.durationSec ?? null;
  const keys = getEnv().GEMINI_API_KEYS;
  const attempts = Math.max(2, keyCount());
  let lastErr: unknown;

  for (let i = 0; i < attempts; i++) {
    const key = nextKey();
    const keyIndex = keys.indexOf(key);
    try {
      // STAGE 1 — PLAN (needs the video).
      const file = await uploadVideo(key, input.localPath, input.contentType || 'video/mp4', input.filename);
      let plan: EditorialPlan;
      try {
        const planText = await generateStructured(
          key,
          model,
          file,
          buildPlanPrompt({ media: input.media, silence: input.silence, transcript: input.transcript, userPrompt: input.userPrompt }),
          PLAN_RESPONSE_SCHEMA,
        );
        plan = parsePlan(safeJson(planText));
      } finally {
        await deleteVideo(key, file.name).catch(() => {});
      }

      // STAGE 2 — RESEARCH (optional, web-grounded).
      let research: string | undefined;
      let researched = false;
      if (researchEnabled()) {
        research = await researchTechniques(key, model, plan.niche, plan.tone);
        researched = Boolean(research);
      }

      // STAGE 3 (per-moment vault search) + BUILD (text-only) → EDL.
      const buildPrompt = buildBuildPrompt({
        plan,
        media: input.media,
        silence: input.silence,
        transcript: input.transcript,
        research,
        userPrompt: input.userPrompt,
      });
      const meta = (): AnalysisMeta => ({ model, generatedAt: new Date().toISOString(), keyIndex, researched });

      const buildText = await generateStructuredText(key, model, buildPrompt, EDL_RESPONSE_SCHEMA);
      try {
        const { edl } = parseEdl(safeJson(buildText), { durationSec });
        return { edl, meta: meta(), plan, repaired: false };
      } catch (validationErr) {
        const repairText = await generateStructuredText(
          key,
          model,
          buildRepairPrompt(buildText, (validationErr as Error).message),
          EDL_RESPONSE_SCHEMA,
        );
        const { edl } = parseEdl(safeJson(repairText), { durationSec });
        return { edl, meta: meta(), plan, repaired: true };
      }
    } catch (err) {
      lastErr = err;
      if (isRetryable(err)) {
        if (isRateLimit(err)) markRateLimited(key);
        continue;
      }
      throw err;
    }
  }
  throw new Error(
    `Agentic analysis failed after ${attempts} attempt(s): ${(lastErr as Error)?.message ?? lastErr}`,
  );
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
