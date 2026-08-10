import type { MotionComposition } from '../ir/types';

/**
 * Input props for the Remotion "Motion" composition. Pure, zero-runtime-import
 * module so it can be shared by the Node orchestrator AND the Remotion bundle
 * (mirrors src/remotion/types.ts discipline — the only value export is plain data).
 */

export type OutputLayout = 'landscape' | 'shorts';

export interface MotionRenderProps {
  /** Public URL of the Phase-2 cut video (the base layer). */
  videoSrc: string;
  fps: number;
  width: number;
  height: number;
  durationInFrames: number;
  layout: OutputLayout;
  progressBar: boolean;
  compositions: MotionComposition[];
}

export const DEFAULT_MOTION_PROPS: MotionRenderProps = {
  videoSrc: '',
  fps: 30,
  width: 1280,
  height: 720,
  durationInFrames: 30,
  layout: 'landscape',
  progressBar: true,
  compositions: [],
};

/** 9:16 target resolution (same pixel count as 720p landscape). */
const SHORTS_DIMS = { width: 720, height: 1280 };

export interface BuildMotionPropsInput {
  cutUrl: string;
  editMedia: { width?: number; height?: number; fps?: number };
  layout: OutputLayout;
  compositions: MotionComposition[];
  outputDurationSec: number;
  progressBar?: boolean;
}

/**
 * Assemble the Motion composition inputProps from the cut + IR. Deterministic
 * and side-effect free (unit-tested); the actual render lives in renderMotion.ts.
 */
export function buildMotionProps(input: BuildMotionPropsInput): MotionRenderProps {
  const fps = Math.max(1, Math.round(input.editMedia.fps ?? 30));
  const dims =
    input.layout === 'shorts'
      ? SHORTS_DIMS
      : { width: input.editMedia.width ?? 1280, height: input.editMedia.height ?? 720 };
  const durationInFrames = Math.max(1, Math.round(input.outputDurationSec * fps));

  return {
    videoSrc: input.cutUrl,
    fps,
    width: dims.width,
    height: dims.height,
    durationInFrames,
    layout: input.layout,
    progressBar: input.progressBar ?? true,
    compositions: input.compositions,
  };
}
