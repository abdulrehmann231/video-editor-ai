import vaultData from './vault.json';

/**
 * The Editing Inspiration Vault — 451 B2B/YouTube editing references, each an
 * AI-analyzed effect (name + what/when + motion type + style tags + b2b use).
 * Source: github.com/abdulrehmann231/notion-vault (editing-inspiration-vault).
 *
 * We retrieve the references most relevant to a given video and feed them into
 * the analysis prompt, so the AI edits *in the style of* real references and can
 * cite which one inspired each decision.
 */
export interface VaultRef {
  i: number;
  name: string;
  what: string;
  use: string;
  motion: string;
  tags: string[];
  b2b: string;
  cat: string;
  text: boolean;
}

export const VAULT: VaultRef[] = vaultData as VaultRef[];
export const VAULT_SIZE = VAULT.length;

const STOP = new Set(
  'the a an and or of to in on for with your you it is are be this that as at by from into we our us they them their he she his her i my me can will would should could into over under about more most very just like use used using add adds added when where what how why into out up down off get got make makes making show shows video videos clip clips effect effects editing edit'.split(
    /\s+/,
  ),
);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOP.has(t));
}

// Precompute a searchable token set per reference (tags/b2b weighted higher).
interface Indexed {
  ref: VaultRef;
  tokens: Set<string>;
  weighted: Map<string, number>;
}

let INDEX: Indexed[] | null = null;
function index(): Indexed[] {
  if (INDEX) return INDEX;
  INDEX = VAULT.map((ref) => {
    const weighted = new Map<string, number>();
    const bump = (text: string, w: number) => {
      for (const tok of tokenize(text)) weighted.set(tok, Math.max(weighted.get(tok) ?? 0, w));
    };
    bump(ref.name, 2);
    bump(ref.b2b, 3);
    bump(ref.tags.join(' '), 3);
    bump(ref.motion, 2);
    bump(ref.use, 1);
    bump(ref.what, 1);
    bump(ref.cat, 1);
    return { ref, tokens: new Set(weighted.keys()), weighted };
  });
  return INDEX;
}

export interface RetrieveOptions {
  limit?: number;
  /** Max references sharing the same motion type (keeps the set diverse). */
  perMotionCap?: number;
}

/**
 * Retrieve the vault references most relevant to `query` (e.g. the transcript +
 * user prompt), diversified across motion types. Falls back to a spread of
 * talking-head references when the query barely matches.
 */
export function retrieveReferences(query: string, opts: RetrieveOptions = {}): VaultRef[] {
  const limit = opts.limit ?? 16;
  const perMotionCap = opts.perMotionCap ?? 3;
  const qtokens = new Set(tokenize(query));

  const scored = index()
    .map(({ ref, weighted }) => {
      let score = 0;
      for (const tok of qtokens) score += weighted.get(tok) ?? 0;
      // small prior toward core talking-head/B2B references
      if (ref.tags.some((t) => /talking|lower.?third|kinetic|typewriter|stat|caption/i.test(t))) {
        score += 0.5;
      }
      return { ref, score };
    })
    .sort((a, b) => b.score - a.score);

  const anyMatch = scored.some((s) => s.score >= 1);
  const pool = anyMatch ? scored : fallbackPool();

  const perMotion = new Map<string, number>();
  const out: VaultRef[] = [];
  for (const { ref } of pool) {
    const m = ref.motion || 'other';
    const n = perMotion.get(m) ?? 0;
    if (n >= perMotionCap) continue;
    perMotion.set(m, n + 1);
    out.push(ref);
    if (out.length >= limit) break;
  }
  return out;
}

function fallbackPool(): { ref: VaultRef; score: number }[] {
  return index()
    .filter(({ ref }) => ref.tags.some((t) => /talking/i.test(t)))
    .map(({ ref }) => ({ ref, score: 0 }));
}

/** Compact one-line rendering of a reference for the prompt. */
export function refLine(r: VaultRef): string {
  const tags = r.tags.slice(0, 4).join(', ');
  const use = (r.use || r.what).slice(0, 140);
  return `- ${r.name} [${r.motion || 'n/a'}${tags ? `; ${tags}` : ''}] — ${use}`;
}

/**
 * Catalog line for MODEL-DRIVEN selection: leads with the numeric #id so the
 * model can cite exactly which reference it chose. Includes motion + tags + a
 * one-line use so the model can decide by meaning, not our keyword match.
 */
export function refCatalogLine(r: VaultRef): string {
  const tags = r.tags.slice(0, 4).join(', ');
  const use = (r.use || r.what).replace(/\s+/g, ' ').slice(0, 120);
  return `#${r.i} ${r.name} [${r.motion || 'n/a'}${tags ? `; ${tags}` : ''}] — ${use}`;
}

/**
 * The ENTIRE vault as compact catalog lines (~21k tokens for 451 refs). Fed to
 * the BUILD stage so the model chooses references itself instead of being handed
 * only a keyword pre-filter.
 */
export function vaultCatalogText(): string {
  return VAULT.map(refCatalogLine).join('\n');
}

/** Full detail for specific reference ids (for optional on-demand expansion). */
export function referencesByIds(ids: number[]): VaultRef[] {
  const want = new Set(ids);
  return VAULT.filter((r) => want.has(r.i));
}
