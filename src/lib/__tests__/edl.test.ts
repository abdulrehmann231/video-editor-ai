import { describe, it, expect } from 'vitest';
import { parseEdl, toDecisionLog } from '../edl/schema';

describe('parseEdl', () => {
  it('validates a well-formed EDL and narrows op params', () => {
    const raw = {
      version: 1,
      summary: 'Tighten pacing, add captions.',
      ops: [
        { id: 'a', type: 'silence_cut', start: 1, end: 2.5, reason: 'dead air' },
        {
          id: 'b',
          type: 'zoom_punch',
          start: 3,
          end: 4,
          reason: 'emphasis on hook',
          scale: 1.2,
          focus: 'face',
        },
        {
          id: 'c',
          type: 'caption',
          start: 0,
          end: 5,
          reason: 'hook captions',
          style: 'bold_pop',
        },
      ],
    };
    const { edl, warnings } = parseEdl(raw, { durationSec: 60 });
    expect(edl.ops).toHaveLength(3);
    expect(warnings).toHaveLength(0);
    const zoom = edl.ops.find((o) => o.type === 'zoom_punch');
    expect(zoom).toMatchObject({ scale: 1.2, focus: 'face' });
  });

  it('strips null params emitted by the flat response schema', () => {
    const raw = {
      ops: [
        {
          id: 'x',
          type: 'silence_cut',
          start: 1,
          end: 2,
          reason: 'pause',
          // irrelevant params come back as null from the flat schema
          scale: null,
          focus: null,
          title: null,
          query: '',
          emphasis: null,
        },
      ],
    };
    const { edl } = parseEdl(raw);
    expect(edl.ops[0].type).toBe('silence_cut');
  });

  it('drops ops with end <= start and clamps ops past duration', () => {
    const raw = {
      ops: [
        { id: '1', type: 'silence_cut', start: 5, end: 5, reason: 'zero-length' },
        { id: '2', type: 'zoom_punch', start: 9, end: 30, reason: 'overshoot', scale: 1.1 },
      ],
    };
    const { edl, warnings } = parseEdl(raw, { durationSec: 10 });
    expect(edl.ops).toHaveLength(1);
    expect(edl.ops[0].end).toBe(10);
    expect(warnings.length).toBe(2);
  });

  it('rejects an unknown op type', () => {
    expect(() =>
      parseEdl({ ops: [{ id: '1', type: 'explode', start: 0, end: 1, reason: 'no' }] }),
    ).toThrow();
  });
});

describe('toDecisionLog', () => {
  it('sorts by start time', () => {
    const edl = {
      version: 1 as const,
      ops: [
        { id: 'b', type: 'caption' as const, source: 'gemini' as const, start: 10, end: 12, reason: 'later', style: 'word_highlight' as const },
        { id: 'a', type: 'silence_cut' as const, source: 'gemini' as const, start: 1, end: 2, reason: 'earlier' },
      ],
    };
    const log = toDecisionLog(edl);
    expect(log.map((l) => l.reason)).toEqual(['earlier', 'later']);
  });
});
