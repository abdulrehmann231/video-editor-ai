import { getProject, saveProject, type Project } from '../projects';
import { analyzeVideo } from '../analyze/analyzeVideo';
import { renderCut } from '../render/renderCut';
import { renderFinal } from '../render/renderFinal';
import { buildOverlayPlan } from '../render/timeline';
import { resolveBroll } from '../render/resolveBroll';

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
    const result = await analyzeVideo({
      sourceKey: project.sourceKey,
      contentType: project.contentType,
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

/**
 * Render the final video: fresh cut (base consistent with current EDL) →
 * overlay plan (source→cut remap) → Pexels b-roll → Remotion composite.
 */
export async function runFinalRender(projectId: string): Promise<FinalRenderResult> {
  let project = await getProject(projectId);
  if (!project) throw new Error('Project not found');
  if (!project.media) throw new Error('Project is not ingested yet.');
  if (!project.edl) throw new Error('No edit plan yet — run analysis first.');

  const media = project.media;
  const edl = project.edl;
  const sourceDuration = media.durationSec ?? 0;

  await saveProject({ ...project, finalStatus: 'rendering', finalError: undefined });

  try {
    // 1. Fresh cut.
    const cut = await renderCut({
      projectId: project.id,
      sourceKey: project.sourceKey,
      filename: project.filename,
      media,
      edl,
    });
    project = await saveProject({
      ...project,
      renderStatus: 'rendered',
      renderKey: cut.renderKey,
      renderMeta: cut.meta,
    });

    // 2. Overlay plan + b-roll.
    const plan = buildOverlayPlan(edl, project.transcript ?? [], sourceDuration);
    const { resolved, warnings } = await resolveBroll(plan.brolls, {
      orientation: (media.width ?? 16) >= (media.height ?? 9) ? 'landscape' : 'portrait',
    });
    plan.brolls = resolved;

    // 3. Composite.
    const result = await renderFinal({
      projectId: project.id,
      cutUrl: cut.url,
      width: media.width ?? 1280,
      height: media.height ?? 720,
      fps: media.fps ?? 30,
      plan,
    });

    const saved = await saveProject({
      ...project,
      finalStatus: 'rendered',
      finalError: undefined,
      finalKey: result.finalKey,
      finalMeta: result.meta,
      finalWarnings: warnings,
    });
    return { project: saved, warnings };
  } catch (err) {
    await saveProject({ ...project, finalStatus: 'error', finalError: (err as Error).message });
    throw err;
  }
}
