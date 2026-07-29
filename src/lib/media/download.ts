import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getObject } from '../r2';

/** Download an R2 object to a temp file and return its local path. */
export async function downloadToTemp(key: string, filename = 'source'): Promise<{ path: string; dir: string }> {
  const buf = await getObject(key);
  if (!buf) throw new Error(`Object not found in R2: ${key}`);
  const dir = await mkdtemp(join(tmpdir(), 'edit-ai-'));
  const ext = key.includes('.') ? key.slice(key.lastIndexOf('.')) : '';
  const path = join(dir, `${filename}${ext}`);
  await writeFile(path, buf);
  return { path, dir };
}

/** Best-effort recursive cleanup of a temp dir. */
export async function cleanupTemp(dir: string): Promise<void> {
  try {
    await rm(dir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}
