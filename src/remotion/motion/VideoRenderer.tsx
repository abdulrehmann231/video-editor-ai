import React from 'react';
import { AbsoluteFill, OffthreadVideo, useCurrentFrame, useVideoConfig } from 'remotion';
import type { VideoLayer, ImageLayer } from '../../lib/motion/ir/types';
import { sampleNumber, sampleVec3 } from './anim/resolveAnimated';
import { layerDecorations } from './style';

/**
 * Render an IR video/image layer. The source may be a direct `src` (e.g. a
 * resolved Pexels clip); if neither src nor a resolved asset exists yet, the
 * layer renders nothing (b-roll resolution is a later phase).
 */
export const VideoRenderer: React.FC<{ layer: VideoLayer | ImageLayer }> = ({ layer }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const src = layer.src;
  if (!src) return null;

  const [px, py] = sampleVec3(layer.transform?.position, frame, fps, [0.5, 0.5, 0]);
  const [sx, sy] = sampleVec3(layer.transform?.scale, frame, fps, [1, 1, 1]);
  const opacity = sampleNumber(layer.opacity, frame, fps, 1);
  const fit = layer.fit ?? 'cover';

  return (
    <AbsoluteFill style={{ opacity, ...layerDecorations(layer) }}>
      <div
        style={{
          position: 'absolute',
          left: `${px * 100}%`,
          top: `${py * 100}%`,
          width: `${sx * 100}%`,
          height: `${sy * 100}%`,
          transform: 'translate(-50%, -50%)',
          overflow: 'hidden',
        }}
      >
        {layer.type === 'video' ? (
          <OffthreadVideo src={src} style={{ width: '100%', height: '100%', objectFit: fit }} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: fit }} />
        )}
      </div>
    </AbsoluteFill>
  );
};
