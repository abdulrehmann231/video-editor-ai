import { generateProgram } from '../src/lib/analyze/program.ts';
import { PROGRAM_RESPONSE_SCHEMA } from '../src/lib/edl/catalog.ts';
import { generateStructuredText } from '../src/lib/ai/geminiVideo.ts';
import { nextKey } from '../src/lib/geminiKeys.ts';
import { getEnv } from '../src/lib/env.ts';
import { programToMotion, programDecisionLog } from '../src/lib/motion/program/index.ts';
import { validateComposition } from '../src/lib/motion/ir/index.ts';

const model = getEnv().GEMINI_MODEL;
const durationSec = 42;
const plan = { niche: 'B2B business growth', tone: 'energetic', captionPlacement: 'lower', summary: 'How to build recurring revenue', segments: [], beats: [
  { start: 2, end: 7, intent: 'Hook: the goal is $12k/mo recurring — exciting and concrete', effectHint: 'money illustration + stat', searchQuery: 'money income stat illustration' },
  { start: 10, end: 15, intent: 'Contrast old way (trade time) vs new way (own assets)', effectHint: 'comparison', searchQuery: 'comparison versus old new' },
  { start: 18, end: 23, intent: 'Revenue climbed 40k, 68k, 55k, 91k over four years', effectHint: 'bar chart', searchQuery: 'bar chart revenue trend' },
  { start: 26, end: 31, intent: 'The 3-step framework', effectHint: 'numbered steps', searchQuery: 'numbered steps list' },
  { start: 34, end: 39, intent: 'Then you launch and it scales', effectHint: 'rocket + zoom', searchQuery: 'rocket launch growth' },
]};
const transcript = ('the goal is twelve thousand a month recurring the old way you trade time the new way you own assets ' +
  'revenue went forty then sixty eight then fifty five then ninety one thousand here is the three step framework then you launch it and it scales').split(' ').map((w,i)=>({word:w,start:2+i*0.5,end:2+i*0.5+0.45}));
const media = { durationSec, width: 1280, height: 720, fps: 30, hasAudio: true };
const key = nextKey();
const call = (prompt, schema) => generateStructuredText(key, model, prompt, schema);
const { program, warnings, repaired, filled } = await generateProgram({ plan, media, silence: [{start:8,end:9.5}], transcript }, durationSec, call);
console.log('scenes:', program.scenes.length, '| repaired:', repaired, '| cuts:', program.cuts.length, '| parse warnings:', warnings.length);
let composed = 0, withData = 0;
for (const s of program.scenes) {
  if (s.elements.length >= 2) composed++;
  const types = s.elements.map(e => e.type + (e.type==='illustration'?`(${e.name})`:e.type==='chart'?`(${e.data?.length||0}pts)`:e.type==='stack_list'?`(${e.listItems?.length||0})`:e.type==='comparison'?`(${e.leftItems?.length||0}v${e.rightItems?.length||0})`:''));
  if (s.elements.some(e => (e.type==='chart'&&e.data?.length) || (e.type==='stack_list'&&e.listItems?.length) || (e.type==='checklist'&&e.items?.length))) withData++;
  console.log('  ', s.id, '['+s.start+'-'+s.end+']', types.join(', '));
}
console.log(`composed(>=2): ${composed}/${program.scenes.length} | scenes with populated data-viz: ${withData}`);
const { compositions } = programToMotion(program, transcript, durationSec, media);
const bad = compositions.filter(c => !validateComposition(c).ok);
console.log('compositions:', compositions.length, '| invalid:', bad.length, '| decision-log rows:', programDecisionLog(program).length);
console.log(bad.length ? 'INVALID' : 'PROGRAM E2E OK');
