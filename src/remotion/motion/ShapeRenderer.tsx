import React from 'react';
import { useVideoConfig } from 'remotion';
import type { ShapeLayer } from '../../lib/motion/ir/types';
import { COLORS } from '../theme';
import { useLayerStyle } from './style';

/** Render an IR vector shape (rectangle / rounded_rectangle / circle / ellipse / line). */
export const ShapeRenderer: React.FC<{ layer: ShapeLayer }> = ({ layer }) => {
  const { width, height } = useVideoConfig();
  const style = useLayerStyle(layer);

  // Normalized sizes -> pixels. Circles/ellipses use `radius` (fraction of width).
  const isRound = layer.shape === 'circle' || layer.shape === 'ellipse';
  const w = isRound
    ? (layer.radius ?? 0.1) * 2 * width
    : (layer.size?.[0] ?? 0.2) * width;
  const h = isRound
    ? (layer.shape === 'circle' ? (layer.radius ?? 0.1) * 2 * width : (layer.radius ?? 0.1) * 2 * height)
    : layer.shape === 'line'
      ? Math.max(2, (layer.stroke?.width ?? 0.004) * height)
      : (layer.size?.[1] ?? 0.1) * height;

  const borderRadius = isRound
    ? '50%'
    : layer.shape === 'rounded_rectangle'
      ? (layer.radius ?? 0.02) * width
      : 0;

  const background = layer.gradient
    ? `linear-gradient(${layer.gradientAngle ?? 135}deg, ${layer.gradient[0]}, ${layer.gradient[1]})`
    : layer.fill ?? COLORS.blue;

  return (
    <div
      style={{
        ...style,
        width: w,
        height: h,
        background,
        borderRadius,
        border: layer.stroke && layer.shape !== 'line' ? `${layer.stroke.width}px solid ${layer.stroke.color}` : undefined,
        boxShadow: layer.shadow ? `0 ${Math.round(layer.shadow * 0.4)}px ${layer.shadow}px rgba(0,0,0,0.45)` : undefined,
      }}
    />
  );
};
