import type React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import type { MotionLayer } from '../../lib/motion/ir/types';
import { sampleNumber, sampleVec3 } from './anim/resolveAnimated';

/**
 * Compute the CSS transform/opacity for a layer at the current (layer-relative)
 * frame. Coordinates are normalized (0..1) with a center anchor, so the same
 * composition adapts to any output aspect ratio.
 */
export function useLayerStyle(layer: MotionLayer): React.CSSProperties {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const [px, py] = sampleVec3(layer.transform?.position, frame, fps, [0.5, 0.5, 0]);
  const [sx, sy] = sampleVec3(layer.transform?.scale, frame, fps, [1, 1, 1]);
  const [, , rz] = sampleVec3(layer.transform?.rotation, frame, fps, [0, 0, 0]);
  const opacity = sampleNumber(layer.opacity, frame, fps, 1);

  return {
    position: 'absolute',
    left: `${px * 100}%`,
    top: `${py * 100}%`,
    transform: `translate(-50%, -50%) scale(${sx}, ${sy}) rotate(${rz}deg)`,
    opacity,
  };
}
