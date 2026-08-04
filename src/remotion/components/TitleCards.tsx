import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import type { TitleCardOverlay } from '../types';
import { FONT_DISPLAY, FONT_BODY, COLORS } from '../theme';

/**
 * Full-screen intro / CTA cards overlaid on the footage (no added time). A dark
 * gradient scrim + big kinetic heading; CTA adds an accent bar.
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

  const enter = spring({ frame, fps, config: { damping: 18, mass: 0.7, stiffness: 120 } });
  const exit = interpolate(frame, [durationInFrames - 9, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const opacity = Math.min(1, enter * 1.3) * exit;
  const y = interpolate(enter, [0, 1], [40, 0]);
  const isCta = item.variant === 'cta';
  const headingSize = Math.round(width * (isCta ? 0.062 : 0.075));
  const subSize = Math.round(width * 0.026);

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        background: isCta
          ? 'radial-gradient(circle at 50% 60%, rgba(10,16,30,0.6), rgba(6,10,20,0.85))'
          : 'linear-gradient(180deg, rgba(6,10,20,0.35), rgba(6,10,20,0.7))',
        opacity,
      }}
    >
      <div style={{ textAlign: 'center', transform: `translateY(${y}px)`, padding: '0 8%' }}>
        {isCta && (
          <div
            style={{
              width: 72,
              height: 6,
              background: `linear-gradient(90deg, ${COLORS.accent}, ${COLORS.accentAlt})`,
              borderRadius: 999,
              margin: '0 auto 26px',
              boxShadow: `0 0 20px ${COLORS.accent}88`,
            }}
          />
        )}
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            color: COLORS.white,
            fontSize: headingSize,
            lineHeight: 1.02,
            letterSpacing: 0.5,
            textTransform: 'uppercase',
            textShadow: '0 10px 40px rgba(0,0,0,0.65)',
          }}
        >
          {item.heading}
        </div>
        {item.sub && (
          <div
            style={{
              fontFamily: FONT_BODY,
              color: '#cdd8ec',
              fontWeight: 700,
              fontSize: subSize,
              marginTop: 20,
              letterSpacing: 1,
            }}
          >
            {item.sub}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
