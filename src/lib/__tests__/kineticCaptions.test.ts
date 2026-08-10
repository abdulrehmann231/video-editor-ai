import { describe, it, expect } from 'vitest';
import { parseEdl } from '../edl/schema';
import { motionFromEdl, resolveTemplate, type BrandProfile, type MotionComposition } from '../motion/ir';
import { describeComposition } from '../../remotion/motion/describe';
import type { TranscriptWord } from '../analyze/transcribe';

/**
 * Phase 4 — word-by-word kinetic typography. Captions are generated densely from
 * the transcript (remapped to cut time), carry per-word timing, and take their
 * style from any overlapping caption op.
 */

const CANVAS = { width: 1280, height: 720, fps: 30 };

describe('dense captions from transcript', () => {
  const transcript: TranscriptWord[] = [
    { word: 'hello', start: 0.2, end: 0.6 },
    { word: 'world', start: 0.6, end: 1.0 },
    { word: 'again', start: 4.0, end: 4.5 }, // after silence 1-3 removed -> cut ~2.0
  ];
  const { edl } = parseEdl(
    {
      ops: [
        { id: 's', type: 'silence_cut', start: 1, end: 3, reason: 'gap' },
        { id: 'c', type: 'caption', start: 0, end: 10, reason: 'style hint', style: 'bold_pop' },
      ],
    },
    { durationSec: 12 },
  );
  const { compositions } = motionFromEdl(edl, transcript, 12, CANVAS);
  const caps = compositions.filter((c) => c.metadata?.sourceOpType === 'caption');

  it('produces caption compositions with per-word timing and the op style', () => {
    expect(caps.length).toBeGreaterThanOrEqual(1);
    const layer = caps[0].layers[0] as { type: string; style: string; words: { word: string; start: number }[] };
    expect(layer.type).toBe('caption');
    expect(layer.style).toBe('bold_pop'); // inherited from the overlapping caption op
    expect(layer.words[0].word).toBe('hello');
    expect(layer.words[0].start).toBeGreaterThanOrEqual(0); // relative to comp start
  });

  it('remaps caption words onto the cut timeline (silence removed)', () => {
    const againComp = caps.find((c) => (c.layers[0] as { words: { word: string }[] }).words.some((w) => w.word === 'again'))!;
    expect(againComp).toBeDefined();
    expect(againComp.start).toBeCloseTo(2.0, 1); // source 4.0 - 2s removed
  });
});

describe('kinetic_text builds a caption layer from injected words', () => {
  const brand: BrandProfile = {
    colors: { primary: '#111', secondary: '#222', accent: '#00ffcc', background: '#000', text: '#fafafa' },
    fonts: { heading: 'Anton', body: 'Inter' },
  };
  it('honors style/placement + brand highlight/fill', () => {
    const ctx = { idPrefix: 'x', dur: 2, canvas: CANVAS, brand, input: { words: [{ word: 'hi', start: 0, end: 1 }] } };
    const { layers } = resolveTemplate('kinetic_text', { style: 'karaoke', placement: 'middle' }, ctx);
    const cap = layers[0] as { type: string; style: string; placement: string; highlight: string; fill: string; words: unknown[] };
    expect(cap.type).toBe('caption');
    expect(cap.style).toBe('karaoke');
    expect(cap.placement).toBe('middle');
    expect(cap.highlight).toBe('#00ffcc'); // brand accent
    expect(cap.fill).toBe('#fafafa'); // brand text
    expect(cap.words).toHaveLength(1);
  });
});

describe('active word advances over time', () => {
  it('reports a different active word at successive frames', () => {
    const comp: MotionComposition = {
      schemaVersion: '1.0',
      id: 'c',
      start: 0,
      end: 1,
      timeBasis: 'cut',
      coordinateSpace: 'normalized',
      canvas: CANVAS,
      layers: [
        {
          id: 'cap',
          type: 'caption',
          start: 0,
          duration: 1,
          style: 'word_highlight',
          words: [
            { word: 'hi', start: 0, end: 0.4 },
            { word: 'there', start: 0.4, end: 1.0 },
          ],
        },
      ],
    };
    const cr = describeComposition(comp, [0, 20], 30); // 0s -> "hi", 0.66s -> "there"
    expect(cr.atFrames[0].layers[0].activeWord).toBe('hi');
    expect(cr.atFrames[1].layers[0].activeWord).toBe('there');
  });
});
