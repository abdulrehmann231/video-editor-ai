import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring } from 'remotion';
import type { CaptionLayer, CaptionPlacement, CaptionStyle, CaptionWord } from '../../lib/motion/ir/types';
import { FONT_DISPLAY, FONT_BODY, COLORS } from '../theme';

/**
 * Word-by-word kinetic captions (Phase 4). Eight distinct styles, and EVERY
 * visual knob is dynamic via the IR CaptionLayer: size, font family, weight,
 * tracking, placement, text color, highlight color, outline color/width,
 * background box (+ color + backdrop blur), and wrap width. Times are
 * layer-relative (LayerRenderer wraps this in a Sequence).
 */

function wrapStyle(placement: CaptionPlacement): React.CSSProperties {
  // AbsoluteFill defaults to flex-direction:column; set row so justifyContent
  // centers horizontally and alignItems picks the vertical band.
  const base: React.CSSProperties = { flexDirection: 'row', justifyContent: 'center', paddingLeft: '7%', paddingRight: '7%' };
  if (placement === 'upper') return { ...base, alignItems: 'flex-start', paddingTop: '12%' };
  if (placement === 'middle') return { ...base, alignItems: 'center' };
  return { ...base, alignItems: 'flex-end', paddingBottom: '11%' };
}

function activeIndex(words: CaptionWord[], t: number): number {
  for (let i = 0; i < words.length; i++) if (t >= words[i].start && t <= words[i].end) return i;
  let last = -1;
  for (let i = 0; i < words.length; i++) if (words[i].start <= t) last = i;
  return last;
}

function outline(px: number, color: string): React.CSSProperties {
  if (px <= 0) return { textShadow: '0 6px 22px rgba(0,0,0,0.5), 0 2px 3px rgba(0,0,0,0.7)' };
  return { WebkitTextStroke: `${px}px ${color}`, paintOrder: 'stroke fill', textShadow: '0 6px 22px rgba(0,0,0,0.55), 0 2px 3px rgba(0,0,0,0.8)' } as React.CSSProperties;
}

const clean = (w: string): string => w.replace(/^\s+|\s+$/g, '');
const key = (w: string): string => clean(w).toLowerCase().replace(/[^a-z0-9]/g, '');
const REVEAL_ALL: CaptionStyle[] = ['youtube', 'karaoke'];

export const CaptionRenderer: React.FC<{ layer: CaptionLayer }> = ({ layer }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const tAbs = frame / fps;
  const words = layer.words;
  const active = activeIndex(words, tAbs);
  if (active < 0) return null;

  const style = layer.style;
  const isYoutube = style === 'youtube';
  const placement = layer.placement ?? 'lower';
  const fill = layer.fill ?? COLORS.white;
  const highlight = layer.highlight ?? COLORS.accent;
  const defaultFace = isYoutube ? FONT_BODY : FONT_DISPLAY;
  const family = layer.family ? `${layer.family}, ${defaultFace}` : defaultFace;
  const emphasis = new Set((layer.emphasis ?? []).map(key));
  const fontSize = Math.round(width * (layer.size ?? 0.05));

  // Dynamic decorations.
  const outlineColor = layer.outlineColor ?? COLORS.ink;
  const strokeW = Math.max(0, Math.round(fontSize * (layer.outlineWidth ?? 0.09)));
  const maxWidthPct = `${Math.round((layer.maxWidth ?? 0.86) * 100)}%`;
  const showBox = isYoutube || layer.box === true;
  const boxColor = layer.boxColor ?? '#000000a8';
  const boxBlur = layer.boxBlur ?? 0;

  const boxWrap = (children: React.ReactNode): React.ReactNode =>
    showBox ? (
      <div
        style={{
          background: boxColor,
          borderRadius: fontSize * 0.28,
          padding: `${fontSize * 0.22}px ${fontSize * 0.42}px`,
          maxWidth: maxWidthPct,
          backdropFilter: boxBlur ? `blur(${boxBlur}px)` : undefined,
          WebkitBackdropFilter: boxBlur ? `blur(${boxBlur}px)` : undefined,
        }}
      >
        {children}
      </div>
    ) : (
      children
    );

  if (style === 'typewriter') {
    return <Typewriter layer={layer} tAbs={tAbs} active={active} fontSize={fontSize} strokeW={strokeW} outlineColor={outlineColor} maxWidthPct={maxWidthPct} family={family} fill={fill} highlight={highlight} placement={placement} boxWrap={boxWrap} />;
  }

  const baseText: React.CSSProperties = isYoutube
    ? { fontFamily: family, fontSize, lineHeight: 1.25, letterSpacing: layer.tracking ?? 0, fontWeight: layer.weight ?? 500, textShadow: '0 2px 6px rgba(0,0,0,0.6)' }
    : { fontFamily: family, fontSize, lineHeight: 1.06, textTransform: 'uppercase', letterSpacing: layer.tracking ?? 0.5, fontWeight: layer.weight, ...outline(strokeW, outlineColor) };

  if (style === 'single_word') {
    const w = words[active];
    const enter = spring({ frame: Math.max(0, frame - Math.round(w.start * fps)), fps, config: { damping: 11, mass: 0.5, stiffness: 200 } });
    return <AbsoluteFill style={wrapStyle(placement)}>{boxWrap(<span style={{ ...baseText, color: highlight, transform: `scale(${0.6 + 0.4 * enter})`, opacity: enter, display: 'inline-block' }}>{clean(w.word)}</span>)}</AbsoluteFill>;
  }

  const lastVisible = REVEAL_ALL.includes(style) ? words.length - 1 : active;
  const revealAll = REVEAL_ALL.includes(style);

  const row = (
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'flex-end', gap: `${fontSize * 0.2}px ${fontSize * 0.42}px`, maxWidth: showBox ? '100%' : maxWidthPct }}>
      {words.slice(0, lastVisible + 1).map((w, idx) => {
        const isActive = idx === active;
        const isEmph = emphasis.has(key(w.word));
        const spoken = w.end <= tAbs;
        const bouncy = style === 'bounce';
        const enterFrame = Math.max(0, frame - Math.round(w.start * fps));
        const enter = spring({ frame: enterFrame, fps, config: bouncy ? { damping: 7, mass: 0.6, stiffness: 170 } : { damping: 13, mass: 0.5, stiffness: 190 } });
        const rise = (1 - Math.min(1, enter)) * fontSize * 0.45;
        const pop = isActive ? 1 + 0.16 * spring({ frame: enterFrame, fps, config: { damping: 10, mass: 0.4, stiffness: 220 } }) : 1;
        const scale = (0.7 + 0.3 * Math.min(1, enter)) * pop;

        let color = fill;
        if (style === 'karaoke') color = spoken || isActive ? highlight : fill;
        else if (isYoutube) color = fill;
        else if (isActive || isEmph) color = highlight;

        if (style === 'bold_pop' && isActive) {
          return (
            <span key={idx} style={{ ...baseText, color: COLORS.ink, WebkitTextStroke: '0px transparent', background: highlight, borderRadius: fontSize * 0.16, padding: `0 ${fontSize * 0.16}px`, transform: `translateY(${rise}px) scale(${scale}) rotate(-1.5deg)`, display: 'inline-block', opacity: enter, boxShadow: '0 10px 26px rgba(0,0,0,0.35)' }}>
              {clean(w.word)}
            </span>
          );
        }
        const underline = style === 'underline' && isActive ? { borderBottom: `${Math.max(3, Math.round(fontSize * 0.12))}px solid ${highlight}`, paddingBottom: fontSize * 0.06 } : {};
        const transform = isYoutube ? 'none' : `translateY(${rise}px) scale(${scale})`;
        return (
          <span key={idx} style={{ ...baseText, color, transform, display: 'inline-block', opacity: revealAll ? 1 : enter, textTransform: isYoutube ? 'none' : 'uppercase', ...underline }}>
            {clean(w.word)}
          </span>
        );
      })}
    </div>
  );

  return <AbsoluteFill style={wrapStyle(placement)}>{boxWrap(row)}</AbsoluteFill>;
};

const Typewriter: React.FC<{
  layer: CaptionLayer;
  tAbs: number;
  active: number;
  fontSize: number;
  strokeW: number;
  outlineColor: string;
  maxWidthPct: string;
  family: string;
  fill: string;
  highlight: string;
  placement: CaptionPlacement;
  boxWrap: (c: React.ReactNode) => React.ReactNode;
}> = ({ layer, tAbs, active, fontSize, strokeW, outlineColor, maxWidthPct, family, fill, highlight, placement, boxWrap }) => {
  const w = layer.words[active];
  const dur = Math.max(0.12, w.end - w.start);
  const prog = Math.min(1, Math.max(0, (tAbs - w.start) / dur));
  const activeText = clean(w.word);
  const typed = activeText.slice(0, Math.ceil(activeText.length * prog));
  const done = layer.words.slice(0, active).map((x) => clean(x.word)).join(' ');
  const cursorOn = Math.floor(tAbs * 2) % 2 === 0;

  return (
    <AbsoluteFill style={wrapStyle(placement)}>
      {boxWrap(
        <div style={{ maxWidth: maxWidthPct, textAlign: 'center', fontFamily: family, fontSize, lineHeight: 1.12, textTransform: 'uppercase', letterSpacing: layer.tracking ?? 0.5, fontWeight: layer.weight, color: fill, ...outline(strokeW, outlineColor) }}>
          {done ? done + ' ' : ''}
          <span style={{ color: highlight }}>{typed}</span>
          <span style={{ opacity: cursorOn ? 1 : 0 }}>▌</span>
        </div>,
      )}
    </AbsoluteFill>
  );
};
