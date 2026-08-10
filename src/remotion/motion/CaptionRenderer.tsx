import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring } from 'remotion';
import type { CaptionLayer, CaptionPlacement, CaptionWord } from '../../lib/motion/ir/types';
import { FONT_DISPLAY, COLORS, outlineStyle } from '../theme';

/**
 * Word-by-word kinetic captions (Phase 4). Words are REVEALED one at a time as
 * they're spoken — each springs in (scale + rise + fade) at its own start time —
 * and the active word is emphasized. Centered and stable (grows word by word),
 * not a drifting subtitle line. Four styles: word_highlight, bold_pop, karaoke,
 * typewriter. Times are layer-relative (LayerRenderer wraps this in a Sequence).
 */

function wrapStyle(placement: CaptionPlacement): React.CSSProperties {
  // AbsoluteFill defaults to flex-direction: column, so set row explicitly:
  // justifyContent = horizontal centering, alignItems = the vertical band.
  const base: React.CSSProperties = { flexDirection: 'row', justifyContent: 'center', paddingLeft: '8%', paddingRight: '8%' };
  if (placement === 'upper') return { ...base, alignItems: 'flex-start', paddingTop: '14%' };
  if (placement === 'middle') return { ...base, alignItems: 'center' };
  return { ...base, alignItems: 'flex-end', paddingBottom: '16%' }; // lower (default)
}

function activeIndex(words: CaptionWord[], t: number): number {
  for (let i = 0; i < words.length; i++) if (t >= words[i].start && t <= words[i].end) return i;
  let last = -1;
  for (let i = 0; i < words.length; i++) if (words[i].start <= t) last = i;
  return last;
}

const clean = (w: string): string => w.replace(/^\s+|\s+$/g, '');
const key = (w: string): string => clean(w).toLowerCase().replace(/[^a-z0-9]/g, '');

export const CaptionRenderer: React.FC<{ layer: CaptionLayer }> = ({ layer }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const tAbs = frame / fps;
  const words = layer.words;
  const active = activeIndex(words, tAbs);
  if (active < 0) return null;

  const placement = layer.placement ?? 'lower';
  const fill = layer.fill ?? COLORS.white;
  const highlight = layer.highlight ?? COLORS.accent;
  const family = layer.family ? `${layer.family}, ${FONT_DISPLAY}` : FONT_DISPLAY;
  const emphasis = new Set((layer.emphasis ?? []).map(key));
  const fontSize = Math.round(width * (layer.size ?? 0.05));
  const stroke = Math.max(3, Math.round(fontSize * 0.09));

  if (layer.style === 'typewriter') {
    return <Typewriter layer={layer} tAbs={tAbs} active={active} fontSize={fontSize} stroke={stroke} family={family} fill={fill} highlight={highlight} placement={placement} />;
  }

  const isKaraoke = layer.style === 'karaoke';
  // word_highlight / bold_pop reveal words as spoken; karaoke shows the whole line.
  const lastVisible = isKaraoke ? words.length - 1 : active;

  const baseText: React.CSSProperties = {
    fontFamily: family,
    fontSize,
    lineHeight: 1.04,
    textTransform: 'uppercase',
    letterSpacing: layer.tracking ?? 0.5,
    ...outlineStyle(stroke),
  };

  return (
    <AbsoluteFill style={wrapStyle(placement)}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: `${fontSize * 0.2}px ${fontSize * 0.45}px`, maxWidth: '84%' }}>
        {words.slice(0, lastVisible + 1).map((w, idx) => {
          const isActive = idx === active;
          const isEmph = emphasis.has(key(w.word));
          const spoken = w.end <= tAbs;

          // Per-word entrance: spring from the word's own start time.
          const enter = spring({ frame: Math.max(0, frame - Math.round(w.start * fps)), fps, config: { damping: 13, mass: 0.5, stiffness: 190 } });
          const rise = (1 - enter) * fontSize * 0.4;
          // Active word gets an extra pop.
          const pop = isActive ? 1 + 0.16 * spring({ frame: Math.max(0, frame - Math.round(w.start * fps)), fps, config: { damping: 10, mass: 0.4, stiffness: 220 } }) : 1;
          const scale = (0.7 + 0.3 * enter) * pop;

          let color = fill;
          if (isKaraoke) color = spoken || isActive ? highlight : fill;
          else if (isActive || isEmph) color = highlight;

          if (layer.style === 'bold_pop' && isActive) {
            return (
              <span key={idx} style={{ ...baseText, color: COLORS.ink, WebkitTextStroke: '0px transparent', background: highlight, borderRadius: fontSize * 0.16, padding: `0 ${fontSize * 0.16}px`, transform: `translateY(${rise}px) scale(${scale}) rotate(-1.5deg)`, display: 'inline-block', opacity: enter, boxShadow: '0 10px 26px rgba(0,0,0,0.35)' }}>
                {clean(w.word)}
              </span>
            );
          }
          return (
            <span key={idx} style={{ ...baseText, color, transform: `translateY(${rise}px) scale(${scale})`, display: 'inline-block', opacity: enter }}>
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
  active: number;
  fontSize: number;
  stroke: number;
  family: string;
  fill: string;
  highlight: string;
  placement: CaptionPlacement;
}> = ({ layer, tAbs, active, fontSize, stroke, family, fill, highlight, placement }) => {
  const w = layer.words[active];
  const dur = Math.max(0.12, w.end - w.start);
  const prog = Math.min(1, Math.max(0, (tAbs - w.start) / dur));
  const activeText = clean(w.word);
  const typed = activeText.slice(0, Math.ceil(activeText.length * prog));
  const done = layer.words.slice(0, active).map((x) => clean(x.word)).join(' ');
  const cursorOn = Math.floor(tAbs * 2) % 2 === 0;

  return (
    <AbsoluteFill style={wrapStyle(placement)}>
      <div style={{ maxWidth: '84%', textAlign: 'center', fontFamily: family, fontSize, lineHeight: 1.12, textTransform: 'uppercase', letterSpacing: layer.tracking ?? 0.5, color: fill, ...outlineStyle(stroke) }}>
        {done ? done + ' ' : ''}
        <span style={{ color: highlight }}>{typed}</span>
        <span style={{ opacity: cursorOn ? 1 : 0 }}>▌</span>
      </div>
    </AbsoluteFill>
  );
};
