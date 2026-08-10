import { describe, it, expect } from 'vitest';
import { parseEdl } from '../edl/schema';
import { motionFromEdl } from '../motion/ir';
import { resolveMotionBroll } from '../motion/render/resolveMotionBroll';
import type { BrollOverlay } from '../render/timeline';

/**
 * Phase 3 — b-roll resolution for the Motion path (closes the Phase-1.5 gap).
 * The Pexels resolver + fps-normalizer are injected so this is network-free.
 */

const CANVAS = { width: 1280, height: 720, fps: 30 };

function ir() {
  const { edl } = parseEdl(
    {
      ops: [
        { id: 'cap', type: 'caption', start: 0, end: 1, reason: 'hook', style: 'bold_pop' },
        { id: 'br', type: 'broll', start: 2, end: 5, reason: 'illustrate', query: 'city skyline', layout: 'full' },
      ],
    },
    { durationSec: 20 },
  );
  return motionFromEdl(edl, [], 20, CANVAS).compositions;
}

describe('resolveMotionBroll', () => {
  it('injects the resolved src into the b-roll video layer', async () => {
    const compositions = ir();
    const fakeResolve = async (brolls: BrollOverlay[]) => ({
      resolved: brolls.map((b) => ({ ...b, src: `https://clip/${b.query.replace(/\s+/g, '-')}.mp4` })),
      warnings: ['resolved'],
    });
    const fakeNormalize = async (brolls: BrollOverlay[]) => ({ brolls, warnings: ['normalized'] });

    const { compositions: out, warnings } = await resolveMotionBroll(compositions, {
      orientation: 'landscape',
      fps: 30,
      resolve: fakeResolve,
      normalize: fakeNormalize,
    });

    const brollComp = out.find((c) => c.metadata?.sourceOpType === 'broll')!;
    const video = brollComp.layers.find((l) => l.type === 'video') as { src?: string };
    expect(video.src).toBe('https://clip/city-skyline.mp4');
    expect(warnings).toEqual(['resolved', 'normalized']);

    // Non-broll compositions are untouched.
    const capComp = out.find((c) => c.metadata?.sourceOpType === 'caption')!;
    expect(capComp).toBeDefined();
  });

  it('passes the query and inferred layout through to the resolver', async () => {
    const compositions = ir();
    let seen: BrollOverlay[] = [];
    const fakeResolve = async (brolls: BrollOverlay[]) => {
      seen = brolls;
      return { resolved: brolls, warnings: [] };
    };
    const fakeNormalize = async (brolls: BrollOverlay[]) => ({ brolls, warnings: [] });
    await resolveMotionBroll(compositions, { orientation: 'landscape', fps: 30, resolve: fakeResolve, normalize: fakeNormalize });
    expect(seen).toHaveLength(1);
    expect(seen[0].query).toBe('city skyline');
    expect(seen[0].layout).toBe('full');
  });

  it('no-ops when there are no b-roll compositions', async () => {
    const { edl } = parseEdl({ ops: [{ id: 'z', type: 'zoom_punch', start: 0, end: 1, reason: 'p', scale: 1.1 }] }, { durationSec: 10 });
    const comps = motionFromEdl(edl, [], 10, CANVAS).compositions;
    const { compositions: out, warnings } = await resolveMotionBroll(comps, { orientation: 'landscape', fps: 30 });
    expect(out).toBe(comps);
    expect(warnings).toHaveLength(0);
  });
});
