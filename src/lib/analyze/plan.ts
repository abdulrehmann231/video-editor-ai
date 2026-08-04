import { SchemaType, type Schema } from '@google/generative-ai';
import { z } from 'zod';
import type { MediaInfo } from '../ingest';
import type { SilenceSegment } from './silence';
import type { TranscriptWord } from './transcribe';
import { transcriptToScript } from './prompt';

/**
 * STAGE 1 — PLAN. Gemini watches the video and thinks like an editor: it returns
 * a structured editorial plan (niche, tone, segments, and the "beats" that need
 * an effect, each with a keyword query to search the vault). No effects are
 * chosen yet — that's the BUILD stage, after we search the vault per beat.
 */

const fmt = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;

export const Beat = z.object({
  start: z.number().min(0),
  end: z.number().min(0),
  /** What's happening + why it deserves an effect. */
  intent: z.string().min(1).max(300),
  /** Suggested kind of treatment (free text hint, e.g. "punch-in zoom", "stat pop", "3D orb"). */
  effectHint: z.string().max(120).optional(),
  /** 2–5 keywords to find a matching effect in the vault. */
  searchQuery: z.string().min(2).max(120),
});
export type Beat = z.infer<typeof Beat>;

export const EditorialPlan = z.object({
  niche: z.string().max(80).optional(),
  tone: z.string().max(80).optional(),
  summary: z.string().max(800).optional(),
  segments: z
    .array(z.object({ start: z.number().min(0), end: z.number().min(0), title: z.string().max(120) }))
    .default([]),
  beats: z.array(Beat).default([]),
});
export type EditorialPlan = z.infer<typeof EditorialPlan>;

export const PLAN_RESPONSE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    niche: { type: SchemaType.STRING, description: 'Content niche (e.g. B2B SaaS, fitness, finance).' },
    tone: { type: SchemaType.STRING, description: 'Overall tone/energy.' },
    summary: { type: SchemaType.STRING, description: 'One-paragraph editorial approach.' },
    segments: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          start: { type: SchemaType.NUMBER },
          end: { type: SchemaType.NUMBER },
          title: { type: SchemaType.STRING },
        },
        required: ['start', 'end', 'title'],
      },
    },
    beats: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          start: { type: SchemaType.NUMBER, description: 'Beat start (seconds).' },
          end: { type: SchemaType.NUMBER, description: 'Beat end (seconds).' },
          intent: { type: SchemaType.STRING, description: "What's happening and why an effect helps." },
          effectHint: { type: SchemaType.STRING, description: 'Suggested treatment.' },
          searchQuery: { type: SchemaType.STRING, description: '2–5 keywords to find a matching vault effect.' },
        },
        required: ['start', 'end', 'intent', 'searchQuery'],
      },
    },
  },
  required: ['beats'],
};

export interface PlanInput {
  media: MediaInfo;
  silence: SilenceSegment[];
  transcript: TranscriptWord[];
  userPrompt?: string;
}

export function buildPlanPrompt(input: PlanInput): string {
  const { media, silence, transcript, userPrompt } = input;
  const dur = media.durationSec ?? 0;
  const targetBeats = dur > 0 ? Math.max(5, Math.round(dur / 10)) : 6;
  const silenceBlock =
    silence.length > 0
      ? silence.slice(0, 200).map((s) => `  - ${s.start}s → ${s.end}s`).join('\n')
      : '  (none)';

  const userBlock = userPrompt?.trim()
    ? `\nUSER INSTRUCTIONS (highest priority):\n"""\n${userPrompt.trim()}\n"""\n`
    : '';

  return `You are an elite B2B YouTube video editor. WATCH the attached video and produce a
structured EDITORIAL PLAN — do NOT list final effects yet, just plan like a human editor.
${userBlock}
Think about RETENTION and a professional look:
- Identify the hook (first ~3s), the segments/chapters, key claims, EVERY number/metric,
  emotional beats, concrete nouns (for b-roll), and topic/section changes.
- For each moment that deserves an effect, add a "beat": its time range, the intent (what's
  happening + why an effect helps), an effectHint (e.g. "punch-in zoom", "stat pop",
  "3D money orb", "lower third", "b-roll", "wipe transition", "confetti"), and a
  searchQuery — 2–5 keywords to find a matching effect in a 451-effect editing vault
  (e.g. "kinetic caption hook", "3d money orb finance", "glitch section wipe").
- Aim for roughly ${targetBeats}+ beats spread across the ${Math.round(dur)}s video (a
  pattern-interrupt every ~8–15s). Be rich but tasteful — don't stack beats on the same moment.

VIDEO FACTS: duration ${dur}s (${fmt(dur)}), ${media.width}x${media.height} @ ${media.fps}fps,
audio ${media.hasAudio ? 'present' : 'NONE'}.

DETECTED SILENCE (for jump-cut planning):
${silenceBlock}

TRANSCRIPT (word-timed):
${transcriptToScript(transcript)}

RULES:
- All times in SECONDS, between 0 and ${Math.round(dur)}. Never exceed the duration.
- Output ONLY the JSON plan matching the schema.`;
}

/** Strip null/empty + validate the model's plan JSON. */
export function parsePlan(raw: unknown): EditorialPlan {
  return EditorialPlan.parse(stripEmpty(raw));
}

function stripEmpty(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripEmpty);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === null || v === undefined || v === '') continue;
      out[k] = stripEmpty(v);
    }
    return out;
  }
  return value;
}
