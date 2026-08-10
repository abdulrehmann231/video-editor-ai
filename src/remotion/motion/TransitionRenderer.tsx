import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import type { TransitionLayer } from '../../lib/motion/ir/types';

/**
 * Full-frame scene transitions for the Motion path — ported from the legacy
 * Transitions component so the IR renderer matches it: flash, glitch (RGB split +
 * jitter bars), zoom-blur (radial + scale + blur). Deterministic (frame-driven,
 * no randomness). Frame + duration are layer-relative (the LayerRenderer wraps
 * this in the layer's Sequence).
 */

// Triangular envelope 0→1→0 across the layer's duration.
function envelope(frame: number, dur: number): number {
  const mid = dur / 2;
  return interpolate(frame, [0, mid, dur], [0, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
}

export const TransitionRenderer: React.FC<{ layer: TransitionLayer }> = ({ layer }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const dur = Math.max(1, Math.round(layer.duration * fps));
  const o = envelope(frame, dur);

  if (layer.variant === 'flash') {
    return <AbsoluteFill style={{ backgroundColor: 'white', opacity: o * 0.85 }} />;
  }

  if (layer.variant === 'zoom_blur') {
    const scale = 1 + o * 0.15;
    return (
      <AbsoluteFill
        style={{
          opacity: o,
          transform: `scale(${scale})`,
          background: 'radial-gradient(circle at center, rgba(255,255,255,0) 30%, rgba(255,255,255,0.55) 100%)',
          backdropFilter: `blur(${o * 6}px)`,
        }}
      />
    );
  }

  // glitch — deterministic jitter from the frame index.
  const j = ((frame * 2654435761) % 100) / 100;
  const dx = (j - 0.5) * width * 0.04 * o;
  const barY = Number((j * 100).toFixed(0));
  return (
    <AbsoluteFill style={{ opacity: o }}>
      <AbsoluteFill style={{ transform: `translateX(${dx}px)`, background: 'rgba(255,0,60,0.18)', mixBlendMode: 'screen' }} />
      <AbsoluteFill style={{ transform: `translateX(${-dx}px)`, background: 'rgba(0,200,255,0.18)', mixBlendMode: 'screen' }} />
      <div style={{ position: 'absolute', top: `${barY}%`, left: 0, right: 0, height: '4%', background: 'rgba(255,255,255,0.5)' }} />
      <div style={{ position: 'absolute', top: `${(100 - barY) % 100}%`, left: 0, right: 0, height: '2%', background: 'rgba(0,0,0,0.5)' }} />
    </AbsoluteFill>
  );
};
