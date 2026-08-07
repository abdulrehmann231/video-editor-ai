import { describe, it, expect } from 'vitest';
import { buildSelectExpr, buildFilterComplex, buildFfmpegArgs } from '../render/ffmpegCut';

const segs = [
  { start: 0, end: 2.6 },
  { start: 4.61, end: 9.77 },
];

describe('buildSelectExpr', () => {
  it('joins between() terms with +', () => {
    expect(buildSelectExpr(segs)).toBe('between(t,0,2.6)+between(t,4.61,9.77)');
  });
});

describe('buildFilterComplex', () => {
  it('includes video + audio chains with loudnorm by default', () => {
    const f = buildFilterComplex(segs, { hasAudio: true });
    expect(f).toContain("[0:v]select='between(t,0,2.6)+between(t,4.61,9.77)',setpts=N/FRAME_RATE/TB[v]");
    expect(f).toContain('aselect=');
    expect(f).toContain('loudnorm=');
  });

  it('omits the audio chain when there is no audio', () => {
    const f = buildFilterComplex(segs, { hasAudio: false });
    expect(f).not.toContain('aselect');
    expect(f).not.toContain('[a]');
  });

  it('can disable loudnorm', () => {
    const f = buildFilterComplex(segs, { hasAudio: true, normalizeAudio: false });
    expect(f).not.toContain('loudnorm');
  });
});

describe('buildFfmpegArgs', () => {
  it('maps audio + video when audio present', () => {
    const args = buildFfmpegArgs('in.mp4', 'out.mp4', segs, { hasAudio: true });
    expect(args).toContain('-filter_complex');
    expect(args.join(' ')).toContain('-map [v]');
    expect(args.join(' ')).toContain('-map [a]');
    expect(args).toContain('libx264');
    expect(args[args.length - 1]).toBe('out.mp4');
  });

  it('uses -an when there is no audio', () => {
    const args = buildFfmpegArgs('in.mp4', 'out.mp4', segs, { hasAudio: false });
    expect(args).toContain('-an');
    expect(args.join(' ')).not.toContain('-map [a]');
  });

  it('always forces constant frame rate (fixes VFR "No frame found" in Remotion)', () => {
    const args = buildFfmpegArgs('in.mp4', 'out.mp4', segs, { hasAudio: true });
    expect(args.join(' ')).toContain('-fps_mode cfr');
  });

  it('pins the output frame rate to the source fps when provided', () => {
    const args = buildFfmpegArgs('in.mp4', 'out.mp4', segs, { hasAudio: true, fps: 30 });
    expect(args.join(' ')).toContain('-fps_mode cfr');
    expect(args.join(' ')).toContain('-r 30');
    expect(args[args.length - 1]).toBe('out.mp4');
  });

  it('rounds a fractional fps to an integer so it matches the Remotion composition', () => {
    // 23.98 fps → composition renders at Math.round(23.98)=24; the cut must too,
    // else Remotion seeks between frames and throws "No frame found".
    const args = buildFfmpegArgs('in.mp4', 'out.mp4', segs, { hasAudio: true, fps: 23.98 });
    expect(args.join(' ')).toContain('-r 24');
    expect(args.join(' ')).not.toContain('-r 23.98');
  });

  it('omits -r when fps is unknown but still forces CFR', () => {
    const args = buildFfmpegArgs('in.mp4', 'out.mp4', segs, { hasAudio: true, fps: null });
    expect(args.join(' ')).toContain('-fps_mode cfr');
    expect(args.join(' ')).not.toContain(' -r ');
  });
});
