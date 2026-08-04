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

  it('validates + maps stat_callout and transition ops', () => {
    const { edl } = parseEdl({
      ops: [
        { id: 'sc', type: 'stat_callout', start: 4, end: 6, reason: 'metric', value: '$1.2M', label: 'revenue', position: 'center' },
        { id: 'tr', type: 'transition', start: 6, end: 6.4, reason: 'section change', variant: 'glitch' },
        { id: 'cap', type: 'caption', start: 0, end: 3, reason: 'hook', style: 'typewriter' },
      ],
    });
    expect(edl.ops.map((o) => o.type)).toEqual(['stat_callout', 'transition', 'caption']);
    const plan = buildOverlayPlan(edl, [{ word: 'Hi', start: 0.2, end: 0.6 }], 20);
    expect(plan.statCallouts).toHaveLength(1);
    expect(plan.statCallouts[0].value).toBe('$1.2M');
    expect(plan.transitions[0].variant).toBe('glitch');
    expect(plan.captions[0].style).toBe('typewriter');
  });

  it('validates + maps a lottie op', () => {
    const { edl } = parseEdl({
      ops: [
        { id: 'lo', type: 'lottie', start: 3, end: 5, reason: 'win (ref: Confetti)', template: 'confetti', position: 'full' },
      ],
    });
    expect(edl.ops[0].type).toBe('lottie');
    const plan = buildOverlayPlan(edl, [], 20);
    expect(plan.lotties).toHaveLength(1);
    expect(plan.lotties[0].template).toBe('confetti');
    expect(plan.lotties[0].position).toBe('full');
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
