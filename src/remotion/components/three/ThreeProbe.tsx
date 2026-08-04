import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { ThreeCanvas } from '@remotion/three';

/** Minimal 3D scene used to verify WebGL renders in headless Chrome (Phase C0). */
export const ThreeProbe: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: '#0b0d12' }}>
      <ThreeCanvas width={width} height={height} style={{ backgroundColor: 'transparent' }}>
        <ambientLight intensity={1.2} />
        <pointLight position={[10, 10, 10]} intensity={80} />
        <mesh rotation={[frame * 0.06, frame * 0.05, 0]}>
          <boxGeometry args={[2.4, 2.4, 2.4]} />
          <meshStandardMaterial color="#3b82f6" metalness={0.3} roughness={0.2} />
        </mesh>
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
