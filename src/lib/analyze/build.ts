import { buildCatalogText, EDL_RESPONSE_SCHEMA } from '../edl/catalog';
import { retrieveReferences, refLine } from '../vault';
import { transcriptToScript } from './prompt';
import type { EditorialPlan } from './plan';
import type { MediaInfo } from '../ingest';
import type { SilenceSegment } from './silence';
import type { TranscriptWord } from './transcribe';

/**
 * STAGE 3 (after per-moment vault search) — BUILD. Text-only Gemini call that
 * turns the editorial plan + the vault references retrieved FOR EACH beat + the
 * renderable effect catalog into the concrete EDL. No video re-upload.
 */

export { EDL_RESPONSE_SCHEMA };

export interface BuildInput {
  plan: EditorialPlan;
  media: MediaInfo;
  silence: SilenceSegment[];
  transcript: TranscriptWord[];
  /** Optional web-research techniques brief (Stage 2). */
  research?: string;
  userPrompt?: string;
  /** How many vault refs to attach per beat. */
  refsPerBeat?: number;
}

/** Total distinct vault references surfaced across all beats (for meta). */
export function countBeatRefs(plan: EditorialPlan, refsPerBeat = 4): number {
  const ids = new Set<number>();
  for (const b of plan.beats) {
    for (const r of retrieveReferences(b.searchQuery, { limit: refsPerBeat })) ids.add(r.i);
  }
  return ids.size;
}

export function buildBuildPrompt(input: BuildInput): string {
  const { plan, media, silence, transcript, research, userPrompt } = input;
  const dur = media.durationSec ?? 0;
  const refsPerBeat = input.refsPerBeat ?? 4;

  // Per-moment vault search: each beat gets its own best-matching references.
  const beatBlocks = plan.beats
    .map((b, i) => {
      const refs = retrieveReferences(b.searchQuery, { limit: refsPerBeat });
      const refLines = refs.map((r) => `      ${refLine(r)}`).join('\n');
      return `  BEAT ${i + 1} [${b.start}s–${b.end}s] intent: ${b.intent}${
        b.effectHint ? ` | hint: ${b.effectHint}` : ''
      }
    vault matches for "${b.searchQuery}":
${refLines || '      (no strong match — use the closest catalog effect)'}`;
    })
    .join('\n\n');

  const userBlock = userPrompt?.trim()
    ? `\nUSER INSTRUCTIONS (highest priority):\n"""\n${userPrompt.trim()}\n"""\n`
    : '';
  const researchBlock = research?.trim()
    ? `\nCURRENT EDITING TECHNIQUES (researched for this niche — apply what fits):\n${research.trim()}\n`
    : '';
  const silenceBlock =
    silence.length > 0 ? silence.slice(0, 200).map((s) => `  - ${s.start}s → ${s.end}s`).join('\n') : '  (none)';

  return `You are an elite B2B YouTube editor building the final EDIT DECISION LIST (EDL) from a
plan you already made. For EACH beat, realize the intent with the SINGLE best-fitting effect
from the catalog, inspired by that beat's matched vault reference. Map the vault look to the
closest renderable effect (kinetic/typewriter → caption style; scale-pop/zoom → zoom_punch;
lower-third → lower_third; stat/badge → stat_callout OR three:stat_orb for a premium 3D
number; celebration → lottie:confetti/trophy; underline/highlight → lottie:underline;
section change → transition or lottie:swipe_wipe; card reveal → three:card_3d).
${userBlock}${researchBlock}
EDITORIAL PLAN: niche=${plan.niche ?? '?'}, tone=${plan.tone ?? '?'}.
${plan.summary ? `Approach: ${plan.summary}` : ''}

BEATS (each with its own vault matches — build one effect per beat):
${beatBlocks}

ALSO: add silence_cut ops for the detected silence (tighten pacing):
${silenceBlock}

TRANSCRIPT (for exact caption words, stat values, names/labels):
${transcriptToScript(transcript)}

EFFECT CATALOG (choose ONLY these op types; captions are auto-generated so only add caption
ops to OVERRIDE STYLE on a punchy moment):
${buildCatalogText()}

RULES:
- All times in SECONDS, between 0 and ${Math.round(dur)}. Keep start < end; never exceed duration.
- Prefer the beats' plan, but you MAY add/adjust for a professional result. Be rich yet tasteful;
  don't stack two big effects on the exact same instant.
- Use 3D (three) sparingly — a couple of standout moments at most.
- End every op's "reason" with the inspiring reference, e.g. "(ref: …)".
- Output ONLY the JSON EDL matching the schema, plus a one-paragraph "summary".`;
}
