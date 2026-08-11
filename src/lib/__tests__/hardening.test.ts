import { describe, it, expect } from 'vitest';
import { parseEdl } from '../edl/schema';
import { motionFromEdl, resolveTemplate, validateComposition, type MotionComposition } from '../motion/ir';
import type { TranscriptWord } from '../analyze/transcribe';

/**
 * Hardening pass: emphasis wiring, lottie/three executable templates, validator
 * rotation bounds.
 */

const CANVAS = { width: 1280, height: 720, fps: 30 };
const CTX = { idPrefix: 'x', dur: 2, canvas: CANVAS };

describe('caption emphasis wired from the EDL', () => {
  it('carries a caption op emphasis word into the caption layer', () => {
    const transcript: TranscriptWord[] = [
      { word: 'this', start: 0, end: 0.4 },
      { word: 'changes', start: 0.4, end: 0.9 },
      { word: 'everything', start: 0.9, end: 1.5 },
    ];
    const { edl } = parseEdl(
      { ops: [{ id: 'c', type: 'caption', start: 0, end: 3, reason: 'r', style: 'word_highlight', emphasis: ['changes'] }] },
      { durationSec: 5 },
    );
    const { compositions } = motionFromEdl(edl, transcript, 5, CANVAS);
    const cap = compositions.find((c) => c.metadata?.sourceOpType === 'caption')!.layers[0] as { emphasis?: string[] };
    expect(cap.emphasis).toContain('changes');
  });
});

describe('lottie / three executable templates', () => {
  it('maps a lottie op to a lottie layer', () => {
    const { edl } = parseEdl({ ops: [{ id: 'l', type: 'lottie', start: 0, end: 2, reason: 'r', template: 'confetti' }] }, { durationSec: 5 });
    const { compositions } = motionFromEdl(edl, [], 5, CANVAS);
    const layer = compositions[0].layers[0] as { type: string; template: string };
    expect(layer.type).toBe('lottie');
    expect(layer.template).toBe('confetti');
  });

  it('maps a three op to a three layer with value/label', () => {
    const { edl } = parseEdl({ ops: [{ id: 't', type: 'three', start: 0, end: 2, reason: 'r', template: 'stat_orb', value: '43%', label: 'growth' }] }, { durationSec: 5 });
    const { compositions } = motionFromEdl(edl, [], 5, CANVAS);
    const layer = compositions[0].layers[0] as { type: string; template: string; value?: string; label?: string };
    expect(layer.type).toBe('three');
    expect(layer.template).toBe('stat_orb');
    expect(layer.value).toBe('43%');
    expect(layer.label).toBe('growth');
  });

  it('resolveTemplate builds lottie/three layers directly', () => {
    expect((resolveTemplate('lottie', { template: 'trophy', position: 'corner' }, CTX).layers[0] as { type: string }).type).toBe('lottie');
    expect((resolveTemplate('three', { template: 'card_3d', value: 'Q3' }, CTX).layers[0] as { type: string }).type).toBe('three');
  });
});

describe('validator: rotation bounds', () => {
  it('flags an out-of-range rotation', () => {
    const comp: MotionComposition = {
      schemaVersion: '1.0',
      id: 'c',
      start: 0,
      end: 1,
      timeBasis: 'cut',
      coordinateSpace: 'normalized',
      canvas: CANVAS,
      layers: [{ id: 't', type: 'text', content: 'x', start: 0, duration: 1, transform: { rotation: { kind: 'constant', value: [0, 0, 99999] } } }],
    };
    expect(validateComposition(comp).ok).toBe(false);
  });
});
