import { VAULT, retrieveReferences, type VaultRef, type RetrieveOptions } from '../../vault';
import { classifyReference, type ReferenceMapping, type EffectFamily } from './mappings';

/**
 * Phase 5 — the executable Inspiration Vault. Each of the 451 references is
 * classified into a template mapping, so a reference can be turned into a
 * renderable template instance (Phase 6 lets the AI pick references by #id).
 */

export type { EffectFamily, ReferenceMapping } from './mappings';

/** A vault reference enriched with its executable mapping. */
export type MotionReference = VaultRef & { mapping: ReferenceMapping };

let ENRICHED: MotionReference[] | null = null;

/** The whole vault, each reference classified (memoized). */
export function enrichedVault(): MotionReference[] {
  if (!ENRICHED) ENRICHED = VAULT.map((ref) => ({ ...ref, mapping: classifyReference(ref) }));
  return ENRICHED;
}

/** References that render today (mapped to a real template, not advanced-only). */
export function executableReferences(): MotionReference[] {
  return enrichedVault().filter((r) => r.mapping.templateId && !r.mapping.requiresAdvanced);
}

/** Turn a reference into a { templateId, params } instance the compiler can build. */
export function referenceToInstance(ref: MotionReference | VaultRef): { templateId: string; params: Record<string, unknown> } | null {
  const mapping = 'mapping' in ref ? ref.mapping : classifyReference(ref);
  if (!mapping.templateId) return null;
  return { templateId: mapping.templateId, params: mapping.params ?? {} };
}

export interface VaultStats {
  total: number;
  executable: number;
  requiresAdvanced: number;
  byFamily: Record<EffectFamily, number>;
}

export function vaultStats(): VaultStats {
  const all = enrichedVault();
  const byFamily = {} as Record<EffectFamily, number>;
  let executable = 0;
  let advanced = 0;
  for (const r of all) {
    byFamily[r.mapping.family] = (byFamily[r.mapping.family] ?? 0) + 1;
    if (r.mapping.templateId && !r.mapping.requiresAdvanced) executable++;
    if (r.mapping.requiresAdvanced) advanced++;
  }
  return { total: all.length, executable, requiresAdvanced: advanced, byFamily };
}

/** Retrieve references relevant to a query, enriched with mappings. Set
 * executableOnly to drop references that need an advanced backend. */
export function retrieveExecutableReferences(
  query: string,
  opts: RetrieveOptions & { executableOnly?: boolean } = {},
): MotionReference[] {
  const refs = retrieveReferences(query, opts);
  const enriched = refs.map((ref) => ({ ...ref, mapping: classifyReference(ref) }));
  return opts.executableOnly ? enriched.filter((r) => r.mapping.templateId && !r.mapping.requiresAdvanced) : enriched;
}

/** Compact prompt line for a reference incl. its executable template (Phase 6). */
export function refExecLine(ref: MotionReference): string {
  const m = ref.mapping;
  const tpl = m.templateId ? `${m.templateId}${m.params?.style ? `:${m.params.style}` : m.params?.template ? `:${m.params.template}` : m.params?.variant ? `:${m.params.variant}` : ''}` : `advanced(${m.renderer})`;
  return `#${ref.i} ${ref.name} → ${tpl}`;
}
