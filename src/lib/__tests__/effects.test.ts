import { describe, it, expect } from 'vitest';
import { parseEdl } from '../edl/schema';
import { buildOverlayPlan } from '../render/timeline';
import type { Edl } from '../edl/schema';

describe('title_card op', () => {
  it('validates via parseEdl', () => {
    const { edl } = parseEdl({
      ops: [
        { id: 't1', type: 'title_card', start: 0, end: 2, reason: 'intro', variant: 'intro', heading: 'Grow your B2B', sub: 'in 60 seconds' },
        { id: 't2', type: 'title_card', start: 18, end: 20, reason: 'cta', variant: 'cta', heading: 'Subscribe' },
      ],
    });
    expect(edl.ops).toHaveLength(2);
    expect(edl.ops[0]).toMatchObject({ type: 'title_card', variant: 'intro', heading: 'Grow your B2B' });
  });

  it('maps title cards into the overlay plan (cut timeline)', () => {
    const edl: Edl = {
      version: 1,
      ops: [
        { id: 's1', type: 'silence_cut', source: 'gemini', start: 3, end: 5, reason: 'x' },
        { id: 't1', type: 'title_card', source: 'gemini', start: 0, end: 2, reason: 'intro', variant: 'intro', heading: 'Hi' },
        { id: 't2', type: 'title_card', source: 'gemini', start: 8, end: 10, reason: 'cta', variant: 'cta', heading: 'Bye' },
      ],
    };
    const plan = buildOverlayPlan(edl, [], 10);
    expect(plan.titleCards).toHaveLength(2);
    // t2 at source 8-10 shifts left by the 2s cut -> 6-8 in cut time
    const cta = plan.titleCards.find((t) => t.variant === 'cta')!;
    expect(cta.start).toBeCloseTo(6, 2);
    expect(cta.end).toBeCloseTo(8, 2);
  });
});
