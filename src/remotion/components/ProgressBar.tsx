import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';

/** Thin brand-gradient progress bar pinned to the bottom of the frame. */
export const ProgressBar: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames, height } = useVideoConfig();
  const pct = Math.min(1, frame / Math.max(1, durationInFrames - 1));
  const barH = Math.max(4, Math.round(height * 0.008));

  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end' }}>
      <div style={{ width: '100%', height: barH, background: 'rgba(255,255,255,0.14)' }}>
        <div
          style={{
            width: `${pct * 100}%`,
            height: '100%',
            background: 'linear-gradient(90deg,#6ea8fe,#7ef0c2)',
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
