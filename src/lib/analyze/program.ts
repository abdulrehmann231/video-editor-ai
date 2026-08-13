import { SchemaType, type Schema } from '@google/generative-ai';
import { buildCatalogText, PROGRAM_RESPONSE_SCHEMA } from '../edl/catalog';
import { retrieveReferences, refLine, vaultCatalogText } from '../vault';
import { transcriptToScript } from './prompt';
import type { BuildInput } from './build';
import { parseEdl, type EditOp } from '../edl/schema';
import { parseProgram, type MotionProgram, type ProgramScene } from '../motion/program/schema';

/**
 * Phase 6 — the CREATIVE DIRECTOR prompt. Unlike the BUILD stage (which emits a
 * flat list of independent ops), this asks the model to DESIGN SCENES: each a
 * composed moment with several coordinated elements layered together. Output is
 * still flat + enum-constrained per element (reliability), grouped under scenes;
 * `programToMotion` compiles each scene into one layered IR composition.
 */

export { PROGRAM_RESPONSE_SCHEMA };

export function buildProgramPrompt(input: BuildInput): string {
  const { plan, media, silence, transcript, research, userPrompt } = input;
  const dur = media.durationSec ?? 0;
  const refsPerBeat = input.refsPerBeat ?? 3;

  const beatBlocks = plan.beats
    .map((b, i) => {
      const refs = retrieveReferences(b.searchQuery, { limit: refsPerBeat });
      const refLines = refs.map((r) => `      ${refLine(r)}`).join('\n');
      return `  MOMENT ${i + 1} [${b.start}s–${b.end}s] intent: ${b.intent}${b.effectHint ? ` | hint: ${b.effectHint}` : ''}
    vault starting points for "${b.searchQuery}" (or pick ANY #id by meaning):
${refLines || '      (weak match — choose from the FULL VAULT by meaning)'}`;
    })
    .join('\n\n');

  const userBlock = userPrompt?.trim() ? `\nUSER INSTRUCTIONS (highest priority):\n"""\n${userPrompt.trim()}\n"""\n` : '';
  const researchBlock = research?.trim() ? `\nCURRENT EDITING TECHNIQUES (apply what fits):\n${research.trim()}\n` : '';
  const silenceBlock = silence.length > 0 ? silence.slice(0, 200).map((s) => `  - ${s.start}s → ${s.end}s`).join('\n') : '  (none)';

  return `You are an elite B2B YouTube CREATIVE DIRECTOR. You do not just place effects — you DESIGN
each key moment as a COMPOSED SCENE: a small set of coordinated visual elements that work
TOGETHER to make one point (like a motion-graphics artist layering an illustration, a label,
an arrow, and a stat into a single beat).

OUTPUT: a MotionProgram of SCENES. Each scene has a time range + intent + reason + a list of
1–6 ELEMENTS composited on top of the footage. Each element is a flat { type, ...params, delay }
chosen from the EFFECT CATALOG below. \`delay\` (seconds after the scene start) staggers the
reveal so elements pop in sequence, not all at once. Elements inherit the scene's time window.

COMPOSE — don't just pick one effect. Layer elements that reinforce each other, e.g.:
- Money/goal moment → illustration[money_bag] (left) + stat_callout "$12K/mo" (corner, delay 0.6)
  + name_tag arrow pointing at the bag (delay 1.0).
- Contrast moment → comparison (you-lose vs they-win) + a zoom_punch for energy.
- Data moment → chart[bar] of the real numbers + a caption style override on the key word.
- Launch/growth moment → illustration[rocket] + a bold kinetic caption + zoom_punch.
- Framework moment → stack_list (numbered steps) OR checklist (✓/✗) + a title.
- Point-at-thing moment → annotate (arrow/circle) alone, or with a name_tag.
Keep it tasteful: 1–3 elements for most scenes, up to 6 for a hero moment. Don't overcrowd or
stack two big cards on the same spot. Aim for a composed scene roughly every ~8–15s.

CAPTIONS ARE AUTOMATIC (dense word-by-word from the transcript across the whole video). Only add
a \`caption\` element to OVERRIDE the style on a punchy line. Spend elements on the visuals.

SILENCE: put dead-air / filler ranges to REMOVE in the top-level \`cuts\` array (seconds).
${userBlock}${researchBlock}
EDITORIAL PLAN: niche=${plan.niche ?? '?'}, tone=${plan.tone ?? '?'}. ${plan.summary ? `Approach: ${plan.summary}` : ''}

FULL INSPIRATION VAULT — 451 references. Pick the best #id per scene by MEANING; prefer variety.
${vaultCatalogText()}

PLANNED MOMENTS (turn each into a composed scene; you may merge/add):
${beatBlocks}

DETECTED SILENCE (prefer these exact ranges for \`cuts\`):
${silenceBlock}

TRANSCRIPT (for exact stat values, labels, names, chart numbers):
${transcriptToScript(transcript)}

EFFECT CATALOG (element \`type\` must be one of these; fill only the relevant params):
${buildCatalogText()}

RULES:
- All times in SECONDS, 0..${Math.round(dur)}. Scene start < end. Elements inherit scene time; use
  \`delay\` (≥0, less than the scene length) to stagger.
- DATA ELEMENTS MUST BE COMPLETE (an element missing its data is discarded): chart → "data"
  (2–8 {label,value}); checklist → "items" (2–5 {text,mark}); stack_list → "listItems" (2–6
  strings); comparison → "leftItems" AND "rightItems"; progress timeline/scale → "ticks". If you
  lack concrete values, use a simpler element (stat_callout, caption) instead of an empty one.
- Every scene's "reason" ends with the vault ref, e.g. "(ref: #123 Liquid Money Orb Pop-In)".
- Use 3D (three) and heavy effects sparingly. Be rich yet tasteful.
- Output ONLY the JSON MotionProgram matching the schema, plus a one-paragraph "summary".`;
}

/** Repair prompt when the first program dropped elements (usually a data element
 * that was emitted without its required array). Re-ask, keeping the good scenes. */
export function buildProgramRepairPrompt(previousJson: string, warnings: string[]): string {
  return `This MotionProgram JSON was mostly valid but some ELEMENTS were discarded because they were
incomplete. Return the SAME program, but FIX the discarded elements — most often a data element
emitted without its required array. Complete them (chart needs "data"; checklist needs "items";
stack_list needs "listItems"; comparison needs "leftItems" AND "rightItems"; progress
timeline/scale needs "ticks") using concrete values from the transcript, OR replace that element
with a simpler complete one (stat_callout / caption / illustration). Keep everything else identical.
Do not add commentary.

ISSUES:
${warnings.slice(0, 40).map((w) => `- ${w}`).join('\n')}

PROGRAM JSON:
${previousJson}`;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced) return JSON.parse(fenced[1]);
    const first = text.indexOf('{');
    const last = text.lastIndexOf('}');
    if (first >= 0 && last > first) return JSON.parse(text.slice(first, last + 1));
    throw new Error('Model did not return parseable JSON');
  }
}

/** Count warnings that indicate a DROPPED element/scene (vs. benign clamps). */
function droppedCount(warnings: string[]): number {
  return warnings.filter((w) => /discarded|Dropped|Required|0 renderable/i.test(w)).length;
}

/**
 * Focused DATA-FILL schema. A separate, low-load pass whose ONLY job is to return
 * complete data-viz elements for scenes that need one — far more reliable than
 * filling nested arrays inside the full composition pass (single-purpose calls
 * populate arrays consistently, as the live tests showed).
 */
const FILL_RESPONSE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    fills: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          sceneId: { type: SchemaType.STRING, description: 'The scene this data-viz belongs to.' },
          type: { type: SchemaType.STRING, format: 'enum', enum: ['chart', 'checklist', 'stack_list', 'comparison'] },
          title: { type: SchemaType.STRING },
          variant: { type: SchemaType.STRING, format: 'enum', enum: ['bar', 'line', 'area', 'donut'] },
          prefix: { type: SchemaType.STRING },
          suffix: { type: SchemaType.STRING },
          position: { type: SchemaType.STRING, format: 'enum', enum: ['center', 'left', 'right'] },
          data: { type: SchemaType.ARRAY, items: { type: SchemaType.OBJECT, properties: { label: { type: SchemaType.STRING }, value: { type: SchemaType.NUMBER } }, required: ['value'] } },
          items: { type: SchemaType.ARRAY, items: { type: SchemaType.OBJECT, properties: { text: { type: SchemaType.STRING }, mark: { type: SchemaType.STRING, format: 'enum', enum: ['check', 'cross', 'dot'] } }, required: ['text'] } },
          listItems: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          leftTitle: { type: SchemaType.STRING },
          rightTitle: { type: SchemaType.STRING },
          leftItems: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          rightItems: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          leftTone: { type: SchemaType.STRING, format: 'enum', enum: ['bad', 'good', 'neutral'] },
          rightTone: { type: SchemaType.STRING, format: 'enum', enum: ['bad', 'good', 'neutral'] },
        },
        required: ['sceneId', 'type'],
      },
    },
  },
  required: ['fills'],
};

const DATA_VIZ_TYPES = new Set(['chart', 'checklist', 'stack_list', 'comparison']);
function sceneHasDataViz(s: ProgramScene): boolean {
  return s.elements.some((e) => DATA_VIZ_TYPES.has(e.type) && !isEmptyDataViz(e));
}
function isEmptyDataViz(e: EditOp): boolean {
  if (e.type === 'comparison') return (e.leftItems?.length ?? 0) === 0 && (e.rightItems?.length ?? 0) === 0;
  return false; // chart/checklist/stack_list only survive parse WITH data
}

function buildFillPrompt(program: MotionProgram, transcript: BuildInput['transcript']): string {
  const scenes = program.scenes
    .map((s) => `  ${s.id} [${s.start}s–${s.end}s] intent: ${s.intent} | current elements: ${s.elements.map((e) => e.type).join(', ') || '(none)'}`)
    .join('\n');
  return `You are completing a video's DATA VISUALS. Below are the scenes of a composed edit and the
transcript. For scenes whose intent involves NUMBERS, a TREND, a COMPARISON, STEPS, or a LIST,
return ONE complete data-viz element with EXACT values pulled from the transcript. Only where it
genuinely fits — skip scenes that don't need a data-viz or already clearly have one.

Return { fills: [ { sceneId, type, ...data } ] } where type is:
- chart → "data": [{label, value}] (2–8) + optional variant/title/prefix/suffix
- checklist → "items": [{text, mark: check|cross|dot}] (2–5)
- stack_list → "listItems": [strings] (2–6)
- comparison → "leftItems" + "rightItems" (+ leftTitle/rightTitle/leftTone/rightTone)
Use REAL numbers/words from the transcript — never invent figures.

SCENES:
${scenes}

TRANSCRIPT:
${transcriptToScript(transcript)}`;
}

/** Coerce a raw fill into a validated EDL element op scoped to its scene. */
function fillToOp(fill: Record<string, unknown>, scene: ProgramScene, idx: number, durationSec: number | null): EditOp | null {
  const type = fill.type;
  if (typeof type !== 'string' || !DATA_VIZ_TYPES.has(type)) return null;
  const start = Math.min(scene.end - 0.05, scene.start + 0.15); // slight stagger
  const base = { id: `${scene.id}_fill${idx}`, source: 'gemini' as const, start, end: scene.end, reason: `${scene.reason} [data-fill]` };
  const params: Record<string, unknown> = { ...fill };
  delete params.sceneId;
  // stack_list op field is `listItems`; keep as-is. chart/checklist/comparison map 1:1.
  try {
    const { edl } = parseEdl({ ops: [{ ...base, ...params, type }] }, { durationSec });
    return edl.ops[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * DATA-FILL pass — a focused, low-load call that populates data-viz for scenes
 * whose intent needs it but which lack a complete chart/checklist/stack_list/
 * comparison (the composition pass tends to substitute simpler elements under
 * load). Fills are validated through the EDL schema and inserted into the scene
 * (staggered), so they compose with the existing elements.
 */
export async function fillProgramData(
  program: MotionProgram,
  transcript: BuildInput['transcript'],
  durationSec: number | null,
  call: (prompt: string, schema: Schema) => Promise<string>,
): Promise<{ program: MotionProgram; filled: number }> {
  // Only bother if some scenes lack a populated data-viz.
  const needy = program.scenes.filter((s) => !sceneHasDataViz(s));
  if (needy.length === 0) return { program, filled: 0 };

  let filled = 0;
  try {
    const raw = await call(buildFillPrompt(program, transcript), FILL_RESPONSE_SCHEMA);
    const parsed = safeJson(raw) as { fills?: unknown };
    const fills = Array.isArray(parsed?.fills) ? parsed.fills : [];
    const byScene = new Map(program.scenes.map((s) => [s.id, s]));
    fills.forEach((f, i) => {
      if (!f || typeof f !== 'object') return;
      const fr = f as Record<string, unknown>;
      const scene = byScene.get(String(fr.sceneId));
      if (!scene || sceneHasDataViz(scene)) return; // don't duplicate
      const op = fillToOp(fr, scene, i, durationSec);
      if (!op) return;
      // Drop an empty comparison placeholder if we're replacing it.
      scene.elements = scene.elements.filter((e) => !(e.type === 'comparison' && isEmptyDataViz(e)));
      scene.elements.unshift(op);
      filled++;
    });
  } catch {
    /* best-effort — return the program unchanged on any failure */
  }
  return { program, filled };
}

/**
 * Generate a MotionProgram from the plan (Phase 6). A composition pass, then a
 * focused DATA-FILL pass that reliably populates data-viz where it belongs (and
 * a repair fallback if elements were dropped). `call` runs the structured Gemini
 * request (injected so this stays testable + reuses key rotation at the call site).
 */
export async function generateProgram(
  input: BuildInput,
  durationSec: number | null,
  call: (prompt: string, schema: Schema) => Promise<string>,
): Promise<{ program: MotionProgram; warnings: string[]; repaired: boolean; filled: number }> {
  const raw1 = await call(buildProgramPrompt(input), PROGRAM_RESPONSE_SCHEMA);
  let { program, warnings } = parseProgram(safeJson(raw1), { durationSec });
  let repaired = false;

  if (droppedCount(warnings) > 0) {
    try {
      const raw2 = await call(buildProgramRepairPrompt(raw1, warnings), PROGRAM_RESPONSE_SCHEMA);
      const second = parseProgram(safeJson(raw2), { durationSec });
      if (second.program.scenes.length > 0 && droppedCount(second.warnings) < droppedCount(warnings)) {
        program = second.program;
        warnings = second.warnings;
        repaired = true;
      }
    } catch {
      /* keep the first result */
    }
  }

  // Focused data-fill (reliable data-viz within composed scenes).
  const fill = await fillProgramData(program, input.transcript, durationSec, call);
  program = fill.program;
  return { program, warnings, repaired, filled: fill.filled };
}
