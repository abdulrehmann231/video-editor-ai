import { GoogleGenerativeAI, type Schema } from '@google/generative-ai';
import { GoogleAIFileManager, FileState } from '@google/generative-ai/server';

/**
 * Gemini File API helpers for video analysis.
 *
 * The File API is scoped to a single API key/project, so an upload and the
 * generateContent call that references it MUST use the SAME key. Callers pass a
 * pinned key; higher-level orchestration handles key rotation/failover by
 * retrying the whole upload+generate with a different key.
 */

export interface UploadedFile {
  uri: string;
  mimeType: string;
  name: string; // resource name, used for deletion
}

export async function uploadVideo(
  apiKey: string,
  localPath: string,
  mimeType: string,
  displayName: string,
  opts: { pollIntervalMs?: number; timeoutMs?: number } = {},
): Promise<UploadedFile> {
  const fm = new GoogleAIFileManager(apiKey);
  const uploaded = await fm.uploadFile(localPath, { mimeType, displayName });

  const pollInterval = opts.pollIntervalMs ?? 2000;
  const timeout = opts.timeoutMs ?? 5 * 60_000;
  const deadline = Date.now() + timeout;

  let file = await fm.getFile(uploaded.file.name);
  while (file.state === FileState.PROCESSING) {
    if (Date.now() > deadline) {
      await safeDelete(fm, file.name);
      throw new Error('Gemini file processing timed out');
    }
    await sleep(pollInterval);
    file = await fm.getFile(uploaded.file.name);
  }

  if (file.state === FileState.FAILED) {
    await safeDelete(fm, file.name);
    throw new Error('Gemini failed to process the uploaded video');
  }

  return { uri: file.uri, mimeType: file.mimeType, name: file.name };
}

export async function deleteVideo(apiKey: string, name: string): Promise<void> {
  await safeDelete(new GoogleAIFileManager(apiKey), name);
}

/** Run a structured-output generation over an already-uploaded video file. */
export async function generateStructured(
  apiKey: string,
  model: string,
  file: UploadedFile,
  prompt: string,
  responseSchema: Schema,
): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const m = genAI.getGenerativeModel({
    model,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema,
      temperature: 0.4,
    },
  });
  const result = await m.generateContent([
    { fileData: { fileUri: file.uri, mimeType: file.mimeType } },
    { text: prompt },
  ]);
  return result.response.text();
}

/** Plain structured generation without a video (used for the repair pass). */
export async function generateStructuredText(
  apiKey: string,
  model: string,
  prompt: string,
  responseSchema: Schema,
): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const m = genAI.getGenerativeModel({
    model,
    generationConfig: { responseMimeType: 'application/json', responseSchema, temperature: 0.2 },
  });
  const result = await m.generateContent(prompt);
  return result.response.text();
}

async function safeDelete(fm: GoogleAIFileManager, name: string): Promise<void> {
  try {
    await fm.deleteFile(name);
  } catch {
    /* best-effort */
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
