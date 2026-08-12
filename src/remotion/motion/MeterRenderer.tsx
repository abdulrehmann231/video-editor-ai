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
  // Portrait (9:16 Shorts): widen the narrow horizontal widgets + scale up labels.
  const portrait = H > W * 1.1;
  const uf = portrait ? 1.5 : 1;

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
          <div style={{ marginTop: H * 0.012, fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: Math.round(W * 0.028 * uf), letterSpacing: 2, color: accent, textTransform: 'uppercase', ...outlined(Math.round(W * 0.028 * 0.06)) }}>{layer.label}</div>
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
          <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontFamily: FONT_DISPLAY, fontWeight: 900, fontSize: Math.round(W * 0.032 * uf), letterSpacing: 3, color: '#fff', textTransform: 'uppercase', ...outlined(Math.round(W * 0.032 * 0.06)) }}>{layer.label}</div>
        ) : null}
        <div style={{ position: 'relative', width: barW, height: barH, borderRadius: barW, background: track, boxShadow: '0 8px 26px rgba(0,0,0,0.5), inset 0 0 0 3px rgba(0,0,0,0.35)' }}>
          <div style={{ position: 'absolute', left: 0, bottom: 0, width: '100%', height: fillH, borderRadius: barW, background: 'linear-gradient(0deg, #ff375f 0%, #ffd60a 55%, #34d399 100%)', boxShadow: '0 0 22px rgba(52,211,153,0.55)' }} />
          {/* glossy tip */}
          <div style={{ position: 'absolute', left: '50%', bottom: fillH, width: barW * 1.55, height: barW * 1.55, transform: 'translate(-50%, 50%)', borderRadius: '50%', background: '#fff', boxShadow: '0 0 16px rgba(255,255,255,0.7)', opacity: fillH > 2 ? 1 : 0 }} />
        </div>
      </div>
    );
  }

  if (layer.variant === 'timeline' || layer.variant === 'scale' || layer.variant === 'slider') {
    const Wd = Math.round(W * (portrait ? 0.86 : 0.46));
    const Hd = Math.round(H * (portrait ? 0.13 : 0.2));
    const knobR = Math.max(9, Math.round(W * 0.011 * uf));
    const left = knobR + 4;
    const right = Wd - knobR - 4;
    const trackW = right - left;
    const trackY = Hd * 0.5;
    const th = Math.max(6, Math.round(W * 0.009 * uf));
    const v = Math.max(0, Math.min(1, layer.value));
    const tickLabel = Math.max(10, Math.round(W * 0.016 * uf));
    const endLabel = Math.max(12, Math.round(W * 0.022 * uf));
    const ticks = layer.ticks ?? [];
    const kids: React.ReactNode[] = [];
    // track
    kids.push(<rect key="trk" x={left} y={trackY - th / 2} width={trackW} height={th} rx={th / 2} fill={track} />);

    if (layer.variant === 'timeline') {
      const fillW = trackW * v * prog;
      kids.push(<rect key="fil" x={left} y={trackY - th / 2} width={fillW} height={th} rx={th / 2} fill={accent} style={{ filter: `drop-shadow(0 0 10px ${accent}88)` }} />);
      const marks = ticks.length ? ticks : [];
      marks.forEach((tk, i) => {
        const x = left + trackW * Math.max(0, Math.min(1, tk.at));
        const st = 0.12 + i * 0.14;
        const dp = interpolate(t, [st, st + 0.3], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(2)) });
        const done = v * prog >= tk.at - 0.01;
        kids.push(<circle key={`d${i}`} cx={x} cy={trackY} r={knobR * dp} fill={done ? accent : '#0b0d12'} stroke={accent} strokeWidth={3} />);
        if (tk.label) kids.push(<text key={`t${i}`} x={x} y={trackY - knobR - tickLabel * 0.5} textAnchor="middle" fontFamily={FONT_DISPLAY} fontWeight={800} fontSize={tickLabel} fill="#fff" opacity={dp} style={outlined(Math.round(tickLabel * 0.07))}>{tk.label.toUpperCase()}</text>);
      });
    } else if (layer.variant === 'scale') {
      // axis ticks (evenly spaced if none provided)
      const marks = ticks.length ? ticks : Array.from({ length: 5 }, (_, i) => ({ at: i / 4, label: undefined as string | undefined }));
      marks.forEach((tk, i) => {
        const x = left + trackW * Math.max(0, Math.min(1, tk.at));
        kids.push(<line key={`tk${i}`} x1={x} y1={trackY - th} x2={x} y2={trackY + th} stroke="rgba(255,255,255,0.55)" strokeWidth={2} />);
        if (tk.label) kids.push(<text key={`tl${i}`} x={x} y={trackY + th + tickLabel * 1.4} textAnchor="middle" fontFamily={FONT_DISPLAY} fontWeight={700} fontSize={tickLabel} fill="rgba(255,255,255,0.85)" style={outlined(Math.round(tickLabel * 0.06))}>{tk.label}</text>);
      });
      // sliding marker (pointer + dot)
      const mx = left + trackW * v * prog;
      const triH = knobR * 1.6;
      kids.push(<path key="ptr" d={`M ${mx} ${trackY - th} L ${mx - triH * 0.7} ${trackY - th - triH} L ${mx + triH * 0.7} ${trackY - th - triH} Z`} fill={accent} style={{ filter: `drop-shadow(0 3px 8px ${accent}aa)` }} />);
      kids.push(<circle key="mdot" cx={mx} cy={trackY} r={knobR * 0.7} fill={accent} />);
      if (layer.minLabel) kids.push(<text key="min" x={left} y={trackY + th + tickLabel * 1.4} textAnchor="middle" fontFamily={FONT_DISPLAY} fontWeight={900} fontSize={endLabel} fill="#fff" style={outlined(Math.round(endLabel * 0.07))}>{layer.minLabel}</text>);
      if (layer.maxLabel) kids.push(<text key="max" x={right} y={trackY + th + tickLabel * 1.4} textAnchor="middle" fontFamily={FONT_DISPLAY} fontWeight={900} fontSize={endLabel} fill="#fff" style={outlined(Math.round(endLabel * 0.07))}>{layer.maxLabel}</text>);
    } else {
      // slider
      const kx = left + trackW * v * prog;
      kids.push(<rect key="sf" x={left} y={trackY - th / 2} width={kx - left} height={th} rx={th / 2} fill={accent} style={{ filter: `drop-shadow(0 0 10px ${accent}88)` }} />);
      kids.push(<circle key="knob" cx={kx} cy={trackY} r={knobR * 1.5} fill="#fff" stroke={accent} strokeWidth={Math.max(3, knobR * 0.4)} style={{ filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.5))' }} />);
      const shown = `${Math.round(v * prog * 100)}${layer.suffix ?? '%'}`;
      kids.push(<text key="sv" x={kx} y={trackY - knobR * 1.8} textAnchor="middle" fontFamily={FONT_DISPLAY} fontWeight={900} fontSize={endLabel} fill={accent} style={outlined(Math.round(endLabel * 0.07))}>{shown}</text>);
      if (layer.minLabel) kids.push(<text key="min" x={left} y={trackY + th + tickLabel * 1.6} textAnchor="middle" fontFamily={FONT_DISPLAY} fontWeight={800} fontSize={tickLabel} fill="rgba(255,255,255,0.85)" style={outlined(Math.round(tickLabel * 0.06))}>{layer.minLabel}</text>);
      if (layer.maxLabel) kids.push(<text key="max" x={right} y={trackY + th + tickLabel * 1.6} textAnchor="middle" fontFamily={FONT_DISPLAY} fontWeight={800} fontSize={tickLabel} fill="rgba(255,255,255,0.85)" style={outlined(Math.round(tickLabel * 0.06))}>{layer.maxLabel}</text>);
    }

    return (
      <div style={{ position: 'absolute', left: `${px * 100}%`, top: `${py * 100}%`, transform: `translate(-50%,-50%) scale(${pop})`, opacity: appear, width: Wd, height: Hd }}>
        {layer.label ? (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, textAlign: 'center', fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: Math.round(W * 0.024 * uf), letterSpacing: 1, color: '#fff', textTransform: 'uppercase', ...outlined(Math.round(W * 0.024 * 0.06)) }}>{layer.label}</div>
        ) : null}
        <svg width={Wd} height={Hd} viewBox={`0 0 ${Wd} ${Hd}`} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
          {kids}
        </svg>
      </div>
    );
  }

  // bar (horizontal, labeled)
  const barW = Math.round(W * (portrait ? 0.82 : 0.34));
  const barH = Math.round(W * (portrait ? 0.02 : 0.017));
  const pct = Math.max(0, Math.min(1, layer.value));
  const fillW = pct * prog * barW;
  const labelSize = Math.round(W * 0.026 * uf);
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
