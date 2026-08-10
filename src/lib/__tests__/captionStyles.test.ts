import { describe, it, expect } from 'vitest';
import { parseEdl } from '../edl/schema';
import { motionFromEdl, resolveCaptionConfig, parseMotionComposition, type MotionComposition } from '../motion/ir';
import type { TranscriptWord } from '../analyze/transcribe';

/**
 * More caption styles + per-project caption config. Confirms size/placement/font/
 * colors/style are all dynamic (preset OR partial config), and that all 8 render
 * styles are valid IR.
 */

const CANVAS = { width: 1280, height: 720, fps: 30 };
const T: TranscriptWord[] = [
  { word: 'a', start: 0, end: 0.4 },
  { word: 'b', start: 0.4, end: 0.8 },
  { word: 'c', start: 0.8, end: 1.2 },
];

type Cap = { type: string; style: string; placement?: string; size?: number; fill?: string; family?: string };

function captionLayer(opStyle: string, cfg?: unknown): Cap {
  const { edl } = parseEdl({ ops: [{ id: 'c', type: 'caption', start: 0, end: 3, reason: 'r', style: opStyle }] }, { durationSec: 5 });
  const { compositions } = motionFromEdl(edl, T, 5, CANVAS, undefined, cfg as string | undefined);
  const cap = compositions.find((c) => c.metadata?.sourceOpType === 'caption')!;
  return cap.layers[0] as unknown as Cap;
}

describe('resolveCaptionConfig', () => {
  it('resolves a preset name', () => {
    expect(resolveCaptionConfig('youtube').style).toBe('youtube');
    expect(resolveCaptionConfig('youtube').size).toBe(0.04);
    expect(resolveCaptionConfig('tiktok').style).toBe('single_word');
    expect(resolveCaptionConfig('tiktok').placement).toBe('middle');
  });
  it('layers a partial config over the default and falls back for unknown', () => {
    expect(resolveCaptionConfig({ size: 0.02 }).style).toBe('word_highlight'); // base
    expect(resolveCaptionConfig({ size: 0.02 }).size).toBe(0.02); // override
    expect(resolveCaptionConfig('nope').style).toBe('word_highlight'); // unknown -> base
  });
});

describe('caption config threads into the adapter', () => {
  it('uses the per-op style when no config is set', () => {
    expect(captionLayer('bold_pop').style).toBe('bold_pop');
    expect(captionLayer('karaoke').style).toBe('karaoke');
  });

  it('a preset overrides the op style and sets size/placement', () => {
    const yt = captionLayer('bold_pop', 'youtube');
    expect(yt.style).toBe('youtube'); // preset wins
    expect(yt.size).toBe(0.04);
    expect(yt.placement).toBe('lower');

    const tk = captionLayer('word_highlight', 'tiktok');
    expect(tk.style).toBe('single_word');
    expect(tk.placement).toBe('middle');
    expect(tk.size).toBe(0.11);
  });

  it('a full partial config makes size/position/font/color dynamic', () => {
    const cap = captionLayer('word_highlight', { style: 'underline', size: 0.07, placement: 'upper', fill: '#00ffcc', fontFamily: 'Oswald' });
    expect(cap.style).toBe('underline');
    expect(cap.size).toBe(0.07);
    expect(cap.placement).toBe('upper');
    expect(cap.fill).toBe('#00ffcc');
    expect(cap.family).toBe('Oswald');
  });
});

describe('all 8 caption styles are valid IR', () => {
  const STYLES = ['word_highlight', 'bold_pop', 'karaoke', 'typewriter', 'youtube', 'single_word', 'underline', 'bounce'];
  it('parses a caption layer for each style without dropping it', () => {
    for (const style of STYLES) {
      const raw: MotionComposition = {
        schemaVersion: '1.0',
        id: `c_${style}`,
        start: 0,
        end: 1,
        timeBasis: 'cut',
        coordinateSpace: 'normalized',
        canvas: CANVAS,
        layers: [{ id: 'cap', type: 'caption', start: 0, duration: 1, style: style as never, words: [{ word: 'hi', start: 0, end: 1 }] }],
      };
      const { comp, warnings } = parseMotionComposition(raw);
      expect(warnings, `style ${style}`).toHaveLength(0);
      expect(comp.layers).toHaveLength(1);
    }
  });
});
