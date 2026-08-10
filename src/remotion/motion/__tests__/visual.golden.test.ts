import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { mkdtemp, readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { PNG } from 'pngjs';
import { parseEdl } from '../../../lib/edl/schema';
import { motionFromEdl } from '../../../lib/motion/ir';
import { buildMotionProps } from '../../../lib/motion/render/props';
import type { MotionComposition } from '../../../lib/motion/ir';

/**
 * Pixel-frame golden tests (OPT-IN). Render real frames of the "Motion"
 * composition through headless Chromium and compare to committed reference PNGs
 * with a tolerance. Skipped unless RUN_VISUAL=1 (CI has no browser). Run with:
 *   npm run test:visual
 * On first run (missing reference) each case writes its reference and passes.
 */

const RUN = process.env.RUN_VISUAL === '1';
const GOLDEN_DIR = join(__dirname, 'golden');
const TOLERANCE = 0.02; // ≤2% of pixels may differ beyond the per-channel threshold
const CHANNEL_THRESHOLD = 24; // 0..255
const MEDIA = { width: 640, height: 360, fps: 30 };

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function fractionDifferent(a: PNG, b: PNG): number {
  if (a.width !== b.width || a.height !== b.height) return 1;
  let diff = 0;
  const n = a.width * a.height;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    if (
      Math.abs(a.data[o] - b.data[o]) > CHANNEL_THRESHOLD ||
      Math.abs(a.data[o + 1] - b.data[o + 1]) > CHANNEL_THRESHOLD ||
      Math.abs(a.data[o + 2] - b.data[o + 2]) > CHANNEL_THRESHOLD
    ) {
      diff++;
    }
  }
  return diff / n;
}

/** Render one frame of the Motion comp and assert it matches the committed ref. */
async function renderAndCompare(name: string, videoSrc: string, compositions: MotionComposition[], frame: number): Promise<void> {
  const { bundle } = await import('@remotion/bundler');
  const { selectComposition, renderStill, ensureBrowser } = await import('@remotion/renderer');

  const inputProps = buildMotionProps({
    cutUrl: videoSrc,
    editMedia: MEDIA,
    layout: 'landscape',
    compositions,
    outputDurationSec: 2,
  }) as unknown as Record<string, unknown>;

  await ensureBrowser();
  const serveUrl = await bundle({ entryPoint: join(process.cwd(), 'src/remotion/index.ts') });
  const composition = await selectComposition({ serveUrl, id: 'Motion', inputProps });

  const dir = await mkdtemp(join(tmpdir(), 'motion-golden-'));
  const out = join(dir, 'frame.png');
  await renderStill({ composition, serveUrl, output: out, frame, inputProps });

  await mkdir(GOLDEN_DIR, { recursive: true });
  const refPath = join(GOLDEN_DIR, `${name}.png`);
  const actual = PNG.sync.read(await readFile(out));
  if (!(await exists(refPath))) {
    await writeFile(refPath, PNG.sync.write(actual));
    console.warn(`[visual golden] wrote new reference: ${refPath}`);
    return;
  }
  const reference = PNG.sync.read(await readFile(refPath));
  expect(fractionDifferent(actual, reference)).toBeLessThan(TOLERANCE);
}

describe.skipIf(!RUN)('pixel golden — Motion composition', () => {
  it(
    'overlays (stat + lower third) match the reference',
    async () => {
      const { edl } = parseEdl(
        {
          ops: [
            { id: 'lt', type: 'lower_third', start: 0, end: 2, reason: 'name', title: 'Jane', subtitle: 'CEO' },
            { id: 'st', type: 'stat_callout', start: 0, end: 2, reason: 'metric', value: '43%', label: 'growth' },
          ],
        },
        { durationSec: 5 },
      );
      const { compositions } = motionFromEdl(edl, [], 5, MEDIA);
      await renderAndCompare('motion-overlays', '', compositions, 20);
    },
    120_000,
  );

  it(
    'camera punch + glitch transition over the base clip match the reference',
    async () => {
      const { edl } = parseEdl(
        {
          ops: [
            { id: 'z', type: 'zoom_punch', start: 0, end: 2, reason: 'hook', scale: 1.3, focus: 'center' },
            { id: 'tr', type: 'transition', start: 0.4, end: 1.0, reason: 'glitch', variant: 'glitch' },
            { id: 'st', type: 'stat_callout', start: 0, end: 2, reason: 'metric', value: '3x', label: 'ROI' },
          ],
        },
        { durationSec: 5 },
      );
      const { compositions } = motionFromEdl(edl, [], 5, MEDIA);
      // frame 18 (~0.6s): camera near peak zoom AND glitch transition active.
      await renderAndCompare('motion-camera-transition', 'public/testclips/base.mp4', compositions, 18);
    },
    120_000,
  );
});
