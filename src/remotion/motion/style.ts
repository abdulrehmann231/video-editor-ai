import type React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import type { MotionLayer } from '../../lib/motion/ir/types';
import { sampleNumber, sampleVec3 } from './anim/resolveAnimated';
import { cssBlendMode, maskDecoration } from './decorations';

/**
 * CSS decorations (blend mode + mask) for a layer — frame-independent, so both
 * self-positioning layers (text/shape) and wrapper layers (video/group) can apply
 * them uniformly. Masks use clip-path (simple) or an SVG mask (inverted/feather).
 */
export function layerDecorations(layer: MotionLayer): React.CSSProperties {
  return { mixBlendMode: cssBlendMode(layer.blendMode), ...maskDecoration(layer.mask) };
}

/**
 * Compute the CSS transform/opacity (+ decorations) for a layer at the current
 * (layer-relative) frame. Coordinates are normalized (0..1) with a center
 * anchor, so the same composition adapts to any output aspect ratio.
 */
export function useLayerStyle(layer: MotionLayer, anchorX: 'left' | 'center' | 'right' = 'center'): React.CSSProperties {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const [px, py] = sampleVec3(layer.transform?.position, frame, fps, [0.5, 0.5, 0]);
  const [sx, sy] = sampleVec3(layer.transform?.scale, frame, fps, [1, 1, 1]);
  const [, , rz] = sampleVec3(layer.transform?.rotation, frame, fps, [0, 0, 0]);
  const opacity = sampleNumber(layer.opacity, frame, fps, 1);

  // Anchor the element's box horizontally so left/right-aligned text stacks
  // cleanly at a fixed x (position.x is the left edge / right edge / center).
  const tx = anchorX === 'left' ? '0%' : anchorX === 'right' ? '-100%' : '-50%';

  return {
    position: 'absolute',
    left: `${px * 100}%`,
    top: `${py * 100}%`,
    transform: `translate(${tx}, -50%) scale(${sx}, ${sy}) rotate(${rz}deg)`,
    opacity,
    ...layerDecorations(layer),
  };
}
