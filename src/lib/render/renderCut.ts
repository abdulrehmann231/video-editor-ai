import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readFile, stat, mkdtemp, rm } from 'node:fs/promises';
import { probeMedia, type MediaInfo } from '../ingest';
import { putObject, publicUrl, presignGet } from '../r2';
import type { Edl } from '../edl/schema';
import { computeKeepSegments, cutRangesFromEdl, totalKept, type Range } from './segments';
import { renderCutFile } from './ffmpegCut';

export interface RenderMeta {
  kind: 'cut';
  createdAt: string;
  keepSegments: number;
  keptSec: number;
  removedSec: number;
  sourceDurationSec: number | null;
  outputDurationSec: number | null;
  sizeBytes: number | null;
}

export interface RenderResult {
  renderKey: string;
  url: string;
  meta: RenderMeta;
  segments: Range[];
}

export interface RenderInput {
  projectId: string;
  sourceKey: string;
  filename: string;
  media: MediaInfo;
  edl: Edl;
  normalizeAudio?: boolean;
}

/**
 * Phase 2 render: apply the EDL's structural cuts (silence removal) with FFmpeg
 * and upload the resulting "cut" video to R2. Motion graphics (captions/zooms/
 * b-roll) are layered on later in Phase 3.
 */
export async function renderCut(input: RenderInput): Promise<RenderResult> {
  const duration = input.media.durationSec ?? 0;
  if (duration <= 0) throw new Error('Cannot render: unknown source duration.');

  const cuts = cutRangesFromEdl(input.edl);
  const segments = computeKeepSegments(duration, cuts, { minKeepSec: 0.05 });
  if (segments.length === 0) throw new Error('Nothing left to render after cuts.');

  // Stream the (mezzanine) source straight from R2 into ffmpeg — no full local
  // copy, so multi-GB originals never touch the worker's disk/memory.
  const inputUrl = await presignGet(input.sourceKey, 3 * 3600);
  const dir = await mkdtemp(join(tmpdir(), 'edit-ai-cut-'));
  const outPath = join(dir, 'cut.mp4');

  try {
    await renderCutFile(inputUrl, outPath, segments, {
      hasAudio: input.media.hasAudio,
      normalizeAudio: input.normalizeAudio,
      // Pin the cut to the source fps as CFR so Remotion's <OffthreadVideo> can
      // always find a frame (VFR sources otherwise trip "No frame found").
      fps: input.media.fps,
    });

    const [buf, outInfo, fileStat] = await Promise.all([
      readFile(outPath),
      probeMedia(outPath).catch(() => null),
      stat(outPath),
    ]);

    const renderKey = `renders/${input.projectId}/cut-${Date.now()}.mp4`;
    await putObject(renderKey, buf, 'video/mp4');

    const kept = totalKept(segments);
    const meta: RenderMeta = {
      kind: 'cut',
      createdAt: new Date().toISOString(),
      keepSegments: segments.length,
      keptSec: kept,
      removedSec: Math.round((duration - kept) * 1000) / 1000,
      sourceDurationSec: duration,
      outputDurationSec: outInfo?.durationSec ?? null,
      sizeBytes: fileStat.size,
    };

    return { renderKey, url: publicUrl(renderKey), meta, segments };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
