import { getProject, saveProject, type Project } from '../projects';
import { analyzeVideo } from '../analyze/analyzeVideo';
import { renderCut } from '../render/renderCut';
import { renderFinal, type OutputLayout } from '../render/renderFinal';
import { buildOverlayPlan } from '../render/timeline';
import { computeKeepSegments, cutRangesFromEdl, totalKept } from '../render/segments';
import { resolveBroll } from '../render/resolveBroll';
import { normalizeBrollClips } from '../render/normalizeBroll';
import { defaultMusicPath } from '../render/music';
import { deriveProxies } from '../media/derive';
import { motionFromEdl } from '../motion/ir';
import { renderFinalMotion } from '../motion/renderers/remotion/renderMotion';

/** Resolve which final-render engine to use (project flag wins; env is the fallback). */
export function resolveRenderEngine(project: Project): 'edl' | 'motion' {
  if (project.renderEngine) return project.renderEngine;
  return process.env.MOTION_ENGINE ? 'motion' : 'edl';
}

/**
 * Derive the small 480p proxy + 1080p mezzanine from the (possibly huge) source
 * in one streaming pass. Idempotent-ish: skips if already derived.
 */
export async function runDerive(projectId: string): Promise<Project> {
  const project = await getProject(projectId);
  if (!project) throw new Error('Project not found');
  if (!project.media) throw new Error('Project is not ingested yet.');
  if (project.proxyKey && project.mezzanineKey && project.deriveStatus === 'derived') {
    return project; // already done
  }

  await saveProject({ ...project, deriveStatus: 'deriving', deriveError: undefined });
  try {
    const res = await deriveProxies({
      projectId: project.id,
      sourceKey: project.sourceKey,
      hasAudio: project.media.hasAudio,
    });
    return await saveProject({
      ...project,
      deriveStatus: 'derived',
      deriveError: undefined,
      proxyKey: res.proxyKey,
      mezzanineKey: res.mezzanineKey,
      editMedia: res.mezzanineMedia,
    });
  } catch (err) {
    await saveProject({ ...project, deriveStatus: 'error', deriveError: (err as Error).message });
    throw err;
  }
}

/**
 * Reusable pipeline steps shared by the manual API routes AND the automatic
 * pipeline orchestrator, so there is exactly one code path per step.
 *
 * Each step loads the freshest project (avoids clobbering concurrent updates),
 * does its work, persists the result, and returns the updated project.
 */

export interface AnalyzeStepOptions {
  /** Override the stored steering prompt (undefined = keep existing). */
  prompt?: string;
  transcribe?: boolean;
}

export async function runAnalyze(projectId: string, opts: AnalyzeStepOptions = {}): Promise<Project> {
  const project = await getProject(projectId);
  if (!project) throw new Error('Project not found');
  if (!project.media) throw new Error('Project is not ingested yet.');

  const effectivePrompt = opts.prompt !== undefined ? opts.prompt : project.prompt;

  await saveProject({
    ...project,
    prompt: effectivePrompt || undefined,
    analysisStatus: 'analyzing',
    analysisError: undefined,
  });

  try {
    // Analyze the small 480p proxy when available (keeps us under Gemini's 2 GB
    // cap and avoids downloading the multi-GB original).
    const analysisKey = project.proxyKey ?? project.sourceKey;
    const analysisType = project.proxyKey ? 'video/mp4' : project.contentType;
    const result = await analyzeVideo({
      sourceKey: analysisKey,
      contentType: analysisType,
      filename: project.filename,
      media: project.media,
      userPrompt: effectivePrompt,
      transcribe: opts.transcribe,
    });
    return await saveProject({
      ...project,
      prompt: effectivePrompt || undefined,
      analysisStatus: 'analyzed',
      analysisError: undefined,
      edl: result.edl,
      analysisMeta: result.meta,
      transcript: result.transcript,
    });
  } catch (err) {
    await saveProject({
      ...project,
      prompt: effectivePrompt || undefined,
      analysisStatus: 'error',
      analysisError: (err as Error).message,
    });
    throw err;
  }
}

export interface FinalRenderResult {
  project: Project;
  warnings: string[];
}

export interface FinalRenderOptions {
  format?: OutputLayout; // 'landscape' (default) | 'shorts'
}

/**
 * Render the final video: fresh cut (base consistent with current EDL) →
 * overlay plan (source→cut remap) → Pexels b-roll → Remotion composite →
 * optional background-music ducking. `format: 'shorts'` outputs a 9:16 version
 * stored under the shorts* fields.
 */
export async function runFinalRender(
  projectId: string,
  opts: FinalRenderOptions = {},
): Promise<FinalRenderResult> {
  const format: OutputLayout = opts.format ?? 'landscape';
  const isShorts = format === 'shorts';

  let project = await getProject(projectId);
  if (!project) throw new Error('Project not found');
  if (!project.media) throw new Error('Project is not ingested yet.');
  if (!project.edl) throw new Error('No edit plan yet — run analysis first.');

  const media = project.media;
  const edl = project.edl;
  // Edit/render against the 1080p mezzanine when available (else the original).
  const editMedia = project.editMedia ?? media;
  const renderSourceKey = project.mezzanineKey ?? project.sourceKey;
  const sourceDuration = editMedia.durationSec ?? media.durationSec ?? 0;
  const musicOn = project.music !== false;

  await saveProject(
    isShorts
      ? { ...project, shortsStatus: 'rendering', shortsError: undefined }
      : { ...project, finalStatus: 'rendering', finalError: undefined },
  );

  try {
    // 1. Fresh cut (on the mezzanine).
    const cut = await renderCut({
      projectId: project.id,
      sourceKey: renderSourceKey,
      filename: project.filename,
      media: editMedia,
      edl,
    });
    project = await saveProject({
      ...project,
      renderStatus: 'rendered',
      renderKey: cut.renderKey,
      renderMeta: cut.meta,
    });

    // 2 + 3. Composite over the cut (+ music ducking). Two engines share the same
    // cut, b-roll orientation, and music; the default 'edl' path is unchanged.
    const engine = resolveRenderEngine(project);
    const musicPath = musicOn ? defaultMusicPath() ?? undefined : undefined;
    let result: { finalKey: string; url: string; meta: NonNullable<Project['finalMeta']> };
    let warnings: string[];

    if (engine === 'motion') {
      // IR-driven parallel path (Phase 1.5/2).
      const keep = computeKeepSegments(sourceDuration, cutRangesFromEdl(edl), { minKeepSec: 0.05 });
      const outputDurationSec = totalKept(keep);
      const { compositions, warnings: irWarnings } = motionFromEdl(edl, project.transcript ?? [], sourceDuration, {
        width: isShorts ? 720 : editMedia.width ?? 1280,
        height: isShorts ? 1280 : editMedia.height ?? 720,
        fps: editMedia.fps ?? 30,
      });
      warnings = irWarnings;
      result = await renderFinalMotion({
        projectId: project.id,
        cutUrl: cut.url,
        editMedia: {
          width: editMedia.width ?? undefined,
          height: editMedia.height ?? undefined,
          fps: editMedia.fps ?? undefined,
        },
        compositions,
        outputDurationSec,
        layout: format,
        musicPath,
        hasAudio: editMedia.hasAudio,
      });
    } else {
      // Default EDL-driven path (unchanged).
      const plan = buildOverlayPlan(edl, project.transcript ?? [], sourceDuration);
      const broll = await resolveBroll(plan.brolls, { orientation: isShorts ? 'portrait' : 'landscape' });
      warnings = broll.warnings;
      // Normalize each clip to the composition's integer fps (same rate renderFinal
      // uses). Stock clips are commonly 23.976 fps; played in a 24 fps composition
      // they crash Remotion with "No frame found at position …". Re-encode to CFR
      // integer fps (cached in R2) so every source maps 1:1 to the timeline.
      const norm = await normalizeBrollClips(broll.resolved, editMedia.fps ?? 30);
      plan.brolls = norm.brolls;
      warnings.push(...norm.warnings);

      result = await renderFinal({
        projectId: project.id,
        cutUrl: cut.url,
        width: editMedia.width ?? 1280,
        height: editMedia.height ?? 720,
        fps: editMedia.fps ?? 30,
        plan,
        layout: format,
        musicPath,
        hasAudio: editMedia.hasAudio,
      });
    }

    const saved = await saveProject(
      isShorts
        ? {
            ...project,
            shortsStatus: 'rendered',
            shortsError: undefined,
            shortsKey: result.finalKey,
            shortsMeta: result.meta,
            finalWarnings: warnings,
          }
        : {
            ...project,
            finalStatus: 'rendered',
            finalError: undefined,
            finalKey: result.finalKey,
            finalMeta: result.meta,
            finalWarnings: warnings,
          },
    );
    return { project: saved, warnings };
  } catch (err) {
    await saveProject(
      isShorts
        ? { ...project, shortsStatus: 'error', shortsError: (err as Error).message }
        : { ...project, finalStatus: 'error', finalError: (err as Error).message },
    );
    throw err;
  }
}
