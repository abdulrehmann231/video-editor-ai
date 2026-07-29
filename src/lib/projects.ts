import { getObject, putObject, publicUrl } from './r2';
import type { MediaInfo } from './ingest';
import type { AnalysisMeta, Edl } from './edl/schema';
import type { TranscriptWord } from './analyze/transcribe';
import type { RenderMeta } from './render/renderCut';

/**
 * Project record store, backed by R2 JSON objects (`projects/<id>.json`).
 *
 * Phase 0 deliberately avoids standing up a database: R2 is already required
 * and this exercises the same read/write path we depend on. A real DB (Postgres)
 * arrives in Phase 1 when we need querying/listing at scale.
 */

export type ProjectStatus = 'uploading' | 'uploaded' | 'ingested' | 'error';
export type AnalysisStatus = 'idle' | 'analyzing' | 'analyzed' | 'error';
export type RenderStatus = 'idle' | 'rendering' | 'rendered' | 'error';

export interface Project {
  id: string;
  filename: string;
  contentType: string;
  /** R2 object key of the uploaded source video. */
  sourceKey: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  media?: MediaInfo;
  error?: string;

  /** Optional user guidance that steers the AI edit (e.g. tone, speaker name, focus). */
  prompt?: string;

  // ---- Phase 1: analysis ----
  analysisStatus?: AnalysisStatus;
  analysisError?: string;
  edl?: Edl;
  analysisMeta?: AnalysisMeta;
  /** Word-level transcript (kept for captions in later phases). */
  transcript?: TranscriptWord[];

  // ---- Phase 2: render (structural cut) ----
  renderStatus?: RenderStatus;
  renderError?: string;
  /** R2 key of the latest rendered cut. */
  renderKey?: string;
  renderMeta?: RenderMeta;
}

const INDEX_KEY = 'projects/_index.json';

function recordKey(id: string): string {
  return `projects/${id}.json`;
}

export function sourceKeyFor(id: string, filename: string): string {
  return `uploads/${id}/${filename}`;
}

export async function saveProject(p: Project): Promise<Project> {
  const next = { ...p, updatedAt: new Date().toISOString() };
  await putObject(recordKey(p.id), JSON.stringify(next, null, 2), 'application/json');
  await addToIndex(p.id);
  return next;
}

export async function getProject(id: string): Promise<Project | null> {
  const buf = await getObject(recordKey(id));
  if (!buf) return null;
  return JSON.parse(buf.toString('utf8')) as Project;
}

export async function listProjectIds(): Promise<string[]> {
  const buf = await getObject(INDEX_KEY);
  if (!buf) return [];
  try {
    return JSON.parse(buf.toString('utf8')) as string[];
  } catch {
    return [];
  }
}

async function addToIndex(id: string): Promise<void> {
  const ids = await listProjectIds();
  if (ids.includes(id)) return;
  ids.unshift(id);
  await putObject(INDEX_KEY, JSON.stringify(ids, null, 2), 'application/json');
}

/** Convenience: the public playback URL for a project's source video. */
export function sourceUrl(p: Project): string {
  return publicUrl(p.sourceKey);
}

/** Public playback URL for the latest rendered cut, if any. */
export function renderUrl(p: Project): string | null {
  return p.renderKey ? publicUrl(p.renderKey) : null;
}
