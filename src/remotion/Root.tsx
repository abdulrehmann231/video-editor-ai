import React from 'react';
import { Composition } from 'remotion';
import { Edit } from './Edit';
import { ThreeProbe } from './components/three/ThreeProbe';
import { DEFAULT_EDIT_PROPS, type EditProps } from './types';
import { MotionComp } from './motion/MotionComp';
import { DEFAULT_MOTION_PROPS, type MotionRenderProps } from '../lib/motion/render/props';

/**
 * Remotion root. The `Edit` composition's dimensions/fps/duration are derived
 * from inputProps at render time via calculateMetadata, so one composition
 * handles any source video. `Motion` is the parallel IR-driven composition
 * (Phase 1.5/2), gated behind a flag on the Node side so `Edit` stays default.
 */
// Remotion's Composition expects props extending Record<string, unknown>; our
// EditProps interface isn't index-compatible, so we bridge with casts.
const EditComponent = Edit as unknown as React.FC<Record<string, unknown>>;

export const RemotionRoot: React.FC = () => {
  return (
    <>
    <Composition
      id="Edit"
      component={EditComponent}
      durationInFrames={DEFAULT_EDIT_PROPS.durationInFrames}
      fps={DEFAULT_EDIT_PROPS.fps}
      width={DEFAULT_EDIT_PROPS.width}
      height={DEFAULT_EDIT_PROPS.height}
      defaultProps={DEFAULT_EDIT_PROPS as unknown as Record<string, unknown>}
      calculateMetadata={({ props }) => {
        const p = props as unknown as EditProps;
        return {
          durationInFrames: Math.max(1, p.durationInFrames),
          fps: p.fps,
          width: p.width,
          height: p.height,
        };
      }}
    />
    <Composition
      id="Motion"
      component={MotionComp}
      durationInFrames={DEFAULT_MOTION_PROPS.durationInFrames}
      fps={DEFAULT_MOTION_PROPS.fps}
      width={DEFAULT_MOTION_PROPS.width}
      height={DEFAULT_MOTION_PROPS.height}
      defaultProps={DEFAULT_MOTION_PROPS as unknown as Record<string, unknown>}
      calculateMetadata={({ props }) => {
        const p = props as unknown as MotionRenderProps;
        return {
          durationInFrames: Math.max(1, p.durationInFrames),
          fps: p.fps,
          width: p.width,
          height: p.height,
        };
      }}
    />
    <Composition
      id="ThreeProbe"
      component={ThreeProbe}
      durationInFrames={60}
      fps={30}
      width={1280}
      height={720}
    />
    </>
  );
};
