/**
 * Pure view helpers for the pipeline stepper — shared by the UI and unit-tested
 * here so the progress display logic can't silently regress.
 */

export type PipelineStatus = 'idle' | 'running' | 'done' | 'error';
export type PipelineStep = 'derive' | 'analyze' | 'render' | 'done';
export type StepState = 'done' | 'active' | 'pending';

export const PIPELINE_STEPS: { key: PipelineStep; label: string }[] = [
  { key: 'derive', label: 'Prepare (proxy + 1080p)' },
  { key: 'analyze', label: 'Analyze (Gemini + Whisper)' },
  { key: 'render', label: 'Cut + motion graphics' },
  { key: 'done', label: 'Done' },
];

const ORDER: PipelineStep[] = ['derive', 'analyze', 'render', 'done'];

export function stepState(
  status: PipelineStatus,
  activeStep: PipelineStep,
  key: PipelineStep,
): StepState {
  if (status === 'done') return 'done';
  const ai = ORDER.indexOf(activeStep);
  const ki = ORDER.indexOf(key);
  if (ki < ai) return 'done';
  if (ki === ai) return status === 'error' ? 'pending' : 'active';
  return 'pending';
}
