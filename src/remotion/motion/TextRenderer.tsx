import React from 'react';
import { useVideoConfig } from 'remotion';
import type { TextLayer } from '../../lib/motion/ir/types';
import { FONT_DISPLAY, COLORS } from '../theme';
import { useLayerStyle } from './style';

/** Render an IR text layer. Outline/stroke color + width are dynamic via
 * layer.stroke; everything else (font, size, weight, tracking, color, position)
 * comes from the layer. */
export const TextRenderer: React.FC<{ layer: TextLayer }> = ({ layer }) => {
  const { width } = useVideoConfig();
  const style = useLayerStyle(layer);
  const size = layer.font?.size ?? Math.round(width * 0.05);
  // Dynamic outline: use layer.stroke if provided, else a default ink outline.
  const strokeWidth = layer.stroke ? layer.stroke.width : Math.max(3, Math.round(size * 0.08));
  const strokeColor = layer.stroke?.color ?? COLORS.ink;
  const outline: React.CSSProperties =
    strokeWidth > 0
      ? { WebkitTextStroke: `${strokeWidth}px ${strokeColor}`, paintOrder: 'stroke fill', textShadow: '0 6px 22px rgba(0,0,0,0.55), 0 2px 3px rgba(0,0,0,0.8)' }
      : { textShadow: '0 4px 14px rgba(0,0,0,0.5)' };

  return (
    <div
      style={{
        ...style,
        whiteSpace: 'pre-wrap',
        textAlign: layer.align ?? 'center',
        maxWidth: '90%',
        fontFamily: layer.font?.family ? `${layer.font.family}, ${FONT_DISPLAY}` : FONT_DISPLAY,
        fontWeight: layer.font?.weight ?? 800,
        fontSize: size,
        letterSpacing: layer.font?.tracking,
        lineHeight: 1.05,
        textTransform: 'uppercase',
        color: layer.fill ?? COLORS.white,
        ...outline,
      }}
    >
      {layer.content}
    </div>
  );
};
