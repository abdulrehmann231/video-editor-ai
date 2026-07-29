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
  style: 'word_highlight' | 'bold_pop' | 'karaoke';
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

export interface OverlayPlan {
  zooms: ZoomOverlay[];
  captions: CaptionOverlay[];
  lowerThirds: LowerThirdOverlay[];
  brolls: BrollOverlay[];
  titleCards: TitleCardOverlay[];
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
  const captions: CaptionOverlay[] = [];
  const lowerThirds: LowerThirdOverlay[] = [];
  const brolls: BrollOverlay[] = [];
  const titleCards: TitleCardOverlay[] = [];

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
      case 'caption': {
        const words = remapWordsInRange(transcript, { start: op.start, end: op.end }, keep);
        // Only add caption if we actually have word timings to show.
        if (words.length > 0) {
          captions.push({ id: op.id, start: mapped.start, end: mapped.end, style: op.style, words });
        }
        break;
      }
      case 'silence_cut':
        break; // already consumed into the timeline
    }
  }

  return { zooms, captions, lowerThirds, brolls, titleCards, outputDurationSec };
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
