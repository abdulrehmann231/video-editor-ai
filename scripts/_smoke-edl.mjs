import { buildBuildPrompt, EDL_RESPONSE_SCHEMA } from '../src/lib/analyze/build.ts';
import { generateStructuredText } from '../src/lib/ai/geminiVideo.ts';
import { nextKey } from '../src/lib/geminiKeys.ts';
import { getEnv } from '../src/lib/env.ts';
import { parseEdl } from '../src/lib/edl/schema.ts';
import { motionFromEdl, validateComposition } from '../src/lib/motion/ir/index.ts';

const model = getEnv().GEMINI_MODEL;
const durationSec = 48;

// Beats crafted to invite the NEW ops (comparison/chart/checklist/illustration/
// progress/stack_list/annotate) — the model still freely chooses from the catalog.
const plan = {
  niche: 'B2B / business growth', tone: 'energetic', captionPlacement: 'lower', segments: [],
  beats: [
    { start: 2, end: 6, intent: 'Hook: contrast the OLD trading-time way vs the NEW owning-assets way — a clear side-by-side this-vs-that', effectHint: 'two-column comparison', searchQuery: 'comparison versus two column lose win' },
    { start: 9, end: 13, intent: 'He lists revenue for 4 years (40k, 68k, 55k, 91k) climbing — visualize the trend', effectHint: 'bar chart', searchQuery: 'bar chart revenue graph trend rising' },
    { start: 16, end: 20, intent: 'Three requirements: EXPERTISE yes, LABOUR no, SPEED yes — a checkmark/cross list', effectHint: 'checklist do and dont', searchQuery: 'checklist checkmark cross do dont' },
    { start: 23, end: 27, intent: 'He says "then you LAUNCH" — pop a concept sticker', effectHint: 'rocket illustration sticker', searchQuery: 'rocket launch illustration sticker' },
    { start: 30, end: 34, intent: 'Confidence is at 80% — show a meter filling', effectHint: 'progress gauge meter', searchQuery: 'confidence meter gauge progress bar' },
    { start: 37, end: 41, intent: 'The 3-step process, numbered', effectHint: 'numbered stacking list', searchQuery: 'numbered steps list process' },
    { start: 43, end: 46, intent: 'He points at the product on screen — draw attention to it', effectHint: 'hand-drawn arrow', searchQuery: 'arrow circle annotation point marker' },
  ],
};

const transcript = ('the old way you trade your time but the new way you own assets that scale ' +
  'our revenue went forty thousand then sixty eight then fifty five then ninety one thousand ' +
  'you need expertise not labour and you need speed then you launch the whole thing ' +
  'my confidence was eighty percent by then here are the three steps to do it ' +
  'look right here at this product on the screen that is the key')
  .split(' ').map((w, i) => ({ word: w, start: 2 + i * 0.6, end: 2 + i * 0.6 + 0.55 }));

const media = { durationSec, width: 1280, height: 720, fps: 30, hasAudio: true };
const prompt = buildBuildPrompt({ plan, media, silence: [], transcript });

const key = nextKey();
console.log('model:', model, '| calling Gemini BUILD...');
const raw = await generateStructuredText(key, model, prompt, EDL_RESPONSE_SCHEMA);
const { edl, warnings } = parseEdl(JSON.parse(raw), { durationSec });

const counts = {};
for (const op of edl.ops) counts[op.type] = (counts[op.type] || 0) + 1;
console.log('\n=== EDL op type counts ===');
console.log(counts);
console.log('parse warnings:', warnings.length ? warnings : 'none');

const NEW = ['comparison','chart','checklist','illustration','progress','stack_list','annotate','name_tag'];
console.log('\n=== NEW ops emitted ===');
console.log(NEW.filter(t => counts[t]));

// show a couple new-op payloads
for (const t of NEW) {
  const op = edl.ops.find(o => o.type === t);
  if (op) console.log('\n['+t+']', JSON.stringify(op).slice(0, 260));
}

// map through the IR + validate
const { compositions, warnings: irw } = motionFromEdl(edl, transcript, durationSec, { width: 1280, height: 720, fps: 30 });
const bad = compositions.filter(c => !validateComposition(c).ok);
console.log('\n=== IR ===');
console.log('compositions:', compositions.length, '| invalid:', bad.length, '| ir warnings:', irw.length);
if (bad.length) console.log('INVALID:', bad.map(c => c.id));
console.log('\nSMOKE OK');
