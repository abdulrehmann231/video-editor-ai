import { join } from 'node:path';
import { bundle } from '@remotion/bundler';
import { selectComposition, renderStill, ensureBrowser } from '@remotion/renderer';
import { parseProgram, programToMotion } from '../src/lib/motion/program/index.ts';
import { buildMotionProps } from '../src/lib/motion/render/props.ts';
const MEDIA = { width: 1280, height: 720, fps: 30 };
// A composed scene: money illustration + stat + arrow + name-tag, layered together.
const RAW = { cuts: [], scenes: [{
  id: 'scene', start: 0, end: 4, intent: 'composed money moment', reason: 'demo',
  elements: [
    { type: 'illustration', name: 'money_bag', label: 'PASSIVE INCOME', position: 'left', size: 'large', animate: 'float' },
    { type: 'stat_callout', value: '$12K/mo', label: 'RECURRING', position: 'corner' },
    { type: 'name_tag', text: 'THIS IS THE GOAL', targetX: 0.28, targetY: 0.5, side: 'right', delay: 0.8 },
  ],
}]};
const { program, warnings } = parseProgram(RAW, { durationSec: 5 });
console.log('scenes:', program.scenes.length, 'warnings:', warnings);
const { compositions } = programToMotion(program, [], 5, MEDIA);
console.log('compositions:', compositions.length, 'layers in scene:', compositions[0].layers.length);
const comp = compositions.find(c => c.id === 'scene_scene');
const inputProps = buildMotionProps({ cutUrl: 'public/testclips/demo.mp4', editMedia: MEDIA, layout: 'landscape', compositions: [comp], outputDurationSec: 4 });
await ensureBrowser();
const serveUrl = await bundle({ entryPoint: join(process.cwd(), 'src/remotion/index.ts') });
const composition = await selectComposition({ serveUrl, id: 'Motion', inputProps, timeoutInMilliseconds: 120000 });
await renderStill({ composition, serveUrl, output: '/tmp/program.png', frame: 75, inputProps, timeoutInMilliseconds: 120000 });
console.log('done');
