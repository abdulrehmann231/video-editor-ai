import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';
import type { AnnotationLayer } from '../../lib/motion/ir/types';
import { COLORS } from '../theme';

/**
 * Hand-drawn marker annotation — the signature "the editor drew on the frame"
 * look from the inspiration vault (curved arrows pointing at the speaker, rough
 * circles around a face, underlines, boxes, checks/crosses). Rendered as a rough
 * SVG stroke that DRAWS ON via stroke-dashoffset. Everything (the jitter, the
 * curve) is deterministic — seeded from the layer id — so renders are stable and
 * golden-testable.
 */

// ── deterministic PRNG (seeded from the layer id) ─────────────────────────────
function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}
function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Pt = [number, number];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** A slightly-curved, jittered stroke between two points (marker feel). */
function roughLine(p0: Pt, p1: Pt, jitter: number, rnd: () => number): string {
  const dx = p1[0] - p0[0];
  const dy = p1[1] - p0[1];
  const len = Math.hypot(dx, dy) || 1;
  // unit perpendicular
  const nx = -dy / len;
  const ny = dx / len;
  const bow = (rnd() - 0.5) * jitter * 2 + jitter * 0.6; // gentle consistent bow
  const c1x = lerp(p0[0], p1[0], 0.33) + nx * bow;
  const c1y = lerp(p0[1], p1[1], 0.33) + ny * bow;
  const c2x = lerp(p0[0], p1[0], 0.66) + nx * bow * 0.8;
  const c2y = lerp(p0[1], p1[1], 0.66) + ny * bow * 0.8;
  return `M ${p0[0]} ${p0[1]} C ${c1x} ${c1y} ${c2x} ${c2y} ${p1[0]} ${p1[1]}`;
}

/** Rough closed-ish ellipse (open loop that slightly overshoots, hand-drawn). */
function roughEllipse(cx: number, cy: number, rx: number, ry: number, jitter: number, rnd: () => number): string {
  const steps = 14;
  const start = -Math.PI * 0.5 - 0.3;
  const end = start + Math.PI * 2 + 0.5; // overshoot the closure
  const pts: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = lerp(start, end, i / steps);
    const jr = 1 + (rnd() - 0.5) * jitter * 0.12;
    pts.push([cx + Math.cos(a) * rx * jr, cy + Math.sin(a) * ry * jr]);
  }
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const cur = pts[i];
    const mx = (prev[0] + cur[0]) / 2;
    const my = (prev[1] + cur[1]) / 2;
    d += ` Q ${prev[0]} ${prev[1]} ${mx} ${my}`;
  }
  return d;
}

/** Rough rectangle (four jittered sides, corners overshoot a touch). */
function roughBox(x: number, y: number, w: number, h: number, jitter: number, rnd: () => number): string {
  const j = () => (rnd() - 0.5) * jitter * 1.6;
  const tl: Pt = [x + j(), y + j()];
  const tr: Pt = [x + w + j(), y + j()];
  const br: Pt = [x + w + j(), y + h + j()];
  const bl: Pt = [x + j(), y + h + j()];
  return (
    roughLine(tl, tr, jitter * 0.5, rnd) +
    ' ' + roughLine(tr, br, jitter * 0.5, rnd).replace('M', 'M') +
    ' ' + roughLine(br, bl, jitter * 0.5, rnd) +
    ' ' + roughLine(bl, tl, jitter * 0.5, rnd)
  );
}

/** Zigzag scribble filling a rect (used for a "highlighter" emphasis). */
function scribble(x: number, y: number, w: number, h: number, jitter: number, rnd: () => number): string {
  const rows = 5;
  let d = `M ${x} ${y}`;
  for (let i = 0; i <= rows; i++) {
    const yy = y + (h * i) / rows + (rnd() - 0.5) * jitter;
    const xx = i % 2 === 0 ? x + w : x;
    d += ` L ${xx} ${yy}`;
  }
  return d;
}

interface Built {
  d: string;
  arrowHead?: string;
}

function buildPath(layer: AnnotationLayer, W: number, H: number): Built {
  const rnd = mulberry32(hashSeed(layer.id));
  const jitter = (layer.roughness ?? 0.5) * Math.min(W, H) * 0.02;
  const rect = layer.rect;
  const kind = layer.annotation;

  if (kind === 'arrow') {
    const from: Pt = [(layer.from?.[0] ?? 0.15) * W, (layer.from?.[1] ?? 0.2) * H];
    const to: Pt = [(layer.to?.[0] ?? 0.5) * W, (layer.to?.[1] ?? 0.5) * H];
    const shaft = roughLine(from, to, jitter, rnd);
    // Arrowhead: two short barbs at `to`, angled back along the shaft.
    const ang = Math.atan2(to[1] - from[1], to[0] - from[0]);
    const headLen = Math.min(W, H) * 0.05;
    const spread = 0.5;
    const b1: Pt = [to[0] - Math.cos(ang - spread) * headLen, to[1] - Math.sin(ang - spread) * headLen];
    const b2: Pt = [to[0] - Math.cos(ang + spread) * headLen, to[1] - Math.sin(ang + spread) * headLen];
    const head = `M ${b1[0]} ${b1[1]} L ${to[0]} ${to[1]} L ${b2[0]} ${b2[1]}`;
    return { d: shaft, arrowHead: head };
  }

  if (kind === 'circle') {
    const cx = ((rect?.x ?? 0.35) + (rect?.width ?? 0.3) / 2) * W;
    const cy = ((rect?.y ?? 0.35) + (rect?.height ?? 0.3) / 2) * H;
    const rx = ((rect?.width ?? 0.3) / 2) * W * 1.08;
    const ry = ((rect?.height ?? 0.3) / 2) * H * 1.08;
    return { d: roughEllipse(cx, cy, rx, ry, jitter, rnd) };
  }

  if (kind === 'box') {
    const x = (rect?.x ?? 0.3) * W;
    const y = (rect?.y ?? 0.4) * H;
    const w = (rect?.width ?? 0.4) * W;
    const h = (rect?.height ?? 0.2) * H;
    return { d: roughBox(x, y, w, h, jitter, rnd) };
  }

  if (kind === 'underline') {
    const x = (rect?.x ?? 0.3) * W;
    const y = ((rect?.y ?? 0.6) + (rect?.height ?? 0.08)) * H;
    const w = (rect?.width ?? 0.4) * W;
    const p0: Pt = [x, y];
    const p1: Pt = [x + w, y + (rnd() - 0.5) * jitter];
    // double stroke for a marker underline
    return { d: roughLine(p0, p1, jitter, rnd) + ' ' + roughLine([x, y + jitter], [x + w, y + jitter], jitter, rnd) };
  }

  if (kind === 'strike') {
    const from: Pt = [(layer.from?.[0] ?? (rect?.x ?? 0.3)) * W, (layer.from?.[1] ?? ((rect?.y ?? 0.4) + (rect?.height ?? 0.1) / 2)) * H];
    const to: Pt = [(layer.to?.[0] ?? ((rect?.x ?? 0.3) + (rect?.width ?? 0.4))) * W, (layer.to?.[1] ?? ((rect?.y ?? 0.4) + (rect?.height ?? 0.1) / 2)) * H];
    return { d: roughLine(from, to, jitter, rnd) };
  }

  if (kind === 'scribble') {
    const x = (rect?.x ?? 0.3) * W;
    const y = (rect?.y ?? 0.42) * H;
    const w = (rect?.width ?? 0.4) * W;
    const h = (rect?.height ?? 0.16) * H;
    return { d: scribble(x, y, w, h, jitter, rnd) };
  }

  if (kind === 'checkmark') {
    const cx = ((rect?.x ?? 0.45) + (rect?.width ?? 0.1) / 2) * W;
    const cy = ((rect?.y ?? 0.45) + (rect?.height ?? 0.1) / 2) * H;
    const s = Math.min(W, H) * (rect?.width ? (rect.width * W) / Math.min(W, H) : 0.08);
    const p0: Pt = [cx - s * 0.5, cy];
    const p1: Pt = [cx - s * 0.1, cy + s * 0.4];
    const p2: Pt = [cx + s * 0.6, cy - s * 0.5];
    return { d: `M ${p0[0]} ${p0[1]} L ${p1[0]} ${p1[1]} L ${p2[0]} ${p2[1]}` };
  }

  if (kind === 'cross') {
    const cx = ((rect?.x ?? 0.45) + (rect?.width ?? 0.1) / 2) * W;
    const cy = ((rect?.y ?? 0.45) + (rect?.height ?? 0.1) / 2) * H;
    const s = Math.min(W, H) * 0.05;
    return {
      d:
        roughLine([cx - s, cy - s], [cx + s, cy + s], jitter, rnd) +
        ' ' + roughLine([cx + s, cy - s], [cx - s, cy + s], jitter, rnd),
    };
  }

  return { d: '' };
}

export const AnnotationRenderer: React.FC<{ layer: AnnotationLayer }> = ({ layer }) => {
  const { width: W, height: H, fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const t = frame / fps;

  const drawIn = layer.drawIn ?? 0.5;
  const progress = interpolate(t, [0, Math.max(0.01, drawIn)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  // Fade the whole annotation out over its final 250ms so it exits cleanly.
  const dur = layer.duration;
  const opacity = interpolate(t, [dur - 0.25, dur], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const { d, arrowHead } = buildPath(layer, W, H);
  if (!d) return null;

  const color = layer.color ?? COLORS.accent;
  // Check/cross read like the bright emoji marks in the vault — much thicker,
  // with a soft colored glow — while arrows/circles stay marker-thin.
  const boldMark = layer.annotation === 'checkmark' || layer.annotation === 'cross';
  const sw = (layer.strokeWidth ?? 0.006) * W * (boldMark ? 2.6 : 1);

  // Split the draw across shaft + arrowhead so the head lands last.
  const headFrac = arrowHead ? 0.22 : 0;
  const shaftProg = Math.min(1, progress / (1 - headFrac || 1));
  const headProg = arrowHead ? Math.max(0, (progress - (1 - headFrac)) / (headFrac || 1)) : 0;

  const strokeCommon: React.CSSProperties = {
    fill: 'none',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };

  const drawProps = (prog: number) => ({
    pathLength: 100,
    strokeDasharray: 100,
    strokeDashoffset: 100 * (1 - prog),
  });

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      style={{ position: 'absolute', inset: 0, opacity, overflow: 'visible', filter: boldMark ? `drop-shadow(0 0 ${sw * 0.9}px ${color}aa)` : undefined }}
    >
      {/* dark backing stroke for legibility over any footage */}
      <path d={d} stroke="rgba(0,0,0,0.55)" strokeWidth={sw * (boldMark ? 1.4 : 1.9)} style={strokeCommon} {...drawProps(shaftProg)} />
      <path d={d} stroke={color} strokeWidth={sw} style={strokeCommon} {...drawProps(shaftProg)} />
      {arrowHead && (
        <>
          <path d={arrowHead} stroke="rgba(0,0,0,0.55)" strokeWidth={sw * 1.9} style={strokeCommon} {...drawProps(headProg)} />
          <path d={arrowHead} stroke={color} strokeWidth={sw} style={strokeCommon} {...drawProps(headProg)} />
        </>
      )}
    </svg>
  );
};
