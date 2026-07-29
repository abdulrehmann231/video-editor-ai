import { GoogleGenerativeAI } from '@google/generative-ai';
import { getEnv } from './env';
import { keyCount, markRateLimited, nextKey } from './geminiKeys';

/**
 * Thin Gemini wrapper that transparently rotates across GEMINI_API_KEYS.
 *
 * `generateText` retries on rate-limit (429) by moving to the next key. Phase 0
 * only needs a lightweight text call (used by the smoke test and as the
 * foundation the Phase 1 EDL prompt builds on).
 */

function isRateLimit(err: unknown): boolean {
  const e = err as { status?: number; message?: string };
  const msg = (e?.message || '').toLowerCase();
  return e?.status === 429 || msg.includes('429') || msg.includes('rate limit') || msg.includes('quota');
}

/**
 * Retryable = rate limits OR transient server-side/network errors (Gemini
 * occasionally returns 500/503 or times out). These are worth failing over to
 * another key / retrying; 4xx (except 429) are not.
 */
function isRetryable(err: unknown): boolean {
  if (isRateLimit(err)) return true;
  const e = err as { status?: number; message?: string };
  const msg = (e?.message || '').toLowerCase();
  if (e?.status === 500 || e?.status === 503 || e?.status === 502 || e?.status === 504) return true;
  return (
    msg.includes('500') ||
    msg.includes('503') ||
    msg.includes('internal error') ||
    msg.includes('overloaded') ||
    msg.includes('unavailable') ||
    msg.includes('timeout') ||
    msg.includes('fetch failed') ||
    msg.includes('econnreset')
  );
}

export interface GenerateOptions {
  model?: string;
  /** Max key failovers before giving up. Defaults to the number of keys. */
  maxAttempts?: number;
}

export async function generateText(prompt: string, opts: GenerateOptions = {}): Promise<string> {
  const env = getEnv();
  const model = opts.model ?? env.GEMINI_MODEL;
  const maxAttempts = opts.maxAttempts ?? Math.max(1, keyCount());

  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const key = nextKey();
    try {
      const genAI = new GoogleGenerativeAI(key);
      const result = await genAI.getGenerativeModel({ model }).generateContent(prompt);
      return result.response.text();
    } catch (err) {
      lastErr = err;
      if (isRateLimit(err)) {
        markRateLimited(key);
        continue; // try the next key
      }
      throw err; // non-rate-limit errors are not retryable here
    }
  }
  throw new Error(
    `Gemini generateText failed after ${maxAttempts} attempt(s): ${(lastErr as Error)?.message ?? lastErr}`,
  );
}

export { isRateLimit, isRetryable };
