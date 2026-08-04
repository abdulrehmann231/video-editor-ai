import { buildCatalogText } from '../edl/catalog';
import type { MediaInfo } from '../ingest';
import type { SilenceSegment } from './silence';
import type { TranscriptWord } from './transcribe';
import { refLine, type VaultRef } from '../vault';

export interface PromptInput {
  media: MediaInfo;
  silence: SilenceSegment[];
  transcript?: TranscriptWord[];
  /** Optional free-text guidance from the user that steers the edit. */
  userPrompt?: string;
  /** Relevant editing references retrieved from the Inspiration Vault. */
  references?: VaultRef[];
}

/** Compact the transcript into a timestamped, readable script for the model. */
export function transcriptToScript(words: TranscriptWord[], maxChars = 12_000): string {
  if (words.length === 0) return '(no transcript available)';
  const lines: string[] = [];
  let line = '';
  let lineStart = words[0].start;
  for (const w of words) {
    if (line === '') lineStart = w.start;
    line += (line ? ' ' : '') + w.word.trim();
    if (line.length > 90 || /[.!?]$/.test(w.word.trim())) {
      lines.push(`[${fmt(lineStart)}-${fmt(w.end)}] ${line}`);
      line = '';
    }
  }
  if (line) lines.push(`[${fmt(lineStart)}] ${line}`);
  const joined = lines.join('\n');
  return joined.length > maxChars ? joined.slice(0, maxChars) + '\n…(truncated)' : joined;
}

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function buildAnalysisPrompt(input: PromptInput): string {
  const { media, silence, transcript, userPrompt, references } = input;
  const durationLine =
    media.durationSec != null ? `${media.durationSec}s (${fmt(media.durationSec)})` : 'unknown';

  const refBlock =
    references && references.length > 0
      ? `\nSTYLE REFERENCES (retrieved from a 451-effect B2B editing vault — edit in THIS spirit):
${references.map(refLine).join('\n')}

Map each reference idea to the CLOSEST catalog op you can actually render:
- kinetic typography / typewriter / word pop / caption reveal → caption
- scale pop / punch-in / zoom / camera push → zoom_punch
- lower-third / name tag / title bar → lower_third
- stat callout / badge / big number / concept card / intro-outro → title_card
- b-roll / screen-capture / overlay footage → broll
For each op, end its "reason" with the reference that inspired it, e.g. "(ref: Bold Word Pop)".
Be RICH and varied: draw on as many of these references as genuinely fit — vary caption
styles (word_highlight / bold_pop / karaoke / typewriter), pop a stat_callout on any number
or metric the speaker says, add a short transition at a clear section change, and use
lower thirds / title cards / b-roll where they help. Aim to reference many techniques across
the video, but NEVER force an effect where it doesn't fit the moment.\n`
      : '';

  const userBlock = userPrompt?.trim()
    ? `\nUSER INSTRUCTIONS (HIGHEST PRIORITY — follow these unless they conflict with the schema/rules):
"""
${userPrompt.trim()}
"""\n`
    : '';

  const silenceBlock =
    silence.length > 0
      ? silence
          .slice(0, 200)
          .map((s) => `  - ${s.start}s → ${s.end}s (${s.durationSec}s)`)
          .join('\n')
      : '  (none detected)';

  const scriptBlock = transcript ? transcriptToScript(transcript) : '(transcription not run)';

  const durNum = media.durationSec ?? 0;
  const targetInterrupts = durNum > 0 ? Math.max(3, Math.round(durNum / 12)) : 6;

  return `You are a TOP-TIER B2B YouTube editor, obsessed with retention. Watch the attached
video and produce an EDIT DECISION LIST (EDL): a precise, timestamped plan of edits a
deterministic renderer will apply. You do NOT regenerate video — you choose edits from the
fixed catalog below, the way an elite editor works.
${userBlock}
THINK LIKE AN EDITOR (retention-first):
- The first ~3 seconds are the HOOK: open on energy — a punch-in zoom + (if there's a topic)
  an intro title_card, and mark the hook line for a strong caption style.
- Keep constant visual motion — a "pattern interrupt" every ~8-15s so it's never a static
  talking head. For this ${Math.round(durNum)}s video aim for roughly ${targetInterrupts}+
  interrupts total (zoom / b-roll / stat_callout / transition), spread across the video.
- Put a stat_callout on EVERY number, metric, price, %, or multiple the speaker says.
- Punch-in zoom on emphasis, strong claims, and emotional beats.
- Add b-roll when the speaker names a concrete thing/place/action (2-5 keyword query).
- Use a transition at clear topic/section changes (short, a few at most).
- Introduce the speaker/topic with a lower_third early; consider a CTA title_card near the end.
- Vary caption STYLES for emphasis moments (bold_pop on the hook, typewriter on a key line).

CAPTIONS ARE AUTOMATIC: the renderer already adds bold word-by-word captions across the
WHOLE video from the transcript. So do NOT add caption ops for coverage. Only add a caption
op to OVERRIDE THE STYLE on a specific punchy moment (e.g. bold_pop on the hook line). Spend
your effort on the high-impact ops: zoom_punch, stat_callout, b-roll, transition, lower_third,
title_card.

VIDEO FACTS:
- Duration: ${durationLine}
- Resolution: ${media.width ?? '?'}x${media.height ?? '?'} @ ${media.fps ?? '?'}fps
- Audio: ${media.hasAudio ? 'present' : 'NONE (no captions / stat / lower-third text needs)'}

DETECTED SILENCE (precise, from ffmpeg — prefer these exact ranges for silence_cut ops):
${silenceBlock}

TRANSCRIPT (word-timed; find the hook, numbers, claims, concrete nouns, topic shifts):
${scriptBlock}

${refBlock}
EFFECT CATALOG (choose ONLY these op types):
${buildCatalogText()}

RULES:
- All times are in SECONDS from the start of the source video. Keep start < end.
- CRITICAL: every start and end MUST be between 0 and ${Math.round(durNum)} (the exact
  duration). NEVER output a timestamp past ${Math.round(durNum)}s. Use the transcript's
  real word times — do not guess or extrapolate beyond the end of the video.
- For silence_cut, use the detected silence ranges (you may merge/trim tiny ones).
- Give EVERY op a short, specific "reason" ending with the inspiring vault reference, e.g. "(ref: …)".
- Be RICH but tasteful: hit the density above, but don't stack two big effects on the exact
  same moment, and don't force an effect where nothing warrants it.
- If there is no audio, skip stat_callout/lower_third/caption ops.
- Output ONLY the JSON EDL matching the provided schema. Include a one-paragraph "summary".`;
}

export function buildRepairPrompt(previousJson: string, errors: string): string {
  return `The following JSON was supposed to be a valid Edit Decision List but failed validation.
Fix it so it strictly matches the schema. Do not add commentary.

VALIDATION ERRORS:
${errors}

INVALID JSON:
${previousJson}`;
}
