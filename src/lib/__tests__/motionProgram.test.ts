import { describe, it, expect } from 'vitest';
import { parseProgram, programToMotion, programDecisionLog } from '../motion/program';
import { generateProgram } from '../analyze/program';
import { validateComposition } from '../motion/ir';
import type { MotionLayer } from '../motion/ir/types';
import type { TranscriptWord } from '../analyze/transcribe';

/**
 * Phase 6 — the Creative Director. The AI emits SCENES of coordinated ELEMENTS
 * (lean {type, params}, timing inherited from the scene); parseProgram validates
 * them through the EDL op schema and programToMotion composites each scene into
 * ONE layered IR composition.
 */

const CANVAS = { width: 1280, height: 720, fps: 30 };

// A raw program as the model would emit it: lean elements, no per-element ids/timing.
const RAW = {
  summary: 'test',
  captionPlacement: 'lower',
  cuts: [{ start: 2, end: 4 }],
  scenes: [
    {
      id: 'hook',
      start: 5,
      end: 9,
      intent: 'Contrast + a rocket sticker + an arrow, composed together',
      reason: 'compose the hook (ref: #1)',
      elements: [
        { type: 'illustration', name: 'rocket', label: 'LAUNCH', position: 'right', size: 'medium', animate: 'float' },
        { type: 'annotate', annotation: 'arrow', x: 0.6, y: 0.4, w: 0.2, h: 0.2, delay: 0.6 },
        { type: 'stat_callout', value: '3x', label: 'growth', position: 'corner', delay: 1.0 },
      ],
    },
    {
      id: 'data',
      start: 10,
      end: 14,
      intent: 'A chart and a checklist side by side',
      reason: 'the numbers (ref: #2)',
      elements: [
        { type: 'chart', variant: 'bar', title: 'REV', data: [{ label: '22', value: 40 }, { label: '23', value: 70 }], position: 'left' },
        { type: 'checklist', items: [{ text: 'EXPERTISE', mark: 'check' }, { text: 'LABOUR', mark: 'cross' }], position: 'center' },
      ],
    },
  ],
};

describe('parseProgram', () => {
  it('injects scene timing into lean elements and validates them as ops', () => {
    const { program, warnings } = parseProgram(RAW, { durationSec: 30 });
    expect(warnings).toEqual([]);
    expect(program.scenes).toHaveLength(2);
    expect(program.cuts).toEqual([{ start: 2, end: 4 }]);
    const hook = program.scenes[0];
    expect(hook.elements).toHaveLength(3);
    // elements inherit scene end; delayed ones start later within the scene
    expect(hook.elements[0].start).toBe(5);
    expect(hook.elements[1].start).toBeCloseTo(5.6, 3); // delay 0.6
    expect(hook.elements[2].start).toBeCloseTo(6.0, 3); // delay 1.0
    expect(hook.elements.every((e) => e.end === 9)).toBe(true);
  });

  it('hoists a silence_cut element to the program cut list', () => {
    const raw = { scenes: [{ id: 's', start: 5, end: 9, intent: 'x', reason: 'r', elements: [{ type: 'silence_cut' }, { type: 'zoom_punch', scale: 1.2 }] }] };
    const { program } = parseProgram(raw, { durationSec: 30 });
    // silence hoisted → cuts; the scene keeps only the zoom
    expect(program.cuts.some((c) => c.start === 5 && c.end === 9)).toBe(true);
    expect(program.scenes[0].elements).toHaveLength(1);
    expect(program.scenes[0].elements[0].type).toBe('zoom_punch');
  });

  it('drops a scene with no valid elements and a scene with bad timing', () => {
    const raw = {
      scenes: [
        { id: 'bad_time', start: 9, end: 5, intent: 'x', reason: 'r', elements: [{ type: 'zoom_punch' }] },
        { id: 'empty', start: 1, end: 3, intent: 'x', reason: 'r', elements: [{ type: 'not_a_real_op' }] },
        { id: 'ok', start: 4, end: 6, intent: 'x', reason: 'r', elements: [{ type: 'zoom_punch', scale: 1.1 }] },
      ],
    };
    const { program, warnings } = parseProgram(raw, { durationSec: 30 });
    expect(program.scenes.map((s) => s.id)).toEqual(['ok']);
    expect(warnings.length).toBeGreaterThanOrEqual(2);
  });
});

describe('programToMotion', () => {
  const transcript: TranscriptWord[] = [
    { word: 'we', start: 5.2, end: 5.4 },
    { word: 'grew', start: 5.4, end: 5.8 },
  ];

  it('composites each scene into ONE layered composition and remaps to cut time', () => {
    const { program } = parseProgram(RAW, { durationSec: 30 });
    const { compositions, warnings } = programToMotion(program, transcript, 30, CANVAS);
    expect(warnings).toEqual([]);
    const scenes = compositions.filter((c) => c.metadata?.sourceOpType === 'scene');
    expect(scenes).toHaveLength(2);

    const hook = scenes.find((c) => c.id === 'scene_hook')!;
    // source 5–9 with 2s removed (2–4) → cut 3–7
    expect(hook.start).toBeCloseTo(3, 2);
    expect(hook.end).toBeCloseTo(7, 2);
    // all 3 elements contributed layers into the SINGLE scene composition
    const flat: MotionLayer[] = [];
    const walk = (ls: MotionLayer[]) => ls.forEach((l) => { flat.push(l); if (l.type === 'group') walk(l.children); });
    walk(hook.layers);
    expect(flat.some((l) => l.id.startsWith('hook_e0'))).toBe(true); // illustration
    expect(flat.some((l) => l.id.startsWith('hook_e1'))).toBe(true); // annotate
    expect(flat.some((l) => l.id.startsWith('hook_e2'))).toBe(true); // stat
    // the delayed elements are offset within the scene (started > 0)
    const e2 = hook.layers.find((l) => l.id.startsWith('hook_e2'))!;
    expect(e2.start).toBeGreaterThan(0.5);
  });

  it('every composition passes semantic validation', () => {
    const { program } = parseProgram(RAW, { durationSec: 30 });
    const { compositions } = programToMotion(program, transcript, 30, CANVAS);
    for (const c of compositions) {
      const res = validateComposition(c);
      expect(res.ok, `comp ${c.id}: ${res.errors.join('; ')}`).toBe(true);
    }
  });

  it('a zoom_punch element drives the scene camera (no overlay layer)', () => {
    const raw = { scenes: [{ id: 'z', start: 5, end: 8, intent: 'punch', reason: 'r', elements: [{ type: 'zoom_punch', scale: 1.25, focus: 'face' }, { type: 'illustration', name: 'fire' }] }] };
    const { program } = parseProgram(raw, { durationSec: 30 });
    const { compositions } = programToMotion(program, [], 30, CANVAS);
    const scene = compositions.find((c) => c.id === 'scene_z')!;
    expect(scene.camera?.focus).toBe('face');
    expect(validateComposition(scene).ok).toBe(true);
  });

  it('programDecisionLog yields one time-ordered row per element', () => {
    const { program } = parseProgram(RAW, { durationSec: 30 });
    const log = programDecisionLog(program);
    expect(log.length).toBe(5); // 3 + 2 elements
    expect(log[0].start).toBeLessThanOrEqual(log[log.length - 1].start);
    expect(log.every((r) => typeof r.reason === 'string' && r.reason.length > 0)).toBe(true);
  });
});

describe('generateProgram repair', () => {
  const plan = { niche: 'B2B', tone: 'energetic', captionPlacement: 'lower' as const, summary: 's', segments: [], beats: [{ start: 2, end: 6, intent: 'revenue chart', searchQuery: 'bar chart revenue' }] };
  const media = { durationSec: 20, width: 1280, height: 720, fps: 30, hasAudio: true, videoCodec: 'h264', audioCodec: 'aac', sizeBytes: 1000, container: 'mp4' };
  const input = { plan, media, silence: [], transcript: [] as TranscriptWord[] };

  it('runs one repair pass that recovers a dropped data element', async () => {
    const incomplete = JSON.stringify({ scenes: [{ id: 's1', start: 2, end: 6, intent: 'x', reason: 'r (ref: #1)', elements: [{ type: 'chart', variant: 'bar' }, { type: 'illustration', name: 'rocket' }] }] });
    const complete = JSON.stringify({ scenes: [{ id: 's1', start: 2, end: 6, intent: 'x', reason: 'r (ref: #1)', elements: [{ type: 'chart', variant: 'bar', data: [{ label: 'a', value: 1 }, { label: 'b', value: 2 }] }, { type: 'illustration', name: 'rocket' }] }] });
    let n = 0;
    const call = async () => (n++ === 0 ? incomplete : complete);
    const { program, repaired } = await generateProgram(input, 20, call);
    expect(n).toBe(2); // initial + one repair
    expect(repaired).toBe(true);
    const chart = program.scenes[0].elements.find((e) => e.type === 'chart') as { data?: unknown[] } | undefined;
    expect(chart?.data?.length).toBe(2); // recovered
  });

  it('does not repair when the first program is already complete', async () => {
    const complete = JSON.stringify({ scenes: [{ id: 's1', start: 2, end: 6, intent: 'x', reason: 'r', elements: [{ type: 'illustration', name: 'rocket' }] }] });
    let n = 0;
    const call = async () => { n++; return complete; };
    const { repaired } = await generateProgram(input, 20, call);
    expect(n).toBe(1); // no repair call
    expect(repaired).toBe(false);
  });
});
