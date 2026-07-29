import { describe, it, expect } from 'vitest';
import { newId, safeFilename } from '../ids';

describe('newId', () => {
  it('applies a prefix and is reasonably unique', () => {
    const a = newId('p_');
    const b = newId('p_');
    expect(a.startsWith('p_')).toBe(true);
    expect(a).not.toBe(b);
  });
});

describe('safeFilename', () => {
  it('replaces unsafe characters with underscores', () => {
    expect(safeFilename('my video (final)!.mp4')).toBe('my_video_final_.mp4');
  });

  it('collapses repeated underscores', () => {
    expect(safeFilename('a   b###c.mov')).toBe('a_b_c.mov');
  });

  it('never returns an empty string', () => {
    expect(safeFilename('***')).not.toBe('');
  });

  it('keeps the tail of very long names', () => {
    const long = 'x'.repeat(200) + '.mp4';
    const out = safeFilename(long);
    expect(out.length).toBeLessThanOrEqual(120);
    expect(out.endsWith('.mp4')).toBe(true);
  });
});
