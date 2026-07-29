import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import type { TitleCardOverlay } from '../types';

/**
 * Full-screen intro / CTA cards overlaid on the footage (no added time). Intro
 * uses a dark scrim + big heading; CTA adds an accent bar. Both animate in/out.
 */
export const TitleCards: React.FC<{ items: TitleCardOverlay[]; fps: number }> = ({ items, fps }) => (
  <>
    {items.map((tc) => {
      const from = Math.round(tc.start * fps);
      const durationInFrames = Math.max(1, Math.round((tc.end - tc.start) * fps));
      return (
        <Sequence key={tc.id} from={from} durationInFrames={durationInFrames}>
          <TitleCard item={tc} />
        </Sequence>
      );
    })}
  </>
);

const TitleCard: React.FC<{ item: TitleCardOverlay }> = ({ item }) => {
  const frame = useCurrentFrame();
  const { fps, width, durationInFrames } = useVideoConfig();

  const enter = spring({ frame, fps, config: { damping: 200 } });
  const exit = interpolate(frame, [durationInFrames - 8, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const opacity = Math.min(enter, exit);
  const y = interpolate(enter, [0, 1], [30, 0]);

  const isCta = item.variant === 'cta';
  const headingSize = Math.round(width * (isCta ? 0.06 : 0.07));
  const subSize = Math.round(width * 0.028);

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        background: isCta ? 'rgba(6,10,20,0.72)' : 'rgba(6,10,20,0.55)',
        opacity,
      }}
    >
      <div style={{ textAlign: 'center', transform: `translateY(${y}px)`, padding: '0 8%', fontFamily: 'Inter, Arial, sans-serif' }}>
        {isCta && (
          <div
            style={{
              width: 64,
              height: 6,
              background: 'linear-gradient(90deg,#6ea8fe,#7ef0c2)',
              borderRadius: 999,
              margin: '0 auto 22px',
            }}
          />
        )}
        <div
          style={{
            color: 'white',
            fontWeight: 900,
            fontSize: headingSize,
            lineHeight: 1.05,
            letterSpacing: -0.5,
            textShadow: '0 6px 30px rgba(0,0,0,0.6)',
          }}
        >
          {item.heading}
        </div>
        {item.sub && (
          <div style={{ color: '#c8d3e6', fontWeight: 600, fontSize: subSize, marginTop: 18 }}>{item.sub}</div>
        )}
      </div>
    </AbsoluteFill>
  );
};
