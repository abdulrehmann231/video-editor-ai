import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { ThreeCanvas } from '@remotion/three';
import type { LottieOverlay } from '../../types';
import { FONT_DISPLAY, FONT_BODY, COLORS } from '../../theme';

/** Reuse the same overlay shape (template + optional value/label) for 3D ops. */
export interface ThreeOverlayData {
  id: string;
  start: number;
  end: number;
  template: string;
  value?: string;
  label?: string;
}

export const Three3DLayer: React.FC<{ items: ThreeOverlayData[]; fps: number }> = ({ items, fps }) => (
  <>
    {items.map((it) => {
      const from = Math.round(it.start * fps);
      const durationInFrames = Math.max(1, Math.round((it.end - it.start) * fps));
      return (
        <Sequence key={it.id} from={from} durationInFrames={durationInFrames}>
          {it.template === 'card_3d' ? <Card3D data={it} /> : <StatOrb3D data={it} />}
        </Sequence>
      );
    })}
  </>
);

// ---- 3D glass stat orb ---------------------------------------------------
const StatOrb3D: React.FC<{ data: ThreeOverlayData }> = ({ data }) => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 12, mass: 0.7, stiffness: 150 } });
  const exit = interpolate(frame, [durationInFrames - 8, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const scale = 0.4 + 0.6 * pop;
  const rot = frame * 0.02;

  const valueSize = Math.round(width * 0.075);
  const labelSize = Math.round(width * 0.022);

  return (
    <AbsoluteFill style={{ opacity: exit }}>
      <ThreeCanvas width={width} height={height} style={{ backgroundColor: 'transparent' }} camera={{ position: [0, 0, 6], fov: 45 }}>
        <ambientLight intensity={0.8} />
        <pointLight position={[4, 5, 6]} intensity={120} color="#ffffff" />
        <pointLight position={[-6, -3, 2]} intensity={60} color={COLORS.blue} />
        <mesh scale={scale} rotation={[rot * 0.6, rot, 0]}>
          <sphereGeometry args={[1.7, 48, 48]} />
          <meshStandardMaterial color={COLORS.blue} metalness={0.55} roughness={0.15} emissive={COLORS.blueDeep} emissiveIntensity={0.35} />
        </mesh>
      </ThreeCanvas>
      {/* crisp 2D text over the orb */}
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', opacity: Math.min(1, pop * 1.4) }}>
        <div style={{ textAlign: 'center' }}>
          {data.value && (
            <div
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize: valueSize,
                color: COLORS.white,
                textShadow: `0 0 30px ${COLORS.blue}, 0 6px 26px rgba(0,0,0,0.6)`,
              }}
            >
              {data.value}
            </div>
          )}
          {data.label && (
            <div
              style={{
                fontFamily: FONT_BODY,
                fontWeight: 800,
                fontSize: labelSize,
                color: '#dbe7ff',
                textTransform: 'uppercase',
                letterSpacing: 2,
                marginTop: valueSize * 0.1,
              }}
            >
              {data.label}
            </div>
          )}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---- 3D flip card --------------------------------------------------------
const Card3D: React.FC<{ data: ThreeOverlayData }> = ({ data }) => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const flip = spring({ frame, fps, config: { damping: 14, mass: 0.8, stiffness: 120 } });
  const exit = interpolate(frame, [durationInFrames - 8, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const rotY = interpolate(flip, [0, 1], [-Math.PI / 2, 0]);
  const headingSize = Math.round(width * 0.05);
  const subSize = Math.round(width * 0.02);

  return (
    <AbsoluteFill style={{ opacity: exit }}>
      <ThreeCanvas width={width} height={height} style={{ backgroundColor: 'transparent' }} camera={{ position: [0, 0, 6], fov: 45 }}>
        <ambientLight intensity={1} />
        <pointLight position={[3, 4, 6]} intensity={90} />
        <mesh rotation={[0, rotY, 0]}>
          <boxGeometry args={[4.4, 2.5, 0.16]} />
          <meshStandardMaterial color={COLORS.blueDeep} metalness={0.4} roughness={0.25} />
        </mesh>
      </ThreeCanvas>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', opacity: interpolate(flip, [0.6, 1], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }}>
        <div style={{ textAlign: 'center', padding: '0 12%' }}>
          {data.value && (
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: headingSize, color: COLORS.white, textShadow: '0 4px 20px rgba(0,0,0,0.6)' }}>
              {data.value}
            </div>
          )}
          {data.label && (
            <div style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: subSize, color: '#cdd8ec', marginTop: 12, letterSpacing: 1 }}>
              {data.label}
            </div>
          )}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Adapter so the pipeline can pass overlays typed like the others. */
export type { LottieOverlay };
