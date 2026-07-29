import React from 'react';
import { AbsoluteFill, Sequence, OffthreadVideo, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import type { BrollOverlay } from '../types';

/**
 * Stock b-roll overlays. `full` covers the frame; `pip` is a rounded
 * picture-in-picture in the top-right. Unresolved clips (no src) are skipped.
 */
export const BrollLayer: React.FC<{ brolls: BrollOverlay[]; fps: number }> = ({ brolls, fps }) => (
  <>
    {brolls
      .filter((b) => b.src)
      .map((b) => {
        const from = Math.round(b.start * fps);
        const durationInFrames = Math.max(1, Math.round((b.end - b.start) * fps));
        return (
          <Sequence key={b.id} from={from} durationInFrames={durationInFrames}>
            {b.layout === 'pip' ? <BrollPip src={b.src!} /> : <BrollFull src={b.src!} />}
          </Sequence>
        );
      })}
  </>
);

const BrollFull: React.FC<{ src: string }> = ({ src }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const opacity = interpolate(
    frame,
    [0, 6, durationInFrames - 6, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  return (
    <AbsoluteFill style={{ opacity }}>
      <OffthreadVideo src={src} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </AbsoluteFill>
  );
};

const BrollPip: React.FC<{ src: string }> = ({ src }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width } = useVideoConfig();
  const opacity = interpolate(
    frame,
    [0, 6, durationInFrames - 6, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const w = Math.round(width * 0.38);
  return (
    <AbsoluteFill style={{ opacity }}>
      <div
        style={{
          position: 'absolute',
          top: '6%',
          right: '5%',
          width: w,
          aspectRatio: '16 / 9',
          borderRadius: 14,
          overflow: 'hidden',
          boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
          border: '3px solid rgba(255,255,255,0.85)',
        }}
      >
        <OffthreadVideo src={src} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    </AbsoluteFill>
  );
};
