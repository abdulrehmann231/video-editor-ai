import type { BuildCtx } from '../templates/helpers';
import { DEFAULT_BRAND } from '../brand';
import { getTemplate, type EffectParameter, type EffectTemplate, type TemplateResult } from '../templates/registry';

/**
 * Compile a { templateId, params } instance into IR (layers + optional camera).
 * Parameters are coerced + clamped against the template's declared spec BEFORE
 * build() runs, so the model can never push absurd values into a template.
 */

/** Clamp/coerce a raw param bag against a template's parameter spec. */
export function clampParams(template: EffectTemplate, raw: Record<string, unknown> = {}): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const spec of template.parameters) {
    out[spec.name] = coerce(spec, raw[spec.name]);
  }
  return out;
}

function coerce(spec: EffectParameter, value: unknown): unknown {
  switch (spec.type) {
    case 'number': {
      const raw = typeof value === 'number' && Number.isFinite(value) ? value : spec.default;
      if (typeof raw !== 'number') return undefined; // no value + no default -> inherit downstream
      let n = raw;
      if (typeof spec.min === 'number') n = Math.max(spec.min, n);
      if (typeof spec.max === 'number') n = Math.min(spec.max, n);
      return n;
    }
    case 'boolean':
      return typeof value === 'boolean' ? value : Boolean(spec.default);
    case 'enum': {
      const opts = spec.options ?? [];
      return typeof value === 'string' && opts.includes(value) ? value : spec.default;
    }
    case 'color': {
      const hex = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
      return typeof value === 'string' && hex.test(value) ? value : (spec.default as unknown);
    }
    case 'list':
      return Array.isArray(value) ? value : Array.isArray(spec.default) ? spec.default : [];
    case 'string':
    default:
      return typeof value === 'string' ? value : (spec.default as unknown);
  }
}

export interface ResolveResult extends TemplateResult {
  warnings: string[];
}

/** Resolve a single template instance to layers (+ camera). Unknown template id
 * yields empty layers + a warning rather than throwing. */
export function resolveTemplate(templateId: string, rawParams: Record<string, unknown> | undefined, ctx: BuildCtx): ResolveResult {
  const template = getTemplate(templateId);
  if (!template) {
    return { layers: [], warnings: [`Unknown template "${templateId}"`] };
  }
  const params = clampParams(template, rawParams ?? {});
  const fullCtx: BuildCtx = { ...ctx, brand: ctx.brand ?? DEFAULT_BRAND };
  const result = template.build(params, fullCtx);
  return { layers: result.layers, camera: result.camera, warnings: [] };
}
