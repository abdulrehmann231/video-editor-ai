import { describe, it, expect } from 'vitest';
import { parseEdl } from '../edl/schema';
import { buildOverlayPlan } from '../render/timeline';
import { motionFromEdl } from '../motion/ir';
import { validateComposition } from '../motion/ir';
import type { TranscriptWord } from '../analyze/transcribe';

/**
 * Phase 1 — EDL -> Motion IR adapter.
 * The adapter reuses the EXACT source-time -> cut-time remap that buildOverlayPlan
 * uses (keep-segments), so IR timestamps live on the same timeline as today's
 * overlays. Silence cuts are consumed into the timeline (never emitted as comps).
 */

const CANVAS = { width: 1280, height: 720, fps: 30 };

describe('motionFromEdl', () => {
  it('emits one composition per non-silence op and consumes silence cuts', () => {
    const { edl } = parseEdl(
      {
        ops: [
          { id: 's', type: 'silence_cut', start: 2, end: 4, reason: 'dead air' },
          { id: 'z', type: 'zoom_punch', start: 5, end: 6, reason: 'hook', scale: 1.2 },
          { id: 'lt', type: 'lower_third', start: 6, end: 9, reason: 'name', title: 'Jane', subtitle: 'CEO' },
        ],
      },
      { durationSec: 20 },
    );

    const { compositions } = motionFromEdl(edl, [], 20, CANVAS);
    expect(compositions).toHaveLength(2); // silence_cut is not a composition
    expect(compositions.every((c) => c.metadata?.sourceOpType !== 'silence_cut')).toBe(true);
  });

  it('remaps op times onto the compressed cut timeline', () => {
    // Removing 2s-4s shifts everything after 4s earlier by 2s.
    const { edl } = parseEdl(
      {
        ops: [
          { id: 's', type: 'silence_cut', start: 2, end: 4, reason: 'dead air' },
          { id: 'z', type: 'zoom_punch', start: 5, end: 6, reason: 'hook', scale: 1.2 },
          { id: 'lt', type: 'lower_third', start: 6, end: 9, reason: 'name', title: 'Jane' },
        ],
      },
      { durationSec: 20 },
    );
    const { compositions } = motionFromEdl(edl, [], 20, CANVAS);

    const zoom = compositions.find((c) => c.metadata?.sourceOpType === 'zoom_punch')!;
    expect(zoom.start).toBeCloseTo(3, 2); // source 5 -> cut 3
    expect(zoom.end).toBeCloseTo(4, 2); // source 6 -> cut 4
    expect(zoom.metadata?.sourceOpId).toBe('z');

    const lt = compositions.find((c) => c.metadata?.sourceOpType === 'lower_third')!;
    expect(lt.start).toBeCloseTo(4, 2); // source 6 -> cut 4
    expect(lt.metadata?.reason).toBe('name');
  });

  it('produces compositions that all pass semantic validation', () => {
    const transcript: TranscriptWord[] = [
      { word: 'we', start: 0.2, end: 0.4 },
      { word: 'grew', start: 0.4, end: 0.7 },
    ];
    const { edl } = parseEdl(
      {
        ops: [
          { id: 'c', type: 'caption', start: 0, end: 1, reason: 'hook', style: 'bold_pop' },
          { id: 'z', type: 'zoom_punch', start: 1, end: 2, reason: 'punch', scale: 1.15 },
          { id: 'lt', type: 'lower_third', start: 2, end: 5, reason: 'name', title: 'Jane', subtitle: 'CEO' },
          { id: 'st', type: 'stat_callout', start: 5, end: 7, reason: 'metric', value: '43%', label: 'growth' },
          { id: 'tc', type: 'title_card', start: 7, end: 9, reason: 'intro', variant: 'intro', heading: 'Q3' },
          { id: 'tr', type: 'transition', start: 9, end: 9.4, reason: 'wipe', variant: 'flash' },
          { id: 'br', type: 'broll', start: 10, end: 13, reason: 'illustrate', query: 'city skyline', layout: 'full' },
        ],
      },
      { durationSec: 20 },
    );
    const { compositions } = motionFromEdl(edl, transcript, 20, CANVAS);
    expect(compositions.length).toBe(7);
    for (const c of compositions) {
      const res = validateComposition(c);
      expect(res.ok, `comp ${c.id} (${c.metadata?.sourceOpType}) errors: ${res.errors.join('; ')}`).toBe(true);
    }
  });

  it('maps a lower_third to a group containing the title text', () => {
    const { edl } = parseEdl(
      { ops: [{ id: 'lt', type: 'lower_third', start: 1, end: 4, reason: 'name', title: 'Jane', subtitle: 'CEO' }] },
      { durationSec: 20 },
    );
    const { compositions } = motionFromEdl(edl, [], 20, CANVAS);
    const lt = compositions[0];
    expect(lt.layers[0].type).toBe('group');
    const group = lt.layers[0] as { children: { type: string; content?: string }[] };
    expect(group.children.some((ch) => ch.type === 'text' && ch.content === 'Jane')).toBe(true);
  });

  it('maps zoom_punch to a composition-level camera (no overlay layers)', () => {
    const { edl } = parseEdl(
      { ops: [{ id: 'z', type: 'zoom_punch', start: 1, end: 2, reason: 'punch', scale: 1.25, focus: 'face' }] },
      { durationSec: 10 },
    );
    const { compositions } = motionFromEdl(edl, [], 10, CANVAS);
    const z = compositions[0];
    expect(z.layers).toHaveLength(0);
    expect(z.camera?.scale).toBeDefined();
    expect(z.camera?.focus).toBe('face');
    expect(validateComposition(z).ok).toBe(true);
  });

  it('drops an op that collapses entirely into a removed segment', () => {
    const { edl } = parseEdl(
      {
        ops: [
          { id: 's', type: 'silence_cut', start: 0, end: 10, reason: 'cut all' },
          { id: 'z', type: 'zoom_punch', start: 2, end: 4, reason: 'inside gap', scale: 1.1 },
        ],
      },
      { durationSec: 10 },
    );
    const { compositions, warnings } = motionFromEdl(edl, [], 10, CANVAS);
    expect(compositions).toHaveLength(0);
    expect(warnings.length).toBeGreaterThan(0);
  });
});

describe('no visual regression guard', () => {
  it('buildOverlayPlan output is unaffected by the Phase-1 IR module', () => {
    // Phase 1 adds the IR alongside the pipeline; it must not touch the render
    // path. This pins the existing overlay-plan behavior for a fixture EDL.
    const { edl } = parseEdl(
      {
        ops: [
          { id: 's', type: 'silence_cut', start: 2, end: 4, reason: 'dead air' },
          { id: 'z', type: 'zoom_punch', start: 5, end: 6, reason: 'hook', scale: 1.2, focus: 'face' },
        ],
      },
      { durationSec: 20 },
    );
    const transcript: TranscriptWord[] = [{ word: 'hi', start: 0.1, end: 0.3 }];
    const plan = buildOverlayPlan(edl, transcript, 20);
    expect(plan.zooms).toHaveLength(1);
    expect(plan.zooms[0].start).toBeCloseTo(3, 2); // source 5 -> cut 3 (silence 2-4 removed)
    expect(plan.outputDurationSec).toBeCloseTo(18, 2); // 20 - 2s removed
  });
});
