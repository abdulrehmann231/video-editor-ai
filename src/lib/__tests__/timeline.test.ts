import { describe, it, expect } from 'vitest';
import { mapPoint, remapRange, remapWordsInRange, buildOverlayPlan } from '../render/timeline';
import type { Range } from '../render/segments';
import type { Edl } from '../edl/schema';
import type { TranscriptWord } from '../analyze/transcribe';

// Source 20s with two cuts removed: [2.6-4.61] and [9.77-11.75]
// => keep segments: [0-2.6], [4.61-9.77], [11.75-20]
const keep: Range[] = [
  { start: 0, end: 2.6 },
  { start: 4.61, end: 9.77 },
  { start: 11.75, end: 20 },
];

describe('mapPoint', () => {
  it('maps points before any cut unchanged', () => {
    expect(mapPoint(1, keep)).toBeCloseTo(1, 3);
  });
  it('collapses points inside a removed gap onto the boundary', () => {
    // 3.5 is inside [2.6,4.61] -> maps to end of first kept segment = 2.6
    expect(mapPoint(3.5, keep)).toBeCloseTo(2.6, 3);
  });
  it('subtracts earlier removed time for later points', () => {
    // 5.61 is 1s into the 2nd kept segment (starts 4.61) -> output 2.6 + 1 = 3.6
    expect(mapPoint(5.61, keep)).toBeCloseTo(3.6, 3);
  });
  it('maps the very end to the total kept duration', () => {
    // kept total = 2.6 + 5.16 + 8.25 = 16.01
    expect(mapPoint(20, keep)).toBeCloseTo(16.01, 2);
  });
});

describe('remapRange', () => {
  it('remaps a range spanning a cut into a single contiguous output range', () => {
    // [1, 6] -> [1, mapPoint(6)] ; 6 is 1.39 into 2nd seg -> 2.6+1.39=3.99
    const r = remapRange({ start: 1, end: 6 }, keep);
    expect(r).not.toBeNull();
    expect(r!.start).toBeCloseTo(1, 2);
    expect(r!.end).toBeCloseTo(3.99, 2);
  });
  it('returns null for a range entirely inside a removed gap', () => {
    expect(remapRange({ start: 3, end: 4 }, keep)).toBeNull();
  });
});

describe('remapWordsInRange', () => {
  it('keeps overlapping words and remaps their timings', () => {
    const transcript: TranscriptWord[] = [
      { word: 'a', start: 0.5, end: 1.0 },
      { word: 'gap', start: 3.0, end: 3.4 }, // inside removed gap -> dropped
      { word: 'b', start: 5.0, end: 5.4 }, // in 2nd kept seg
    ];
    const words = remapWordsInRange(transcript, { start: 0, end: 8 }, keep);
    expect(words.map((w) => w.word)).toEqual(['a', 'b']);
    // 'b' at 5.0 -> 2.6 + (5.0-4.61)=2.99
    expect(words[1].start).toBeCloseTo(2.99, 2);
  });
});

describe('buildOverlayPlan', () => {
  const edl: Edl = {
    version: 1,
    ops: [
      { id: 's1', type: 'silence_cut', source: 'gemini', start: 2.6, end: 4.61, reason: 'x' },
      { id: 's2', type: 'silence_cut', source: 'gemini', start: 9.77, end: 11.75, reason: 'x' },
      { id: 'z1', type: 'zoom_punch', source: 'gemini', start: 0, end: 2, reason: 'hook', scale: 1.2, focus: 'center' },
      { id: 'l1', type: 'lower_third', source: 'gemini', start: 0.5, end: 2.5, reason: 'intro', title: 'Alex', subtitle: 'CEO' },
      { id: 'b1', type: 'broll', source: 'gemini', start: 5, end: 8, reason: 'ill', query: 'sales chart', layout: 'full' },
      // caption spanning the first cut; transcript words provide timing
      { id: 'c1', type: 'caption', source: 'gemini', start: 0, end: 8, reason: 'hook', style: 'word_highlight' },
      // this op is entirely inside a removed gap -> dropped
      { id: 'z2', type: 'zoom_punch', source: 'gemini', start: 3, end: 4, reason: 'gap', scale: 1.1, focus: 'center' },
    ],
  };
  const transcript: TranscriptWord[] = [
    { word: 'Hello', start: 0.4, end: 0.9 },
    { word: 'world', start: 5.0, end: 5.5 },
  ];

  it('produces overlays in cut-time and drops gap-only ops', () => {
    const plan = buildOverlayPlan(edl, transcript, 20);
    expect(plan.outputDurationSec).toBeCloseTo(16.01, 2);
    expect(plan.zooms.map((z) => z.id)).toEqual(['z1']); // z2 dropped
    expect(plan.lowerThirds).toHaveLength(1);
    expect(plan.brolls).toHaveLength(1);
    expect(plan.brolls[0].query).toBe('sales chart');
    expect(plan.captions).toHaveLength(1);
    expect(plan.captions[0].words.map((w) => w.word)).toEqual(['Hello', 'world']);
  });

  it('drops caption ops that have no transcript words', () => {
    const plan = buildOverlayPlan(edl, [], 20);
    expect(plan.captions).toHaveLength(0);
  });
});
