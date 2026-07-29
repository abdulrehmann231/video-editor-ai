import { describe, it, expect } from 'vitest';
import {
  mergeRanges,
  computeKeepSegments,
  totalKept,
  cutRangesFromEdl,
} from '../render/segments';
import type { Edl } from '../edl/schema';

describe('mergeRanges', () => {
  it('merges overlapping and adjacent ranges', () => {
    const merged = mergeRanges([
      { start: 5, end: 6 },
      { start: 0, end: 2 },
      { start: 2, end: 3 }, // adjacent to previous
      { start: 2.5, end: 4 }, // overlaps
    ]);
    expect(merged).toEqual([
      { start: 0, end: 4 },
      { start: 5, end: 6 },
    ]);
  });

  it('drops zero/negative-length ranges', () => {
    expect(mergeRanges([{ start: 3, end: 3 }, { start: 5, end: 4 }])).toEqual([]);
  });
});

describe('computeKeepSegments', () => {
  it('inverts cuts into keep-segments', () => {
    const keep = computeKeepSegments(20, [
      { start: 2.6, end: 4.61 },
      { start: 9.77, end: 11.75 },
    ]);
    expect(keep).toEqual([
      { start: 0, end: 2.6 },
      { start: 4.61, end: 9.77 },
      { start: 11.75, end: 20 },
    ]);
  });

  it('returns the whole clip when there are no cuts', () => {
    expect(computeKeepSegments(10, [])).toEqual([{ start: 0, end: 10 }]);
  });

  it('clamps cuts to the duration and handles a cut at the very start', () => {
    const keep = computeKeepSegments(10, [{ start: 0, end: 3 }, { start: 8, end: 999 }]);
    expect(keep).toEqual([{ start: 3, end: 8 }]);
  });

  it('drops keep slivers below minKeepSec', () => {
    const keep = computeKeepSegments(10, [{ start: 0.02, end: 5 }], { minKeepSec: 0.05 });
    // the 0-0.02 sliver is dropped
    expect(keep).toEqual([{ start: 5, end: 10 }]);
  });

  it('totalKept sums kept duration', () => {
    const keep = computeKeepSegments(20, [{ start: 2.6, end: 4.61 }, { start: 9.77, end: 11.75 }]);
    // removed 2.01 + 1.98 = 3.99 -> kept 16.01
    expect(totalKept(keep)).toBeCloseTo(16.01, 2);
  });
});

describe('cutRangesFromEdl', () => {
  it('extracts only silence_cut ops', () => {
    const edl: Edl = {
      version: 1,
      ops: [
        { id: 'a', type: 'silence_cut', source: 'gemini', start: 1, end: 2, reason: 'x' },
        { id: 'b', type: 'zoom_punch', source: 'gemini', start: 3, end: 4, reason: 'y', scale: 1.1, focus: 'center' },
        { id: 'c', type: 'silence_cut', source: 'silence-detector', start: 5, end: 6, reason: 'z' },
      ],
    };
    expect(cutRangesFromEdl(edl)).toEqual([
      { start: 1, end: 2 },
      { start: 5, end: 6 },
    ]);
  });
});
