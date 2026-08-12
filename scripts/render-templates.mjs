// Render specific templates by id+params to stills. Usage:
//   npx tsx scripts/render-templates.mjs
import { join } from 'node:path';
import fs from 'node:fs';
import { bundle } from '@remotion/bundler';
import { selectComposition, renderStill, ensureBrowser } from '@remotion/renderer';
import { resolveTemplate } from '../src/lib/motion/compiler/resolveTemplates.ts';
import { buildMotionProps } from '../src/lib/motion/render/props.ts';
import { IR_VERSION } from '../src/lib/motion/ir/version.ts';

const BASE = process.env.BASE || 'public/testclips/demo.mp4';
const MEDIA = { width: 1280, height: 720, fps: 30 };
const OUT = process.argv[2] || '/tmp/tpl';
fs.mkdirSync(OUT, { recursive: true });

const CASES = [
  { name: 'name_tag', id: 'name_tag', params: { text: 'YOUNG MARK', targetX: 0.5, targetY: 0.2, side: 'below' }, frame: 55 },
  { name: 'checklist', id: 'checklist', params: { items: [{ text: 'EXPERTISE', mark: 'check' }, { text: 'LABOUR', mark: 'cross' }], position: 'center' }, frame: 70 },
  { name: 'comparison', id: 'comparison', params: { leftTitle: 'YOU LOSE', leftItems: ['Trade time', 'Burn out'], leftTone: 'bad', rightTitle: 'THEY WIN', rightItems: ['Own assets', 'Scale up'], rightTone: 'good' }, frame: 70 },
  { name: 'stack_outline', id: 'stack_list', params: { items: ['OLD TRADITIONAL B2B', 'BUILDING SOFTWARE', 'IMPORT & EXPORT', 'LOGISTICS'], variant: 'outline', position: 'center' }, frame: 70 },
  { name: 'stack_number', id: 'stack_list', params: { items: ['YOU USE MY SERVICE', 'YOU GIVE ME FEEDBACK', 'YOU REFER A FRIEND'], variant: 'number', position: 'left' }, frame: 70 },
  { name: 'stack_todo', id: 'stack_list', params: { items: ['Bring Laundry Down', 'Check Old Apartment', 'Walk Break', 'Film a Video'], variant: 'bullet', position: 'topleft', accent: '#3b82f6' }, frame: 70 },
  { name: 'progress_bar', id: 'progress', params: { variant: 'bar', value: 70, label: 'Happy Customers', position: 'center' }, frame: 55 },
  { name: 'progress_gauge', id: 'progress', params: { variant: 'gauge', value: 82, label: 'Confidence', position: 'left' }, frame: 55 },
  { name: 'progress_counter', id: 'progress', params: { variant: 'counter', value: 14, from: 23, label: 'Seconds Left', position: 'center' }, frame: 30 },
  { name: 'annotate_arrow', id: 'annotate', params: { annotation: 'arrow', x: 0.42, y: 0.12, w: 0.16, h: 0.16, fromX: 0.12, fromY: 0.28, color: '#ffffff' }, frame: 40 },
  { name: 'annotate_circle', id: 'annotate', params: { annotation: 'circle', x: 0.38, y: 0.1, w: 0.26, h: 0.4, color: '#ffd60a' }, frame: 40 },
];

await ensureBrowser();
const serveUrl = await bundle({ entryPoint: join(process.cwd(), 'src/remotion/index.ts') });

for (const c of CASES) {
  const dur = 2.5;
  const { layers, camera } = resolveTemplate(c.id, c.params, { idPrefix: c.name, dur, canvas: MEDIA });
  const comp = { schemaVersion: IR_VERSION, id: `comp_${c.name}`, start: 0, end: dur, timeBasis: 'cut', coordinateSpace: 'normalized', canvas: MEDIA, layers, ...(camera ? { camera } : {}) };
  const inputProps = buildMotionProps({ cutUrl: BASE, editMedia: MEDIA, layout: 'landscape', compositions: [comp], outputDurationSec: dur });
  const composition = await selectComposition({ serveUrl, id: 'Motion', inputProps, timeoutInMilliseconds: 120000 });
  await renderStill({ composition, serveUrl, output: join(OUT, `${c.name}.png`), frame: c.frame, inputProps, timeoutInMilliseconds: 120000 });
  console.log('OK', c.name);
}
console.log('done');
