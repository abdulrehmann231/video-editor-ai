import React from 'react';
import { AbsoluteFill, OffthreadVideo, useCurrentFrame, interpolate } from 'remotion';
import type { ZoomOverlay } from '../types';

const ORIGIN: Record<ZoomOverlay['focus'], string> = {
  center: '50% 50%',
  face: '50% 38%',
  left: '30% 50%',
  right: '70% 50%',
  top: '50% 25%',
};

/**
 * Base video with animated punch-in zooms. At any frame, the active zoom (if
 * any) drives a smooth scale in→hold→out. Non-overlapping zooms assumed; if they
 * overlap, the first active one wins.
 */
export const ZoomLayer: React.FC<{ src: string; fps: number; zooms: ZoomOverlay[] }> = ({
  src,
  fps,
  zooms,
}) => {
  const frame = useCurrentFrame();
  const t = frame / fps;

  const active = zooms.find((z) => t >= z.start && t <= z.end);
  let scale = 1;
  let origin = '50% 50%';
  if (active) {
    const ramp = Math.min(0.25, (active.end - active.start) / 3);
    scale = interpolate(
      t,
      [active.start, active.start + ramp, active.end - ramp, active.end],
      [1, active.scale, active.scale, 1],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
    );
    origin = ORIGIN[active.focus] ?? '50% 50%';
  }

  return (
    <AbsoluteFill style={{ backgroundColor: 'black', overflow: 'hidden' }}>
      <AbsoluteFill style={{ transform: `scale(${scale})`, transformOrigin: origin }}>
        <OffthreadVideo src={src} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
