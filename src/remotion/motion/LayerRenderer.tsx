import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
import type { GroupLayer, MotionLayer } from '../../lib/motion/ir/types';
import { TextRenderer } from './TextRenderer';
import { ShapeRenderer } from './ShapeRenderer';
import { VideoRenderer } from './VideoRenderer';
import { TransitionRenderer } from './TransitionRenderer';
import { sampleNumber, sampleVec3 } from './anim/resolveAnimated';
import { layerDecorations } from './style';

/** A group applies its own transform/opacity/mask to a full-frame wrapper, then
 * renders its child layers (which position themselves within it). A mask clips
 * the children (overflow hidden). */
const GroupRenderer: React.FC<{ layer: GroupLayer }> = ({ layer }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = sampleNumber(layer.opacity, frame, fps, 1);
  const [sx, sy] = sampleVec3(layer.transform?.scale, frame, fps, [1, 1, 1]);
  const deco = layerDecorations(layer);
  return (
    <AbsoluteFill
      style={{
        opacity,
        transform: `scale(${sx}, ${sy})`,
        transformOrigin: 'center',
        overflow: deco.clipPath ? 'hidden' : undefined,
        ...deco,
      }}
    >
      {layer.children.map((c) => (
        <LayerRenderer key={c.id} layer={c} />
      ))}
    </AbsoluteFill>
  );
};

/**
 * Generic renderer for any IR layer. Wraps the layer in a Sequence for its
 * [start, start+duration) window, then dispatches by type. This is the single
 * component that replaces the per-effect components of the "Edit" composition.
 */
export const LayerRenderer: React.FC<{ layer: MotionLayer }> = ({ layer }) => {
  const { fps } = useVideoConfig();
  if (layer.visible === false) return null;

  const from = Math.max(0, Math.round(layer.start * fps));
  const durationInFrames = Math.max(1, Math.round(layer.duration * fps));

  let inner: React.ReactNode = null;
  switch (layer.type) {
    case 'text':
      inner = <TextRenderer layer={layer} />;
      break;
    case 'shape':
      inner = <ShapeRenderer layer={layer} />;
      break;
    case 'video':
    case 'image':
      inner = <VideoRenderer layer={layer} />;
      break;
    case 'group':
      inner = <GroupRenderer layer={layer} />;
      break;
    case 'transition':
      inner = <TransitionRenderer layer={layer} />;
      break;
    default:
      inner = null;
  }

  return (
    <Sequence from={from} durationInFrames={durationInFrames} layout="none">
      {inner}
    </Sequence>
  );
};
