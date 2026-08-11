import React from 'react';
import { useVideoConfig } from 'remotion';
import type { ThreeLayer } from '../../lib/motion/ir/types';
import { Three3DLayer } from '../components/three/Three3DLayer';

/** Render an IR three (3D) layer by reusing the existing Three3DLayer component
 * (single item; LayerRenderer already provides the Sequence window). Needs a GL
 * backend — renderMotion sets chromiumOptions:{gl:'swangle'} when three is present. */
export const ThreeRenderer: React.FC<{ layer: ThreeLayer }> = ({ layer }) => {
  const { fps } = useVideoConfig();
  return (
    <Three3DLayer
      fps={fps}
      items={[{ id: layer.id, start: 0, end: layer.duration, template: layer.template, value: layer.value, label: layer.label }]}
    />
  );
};
