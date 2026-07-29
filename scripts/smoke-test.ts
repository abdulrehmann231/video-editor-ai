/**
 * Live credential smoke test — validates that every external dependency is
 * reachable with the configured secrets BEFORE we build further on them.
 *
 * Run: npm run smoke
 *
 * Checks:
 *   1. Env — all required vars parse.
 *   2. R2   — PUT, HEAD, GET (round-trip), then DELETE a tiny object.
 *   3. Gemini — a minimal generateContent call per configured key.
 *   4. Pexels — a real video search returns results.
 *
 * Exits non-zero if any check fails.
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getEnv } from '../src/lib/env';
import { deleteObject, getObject, objectExists, putObject } from '../src/lib/r2';
import { searchVideos } from '../src/lib/pexels';

type Check = { name: string; ok: boolean; detail: string };
const results: Check[] = [];

function record(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
  const icon = ok ? '✅' : '❌';
  console.log(`${icon} ${name} — ${detail}`);
}

async function checkEnv(): Promise<boolean> {
  try {
    const env = getEnv();
    record(
      'env',
      true,
      `R2 bucket "${env.R2_BUCKET}", ${env.GEMINI_API_KEYS.length} Gemini key(s), model ${env.GEMINI_MODEL}`,
    );
    return true;
  } catch (err) {
    record('env', false, (err as Error).message);
    return false;
  }
}

async function checkR2(): Promise<void> {
  const key = `smoke-tests/${Date.now()}-${Math.floor(Math.random() * 1e6)}.txt`;
  const payload = `edit-ai smoke ${new Date().toISOString()}`;
  try {
    await putObject(key, payload, 'text/plain');
    const exists = await objectExists(key);
    const buf = await getObject(key);
    const roundTripOk = exists && buf?.toString('utf8') === payload;
    await deleteObject(key);
    record(
      'r2',
      roundTripOk,
      roundTripOk ? `PUT/HEAD/GET/DELETE round-trip ok (${key})` : 'round-trip mismatch',
    );
  } catch (err) {
    record('r2', false, (err as Error).message);
    // best-effort cleanup
    try {
      await deleteObject(key);
    } catch {
      /* ignore */
    }
  }
}

async function checkGemini(): Promise<void> {
  const env = getEnv();
  const model = env.GEMINI_MODEL;
  let allOk = true;
  for (let i = 0; i < env.GEMINI_API_KEYS.length; i++) {
    const key = env.GEMINI_API_KEYS[i];
    const label = `gemini[key ${i + 1}/${env.GEMINI_API_KEYS.length}]`;
    try {
      const genAI = new GoogleGenerativeAI(key);
      const res = await genAI
        .getGenerativeModel({ model })
        .generateContent('Reply with the single word: pong');
      const text = res.response.text().trim().toLowerCase();
      const ok = text.includes('pong');
      if (!ok) allOk = false;
      record(label, ok, ok ? `responded "${text.slice(0, 20)}"` : `unexpected reply "${text.slice(0, 40)}"`);
    } catch (err) {
      allOk = false;
      record(label, false, (err as Error).message);
    }
  }
  if (env.GEMINI_API_KEYS.length === 0) record('gemini', false, 'no keys configured');
  void allOk;
}

async function checkPexels(): Promise<void> {
  try {
    const res = await searchVideos('office team meeting', { perPage: 3, orientation: 'landscape' });
    const ok = Array.isArray(res.videos) && res.videos.length > 0;
    record(
      'pexels',
      ok,
      ok ? `search returned ${res.videos.length} clips (total ${res.total_results})` : 'no results',
    );
  } catch (err) {
    record('pexels', false, (err as Error).message);
  }
}

async function main() {
  console.log('== edit-ai smoke test ==\n');
  const envOk = await checkEnv();
  if (!envOk) {
    console.log('\nEnv invalid — skipping live checks.');
    process.exit(1);
  }
  await checkR2();
  await checkGemini();
  await checkPexels();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length > 0) {
    console.log('Failed:', failed.map((f) => f.name).join(', '));
    process.exit(1);
  }
  console.log('All systems go. 🚀');
}

main().catch((err) => {
  console.error('smoke test crashed:', err);
  process.exit(1);
});
