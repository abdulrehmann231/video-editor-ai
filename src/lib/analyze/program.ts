import { buildCatalogText, PROGRAM_RESPONSE_SCHEMA } from '../edl/catalog';
import { retrieveReferences, refLine, vaultCatalogText } from '../vault';
import { transcriptToScript } from './prompt';
import type { BuildInput } from './build';

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
