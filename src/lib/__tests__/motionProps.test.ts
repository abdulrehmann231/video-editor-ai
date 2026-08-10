import { describe, it, expect } from 'vitest';
import { buildMotionProps } from '../motion/render/props';
import type { MotionComposition } from '../motion/ir';

/**
 * Phase 1.5/2 — the Node-side builder that turns cut info + IR compositions into
 * the inputProps for the Remotion "Motion" composition. Pure + deterministic.
 */

const comps: MotionComposition[] = [];

describe('buildMotionProps', () => {
  it('uses the edit-media dimensions and rounds fps for landscape', () => {
    const props = buildMotionProps({
      cutUrl: 'https://cdn/cut.mp4',
      editMedia: { width: 1920, height: 1080, fps: 29.97 },
      layout: 'landscape',
      compositions: comps,
      outputDurationSec: 10,
    });
    expect(props.videoSrc).toBe('https://cdn/cut.mp4');
    expect(props.width).toBe(1920);
    expect(props.height).toBe(1080);
    expect(props.fps).toBe(30); // rounded from 29.97
    expect(props.durationInFrames).toBe(300); // 10s * 30fps
    expect(props.layout).toBe('landscape');
    expect(props.progressBar).toBe(true);
  });

  it('overrides dimensions to 720x1280 for shorts', () => {
    const props = buildMotionProps({
      cutUrl: 'https://cdn/cut.mp4',
      editMedia: { width: 1920, height: 1080, fps: 30 },
      layout: 'shorts',
      compositions: comps,
      outputDurationSec: 5,
    });
    expect(props.width).toBe(720);
    expect(props.height).toBe(1280);
    expect(props.durationInFrames).toBe(150);
  });

  it('falls back to defaults for missing media and respects progressBar override', () => {
    const props = buildMotionProps({
      cutUrl: '',
      editMedia: {},
      layout: 'landscape',
      compositions: comps,
      outputDurationSec: 0,
      progressBar: false,
    });
    expect(props.width).toBe(1280);
    expect(props.height).toBe(720);
    expect(props.fps).toBe(30);
    expect(props.durationInFrames).toBeGreaterThanOrEqual(1); // never zero
    expect(props.progressBar).toBe(false);
  });
});
