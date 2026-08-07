import { describe, it, expect } from 'vitest';
import { retrieveReferences, refLine, refCatalogLine, vaultCatalogText, referencesByIds, VAULT, VAULT_SIZE } from '../vault';

describe('vault dataset', () => {
  it('loaded the 451-effect catalog', () => {
    expect(VAULT_SIZE).toBeGreaterThan(400);
    expect(VAULT[0]).toHaveProperty('name');
    expect(VAULT[0]).toHaveProperty('motion');
  });
});

describe('retrieveReferences', () => {
  it('returns relevant, capped, diversified results for a topical query', () => {
    const refs = retrieveReferences('growing revenue and finance charts for investors', { limit: 10 });
    expect(refs.length).toBeGreaterThan(0);
    expect(refs.length).toBeLessThanOrEqual(10);
    // diversity: no motion type appears more than the cap (default 3)
    const counts: Record<string, number> = {};
    for (const r of refs) counts[r.motion || 'other'] = (counts[r.motion || 'other'] ?? 0) + 1;
    expect(Math.max(...Object.values(counts))).toBeLessThanOrEqual(3);
  });

  it('surfaces finance references for a finance query', () => {
    const refs = retrieveReferences('money investing savings income growth', { limit: 20 });
    const hasFinance = refs.some(
      (r) => /finance|money|invest|growth|stat/i.test(r.b2b + ' ' + r.tags.join(' ') + ' ' + r.use),
    );
    expect(hasFinance).toBe(true);
  });

  it('falls back to talking-head references when the query is empty', () => {
    const refs = retrieveReferences('', { limit: 8 });
    expect(refs.length).toBeGreaterThan(0);
  });

  it('respects a custom perMotionCap', () => {
    const refs = retrieveReferences('slide in scale pop mask reveal', { limit: 30, perMotionCap: 2 });
    const counts: Record<string, number> = {};
    for (const r of refs) counts[r.motion || 'other'] = (counts[r.motion || 'other'] ?? 0) + 1;
    expect(Math.max(...Object.values(counts))).toBeLessThanOrEqual(2);
  });
});

describe('refLine', () => {
  it('renders a compact single line', () => {
    const line = refLine(VAULT[0]);
    expect(line.startsWith('- ')).toBe(true);
    expect(line).toContain(VAULT[0].name);
  });
});

describe('model-driven vault catalog', () => {
  it('refCatalogLine leads with the #id so the model can cite it', () => {
    const line = refCatalogLine(VAULT[0]);
    expect(line.startsWith(`#${VAULT[0].i} `)).toBe(true);
    expect(line).toContain(VAULT[0].name);
  });

  it('vaultCatalogText lists every reference, one per line', () => {
    const text = vaultCatalogText();
    expect(text.split('\n').length).toBe(VAULT_SIZE);
    expect(text).toContain('#1 ');
  });

  it('referencesByIds returns the requested references', () => {
    const refs = referencesByIds([VAULT[0].i, VAULT[3].i]);
    expect(refs.map((r) => r.i).sort()).toEqual([VAULT[0].i, VAULT[3].i].sort());
  });
});
