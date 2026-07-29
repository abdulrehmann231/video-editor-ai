import { describe, it, expect } from 'vitest';
import { normalizeChunks } from '../analyze/transcribe';

describe('normalizeChunks', () => {
  it('maps ASR chunks to word timestamps', () => {
    const words = normalizeChunks([
      { text: ' Hello', timestamp: [0, 0.5] },
      { text: ' world', timestamp: [0.5, 1.0] },
    ]);
    expect(words).toEqual([
      { word: 'Hello', start: 0, end: 0.5 },
      { word: 'world', start: 0.5, end: 1 },
    ]);
  });

  it('drops chunks with no text or missing start', () => {
    const words = normalizeChunks([
      { text: '   ', timestamp: [0, 1] },
      { text: 'ok', timestamp: [null, 2] },
      { text: 'good', timestamp: [3, null] },
    ]);
    expect(words).toEqual([{ word: 'good', start: 3, end: 3 }]);
  });
});
