import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import type { LowerThirdOverlay } from '../types';

export const LowerThirds: React.FC<{ items: LowerThirdOverlay[]; fps: number }> = ({ items, fps }) => (
  <>
    {items.map((lt) => {
      const from = Math.round(lt.start * fps);
      const durationInFrames = Math.max(1, Math.round((lt.end - lt.start) * fps));
      return (
        <Sequence key={lt.id} from={from} durationInFrames={durationInFrames}>
          <LowerThird item={lt} />
        </Sequence>
      );
    })}
  </>
);

const LowerThird: React.FC<{ item: LowerThirdOverlay }> = ({ item }) => {
  const frame = useCurrentFrame();
  const { fps, width, durationInFrames } = useVideoConfig();

  const enter = spring({ frame, fps, config: { damping: 200 } });
  const exit = interpolate(frame, [durationInFrames - 8, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const opacity = Math.min(enter, exit);
  const x = interpolate(enter, [0, 1], [-40, 0]);

  const titleSize = Math.round(width * 0.032);
  const subSize = Math.round(width * 0.021);

  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'flex-start', padding: '0 0 8% 5%' }}>
      <div style={{ opacity, transform: `translateX(${x}px)`, fontFamily: 'Inter, Arial, sans-serif' }}>
        <div
          style={{
            display: 'inline-block',
            background: 'linear-gradient(90deg, #2563eb, #1e40af)',
            color: 'white',
            fontWeight: 800,
            fontSize: titleSize,
            padding: '8px 18px',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
          }}
        >
          {item.title}
        </div>
        {item.subtitle && (
          <div
            style={{
              marginTop: 6,
              display: 'inline-block',
              background: 'rgba(0,0,0,0.72)',
              color: '#e7ecf3',
              fontWeight: 600,
              fontSize: subSize,
              padding: '6px 14px',
              borderRadius: 6,
            }}
          >
            {item.subtitle}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
