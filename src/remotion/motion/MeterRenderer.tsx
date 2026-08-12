import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';
import type { MeterLayer } from '../../lib/motion/ir/types';
import { COLORS, FONT_DISPLAY } from '../theme';
import { sampleVec3 } from './anim/resolveAnimated';

/**
 * Animated data widget — the vault's progress bars, meter gauges, and counters.
 *  • bar     — a labeled horizontal progress fill ("4. BECOME SKILLED", "70%")
 *  • gauge   — a vertical red→green fill meter ("CONFIDENCE")
 *  • counter — a big number that counts from `from` to `value` (up or down)
 * All animation is driven by the layer-relative frame, so renders are stable and
 * golden-testable.
 */

const INK = 'rgba(0,0,0,0.82)';

/** Shared thick text outline so a label reads over any footage. */
const outlined = (strokePx: number): React.CSSProperties => ({
  WebkitTextStroke: `${strokePx}px ${INK}`,
  paintOrder: 'stroke fill',
  textShadow: '0 4px 16px rgba(0,0,0,0.6)',
});

export const MeterRenderer: React.FC<{ layer: MeterLayer }> = ({ layer }) => {
  const { width: W, height: H, fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const t = frame / fps;

  const [px, py] = sampleVec3(layer.transform?.position, frame, fps, [0.5, 0.5, 0]);
  const accent = layer.color ?? COLORS.accent;
  const track = layer.trackColor ?? 'rgba(255,255,255,0.16)';
  const fillIn = layer.fillIn ?? 0.9;

  // Spring-ish ease so the fill snaps in with life.
  const prog = interpolate(t, [0, Math.max(0.05, fillIn)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  // Pop-in for the whole widget.
  const pop = interpolate(t, [0, 0.28], [0.7, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(2)) });
  const appear = interpolate(t, [0, 0.18], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  if (layer.variant === 'counter') {
    const from = layer.from ?? 0;
    const cur = from + (layer.value - from) * prog;
    const dec = layer.decimals ?? 0;
    const shown = cur.toFixed(dec);
    const size = Math.round(W * 0.14);
    return (
      <div style={{ position: 'absolute', left: `${px * 100}%`, top: `${py * 100}%`, transform: `translate(-50%,-50%) scale(${pop})`, opacity: appear, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 900, fontSize: size, color: '#fff', lineHeight: 1, ...outlined(Math.round(size * 0.055)) }}>
          {shown}
          {layer.suffix ?? ''}
        </div>
        {layer.label ? (
          <div style={{ marginTop: H * 0.012, fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: Math.round(W * 0.028), letterSpacing: 2, color: accent, textTransform: 'uppercase', ...outlined(Math.round(W * 0.028 * 0.06)) }}>{layer.label}</div>
        ) : null}
      </div>
    );
  }

  if (layer.variant === 'gauge') {
    const barW = Math.round(W * 0.032);
    const barH = Math.round(H * 0.5);
    const fillH = Math.max(0, Math.min(1, layer.value)) * prog * barH;
    return (
      <div style={{ position: 'absolute', left: `${px * 100}%`, top: `${py * 100}%`, transform: `translate(-50%,-50%) scale(${pop})`, opacity: appear, display: 'flex', alignItems: 'center', gap: W * 0.012 }}>
        {layer.label ? (
          <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontFamily: FONT_DISPLAY, fontWeight: 900, fontSize: Math.round(W * 0.032), letterSpacing: 3, color: '#fff', textTransform: 'uppercase', ...outlined(Math.round(W * 0.032 * 0.06)) }}>{layer.label}</div>
        ) : null}
        <div style={{ position: 'relative', width: barW, height: barH, borderRadius: barW, background: track, boxShadow: '0 8px 26px rgba(0,0,0,0.5), inset 0 0 0 3px rgba(0,0,0,0.35)' }}>
          <div style={{ position: 'absolute', left: 0, bottom: 0, width: '100%', height: fillH, borderRadius: barW, background: 'linear-gradient(0deg, #ff375f 0%, #ffd60a 55%, #34d399 100%)', boxShadow: '0 0 22px rgba(52,211,153,0.55)' }} />
          {/* glossy tip */}
          <div style={{ position: 'absolute', left: '50%', bottom: fillH, width: barW * 1.55, height: barW * 1.55, transform: 'translate(-50%, 50%)', borderRadius: '50%', background: '#fff', boxShadow: '0 0 16px rgba(255,255,255,0.7)', opacity: fillH > 2 ? 1 : 0 }} />
        </div>
      </div>
    );
  }

  // bar (horizontal, labeled)
  const barW = Math.round(W * 0.34);
  const barH = Math.round(H * 0.03);
  const pct = Math.max(0, Math.min(1, layer.value));
  const fillW = pct * prog * barW;
  const labelSize = Math.round(W * 0.026);
  return (
    <div style={{ position: 'absolute', left: `${px * 100}%`, top: `${py * 100}%`, transform: `translate(-50%,-50%) scale(${pop})`, opacity: appear, width: barW, display: 'flex', flexDirection: 'column', gap: H * 0.012 }}>
      {(layer.label || layer.suffix != null) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          {layer.label ? (
            <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: labelSize, letterSpacing: 1, color: '#fff', textTransform: 'uppercase', ...outlined(Math.round(labelSize * 0.06)) }}>{layer.label}</span>
          ) : <span />}
          <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 900, fontSize: Math.round(labelSize * 1.25), color: accent, ...outlined(Math.round(labelSize * 0.07)) }}>
            {Math.round(pct * prog * 100)}
            {layer.suffix ?? '%'}
          </span>
        </div>
      )}
      <div style={{ position: 'relative', width: barW, height: barH, borderRadius: barH, background: track, boxShadow: '0 6px 20px rgba(0,0,0,0.45), inset 0 0 0 2px rgba(0,0,0,0.3)' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: fillW, borderRadius: barH, background: `linear-gradient(90deg, ${accent}, #fff2)`, boxShadow: `0 0 18px ${accent}88` }} />
      </div>
    </div>
  );
};
