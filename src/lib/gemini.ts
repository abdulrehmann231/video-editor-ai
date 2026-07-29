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

export { isRateLimit };
