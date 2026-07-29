import React from 'react';
import { AbsoluteFill } from 'remotion';
import type { EditProps } from './types';
import { ZoomLayer } from './components/ZoomLayer';
import { BrollLayer } from './components/BrollLayer';
import { Captions } from './components/Captions';
import { LowerThirds } from './components/LowerThirds';

/**
 * The final composite: cut video (with punch-in zooms) at the base, then b-roll,
 * lower thirds, and word captions layered on top — the "After-Effects-style"
 * pass over the deterministic cut.
 */
export const Edit: React.FC<EditProps> = ({ videoSrc, fps, zooms, brolls, lowerThirds, captions }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      <ZoomLayer src={videoSrc} fps={fps} zooms={zooms} />
      <BrollLayer brolls={brolls} fps={fps} />
      <LowerThirds items={lowerThirds} fps={fps} />
      <Captions captions={captions} fps={fps} />
    </AbsoluteFill>
  );
};
