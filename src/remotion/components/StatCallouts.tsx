import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import type { StatCalloutOverlay } from '../types';
import { FONT_DISPLAY, FONT_BODY, COLORS } from '../theme';

/**
 * Scale-pop stat/metric badge — a glassy card with the figure counting up and a
 * glowing accent, matching the vault's finance "stat callout" references.
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

/** Split "$1.2M", "+40%", "3x", "1,234" into prefix / number / suffix for count-up. */
function splitNumeric(value: string): { prefix: string; num: number; suffix: string; decimals: number } | null {
  const m = value.match(/^([^\d-]*-?)([\d,]+(?:\.\d+)?)(.*)$/);
  if (!m) return null;
  const raw = m[2].replace(/,/g, '');
  const num = parseFloat(raw);
  if (!Number.isFinite(num)) return null;
  const decimals = raw.includes('.') ? raw.split('.')[1].length : 0;
  return { prefix: m[1], num, suffix: m[3], decimals };
}

const StatBadge: React.FC<{ item: StatCalloutOverlay }> = ({ item }) => {
  const frame = useCurrentFrame();
  const { fps, width, durationInFrames } = useVideoConfig();

  const pop = spring({ frame, fps, config: { damping: 12, mass: 0.6, stiffness: 170 } });
  const exit = interpolate(frame, [durationInFrames - 8, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const scale = 0.72 + 0.28 * pop;
  const opacity = Math.min(1, pop * 1.5) * exit;

  const corner = item.position === 'corner';
  const valueSize = Math.round(width * (corner ? 0.055 : 0.1));
  const labelSize = Math.round(width * (corner ? 0.017 : 0.024));

  // count-up over ~0.5s
  const countT = interpolate(frame, [0, Math.round(fps * 0.5)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const parts = splitNumeric(item.value);
  const display = parts
    ? `${parts.prefix}${(parts.num * countT).toLocaleString('en-US', {
        minimumFractionDigits: parts.decimals,
        maximumFractionDigits: parts.decimals,
      })}${parts.suffix}`
    : item.value;

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
          padding: `${valueSize * 0.34}px ${valueSize * 0.55}px`,
          borderRadius: valueSize * 0.32,
          background: 'linear-gradient(160deg, rgba(22,28,42,0.86), rgba(12,16,26,0.86))',
          backdropFilter: 'blur(10px)',
          boxShadow: `0 24px 70px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08) inset, 0 0 60px ${COLORS.blue}44`,
          border: `1px solid ${COLORS.blue}66`,
        }}
      >
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            color: COLORS.white,
            fontSize: valueSize,
            lineHeight: 1,
            letterSpacing: 0.5,
            textShadow: `0 0 24px ${COLORS.accent}66, 0 6px 24px rgba(0,0,0,0.5)`,
            background: `linear-gradient(180deg, #fff, ${COLORS.accent})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          {display}
        </div>
        {item.label && (
          <div
            style={{
              fontFamily: FONT_BODY,
              color: '#c6d2ea',
              fontWeight: 700,
              fontSize: labelSize,
              marginTop: valueSize * 0.16,
              textTransform: 'uppercase',
              letterSpacing: 2,
            }}
          >
            {item.label}
          </div>
        )}
        <div
          style={{
            height: Math.max(3, valueSize * 0.05),
            width: `${40 + 60 * pop}%`,
            margin: `${valueSize * 0.16}px auto 0`,
            borderRadius: 999,
            background: `linear-gradient(90deg, ${COLORS.blue}, ${COLORS.accentAlt})`,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
