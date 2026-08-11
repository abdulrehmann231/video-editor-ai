import { BOUNDS } from '../ir/version';
import type { Animated, MotionComposition, MotionLayer } from '../ir/types';

/**
 * Level 2-3 validation (semantic + composition) from the engine plan §46. Level 1
 * (structural) is zod's job in schema.ts; Level 4 (visual QA) is a later phase.
 *
 * Pure checker: never mutates. Returns { ok, warnings, errors } where
 * ok === (errors.length === 0), mirroring parseEdl's {result, warnings} ergonomics
 * so callers treat IR issues uniformly.
 */

export interface ValidationResult {
  ok: boolean;
  warnings: string[];
  errors: string[];
}

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const EPS = 1e-6;

function isHexColor(c: string): boolean {
  return HEX_COLOR.test(c);
}

function flatten(layers: MotionLayer[]): MotionLayer[] {
  const out: MotionLayer[] = [];
  for (const l of layers) {
    out.push(l);
    if (l.type === 'group') out.push(...flatten(l.children));
  }
  return out;
}

function collectNumbers(a: Animated<number> | undefined): number[] {
  if (!a) return [];
  const vals: number[] = [];
  if (typeof a.value === 'number') vals.push(a.value);
  if (typeof a.from === 'number') vals.push(a.from);
  if (a.keyframes) for (const k of a.keyframes) if (typeof k.value === 'number') vals.push(k.value);
  return vals;
}

function collectVectors(a: Animated<number[]> | undefined): number[][] {
  if (!a) return [];
  const arrays: number[][] = [];
  if (Array.isArray(a.value)) arrays.push(a.value);
  if (Array.isArray(a.from)) arrays.push(a.from);
  if (a.keyframes) for (const k of a.keyframes) if (Array.isArray(k.value)) arrays.push(k.value);
  return arrays;
}

export function validateComposition(comp: MotionComposition): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // ── Composition-level ──────────────────────────────────────────────────────
  if (!(comp.start < comp.end)) {
    errors.push(`composition ${comp.id}: start (${comp.start}) must be < end (${comp.end})`);
  }
  if (comp.background && !isHexColor(comp.background)) {
    errors.push(`composition ${comp.id}: invalid background color "${comp.background}"`);
  }
  const compDuration = comp.end - comp.start;
  if (comp.layers.length === 0) warnings.push(`composition ${comp.id}: has no layers`);

  const flat = flatten(comp.layers);
  const ids = new Set(flat.map((l) => l.id));
  const assetIds = new Set((comp.assets ?? []).map((a) => a.id));
  const byId = new Map(flat.map((l) => [l.id, l] as const));

  // ── Layer-level ────────────────────────────────────────────────────────────
  for (const l of flat) {
    if (!(l.duration > 0)) errors.push(`layer ${l.id}: duration must be > 0 (got ${l.duration})`);
    if (l.start < -EPS || l.start + l.duration > compDuration + 1e-3) {
      errors.push(`layer ${l.id}: window [${l.start}, ${l.start + l.duration}] exceeds composition duration ${compDuration}`);
    }

    for (const v of collectNumbers(l.opacity)) {
      if (v < BOUNDS.opacity.min - EPS || v > BOUNDS.opacity.max + EPS) {
        errors.push(`layer ${l.id}: opacity ${v} out of [${BOUNDS.opacity.min}, ${BOUNDS.opacity.max}]`);
      }
    }

    if (l.transform?.scale) {
      for (const arr of collectVectors(l.transform.scale as Animated<number[]>)) {
        for (const v of arr) {
          if (v < BOUNDS.scale.min - EPS || v > BOUNDS.scale.max + EPS) {
            errors.push(`layer ${l.id}: scale ${v} out of [${BOUNDS.scale.min}, ${BOUNDS.scale.max}]`);
          }
        }
      }
    }

    if (l.transform?.rotation) {
      for (const arr of collectVectors(l.transform.rotation as Animated<number[]>)) {
        for (const v of arr) {
          if (v < BOUNDS.rotationDeg.min - EPS || v > BOUNDS.rotationDeg.max + EPS) {
            errors.push(`layer ${l.id}: rotation ${v} out of [${BOUNDS.rotationDeg.min}, ${BOUNDS.rotationDeg.max}]`);
          }
        }
      }
    }

    // Fill/stroke colors.
    const fill = (l as { fill?: string }).fill;
    if (fill && !isHexColor(fill)) errors.push(`layer ${l.id}: invalid fill color "${fill}"`);
    const stroke = (l as { stroke?: { color?: string } }).stroke;
    if (stroke?.color && !isHexColor(stroke.color)) errors.push(`layer ${l.id}: invalid stroke color "${stroke.color}"`);

    // Mask region must be non-degenerate.
    if (l.mask?.rect) {
      const r = l.mask.rect;
      if (!(r.width > 0) || !(r.height > 0)) {
        errors.push(`layer ${l.id}: mask rect must have positive width/height`);
      }
    }

    // Asset resolution.
    const assetId = (l as { assetId?: string }).assetId;
    if (assetId && !assetIds.has(assetId)) errors.push(`layer ${l.id}: references missing asset "${assetId}"`);

    // Sources for media layers (non-fatal: b-roll src is resolved later).
    if (l.type === 'video' || l.type === 'image') {
      const src = (l as { src?: string }).src;
      if (!assetId && !src) warnings.push(`layer ${l.id}: ${l.type} has no source (resolved downstream?)`);
    }
  }

  // ── Parent references + cycles ───────────────────────────────────────────────
  for (const l of flat) {
    if (!l.parentId) continue;
    let cur: string | undefined = l.parentId;
    const seen = new Set<string>([l.id]);
    let steps = 0;
    while (cur) {
      if (!byId.has(cur)) {
        errors.push(`layer ${l.id}: references missing parent "${cur}"`);
        break;
      }
      if (seen.has(cur)) {
        errors.push(`layer ${l.id}: is part of a parentId cycle`);
        break;
      }
      seen.add(cur);
      cur = byId.get(cur)!.parentId;
      if (++steps > 10_000) break;
    }
  }

  return { ok: errors.length === 0, warnings, errors };
}
