import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import type { StatCalloutOverlay } from '../types';

/**
 * Scale-pop stat/metric badges — a big figure + label that pops in, matching the
 * vault's finance "stat callout" references.
 */
export const StatCallouts: React.FC<{ items: StatCalloutOverlay[]; fps: number }> = ({ items, fps }) => (
  <>
    {items.map((s) => {
      const from = Math.round(s.start * fps);
      const durationInFrames = Math.max(1, Math.round((s.end - s.start) * fps));
      return (
        <Sequence key={s.id} from={from} durationInFrames={durationInFrames}>
          <StatBadge item={s} />
        </Sequence>
      );
    })}
  </>
);

const StatBadge: React.FC<{ item: StatCalloutOverlay }> = ({ item }) => {
  const frame = useCurrentFrame();
  const { fps, width, durationInFrames } = useVideoConfig();

  const pop = spring({ frame, fps, config: { damping: 12, mass: 0.6, stiffness: 180 } });
  const exit = interpolate(frame, [durationInFrames - 7, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const scale = 0.6 + 0.4 * pop;
  const opacity = Math.min(1, pop * 1.4) * exit;

  const corner = item.position === 'corner';
  const valueSize = Math.round(width * (corner ? 0.05 : 0.09));
  const labelSize = Math.round(width * (corner ? 0.018 : 0.026));

  return (
    <AbsoluteFill
      style={{
        justifyContent: corner ? 'flex-start' : 'center',
        alignItems: corner ? 'flex-end' : 'center',
        padding: corner ? '7% 5%' : 0,
      }}
    >
      <div
        style={{
          transform: `scale(${scale})`,
          opacity,
          textAlign: 'center',
          padding: `${valueSize * 0.28}px ${valueSize * 0.45}px`,
          borderRadius: 20,
          background: 'linear-gradient(135deg, rgba(37,99,235,0.96), rgba(30,64,175,0.96))',
          boxShadow: '0 16px 50px rgba(0,0,0,0.45)',
          border: '2px solid rgba(255,255,255,0.25)',
          fontFamily: 'Inter, Arial, sans-serif',
        }}
      >
        <div style={{ color: 'white', fontWeight: 900, fontSize: valueSize, lineHeight: 1, letterSpacing: -1 }}>
          {item.value}
        </div>
        {item.label && (
          <div
            style={{
              color: '#dbe7ff',
              fontWeight: 700,
              fontSize: labelSize,
              marginTop: valueSize * 0.14,
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}
          >
            {item.label}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
