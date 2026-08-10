import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { mkdtemp, readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { PNG } from 'pngjs';
import { parseEdl } from '../../../lib/edl/schema';
import { motionFromEdl } from '../../../lib/motion/ir';
import { buildMotionProps } from '../../../lib/motion/render/props';

/**
 * Pixel-frame golden test (OPT-IN). Renders real frames of the "Motion"
 * composition through headless Chromium and compares them to committed reference
 * PNGs with a tolerance. Skipped unless RUN_VISUAL=1 (CI has no browser); run
 * locally with: RUN_VISUAL=1 npx vitest run src/remotion/motion/__tests__/visual.golden.test.ts
 *
 * On first run (missing reference) it writes the reference and passes (bootstrap).
 */

const RUN = process.env.RUN_VISUAL === '1';
const GOLDEN_DIR = join(__dirname, 'golden');
const TOLERANCE = 0.02; // ≤2% of pixels may differ beyond the per-channel threshold
const CHANNEL_THRESHOLD = 24; // 0..255

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/** Fraction of pixels differing beyond CHANNEL_THRESHOLD on any channel. */
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

describe.skipIf(!RUN)('pixel golden — Motion composition', () => {
  it(
    'renders overlays that match the reference frame within tolerance',
    async () => {
      const { bundle } = await import('@remotion/bundler');
      const { selectComposition, renderStill, ensureBrowser } = await import('@remotion/renderer');

      const { edl } = parseEdl(
        {
          ops: [
            { id: 'lt', type: 'lower_third', start: 0, end: 2, reason: 'name', title: 'Jane', subtitle: 'CEO' },
            { id: 'st', type: 'stat_callout', start: 0, end: 2, reason: 'metric', value: '43%', label: 'growth' },
          ],
        },
        { durationSec: 5 },
      );
      const { compositions } = motionFromEdl(edl, [], 5, { width: 640, height: 360, fps: 30 });
      const inputProps = buildMotionProps({
        cutUrl: '',
        editMedia: { width: 640, height: 360, fps: 30 },
        layout: 'landscape',
        compositions,
        outputDurationSec: 2,
      }) as unknown as Record<string, unknown>;

      await ensureBrowser();
      const serveUrl = await bundle({ entryPoint: join(process.cwd(), 'src/remotion/index.ts') });
      const composition = await selectComposition({ serveUrl, id: 'Motion', inputProps });

      const dir = await mkdtemp(join(tmpdir(), 'motion-golden-'));
      const out = join(dir, 'frame.png');
      await renderStill({ composition, serveUrl, output: out, frame: 20, inputProps });

      await mkdir(GOLDEN_DIR, { recursive: true });
      const refPath = join(GOLDEN_DIR, 'motion-overlays.png');
      const actual = PNG.sync.read(await readFile(out));

      if (!(await exists(refPath))) {
        await writeFile(refPath, PNG.sync.write(actual));
        console.warn(`[visual golden] wrote new reference: ${refPath}`);
        return;
      }
      const reference = PNG.sync.read(await readFile(refPath));
      const frac = fractionDifferent(actual, reference);
      expect(frac).toBeLessThan(TOLERANCE);
    },
    120_000,
  );
});
