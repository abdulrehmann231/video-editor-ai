import { z } from 'zod';
import { parseEdl, type EditOp } from '../../edl/schema';

/**
 * MotionProgram — the Phase-6 "Creative Director" output. Instead of a flat list
 * of independent ops (the EDL), the AI designs SCENES, each a composed moment
 * with 1–6 coordinated ELEMENTS (an illustration + a label + an arrow + a stat,
 * revealed together). Elements reuse the exact, live-validated EDL op vocabulary
 * — the reliability win — but drop their own timing/ids (inherited from the scene,
 * with an optional per-element `delay` for stagger). The compiler expands each
 * scene into ONE layered IR composition.
 *
 * Reconciliation with the plan (§Phase 6): Gemini emits FLAT, enum-constrained
 * {type, params} elements (never nested keyframes); our code builds nested IR.
 */

const TimeSec = z.number().min(0);

export interface ProgramScene {
  id: string;
  /** Scene window in SOURCE seconds. */
  start: number;
  end: number;
  intent: string;
  reason: string;
  /** Validated effect elements (EDL ops, timed within the scene). */
  elements: EditOp[];
}

export interface MotionProgram {
  version: 1;
  summary?: string;
  captionPlacement?: 'lower' | 'middle' | 'upper';
  /** Silence ranges to remove (source seconds) — the compressed-timeline cuts. */
  cuts: { start: number; end: number }[];
  scenes: ProgramScene[];
}

const SceneMetaZ = z.object({
  id: z.string().min(1),
  start: TimeSec,
  end: TimeSec,
  intent: z.string().min(1).max(300),
  reason: z.string().min(1).max(400),
});

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

/**
 * Validate + normalize raw program JSON. Self-healing like parseEdl: individually
 * invalid scenes/elements are dropped with a warning rather than failing the
 * whole program. Each element inherits the scene's timing (offset by `delay`) and
 * gets a synthetic id/reason before being validated through the EDL op schema, so
 * the model only needs to emit `{type, ...params}` per element.
 */
export function parseProgram(
  raw: unknown,
  opts: { durationSec?: number | null } = {},
): { program: MotionProgram; warnings: string[] } {
  const warnings: string[] = [];
  const durationSec = opts.durationSec ?? null;
  const root = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

  // Top-level silence cuts (accept {start,end} objects).
  const cuts: { start: number; end: number }[] = [];
  if (Array.isArray(root.cuts)) {
    for (const c of root.cuts) {
      if (!c || typeof c !== 'object') continue;
      const s = num((c as Record<string, unknown>).start);
      const e = num((c as Record<string, unknown>).end);
      if (s != null && e != null && e > s) cuts.push({ start: s, end: e });
    }
  }

  const rawScenes = Array.isArray(root.scenes) ? root.scenes : [];
  const scenes: ProgramScene[] = [];

  for (let i = 0; i < rawScenes.length; i++) {
    const rs = (rawScenes[i] && typeof rawScenes[i] === 'object' ? rawScenes[i] : {}) as Record<string, unknown>;
    const metaRes = SceneMetaZ.safeParse({
      id: typeof rs.id === 'string' && rs.id ? rs.id : `scene_${i}`,
      start: num(rs.start),
      end: num(rs.end),
      intent: typeof rs.intent === 'string' ? rs.intent : '',
      reason: typeof rs.reason === 'string' ? rs.reason : '',
    });
    if (!metaRes.success) {
      warnings.push(`Dropped scene ${i}: ${metaRes.error.issues[0]?.message ?? 'invalid scene meta'}`);
      continue;
    }
    const meta = metaRes.data;
    if (!(meta.start < meta.end)) {
      warnings.push(`Dropped scene ${meta.id}: start (${meta.start}) must be < end (${meta.end})`);
      continue;
    }

    const rawElements = Array.isArray(rs.elements) ? rs.elements : [];
    // Turn lean elements into full ops (inject timing + id + reason), then reuse
    // the EDL validator/normalizer so elements are validated identically to ops.
    const ops = rawElements.map((el, j) => {
      const e = (el && typeof el === 'object' ? el : {}) as Record<string, unknown>;
      const delay = num(e.delay) ?? 0;
      const start = Math.max(meta.start, Math.min(meta.end - 0.05, meta.start + delay));
      const end = num(e.end) ?? meta.end;
      return { ...e, id: typeof e.id === 'string' && e.id ? e.id : `${meta.id}_e${j}`, source: 'gemini', start, end, reason: typeof e.reason === 'string' && e.reason ? e.reason : meta.reason };
    });

    let elements: EditOp[] = [];
    try {
      const { edl, warnings: ew } = parseEdl({ ops }, { durationSec });
      warnings.push(...ew.map((w) => `${meta.id}: ${w}`));
      // silence cuts nested in a scene are hoisted to the program's cut list.
      for (const op of edl.ops) {
        if (op.type === 'silence_cut') cuts.push({ start: op.start, end: op.end });
        else elements.push(op);
      }
    } catch (err) {
      warnings.push(`Dropped scene ${meta.id}: no valid elements (${err instanceof Error ? err.message : String(err)})`);
      elements = [];
    }
    if (elements.length === 0) {
      warnings.push(`Dropped scene ${meta.id}: 0 renderable elements`);
      continue;
    }
    scenes.push({ id: meta.id, start: meta.start, end: meta.end, intent: meta.intent, reason: meta.reason, elements });
  }

  const cp = root.captionPlacement;
  const captionPlacement = cp === 'lower' || cp === 'middle' || cp === 'upper' ? cp : undefined;
  const summary = typeof root.summary === 'string' ? root.summary : undefined;
  return { program: { version: 1, summary, captionPlacement, cuts, scenes }, warnings };
}
