import React from 'react';
import { useVideoConfig } from 'remotion';
import type { TextLayer } from '../../lib/motion/ir/types';
import { FONT_DISPLAY, COLORS, outlineStyle } from '../theme';
import { useLayerStyle } from './style';

/** Render an IR text layer (whole-layer text in Phase 1). */
export const TextRenderer: React.FC<{ layer: TextLayer }> = ({ layer }) => {
  const { width } = useVideoConfig();
  const style = useLayerStyle(layer);
  const size = layer.font?.size ?? Math.round(width * 0.05);
  const stroke = Math.max(3, Math.round(size * 0.08));

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
        ...outlineStyle(stroke),
      }}
    >
      {layer.content}
    </div>
  );
};
