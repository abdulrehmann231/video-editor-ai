import React from 'react';
import { AbsoluteFill } from 'remotion';
import type { EditProps } from './types';
import { ZoomLayer } from './components/ZoomLayer';
import { BrollLayer } from './components/BrollLayer';
import { Captions } from './components/Captions';
import { LowerThirds } from './components/LowerThirds';
import { TitleCards } from './components/TitleCards';
import { ProgressBar } from './components/ProgressBar';
import { StatCallouts } from './components/StatCallouts';
import { Transitions } from './components/Transitions';
import { LottieLayer } from './components/LottieLayer';
import { Three3DLayer } from './components/three/Three3DLayer';

/**
 * The final composite: cut video (with punch-in zooms) at the base, then b-roll,
 * lower thirds, word captions, intro/CTA title cards, and a progress bar — the
 * "After-Effects-style" pass over the deterministic cut. Works for both
 * landscape and 9:16 (the base is cover-fit to the frame).
 */
export const Edit: React.FC<EditProps> = ({
  videoSrc,
  fps,
  zooms,
  brolls,
  lowerThirds,
  captions,
  titleCards,
  statCallouts,
  transitions,
  lotties,
  threes,
  progressBar,
}) => {
  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      <ZoomLayer src={videoSrc} fps={fps} zooms={zooms} />
      <BrollLayer brolls={brolls} fps={fps} />
      <Three3DLayer items={threes} fps={fps} />
      <StatCallouts items={statCallouts} fps={fps} />
      <LottieLayer lotties={lotties} fps={fps} />
      <LowerThirds items={lowerThirds} fps={fps} />
      <Captions captions={captions} fps={fps} />
      <TitleCards items={titleCards} fps={fps} />
      <Transitions items={transitions} fps={fps} />
      {progressBar && <ProgressBar />}
    </AbsoluteFill>
  );
};
