import { buildProgramPrompt, PROGRAM_RESPONSE_SCHEMA } from '../src/lib/analyze/program.ts';
import { generateStructuredText } from '../src/lib/ai/geminiVideo.ts';
import { nextKey } from '../src/lib/geminiKeys.ts';
import { getEnv } from '../src/lib/env.ts';
import { parseProgram } from '../src/lib/motion/program/schema.ts';
import { programToMotion } from '../src/lib/motion/program/compile.ts';
import { validateComposition } from '../src/lib/motion/ir/index.ts';

const model = getEnv().GEMINI_MODEL;
const durationSec = 42;
const plan = { niche: 'B2B business growth', tone: 'energetic', captionPlacement: 'lower', summary: 'How to build recurring revenue', segments: [], beats: [
  { start: 2, end: 7, intent: 'Hook: the goal is $12k/mo recurring — make it feel exciting and concrete', effectHint: 'money illustration + stat + label', searchQuery: 'money income stat callout illustration' },
  { start: 10, end: 15, intent: 'Contrast the old way (trade time) vs the new way (own assets)', effectHint: 'comparison', searchQuery: 'comparison versus old new lose win' },
  { start: 18, end: 23, intent: 'Revenue climbed 40k, 68k, 55k, 91k over four years', effectHint: 'bar chart', searchQuery: 'bar chart revenue trend' },
  { start: 26, end: 31, intent: 'The 3-step framework to get there', effectHint: 'numbered steps', searchQuery: 'numbered steps process list' },
  { start: 34, end: 39, intent: 'Then you launch and it scales', effectHint: 'rocket + zoom', searchQuery: 'rocket launch growth' },
]};
const transcript = ('the goal is twelve thousand a month recurring the old way you trade time the new way you own assets ' +
  'our revenue went forty then sixty eight then fifty five then ninety one thousand here is the three step framework ' +
  'then you launch it and the whole thing scales up fast').split(' ').map((w,i)=>({word:w,start:2+i*0.55,end:2+i*0.55+0.5}));
const media = { durationSec, width: 1280, height: 720, fps: 30, hasAudio: true };

const raw = await generateStructuredText(nextKey(), model, buildProgramPrompt({ plan, media, silence: [{start:8,end:9.5},{start:24,end:25.5}], transcript }), PROGRAM_RESPONSE_SCHEMA);
const { program, warnings } = parseProgram(JSON.parse(raw), { durationSec });
console.log('\n=== PROGRAM ===');
console.log("warns:", warnings); console.log("scenes:", program.scenes.length, '| cuts:', program.cuts.length, '| parse warnings:', warnings.length);
for (const s of program.scenes) {
  console.log(`\n  SCENE ${s.id} [${s.start}-${s.end}] "${s.intent.slice(0,50)}"`);
  console.log('    elements:', s.elements.map(e => e.type + (e.type==='illustration'?`(${e.name})`:e.type==='chart'?`(${e.variant},${e.data?.length}pts)`:e.type==='comparison'?`(${e.leftItems?.length}v${e.rightItems?.length})`:e.type==='stack_list'?`(${e.listItems?.length})`:'')).join(', '));
}
const multi = program.scenes.filter(s => s.elements.length >= 2);
console.log(`\n=== composed scenes (>=2 elements): ${multi.length}/${program.scenes.length} ===`);
const { compositions, warnings: cw } = programToMotion(program, transcript, durationSec, media);
const bad = compositions.filter(c => !validateComposition(c).ok);
console.log('compositions:', compositions.length, '| invalid:', bad.length, '| compile warnings:', cw.length);
console.log(bad.length ? 'INVALID: '+bad.map(c=>c.id) : '\nPROGRAM SMOKE OK');
