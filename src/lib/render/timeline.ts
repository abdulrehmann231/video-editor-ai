import type { Edl } from '../edl/schema';
import type { TranscriptWord } from '../analyze/transcribe';
import { computeKeepSegments, cutRangesFromEdl, totalKept, type Range } from './segments';

/**
 * Timeline remapping: overlay ops/transcript carry SOURCE-video timestamps, but
 * the Phase-2 cut removed segments, so the cut video has a compressed timeline.
 * These helpers map source-time → cut(output)-time through the keep-segments.
 *
 * mapPoint is monotonic non-decreasing: any source instant inside a removed gap
 * collapses onto the cut boundary, so a source range that lies entirely within a
 * gap maps to a zero-length output range (and is dropped).
 */

/** Map a source-time instant to its position in the cut timeline. */
export function mapPoint(t: number, keep: Range[]): number {
  let offset = 0;
  for (const seg of keep) {
    if (t <= seg.start) return offset;
    if (t <= seg.end) return offset + (t - seg.start);
    offset += seg.end - seg.start;
  }
  return offset;
}

/** Remap a source range to the cut timeline; null if it collapses (was cut out). */
export function remapRange(range: Range, keep: Range[], minLen = 0.04): Range | null {
  const start = mapPoint(range.start, keep);
  const end = mapPoint(range.end, keep);
  if (end - start < minLen) return null;
  return { start: round(start), end: round(end) };
}

export interface ZoomOverlay {
  id: string;
  start: number;
  end: number;
  scale: number;
  focus: 'center' | 'face' | 'left' | 'right' | 'top';
}
export interface CaptionWord {
  word: string;
  start: number;
  end: number;
}
export interface CaptionOverlay {
  id: string;
  start: number;
  end: number;
  style: 'word_highlight' | 'bold_pop' | 'karaoke' | 'typewriter';
  words: CaptionWord[];
}
export interface LowerThirdOverlay {
  id: string;
  start: number;
  end: number;
  title: string;
  subtitle?: string;
}
export interface BrollOverlay {
  id: string;
  start: number;
  end: number;
  layout: 'full' | 'pip';
  query: string;
  /** Resolved later from Pexels. */
  src?: string;
}
export interface TitleCardOverlay {
  id: string;
  start: number;
  end: number;
  variant: 'intro' | 'cta';
  heading: string;
  sub?: string;
}
export interface StatCalloutOverlay {
  id: string;
  start: number;
  end: number;
  value: string;
  label?: string;
  position: 'center' | 'corner';
}
export interface TransitionOverlay {
  id: string;
  start: number;
  end: number;
  variant: 'glitch' | 'flash' | 'zoom_blur';
}
export interface LottieOverlay {
  id: string;
  start: number;
  end: number;
  template: string;
  position?: 'full' | 'center' | 'corner';
}
export interface ThreeOverlay {
  id: string;
  start: number;
  end: number;
  template: string;
  value?: string;
  label?: string;
}

export interface OverlayPlan {
  zooms: ZoomOverlay[];
  captions: CaptionOverlay[];
  lowerThirds: LowerThirdOverlay[];
  brolls: BrollOverlay[];
  titleCards: TitleCardOverlay[];
  statCallouts: StatCalloutOverlay[];
  transitions: TransitionOverlay[];
  lotties: LottieOverlay[];
  threes: ThreeOverlay[];
  /** Cut-timeline duration in seconds. */
  outputDurationSec: number;
}

/**
 * Build the full overlay plan in CUT-timeline seconds from the EDL + transcript.
 * Silence cuts are consumed to derive the timeline; the rest become overlays.
 */
export function buildOverlayPlan(
  edl: Edl,
  transcript: TranscriptWord[],
  sourceDurationSec: number,
): OverlayPlan {
  const keep = computeKeepSegments(sourceDurationSec, cutRangesFromEdl(edl), { minKeepSec: 0.05 });
  const outputDurationSec = round(totalKept(keep));

  const zooms: ZoomOverlay[] = [];
  const lowerThirds: LowerThirdOverlay[] = [];
  const brolls: BrollOverlay[] = [];
  const titleCards: TitleCardOverlay[] = [];
  const statCallouts: StatCalloutOverlay[] = [];
  const transitions: TransitionOverlay[] = [];
  const lotties: LottieOverlay[] = [];
  const threes: ThreeOverlay[] = [];
  // Gemini caption ops become STYLE hints over cut-time ranges; the actual dense
  // caption coverage is generated from the full transcript below.
  const captionStyleRanges: { start: number; end: number; style: CaptionStyle }[] = [];

  for (const op of edl.ops) {
    const mapped = remapRange({ start: op.start, end: op.end }, keep);
    if (!mapped) continue; // op fell inside a removed segment

    switch (op.type) {
      case 'zoom_punch':
        zooms.push({ id: op.id, start: mapped.start, end: mapped.end, scale: op.scale, focus: op.focus });
        break;
      case 'lower_third':
        lowerThirds.push({ id: op.id, start: mapped.start, end: mapped.end, title: op.title, subtitle: op.subtitle });
        break;
      case 'broll':
        brolls.push({ id: op.id, start: mapped.start, end: mapped.end, layout: op.layout, query: op.query });
        break;
      case 'title_card':
        titleCards.push({ id: op.id, start: mapped.start, end: mapped.end, variant: op.variant, heading: op.heading, sub: op.sub });
        break;
      case 'stat_callout':
        statCallouts.push({ id: op.id, start: mapped.start, end: mapped.end, value: op.value, label: op.label, position: op.position });
        break;
      case 'transition':
        transitions.push({ id: op.id, start: mapped.start, end: mapped.end, variant: op.variant });
        break;
      case 'lottie':
        lotties.push({ id: op.id, start: mapped.start, end: mapped.end, template: op.template, position: op.position });
        break;
      case 'three':
        threes.push({ id: op.id, start: mapped.start, end: mapped.end, template: op.template, value: op.value, label: op.label });
        break;
      case 'caption':
        captionStyleRanges.push({ start: mapped.start, end: mapped.end, style: op.style });
        break;
      case 'silence_cut':
        break; // already consumed into the timeline
    }
  }

  // Dense captions across the WHOLE spoken content (like a real YouTube edit),
  // with Gemini's caption ops applying their style over their ranges.
  const captions = buildAutoCaptions(transcript, keep, captionStyleRanges);

  return { zooms, captions, lowerThirds, brolls, titleCards, statCallouts, transitions, lotties, threes, outputDurationSec };
}

type CaptionStyle = CaptionOverlay['style'];

/**
 * Generate continuous, punchy captions from the full transcript (remapped to the
 * cut timeline), grouped into short phrases (≤4 words; break on gaps/punctuation).
 * A caption gets its style from any overlapping Gemini caption op, else a default.
 */
export function buildAutoCaptions(
  transcript: TranscriptWord[],
  keep: Range[],
  styleRanges: { start: number; end: number; style: CaptionStyle }[] = [],
  opts: { maxWords?: number; gapSec?: number; defaultStyle?: CaptionStyle } = {},
): CaptionOverlay[] {
  const maxWords = opts.maxWords ?? 4;
  const gapSec = opts.gapSec ?? 0.6;
  const defaultStyle = opts.defaultStyle ?? 'word_highlight';

  // Remap every word to cut time, drop those inside removed gaps, sort.
  const words: CaptionWord[] = [];
  for (const w of transcript) {
    const r = remapRange({ start: w.start, end: w.end }, keep, 0.01);
    if (r) words.push({ word: w.word, start: r.start, end: r.end });
  }
  words.sort((a, b) => a.start - b.start);
  if (words.length === 0) return [];

  // Group into phrases.
  const phrases: CaptionWord[][] = [];
  let cur: CaptionWord[] = [];
  for (const w of words) {
    if (cur.length > 0) {
      const prev = cur[cur.length - 1];
      const endsSentence = /[.!?,]$/.test(prev.word);
      if (cur.length >= maxWords || w.start - prev.end > gapSec || endsSentence) {
        phrases.push(cur);
        cur = [];
      }
    }
    cur.push(w);
  }
  if (cur.length) phrases.push(cur);

  const styleFor = (start: number, end: number): CaptionStyle => {
    const mid = (start + end) / 2;
    const hit = styleRanges.find((r) => mid >= r.start && mid <= r.end);
    return hit?.style ?? defaultStyle;
  };

  return phrases.map((p, i) => {
    const start = p[0].start;
    const rawEnd = p[p.length - 1].end;
    // Hold the caption until just before the next phrase (avoids flicker gaps).
    const next = phrases[i + 1]?.[0].start ?? rawEnd + 0.4;
    const end = Math.min(next - 0.01, rawEnd + 0.35);
    return {
      id: `cap_${i}`,
      start: round(start),
      end: round(Math.max(end, start + 0.2)),
      style: styleFor(start, rawEnd),
      words: p,
    };
  });
}

/** Remap transcript words overlapping a source range into cut-time caption words. */
export function remapWordsInRange(
  transcript: TranscriptWord[],
  sourceRange: Range,
  keep: Range[],
): CaptionWord[] {
  const out: CaptionWord[] = [];
  for (const w of transcript) {
    // keep words that overlap the caption's source range
    if (w.end <= sourceRange.start || w.start >= sourceRange.end) continue;
    const remapped = remapRange({ start: w.start, end: w.end }, keep, 0.01);
    if (!remapped) continue;
    out.push({ word: w.word, start: remapped.start, end: remapped.end });
  }
  return out;
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}
