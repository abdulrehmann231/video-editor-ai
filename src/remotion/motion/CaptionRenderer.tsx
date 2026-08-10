import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring } from 'remotion';
import type { CaptionLayer, CaptionPlacement, CaptionWord } from '../../lib/motion/ir/types';
import { FONT_DISPLAY, COLORS, outlineStyle } from '../theme';

/**
 * Word-by-word kinetic captions (Phase 4) — the professional caption engine for
 * the Motion path. Ports the four styles from the legacy Captions component but
 * driven entirely by the IR CaptionLayer (per-word timing + brand colors/size/
 * placement). Times are layer-relative (LayerRenderer wraps this in a Sequence).
 */

function wrapStyle(placement: CaptionPlacement): React.CSSProperties {
  const base: React.CSSProperties = { position: 'absolute', left: 0, right: 0, display: 'flex', justifyContent: 'center', padding: '0 7%' };
  if (placement === 'upper') return { ...base, top: '12%', alignItems: 'flex-start' };
  if (placement === 'middle') return { ...base, top: 0, bottom: 0, alignItems: 'center' };
  return { ...base, bottom: '13%', alignItems: 'flex-end' }; // lower (default)
}

function findActiveWord(words: CaptionWord[], t: number): number {
  for (let i = 0; i < words.length; i++) if (t >= words[i].start && t <= words[i].end) return i;
  let last = -1;
  for (let i = 0; i < words.length; i++) if (words[i].start <= t) last = i;
  return last;
}

const clean = (w: string): string => w.replace(/^\s+|\s+$/g, '');

export const CaptionRenderer: React.FC<{ layer: CaptionLayer }> = ({ layer }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const tAbs = frame / fps;
  const words = layer.words;
  const activeIdx = findActiveWord(words, tAbs);
  if (activeIdx < 0) return null;

  const placement = layer.placement ?? 'lower';
  const fill = layer.fill ?? COLORS.white;
  const highlight = layer.highlight ?? COLORS.accent;
  const family = layer.family ? `${layer.family}, ${FONT_DISPLAY}` : FONT_DISPLAY;
  const emphasis = new Set((layer.emphasis ?? []).map((w) => w.toLowerCase().replace(/[^a-z0-9]/g, '')));

  if (layer.style === 'typewriter') {
    return <Typewriter layer={layer} tAbs={tAbs} activeIdx={activeIdx} width={width} family={family} fill={fill} highlight={highlight} placement={placement} />;
  }

  const fontSize = Math.round(width * (layer.size ?? 0.045));
  const stroke = Math.max(3, Math.round(fontSize * 0.09));
  const baseText: React.CSSProperties = {
    fontFamily: family,
    fontSize,
    lineHeight: 1.02,
    textTransform: 'uppercase',
    letterSpacing: layer.tracking ?? 0.5,
    color: fill,
    ...outlineStyle(stroke),
  };

  const windowSize = layer.style === 'bold_pop' ? 3 : 5;
  const start = Math.max(0, Math.min(activeIdx - Math.floor(windowSize / 2), words.length - windowSize));
  const from = Math.max(0, start);
  const win = words.slice(from, from + windowSize);

  const pop = spring({
    frame: Math.max(0, frame - Math.round(words[activeIdx].start * fps)),
    fps,
    config: { damping: 12, mass: 0.5, stiffness: 180 },
  });

  return (
    <AbsoluteFill style={wrapStyle(placement)}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: `${fontSize * 0.12}px ${fontSize * 0.3}px`, maxWidth: '90%' }}>
        {win.map((w, i) => {
          const idx = from + i;
          const isActive = idx === activeIdx;
          const isEmph = emphasis.has(clean(w.word).toLowerCase().replace(/[^a-z0-9]/g, ''));
          const spoken = w.end <= tAbs;
          let color = fill;
          if (layer.style === 'karaoke') color = spoken || isActive ? highlight : fill;
          else if (isActive || isEmph) color = highlight;

          if (layer.style === 'bold_pop' && isActive) {
            return (
              <span
                key={idx}
                style={{
                  ...baseText,
                  color: COLORS.ink,
                  WebkitTextStroke: '0px transparent',
                  background: highlight,
                  borderRadius: fontSize * 0.16,
                  padding: `0 ${fontSize * 0.16}px`,
                  transform: `scale(${1 + 0.14 * pop}) rotate(-1.5deg)`,
                  display: 'inline-block',
                  boxShadow: '0 10px 26px rgba(0,0,0,0.35)',
                }}
              >
                {clean(w.word)}
              </span>
            );
          }
          return (
            <span key={idx} style={{ ...baseText, color, transform: isActive ? `scale(${1 + 0.12 * pop})` : 'scale(1)', display: 'inline-block' }}>
              {clean(w.word)}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const Typewriter: React.FC<{
  layer: CaptionLayer;
  tAbs: number;
  activeIdx: number;
  width: number;
  family: string;
  fill: string;
  highlight: string;
  placement: CaptionPlacement;
}> = ({ layer, tAbs, activeIdx, width, family, fill, highlight, placement }) => {
  const active = layer.words[activeIdx];
  const dur = Math.max(0.12, active.end - active.start);
  const prog = Math.min(1, Math.max(0, (tAbs - active.start) / dur));
  const activeText = clean(active.word);
  const typed = activeText.slice(0, Math.ceil(activeText.length * prog));
  const done = layer.words.slice(0, activeIdx).map((w) => clean(w.word)).join(' ');
  const cursorOn = Math.floor(tAbs * 2) % 2 === 0;
  const fontSize = Math.round(width * (layer.size ?? 0.045));
  const stroke = Math.max(3, Math.round(fontSize * 0.08));

  return (
    <AbsoluteFill style={wrapStyle(placement)}>
      <div style={{ maxWidth: '88%', textAlign: 'center', fontFamily: family, fontSize, lineHeight: 1.12, textTransform: 'uppercase', letterSpacing: layer.tracking ?? 0.5, color: fill, ...outlineStyle(stroke) }}>
        {done ? done + ' ' : ''}
        <span style={{ color: highlight }}>{typed}</span>
        <span style={{ opacity: cursorOn ? 1 : 0 }}>▌</span>
      </div>
    </AbsoluteFill>
  );
};
