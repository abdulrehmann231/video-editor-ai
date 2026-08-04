import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import type { LowerThirdOverlay } from '../types';
import { FONT_DISPLAY, FONT_BODY, COLORS } from '../theme';

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
  const exit = interpolate(frame, [durationInFrames - 9, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const opacity = Math.min(enter, exit);
  const x = interpolate(enter, [0, 1], [-60, 0]);
  const accentH = interpolate(enter, [0, 1], [0, 1]); // accent bar grows in

  const titleSize = Math.round(width * 0.03);
  const subSize = Math.round(width * 0.018);

  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'flex-start', padding: '0 0 9% 5%' }}>
      <div
        style={{
          opacity,
          transform: `translateX(${x}px)`,
          display: 'flex',
          alignItems: 'stretch',
          gap: titleSize * 0.5,
          background: 'linear-gradient(120deg, rgba(16,22,36,0.82), rgba(10,14,24,0.62))',
          backdropFilter: 'blur(12px)',
          borderRadius: titleSize * 0.5,
          padding: `${titleSize * 0.5}px ${titleSize * 0.9}px`,
          boxShadow: '0 18px 50px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06) inset',
        }}
      >
        {/* animated accent bar */}
        <div
          style={{
            width: Math.max(4, titleSize * 0.14),
            alignSelf: 'stretch',
            borderRadius: 999,
            transformOrigin: 'bottom',
            transform: `scaleY(${accentH})`,
            background: `linear-gradient(180deg, ${COLORS.accent}, ${COLORS.accentAlt})`,
            boxShadow: `0 0 18px ${COLORS.accent}88`,
          }}
        />
        <div>
          <div
            style={{
              fontFamily: FONT_DISPLAY,
              color: COLORS.white,
              fontSize: titleSize,
              lineHeight: 1.05,
              letterSpacing: 0.5,
              textShadow: '0 2px 10px rgba(0,0,0,0.5)',
            }}
          >
            {item.title}
          </div>
          {item.subtitle && (
            <div
              style={{
                fontFamily: FONT_BODY,
                color: '#b9c6df',
                fontWeight: 600,
                fontSize: subSize,
                marginTop: titleSize * 0.14,
                textTransform: 'uppercase',
                letterSpacing: 1.5,
              }}
            >
              {item.subtitle}
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};
