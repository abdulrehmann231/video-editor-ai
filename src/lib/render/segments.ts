import type { Edl } from '../edl/schema';

/**
 * Pure segment math for the FFmpeg cut renderer.
 *
 * The EDL's `silence_cut` ops describe ranges to REMOVE. This module turns them
 * into the ordered list of KEEP segments the renderer stitches back together.
 */

export interface Range {
  start: number;
  end: number;
}

/** Merge overlapping/adjacent ranges (gap <= epsilon joined). Input unsorted ok. */
export function mergeRanges(ranges: Range[], epsilon = 0.001): Range[] {
  const valid = ranges
    .filter((r) => r.end > r.start)
    .sort((a, b) => a.start - b.start);
  const out: Range[] = [];
  for (const r of valid) {
    const last = out[out.length - 1];
    if (last && r.start <= last.end + epsilon) {
      last.end = Math.max(last.end, r.end);
    } else {
      out.push({ ...r });
    }
  }
  return out;
}

/**
 * Given the total duration and the ranges to remove, return the KEEP segments
 * (the complement), dropping keep slivers shorter than `minKeepSec`.
 */
export function computeKeepSegments(
  durationSec: number,
  cuts: Range[],
  opts: { minKeepSec?: number } = {},
): Range[] {
  const minKeep = opts.minKeepSec ?? 0.05;
  if (durationSec <= 0) return [];

  // Clamp cuts to [0, duration] and merge.
  const clamped = cuts
    .map((c) => ({ start: Math.max(0, c.start), end: Math.min(durationSec, c.end) }))
    .filter((c) => c.end > c.start);
  const merged = mergeRanges(clamped);

  if (merged.length === 0) return [{ start: 0, end: durationSec }];

  const keep: Range[] = [];
  let cursor = 0;
  for (const cut of merged) {
    if (cut.start - cursor > minKeep) keep.push({ start: round(cursor), end: round(cut.start) });
    cursor = Math.max(cursor, cut.end);
  }
  if (durationSec - cursor > minKeep) keep.push({ start: round(cursor), end: round(durationSec) });

  return keep;
}

/** Total seconds removed = duration - sum(keep). */
export function totalKept(segments: Range[]): number {
  return round(segments.reduce((s, r) => s + (r.end - r.start), 0));
}

/** Pull the silence_cut removal ranges out of an EDL. */
export function cutRangesFromEdl(edl: Edl): Range[] {
  return edl.ops
    .filter((op) => op.type === 'silence_cut')
    .map((op) => ({ start: op.start, end: op.end }));
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}
