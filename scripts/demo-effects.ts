/**
 * Visual demo: render each Motion-IR effect over a real base clip and save one
 * frame per effect to ./testframes (gitignored). Not a committed test — a manual
 * eyeball harness.
 *
 *   BASE=public/testclips/demo.mp4 npx tsx scripts/demo-effects.ts
 */
import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { bundle } from '@remotion/bundler';
import { selectComposition, renderStill, ensureBrowser } from '@remotion/renderer';
import { parseEdl } from '../src/lib/edl/schema';
import { motionFromEdl, type MotionComposition } from '../src/lib/motion/ir';
import { buildMotionProps } from '../src/lib/motion/render/props';
import type { TranscriptWord } from '../src/lib/analyze/transcribe';

const BASE = process.env.BASE || 'public/testclips/demo.mp4';
const MEDIA = { width: 1280, height: 720, fps: 30 };
const OUT = join(process.cwd(), 'testframes');

const CAPTION_WORDS: TranscriptWord[] = [
  { word: 'THIS', start: 0.1, end: 0.5 },
  { word: 'CHANGES', start: 0.5, end: 1.0 },
  { word: 'EVERYTHING', start: 1.0, end: 1.8 },
];

interface Case {
  name: string;
  ops: unknown[];
  transcript?: TranscriptWord[];
  frame: number;
  brollSrc?: string; // inject a src into broll video layers so pip is visible
}

const CASES: Case[] = [
  { name: 'caption', ops: [{ id: 'c', type: 'caption', start: 0, end: 2, reason: 'hook', style: 'bold_pop' }], transcript: CAPTION_WORDS, frame: 30 },
  { name: 'zoom_punch', ops: [{ id: 'z', type: 'zoom_punch', start: 0, end: 2, reason: 'punch', scale: 1.3, focus: 'center' }], frame: 20 },
  { name: 'lower_third', ops: [{ id: 'lt', type: 'lower_third', start: 0, end: 2, reason: 'name', title: 'Jane Doe', subtitle: 'Founder & CEO' }], frame: 40 },
  { name: 'stat_callout', ops: [{ id: 's', type: 'stat_callout', start: 0, end: 2, reason: 'metric', value: '43%', label: 'revenue growth' }], frame: 40 },
  { name: 'title_card', ops: [{ id: 't', type: 'title_card', start: 0, end: 2, reason: 'intro', variant: 'intro', heading: 'Q3 RESULTS', sub: 'FY2026' }], frame: 40 },
  { name: 'transition_glitch', ops: [{ id: 'tr', type: 'transition', start: 0, end: 1, reason: 'glitch', variant: 'glitch' }], frame: 15 },
  { name: 'transition_zoom_blur', ops: [{ id: 'tr', type: 'transition', start: 0, end: 1, reason: 'zb', variant: 'zoom_blur' }], frame: 15 },
  { name: 'transition_flash', ops: [{ id: 'tr', type: 'transition', start: 0, end: 1, reason: 'flash', variant: 'flash' }], frame: 15 },
  { name: 'broll_pip', ops: [{ id: 'b', type: 'broll', start: 0, end: 2, reason: 'pip', query: 'city', layout: 'pip' }], frame: 30, brollSrc: BASE },
  {
    name: 'combined',
    ops: [
      { id: 'z', type: 'zoom_punch', start: 0, end: 2, reason: 'punch', scale: 1.12, focus: 'center' },
      { id: 'c', type: 'caption', start: 0, end: 2, reason: 'hook', style: 'bold_pop' },
      { id: 'lt', type: 'lower_third', start: 0, end: 2, reason: 'name', title: 'Jane Doe', subtitle: 'Founder & CEO' },
      { id: 's', type: 'stat_callout', start: 0, end: 2, reason: 'metric', value: '43%', label: 'growth', position: 'corner' },
    ],
    transcript: CAPTION_WORDS,
    frame: 40,
  },
];

function injectBrollSrc(comps: MotionComposition[], src: string): MotionComposition[] {
  return comps.map((c) =>
    c.metadata?.sourceOpType === 'broll'
      ? { ...c, layers: c.layers.map((l) => (l.type === 'video' ? { ...l, src } : l)) }
      : c,
  );
}

async function main() {
  await mkdir(OUT, { recursive: true });
  await ensureBrowser();
  const serveUrl = await bundle({ entryPoint: join(process.cwd(), 'src/remotion/index.ts') });

  for (const c of CASES) {
    const { edl } = parseEdl({ ops: c.ops }, { durationSec: 6 });
    let { compositions } = motionFromEdl(edl, c.transcript ?? [], 6, MEDIA);
    if (c.brollSrc) compositions = injectBrollSrc(compositions, c.brollSrc);

    const inputProps = buildMotionProps({
      cutUrl: BASE,
      editMedia: MEDIA,
      layout: 'landscape',
      compositions,
      outputDurationSec: 3,
    }) as unknown as Record<string, unknown>;

    const composition = await selectComposition({ serveUrl, id: 'Motion', inputProps, timeoutInMilliseconds: 120_000 });
    const output = join(OUT, `${c.name}.png`);
    await renderStill({ composition, serveUrl, output, frame: c.frame, inputProps, timeoutInMilliseconds: 120_000 });
    console.log(`✓ ${c.name} -> ${output}`);
  }
  console.log(`\nDone. ${CASES.length} frames in ${OUT}`);
}

main().catch((e) => {
  console.error('DEMO_FAIL', e?.message || e);
  process.exit(1);
});
