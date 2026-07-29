import { getEnv } from './env';

/**
 * Round-robin provider over the comma-separated GEMINI_API_KEYS, with
 * short-lived cooldowns on keys that return 429 (rate limited) so we fail over
 * to the next healthy key instead of hammering a throttled one.
 *
 * Stateless-friendly: a single module-level rotor is fine for a single process.
 */

const COOLDOWN_MS = 60_000;

type KeyState = { key: string; cooldownUntil: number };

let states: KeyState[] | null = null;
let cursor = 0;

function init(): KeyState[] {
  if (states) return states;
  const keys = getEnv().GEMINI_API_KEYS;
  states = keys.map((key) => ({ key, cooldownUntil: 0 }));
  return states;
}

/** Number of configured keys. */
export function keyCount(): number {
  return init().length;
}

/**
 * Pick the next available key (round-robin, skipping keys in cooldown).
 * If every key is cooling down, returns the one that recovers soonest.
 */
export function nextKey(now = Date.now()): string {
  const s = init();
  let best: KeyState | null = null;
  for (let i = 0; i < s.length; i++) {
    const idx = (cursor + i) % s.length;
    const st = s[idx];
    if (st.cooldownUntil <= now) {
      cursor = (idx + 1) % s.length;
      return st.key;
    }
    if (!best || st.cooldownUntil < best.cooldownUntil) best = st;
  }
  // All in cooldown — return the soonest-to-recover.
  return (best ?? s[0]).key;
}

/** Mark a key as rate-limited so it's skipped for a cooldown window. */
export function markRateLimited(key: string, now = Date.now(), cooldownMs = COOLDOWN_MS): void {
  const s = init();
  const st = s.find((x) => x.key === key);
  if (st) st.cooldownUntil = now + cooldownMs;
}

/** Test-only: reset in-memory rotor state. */
export function __resetForTests(): void {
  states = null;
  cursor = 0;
}
