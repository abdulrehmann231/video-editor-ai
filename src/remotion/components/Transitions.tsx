import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import type { TransitionOverlay } from '../types';

/**
 * Brief full-frame transition overlays at scene boundaries: flash, glitch, or
 * zoom-blur. Kept short and deterministic (frame-driven, no randomness).
 */
export const Transitions: React.FC<{ items: TransitionOverlay[]; fps: number }> = ({ items, fps }) => (
  <>
    {items.map((t) => {
      const from = Math.round(t.start * fps);
      const durationInFrames = Math.max(1, Math.round((t.end - t.start) * fps));
      return (
        <Sequence key={t.id} from={from} durationInFrames={durationInFrames}>
          {t.variant === 'glitch' ? <Glitch /> : t.variant === 'zoom_blur' ? <ZoomBlur /> : <Flash />}
        </Sequence>
      );
    })}
  </>
);

// Triangular envelope 0→1→0 across the sequence.
function envelope(frame: number, dur: number): number {
  const mid = dur / 2;
  return interpolate(frame, [0, mid, dur], [0, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
}

const Flash: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const o = envelope(frame, durationInFrames);
  return <AbsoluteFill style={{ backgroundColor: 'white', opacity: o * 0.85 }} />;
};

const ZoomBlur: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const o = envelope(frame, durationInFrames);
  const scale = 1 + o * 0.15;
  return (
    <AbsoluteFill
      style={{
        opacity: o,
        transform: `scale(${scale})`,
        background:
          'radial-gradient(circle at center, rgba(255,255,255,0) 30%, rgba(255,255,255,0.55) 100%)',
        backdropFilter: `blur(${o * 6}px)`,
      }}
    />
  );
};

const Glitch: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames, width } = useVideoConfig();
  const o = envelope(frame, durationInFrames);
  // deterministic jitter from the frame index
  const j = ((frame * 2654435761) % 100) / 100; // 0..1 pseudo-jitter
  const dx = (j - 0.5) * width * 0.04 * o;
  const barY = (j * 100).toFixed(0);
  return (
    <AbsoluteFill style={{ opacity: o }}>
      <AbsoluteFill style={{ transform: `translateX(${dx}px)`, background: 'rgba(255,0,60,0.18)', mixBlendMode: 'screen' }} />
      <AbsoluteFill style={{ transform: `translateX(${-dx}px)`, background: 'rgba(0,200,255,0.18)', mixBlendMode: 'screen' }} />
      <div style={{ position: 'absolute', top: `${barY}%`, left: 0, right: 0, height: '4%', background: 'rgba(255,255,255,0.5)' }} />
      <div style={{ position: 'absolute', top: `${(100 - Number(barY)) % 100}%`, left: 0, right: 0, height: '2%', background: 'rgba(0,0,0,0.5)' }} />
    </AbsoluteFill>
  );
};
