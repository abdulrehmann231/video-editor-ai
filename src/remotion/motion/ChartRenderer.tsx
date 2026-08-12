import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';
import type { ChartLayer, ChartDatum } from '../../lib/motion/ir/types';
import { COLORS, FONT_DISPLAY } from '../theme';
import { sampleVec3 } from './anim/resolveAnimated';

/**
 * Animated data chart — bar / line / area / donut. Bars grow from a baseline with
 * a staggered back-ease and value labels that count up; lines draw on with a
 * gradient area fill and popping vertices; donut segments sweep in. Everything is
 * driven by the layer-relative frame (deterministic → golden-testable) and drawn
 * in SVG for crisp edges at any resolution.
 */

const INK = 'rgba(0,0,0,0.85)';
const RAMP = ['#ffd60a', '#34d399', '#3b82f6', '#a78bfa', '#f472b6', '#fb923c', '#22d3ee'];

const outlined = (px: number): React.CSSProperties => ({
  WebkitTextStroke: `${px}px ${INK}`,
  paintOrder: 'stroke fill',
  textShadow: '0 3px 12px rgba(0,0,0,0.6)',
});

function fmt(v: number, prefix = '', suffix = '', decimals = 0): string {
  const n = decimals > 0 ? v.toFixed(decimals) : Math.round(v).toString();
  return `${prefix}${n}${suffix}`;
}

/** Smooth path (Catmull-Rom → bezier) through points for the line/area charts. */
function smoothPath(pts: [number, number][]): string {
  if (pts.length < 2) return pts.length ? `M ${pts[0][0]} ${pts[0][1]}` : '';
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2[0]} ${p2[1]}`;
  }
  return d;
}

export const ChartRenderer: React.FC<{ layer: ChartLayer }> = ({ layer }) => {
  const { width: W, height: H, fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const t = frame / fps;

  const [px, py] = sampleVec3(layer.transform?.position, frame, fps, [0.5, 0.5, 0]);
  const [sw, sh] = layer.size ?? [0.5, 0.42];
  const boxW = Math.max(80, sw * W);
  const boxH = Math.max(60, sh * H);
  const accent = layer.color ?? COLORS.accent;
  const data = (layer.data ?? []).filter((d): d is ChartDatum => d && Number.isFinite(d.value)).slice(0, 8);
  const drawIn = layer.drawIn ?? 0.95;
  const decimals = data.some((d) => !Number.isInteger(d.value)) ? 1 : 0;

  const appear = interpolate(t, [0, 0.2], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const pop = interpolate(t, [0, 0.3], [0.86, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(1.7)) });

  if (data.length === 0) return null;
  const colorFor = (d: ChartDatum, i: number): string => d.color ?? (layer.color ? accent : RAMP[i % RAMP.length]);

  // ── layout ──────────────────────────────────────────────────────────────────
  const titleH = layer.title ? boxH * 0.14 : 0;
  const labelSize = Math.max(11, Math.round(Math.min(boxW, boxH) * 0.055));
  const valSize = Math.max(12, Math.round(Math.min(boxW, boxH) * 0.07));
  const padTop = titleH + valSize * 1.4;
  const padBottom = labelSize * 1.8;
  const padSide = boxW * 0.03;
  const plotX = padSide;
  const plotY = padTop;
  const plotW = boxW - padSide * 2;
  const plotH = boxH - padTop - padBottom;

  const values = data.map((d) => d.value);
  const maxV = layer.max ?? Math.max(...values, 0.0001) * 1.18;
  const showGrid = layer.showGrid ?? true;
  const showValues = layer.showValues ?? true;

  const svgChildren: React.ReactNode[] = [];

  // Grid + baseline (shared by bar/line/area).
  if (layer.variant !== 'donut' && showGrid) {
    for (let g = 0; g <= 4; g++) {
      const gy = plotY + (plotH * g) / 4;
      svgChildren.push(<line key={`g${g}`} x1={plotX} y1={gy} x2={plotX + plotW} y2={gy} stroke="rgba(255,255,255,0.14)" strokeWidth={g === 4 ? 2.5 : 1} />);
    }
  }

  if (layer.variant === 'bar') {
    const n = data.length;
    const slot = plotW / n;
    const barW = slot * 0.62;
    data.forEach((d, i) => {
      const st = 0.15 + i * 0.09;
      const grow = interpolate(t, [st, st + 0.5], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(1.5)) });
      const growC = Math.max(0, Math.min(1, grow));
      const c = colorFor(d, i);
      const bh = (d.value / maxV) * plotH * growC;
      const bx = plotX + i * slot + (slot - barW) / 2;
      const by = plotY + plotH - bh;
      const gid = `bargrad_${layer.id}_${i}`;
      svgChildren.push(
        <defs key={`d${i}`}>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c} />
            <stop offset="100%" stopColor={c} stopOpacity={0.55} />
          </linearGradient>
        </defs>,
      );
      const r = Math.min(barW * 0.28, 12);
      svgChildren.push(<rect key={`b${i}`} x={bx} y={by} width={barW} height={Math.max(0.001, bh)} rx={r} fill={`url(#${gid})`} style={{ filter: `drop-shadow(0 4px 10px ${c}55)` }} />);
      if (showValues && growC > 0.02) {
        svgChildren.push(
          <text key={`v${i}`} x={bx + barW / 2} y={by - valSize * 0.45} textAnchor="middle" fontFamily={FONT_DISPLAY} fontWeight={900} fontSize={valSize} fill="#fff" style={outlined(Math.round(valSize * 0.09))}>
            {fmt(d.value * growC, layer.prefix ?? '', layer.suffix ?? '', decimals)}
          </text>,
        );
      }
      if (d.label) {
        svgChildren.push(
          <text key={`l${i}`} x={bx + barW / 2} y={plotY + plotH + labelSize * 1.35} textAnchor="middle" fontFamily={FONT_DISPLAY} fontWeight={700} fontSize={labelSize} fill="rgba(255,255,255,0.92)" style={outlined(Math.round(labelSize * 0.06))}>
            {d.label.toUpperCase()}
          </text>,
        );
      }
    });
  } else if (layer.variant === 'line' || layer.variant === 'area') {
    const n = data.length;
    const pts: [number, number][] = data.map((d, i) => [plotX + (n === 1 ? plotW / 2 : (plotW * i) / (n - 1)), plotY + plotH - (d.value / maxV) * plotH]);
    const linePath = smoothPath(pts);
    const areaPath = `${linePath} L ${pts[pts.length - 1][0]} ${plotY + plotH} L ${pts[0][0]} ${plotY + plotH} Z`;
    const prog = interpolate(t, [0.15, 0.15 + drawIn], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) });
    const agid = `areagrad_${layer.id}`;
    if (layer.variant === 'area') {
      svgChildren.push(
        <defs key="ad">
          <linearGradient id={agid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity={0.55} />
            <stop offset="100%" stopColor={accent} stopOpacity={0.02} />
          </linearGradient>
          <clipPath id={`clip_${layer.id}`}>
            <rect x={plotX} y={plotY - valSize} width={plotW * prog} height={plotH + valSize * 2} />
          </clipPath>
        </defs>,
      );
      svgChildren.push(<path key="area" d={areaPath} fill={`url(#${agid})`} clipPath={`url(#clip_${layer.id})`} />);
    }
    // draw-on stroke
    svgChildren.push(<path key="linebk" d={linePath} fill="none" stroke={INK} strokeWidth={Math.max(5, valSize * 0.42)} strokeLinecap="round" strokeLinejoin="round" pathLength={100} strokeDasharray={100} strokeDashoffset={100 * (1 - prog)} />);
    svgChildren.push(<path key="line" d={linePath} fill="none" stroke={accent} strokeWidth={Math.max(3, valSize * 0.3)} strokeLinecap="round" strokeLinejoin="round" pathLength={100} strokeDasharray={100} strokeDashoffset={100 * (1 - prog)} style={{ filter: `drop-shadow(0 0 8px ${accent}77)` }} />);
    // vertices + value labels pop as the line passes them
    pts.forEach((p, i) => {
      const reveal = i / Math.max(1, n - 1);
      const shown = prog >= reveal - 0.001;
      if (!shown) return;
      svgChildren.push(<circle key={`pt${i}`} cx={p[0]} cy={p[1]} r={Math.max(4, valSize * 0.32)} fill="#fff" stroke={accent} strokeWidth={Math.max(2, valSize * 0.16)} />);
      if (showValues) {
        svgChildren.push(
          <text key={`pv${i}`} x={p[0]} y={p[1] - valSize * 0.7} textAnchor="middle" fontFamily={FONT_DISPLAY} fontWeight={900} fontSize={valSize * 0.9} fill="#fff" style={outlined(Math.round(valSize * 0.08))}>
            {fmt(data[i].value, layer.prefix ?? '', layer.suffix ?? '', decimals)}
          </text>,
        );
      }
      if (data[i].label) {
        svgChildren.push(
          <text key={`ll${i}`} x={p[0]} y={plotY + plotH + labelSize * 1.35} textAnchor="middle" fontFamily={FONT_DISPLAY} fontWeight={700} fontSize={labelSize} fill="rgba(255,255,255,0.92)" style={outlined(Math.round(labelSize * 0.06))}>
            {data[i].label!.toUpperCase()}
          </text>,
        );
      }
    });
  } else {
    // donut
    const cx = boxW / 2;
    const cy = plotY + plotH / 2;
    const R = Math.min(plotW, plotH) / 2 * 0.9;
    const thickness = R * 0.42;
    const total = values.reduce((a, b) => a + b, 0) || 1;
    const sweep = interpolate(t, [0.15, 0.15 + drawIn], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
    let acc = 0;
    const circ = 2 * Math.PI * R;
    data.forEach((d, i) => {
      const frac = d.value / total;
      const segStart = acc;
      acc += frac;
      const c = colorFor(d, i);
      const dash = circ * frac * sweep;
      const offset = -circ * segStart;
      svgChildren.push(
        <circle key={`seg${i}`} cx={cx} cy={cy} r={R} fill="none" stroke={c} strokeWidth={thickness} strokeDasharray={`${dash} ${circ}`} strokeDashoffset={offset} transform={`rotate(-90 ${cx} ${cy})`} strokeLinecap="butt" />,
      );
    });
    // center total
    if (showValues) {
      svgChildren.push(
        <text key="dc" x={cx} y={cy + valSize * 0.4} textAnchor="middle" fontFamily={FONT_DISPLAY} fontWeight={900} fontSize={valSize * 1.5} fill="#fff" style={outlined(Math.round(valSize * 0.1))}>
          {fmt(total * sweep, layer.prefix ?? '', layer.suffix ?? '', decimals)}
        </text>,
      );
    }
  }

  return (
    <div style={{ position: 'absolute', left: `${px * 100}%`, top: `${py * 100}%`, transform: `translate(-50%,-50%) scale(${pop})`, opacity: appear, width: boxW, height: boxH }}>
      {layer.title ? (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, textAlign: 'center', fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: Math.round(titleH * 0.62), letterSpacing: 1, color: '#fff', textTransform: 'uppercase', ...outlined(Math.round(titleH * 0.04)) }}>{layer.title}</div>
      ) : null}
      <svg width={boxW} height={boxH} viewBox={`0 0 ${boxW} ${boxH}`} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        {svgChildren}
      </svg>
    </div>
  );
};
