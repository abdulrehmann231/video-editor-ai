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

  return (
    <div
      style={{
        ...style,
        width: w,
        height: h,
        background: layer.fill ?? COLORS.blue,
        borderRadius,
        border: layer.stroke && layer.shape !== 'line' ? `${layer.stroke.width}px solid ${layer.stroke.color}` : undefined,
      }}
    />
  );
};
