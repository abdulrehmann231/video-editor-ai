import { describe, it, expect } from 'vitest';
import { buildAnalysisPrompt, transcriptToScript } from '../analyze/prompt';
import type { MediaInfo } from '../ingest';

const media: MediaInfo = {
  durationSec: 20,
  width: 1280,
  height: 720,
  fps: 30,
  hasAudio: true,
  videoCodec: 'h264',
  audioCodec: 'aac',
  sizeBytes: 1000,
  container: 'mp4',
};

describe('buildAnalysisPrompt', () => {
  it('embeds user instructions as highest priority when provided', () => {
    const p = buildAnalysisPrompt({
      media,
      silence: [],
      userPrompt: 'Introduce the speaker as Sara, CEO. Heavy captions.',
    });
    expect(p).toContain('USER INSTRUCTIONS');
    expect(p).toContain('Sara, CEO');
  });

  it('omits the user-instructions block when no prompt is given', () => {
    const p = buildAnalysisPrompt({ media, silence: [] });
    expect(p).not.toContain('USER INSTRUCTIONS');
  });

  it('always includes the effect catalog and rules', () => {
    const p = buildAnalysisPrompt({ media, silence: [] });
    expect(p).toContain('EFFECT CATALOG');
    expect(p).toContain('silence_cut');
  });
});

describe('transcriptToScript', () => {
  it('groups words into timestamped lines', () => {
    const script = transcriptToScript([
      { word: 'Hello', start: 0, end: 0.5 },
      { word: 'world.', start: 0.5, end: 1 },
    ]);
    expect(script).toContain('Hello world.');
    expect(script).toMatch(/\[0:00/);
  });

  it('handles an empty transcript', () => {
    expect(transcriptToScript([])).toContain('no transcript');
  });
});
