import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { __resetForTests, keyCount, markRateLimited, nextKey } from '../geminiKeys';

describe('geminiKeys rotation', () => {
  const original = process.env.GEMINI_API_KEYS;

  beforeEach(() => {
    process.env.GEMINI_API_KEYS = 'k1, k2 , k3';
    __resetForTests();
    // env module caches; re-import isn't trivial, so tests that depend on env
    // count rely on the value set here being parsed on first use.
  });

  afterEach(() => {
    if (original === undefined) delete process.env.GEMINI_API_KEYS;
    else process.env.GEMINI_API_KEYS = original;
    __resetForTests();
  });

  it('counts trimmed, non-empty keys', () => {
    expect(keyCount()).toBe(3);
  });

  it('round-robins across keys', () => {
    const seen = [nextKey(0), nextKey(0), nextKey(0), nextKey(0)];
    expect(seen.slice(0, 3)).toEqual(['k1', 'k2', 'k3']);
    expect(seen[3]).toBe('k1'); // wraps around
  });

  it('skips a rate-limited key until cooldown elapses', () => {
    const t0 = 1000;
    markRateLimited('k2', t0, 60_000);
    // During cooldown, no pick should ever be k2.
    const during = [nextKey(t0), nextKey(t0), nextKey(t0), nextKey(t0)];
    expect(during).not.toContain('k2');
    // After cooldown, a full cycle includes k2 again.
    const after = [nextKey(t0 + 61_000), nextKey(t0 + 61_000), nextKey(t0 + 61_000)];
    expect(after).toContain('k2');
  });

  it('falls back to soonest-recovering key when all are cooling down', () => {
    const t0 = 5000;
    markRateLimited('k1', t0, 10_000);
    markRateLimited('k2', t0, 5_000);
    markRateLimited('k3', t0, 20_000);
    // none available at t0 -> soonest recovery is k2 (5s)
    expect(nextKey(t0)).toBe('k2');
  });
});
