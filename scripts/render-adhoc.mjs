// Ad-hoc Motion-IR render harness: render arbitrary compositions (from a JSON
// file) to stills, for eyeballing new effects. Usage:
//   npx tsx scripts/render-adhoc.mjs <compsJson> <outDir>
import { join } from 'node:path';
import fs from 'node:fs';
import { bundle } from '@remotion/bundler';
import { selectComposition, renderStill, ensureBrowser } from '@remotion/renderer';
import { buildMotionProps } from '../src/lib/motion/render/props.ts';

const BASE = process.env.BASE || 'public/testclips/demo.mp4';
const MEDIA = { width: 1280, height: 720, fps: 30 };
const specPath = process.argv[2];
const outDir = process.argv[3] || '/tmp/adhoc';
fs.mkdirSync(outDir, { recursive: true });
const specs = JSON.parse(fs.readFileSync(specPath, 'utf8')); // [{name, comp, frame}]

await ensureBrowser();
const serveUrl = await bundle({ entryPoint: join(process.cwd(), 'src/remotion/index.ts') });

for (const s of specs) {
  const inputProps = buildMotionProps({
    cutUrl: BASE,
    editMedia: MEDIA,
    layout: 'landscape',
    compositions: [s.comp],
    outputDurationSec: s.comp.end - s.comp.start,
  });
  const composition = await selectComposition({ serveUrl, id: 'Motion', inputProps, timeoutInMilliseconds: 120000 });
  const output = join(outDir, `${s.name}.png`);
  await renderStill({ composition, serveUrl, output, frame: s.frame ?? 30, inputProps, timeoutInMilliseconds: 120000 });
  console.log('OK', output);
}
console.log('done');
