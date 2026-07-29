import { describe, it, expect } from 'vitest';
import { parseSilenceLog } from '../analyze/silence';

describe('parseSilenceLog', () => {
  it('pairs silence_start / silence_end lines', () => {
    const log = `
[silencedetect @ 0x1] silence_start: 1.234
[silencedetect @ 0x1] silence_end: 2.834 | silence_duration: 1.6
[silencedetect @ 0x1] silence_start: 5.0
[silencedetect @ 0x1] silence_end: 6.2 | silence_duration: 1.2
`;
    const segs = parseSilenceLog(log);
    expect(segs).toHaveLength(2);
    expect(segs[0]).toEqual({ start: 1.23, end: 2.83, durationSec: 1.6 });
    expect(segs[1].start).toBe(5);
  });

  it('clamps negative starts to 0 and derives duration when absent', () => {
    const log = `silence_start: -0.5\nsilence_end: 1.0`;
    const segs = parseSilenceLog(log);
    expect(segs[0].start).toBe(0);
    expect(segs[0].durationSec).toBeCloseTo(1.0, 2);
  });

  it('ignores an unterminated silence_start', () => {
    const log = `silence_start: 3.0\n(no end)`;
    expect(parseSilenceLog(log)).toHaveLength(0);
  });
});
