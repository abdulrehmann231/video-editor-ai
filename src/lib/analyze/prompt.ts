import { buildCatalogText } from '../edl/catalog';
import type { MediaInfo } from '../ingest';
import type { SilenceSegment } from './silence';
import type { TranscriptWord } from './transcribe';

export interface PromptInput {
  media: MediaInfo;
  silence: SilenceSegment[];
  transcript?: TranscriptWord[];
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
  const { media, silence, transcript } = input;
  const durationLine =
    media.durationSec != null ? `${media.durationSec}s (${fmt(media.durationSec)})` : 'unknown';

  const silenceBlock =
    silence.length > 0
      ? silence
          .slice(0, 200)
          .map((s) => `  - ${s.start}s → ${s.end}s (${s.durationSec}s)`)
          .join('\n')
      : '  (none detected)';

  const scriptBlock = transcript ? transcriptToScript(transcript) : '(transcription not run)';

  return `You are a senior video editor for B2B talking-head YouTube content. Your job is to
watch the attached video and produce an EDIT DECISION LIST (EDL): a precise, timestamped
plan of edits that a deterministic renderer will apply. You do NOT regenerate video — you
only choose edits from the fixed catalog below, the way a human editor would in After Effects.

TARGET STYLE (from a B2B/talking-head inspiration vault):
- Tight pacing: cut dead air, filler words, and false starts aggressively (jump cuts).
- Bold word-by-word captions, especially on the hook and key points.
- Quick punch-in zooms on emphasis and the first ~5 seconds (the hook).
- Clean lower thirds to introduce the speaker or label sections.
- Occasional stock b-roll that literally illustrates what's being said.
- A hook-heavy opening.

VIDEO FACTS:
- Duration: ${durationLine}
- Resolution: ${media.width ?? '?'}x${media.height ?? '?'} @ ${media.fps ?? '?'}fps
- Audio: ${media.hasAudio ? 'present' : 'NONE (skip caption ops)'}

DETECTED SILENCE (precise, from ffmpeg — prefer these exact ranges for silence_cut ops):
${silenceBlock}

TRANSCRIPT (word-timed; use for caption ranges, emphasis, and finding filler/claims):
${scriptBlock}

EFFECT CATALOG (choose ONLY these op types):
${buildCatalogText()}

RULES:
- All times are in SECONDS from the start of the source video. Keep start < end and within duration.
- For silence_cut, use the detected silence ranges (you may merge/trim tiny ones).
- Give EVERY op a short, specific "reason" (this is shown to the user as a decision log).
- Be tasteful: don't over-use zooms or b-roll. Quality over quantity.
- If there is no audio, do not create caption ops.
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
