import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * STAGE 2 (optional) — RESEARCH. A Gemini call with Google Search grounding that
 * researches how the niche's videos are edited right now, returning a short
 * techniques brief for the BUILD stage. Gated by env `EDIT_RESEARCH=on` to keep
 * per-video cost/latency under control. Google Search grounding can't be combined
 * with JSON output, so this is its own plain-text call.
 */

export function researchEnabled(): boolean {
  return process.env.EDIT_RESEARCH === 'on';
}

export async function researchTechniques(
  apiKey: string,
  model: string,
  niche: string | undefined,
  tone: string | undefined,
): Promise<string | undefined> {
  const topic = niche?.trim() || 'B2B talking-head';
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    // `googleSearch` is the grounding tool for Gemini 2.x+; cast since the SDK
    // Tool type may not include it in this version.
    const m = genAI.getGenerativeModel({
      model,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: [{ googleSearch: {} } as any],
    });
    const prompt = `Research how TOP ${topic} YouTube videos (${tone || 'energetic'} tone) are edited in 2026.
Focus on retention editing: caption style, punch-in zooms, b-roll usage, stat/number callouts,
transitions, lower thirds, pacing, and any signature motion-graphics looks. Return a concise
bullet brief (6–10 bullets) an editor can directly apply. No preamble.`;
    const res = await m.generateContent(prompt);
    const text = res.response.text().trim();
    return text || undefined;
  } catch {
    return undefined; // optional — never block the pipeline
  }
}
