import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';
import type { FlowLayer } from '../../lib/motion/ir/types';
import { COLORS, FONT_DISPLAY } from '../theme';
import { sampleVec3 } from './anim/resolveAnimated';
import { ILLO_COMPONENTS, IlloFallback } from './illustrations';

/**
 * Flow / process / connector diagram — the vault's "gift → $ → gifts", funnels,
 * and step chains. Each node (an illustration and/or a label) pops in, then an
 * arrow draws on to the next node, in sequence. Deterministic (frame-driven);
 * reuses the illustration library for node icons.
 */

const INK = 'rgba(0,0,0,0.85)';
const outlined = (px: number): React.CSSProperties => ({
  WebkitTextStroke: `${px}px ${INK}`,
  paintOrder: 'stroke fill',
  textShadow: '0 3px 12px rgba(0,0,0,0.6)',
});

export const FlowRenderer: React.FC<{ layer: FlowLayer }> = ({ layer }) => {
  const { width: W, height: H, fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const t = frame / fps;

  const [px, py] = sampleVec3(layer.transform?.position, frame, fps, [0.5, 0.5, 0]);
  const nodes = (layer.nodes ?? []).slice(0, 5);
  if (nodes.length === 0) return null;
  const vertical = layer.direction === 'vertical';
  const accent = layer.color ?? COLORS.accent;
  const [sw, sh] = layer.size ?? (vertical ? [0.4, 0.72] : [0.86, 0.34]);
  const boxW = sw * W;
  const boxH = sh * H;
  const n = nodes.length;

  // Node centers + radius.
  const along = vertical ? boxH : boxW;
  const cross = vertical ? boxW : boxH;
  const slot = along / n;
  const nodeR = Math.min(slot * 0.34, cross * (layer.nodes.some((nd) => nd.label) ? 0.34 : 0.42));
  const labelSize = Math.max(12, Math.round(nodeR * 0.42));

  const centers = nodes.map((_, i) => {
    const a = slot * (i + 0.5);
    return vertical ? { x: cross * 0.5, y: a } : { x: a, y: cross * 0.46 };
  });

  const appear = interpolate(t, [0, 0.2], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Connector arrows (SVG), drawn in sequence.
  const conns: React.ReactNode[] = [];
  for (let i = 0; i < n - 1; i++) {
    const from = centers[i];
    const to = centers[i + 1];
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const gap = nodeR * 1.18;
    const x1 = from.x + ux * gap;
    const y1 = from.y + uy * gap;
    const x2 = to.x - ux * gap;
    const y2 = to.y - uy * gap;
    const ci = 0.15 + i * 0.42 + 0.28;
    const prog = interpolate(t, [ci, ci + 0.28], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
    const sw2 = Math.max(4, nodeR * 0.14);
    const shaft = `M ${x1} ${y1} L ${x2} ${y2}`;
    const ang = Math.atan2(uy, ux);
    const hl = nodeR * 0.5;
    const spread = 0.5;
    const head = `M ${x2 - Math.cos(ang - spread) * hl} ${y2 - Math.sin(ang - spread) * hl} L ${x2} ${y2} L ${x2 - Math.cos(ang + spread) * hl} ${y2 - Math.sin(ang + spread) * hl}`;
    if (layer.connector === 'line') {
      conns.push(<path key={`c${i}`} d={shaft} stroke={accent} strokeWidth={sw2} strokeLinecap="round" fill="none" pathLength={100} strokeDasharray={100} strokeDashoffset={100 * (1 - prog)} />);
    } else {
      conns.push(<path key={`c${i}`} d={shaft} stroke={accent} strokeWidth={sw2} strokeLinecap="round" fill="none" pathLength={100} strokeDasharray={100} strokeDashoffset={100 * (1 - prog)} />);
      conns.push(<path key={`h${i}`} d={head} stroke={accent} strokeWidth={sw2} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={prog > 0.85 ? 1 : 0} />);
    }
  }

  return (
    <div style={{ position: 'absolute', left: `${px * 100}%`, top: `${py * 100}%`, transform: 'translate(-50%,-50%)', opacity: appear, width: boxW, height: boxH }}>
      <svg width={boxW} height={boxH} viewBox={`0 0 ${boxW} ${boxH}`} style={{ position: 'absolute', inset: 0, overflow: 'visible', filter: `drop-shadow(0 0 6px ${accent}55)` }}>
        {conns}
      </svg>
      {nodes.map((node, i) => {
        const ci = centers[i];
        const st = 0.15 + i * 0.42;
        const pop = interpolate(t, [st, st + 0.32], [0.5, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(2.2)) });
        const op = interpolate(t, [st, st + 0.2], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        const Comp = node.illustration ? ILLO_COMPONENTS[node.illustration] ?? IlloFallback : null;
        const d = nodeR * 2;
        return (
          <div key={i} style={{ position: 'absolute', left: ci.x, top: ci.y, transform: `translate(-50%,-50%) scale(${pop})`, opacity: op, width: d, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: d, height: d, borderRadius: '50%', background: 'rgba(10,12,18,0.55)', border: `${Math.max(3, nodeR * 0.08)}px solid ${accent}`, boxShadow: `0 6px 18px rgba(0,0,0,0.5), 0 0 16px ${accent}44`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {Comp ? (
                <svg width={d * 0.72} height={d * 0.72} viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
                  <Comp c={undefined} a={undefined} />
                </svg>
              ) : (
                <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 900, fontSize: Math.round(nodeR * 0.8), color: '#fff', textAlign: 'center', lineHeight: 1, ...outlined(Math.round(nodeR * 0.06)) }}>{node.label}</span>
              )}
            </div>
            {Comp && node.label ? (
              <div style={{ marginTop: nodeR * 0.18, fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: labelSize, color: '#fff', textTransform: 'uppercase', textAlign: 'center', whiteSpace: 'nowrap', ...outlined(Math.round(labelSize * 0.06)) }}>{node.label}</div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};
