import { getProject, patchProject } from '../projects';
import { runAnalyze, runFinalRender } from './steps';

/**
 * Fully-automatic pipeline: analyze → final render, chained with a single
 * top-level status so the UI can show one progress tracker. Runs in-process on
 * the long-lived Node server; an in-memory guard prevents duplicate concurrent
 * runs for the same project. (A Redis/BullMQ queue can replace this later for
 * multi-instance scale without changing the step functions.)
 */

const running = new Set<string>();

export function isPipelineRunning(projectId: string): boolean {
  return running.has(projectId);
}

export interface PipelineOptions {
  /** Steering prompt override for the analysis step. */
  prompt?: string;
}

/**
 * Execute the pipeline to completion. Persists progress at each step so pollers
 * see live status. Never throws — failures are recorded on the project.
 */
export async function runProjectPipeline(projectId: string, opts: PipelineOptions = {}): Promise<void> {
  if (running.has(projectId)) return;
  running.add(projectId);

  try {
    await patchProject(projectId, {
      pipelineStatus: 'running',
      pipelineStep: 'analyze',
      pipelineError: undefined,
      pipelineStartedAt: new Date().toISOString(),
      pipelineFinishedAt: undefined,
    });

    // Step 1 — editorial analysis (EDL + transcript).
    await runAnalyze(projectId, { prompt: opts.prompt });

    // Step 2 — cut + motion-graphics composite.
    await patchProject(projectId, { pipelineStep: 'render' });
    await runFinalRender(projectId);

    await patchProject(projectId, {
      pipelineStatus: 'done',
      pipelineStep: 'done',
      pipelineFinishedAt: new Date().toISOString(),
    });
  } catch (err) {
    await patchProject(projectId, {
      pipelineStatus: 'error',
      pipelineError: (err as Error).message,
      pipelineFinishedAt: new Date().toISOString(),
    }).catch(() => {});
  } finally {
    running.delete(projectId);
  }
}

/**
 * Kick the pipeline without waiting for it (fire-and-forget). Marks the project
 * running synchronously so an immediate poll reflects it, then returns.
 */
export async function startPipeline(projectId: string, opts: PipelineOptions = {}): Promise<void> {
  const project = await getProject(projectId);
  if (!project) throw new Error('Project not found');
  if (!project.media) throw new Error('Project is not ingested yet.');
  if (running.has(projectId) || project.pipelineStatus === 'running') return;

  await patchProject(projectId, {
    pipelineStatus: 'running',
    pipelineStep: 'analyze',
    pipelineError: undefined,
    pipelineStartedAt: new Date().toISOString(),
  });

  // Detached — the long-lived server keeps the event loop alive.
  void runProjectPipeline(projectId, opts);
}
