import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';
import type { IllustrationLayer } from '../../lib/motion/ir/types';
import { FONT_DISPLAY } from '../theme';
import { sampleVec3 } from './anim/resolveAnimated';
import { ILLO_COMPONENTS, IlloFallback } from './illustrations';

/**
 * Render a bundled vector illustration with a deterministic entrance + idle
 * animation: `pop` (spring scale-in), `float` (pop + gentle bob & tilt), `draw`
 * (a vertical wipe reveal), or `none`. Tint via layer.color/accent. The SVG keeps
 * a square aspect (xMidYMid meet) inside the layer box.
 */
export const IllustrationRenderer: React.FC<{ layer: IllustrationLayer }> = ({ layer }) => {
  const { width: W, height: H, fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const t = frame / fps;

  const [px, py] = sampleVec3(layer.transform?.position, frame, fps, [0.5, 0.5, 0]);
  const [sw, sh] = layer.size ?? [0.24, 0.24];
  const boxW = Math.max(40, sw * W);
  const boxH = Math.max(40, sh * H);
  const animate = layer.animate ?? 'pop';

  const Comp = ILLO_COMPONENTS[layer.name] ?? IlloFallback;

  const appear = interpolate(t, [0, 0.22], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const popScale = animate === 'none' ? 1 : interpolate(t, [0, 0.4], [0.55, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(2.2)) });
  // Idle motion for 'float': gentle vertical bob + tilt (deterministic).
  const bob = animate === 'float' ? Math.sin(t * 2.2) * (boxH * 0.03) : 0;
  const tilt = animate === 'float' ? Math.sin(t * 1.6) * 3 : 0;
  // 'draw' wipes the illustration in from the bottom.
  const wipe = animate === 'draw' ? interpolate(t, [0.1, 0.9], [0, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) }) : 100;
  const clipId = `illoclip_${layer.id}`;

  const labelSize = Math.round(Math.min(boxW, boxH) * 0.16);

  return (
    <div
      style={{
        position: 'absolute',
        left: `${px * 100}%`,
        top: `${py * 100}%`,
        transform: `translate(-50%, calc(-50% + ${bob}px)) scale(${popScale}) rotate(${tilt}deg)`,
        opacity: appear,
        width: boxW,
        height: boxH + (layer.label ? labelSize * 1.6 : 0),
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <svg
        width={boxW}
        height={boxH}
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
        style={{ overflow: 'visible', filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.45))' }}
      >
        {animate === 'draw' && (
          <defs>
            <clipPath id={clipId}>
              <rect x="0" y={100 - wipe} width="100" height={wipe} />
            </clipPath>
          </defs>
        )}
        <g clipPath={animate === 'draw' ? `url(#${clipId})` : undefined}>
          <Comp c={layer.color} a={layer.accent} />
        </g>
      </svg>
      {layer.label ? (
        <div
          style={{
            marginTop: labelSize * 0.4,
            fontFamily: FONT_DISPLAY,
            fontWeight: 800,
            fontSize: labelSize,
            letterSpacing: 1,
            color: '#fff',
            textTransform: 'uppercase',
            WebkitTextStroke: `${Math.round(labelSize * 0.06)}px rgba(0,0,0,0.85)`,
            paintOrder: 'stroke fill',
            textShadow: '0 3px 12px rgba(0,0,0,0.6)',
            whiteSpace: 'nowrap',
          }}
        >
          {layer.label}
        </div>
      ) : null}
    </div>
  );
};
