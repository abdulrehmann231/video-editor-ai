import React from 'react';
import { useVideoConfig } from 'remotion';
import type { LottieLayer } from '../../lib/motion/ir/types';
import { LottieLayer as LottieOverlayLayer } from '../components/LottieLayer';

/** Render an IR lottie layer by reusing the existing bundled-lottie component
 * (single item; LayerRenderer already provides the Sequence window). */
export const LottieRenderer: React.FC<{ layer: LottieLayer }> = ({ layer }) => {
  const { fps } = useVideoConfig();
  return (
    <LottieOverlayLayer
      fps={fps}
      lotties={[{ id: layer.id, start: 0, end: layer.duration, template: layer.template, position: layer.position }]}
    />
  );
};
