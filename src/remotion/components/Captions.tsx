import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, spring } from 'remotion';
import type { CaptionOverlay } from '../types';
import { FONT_DISPLAY, COLORS, outlineStyle } from '../theme';

/**
 * Modern YouTube-style word captions: heavy display font, thick outline, the
 * active word pops (spring scale) and highlights. Four styles:
 *  - word_highlight : active word colored + scale pop
 *  - bold_pop       : active word in a rounded highlight "sticker"
 *  - karaoke        : words fill with colour as they're spoken
 *  - typewriter     : phrase builds up character-by-character
 */
export type CaptionPlacement = 'lower' | 'middle' | 'upper';

export const Captions: React.FC<{ captions: CaptionOverlay[]; fps: number; placement?: CaptionPlacement }> = ({
  captions,
  fps,
  placement = 'lower',
}) => (
  <>
    {captions.map((c) => {
      const from = Math.round(c.start * fps);
      const durationInFrames = Math.max(1, Math.round((c.end - c.start) * fps));
      return (
        <Sequence key={c.id} from={from} durationInFrames={durationInFrames}>
          <CaptionBlock caption={c} placement={placement} />
        </Sequence>
      );
    })}
  </>
);

/**
 * Vertical placement of the caption block. The AI (PLAN stage) picks this per
 * video so subtitles don't cover the speaker's face or on-screen text. 'lower'
 * is the standard YouTube lower-third spot.
 */
function wrapStyle(placement: CaptionPlacement): React.CSSProperties {
  const base: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    right: 0,
    display: 'flex',
    justifyContent: 'center',
    padding: '0 7%',
  };
  if (placement === 'upper') return { ...base, top: '12%', alignItems: 'flex-start' };
  if (placement === 'middle') return { ...base, top: 0, bottom: 0, alignItems: 'center' };
  return { ...base, bottom: '13%', alignItems: 'flex-end' }; // 'lower' (default)
}

const CaptionBlock: React.FC<{ caption: CaptionOverlay; placement: CaptionPlacement }> = ({ caption, placement }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const tAbs = caption.start + frame / fps;
  const activeIdx = findActiveWord(caption.words, tAbs);
  if (activeIdx < 0) return null;

  if (caption.style === 'typewriter') {
    return <Typewriter caption={caption} tAbs={tAbs} activeIdx={activeIdx} width={width} placement={placement} />;
  }

  const fontSize = Math.round(width * 0.062);
  const stroke = Math.max(4, Math.round(fontSize * 0.09));
  const base: React.CSSProperties = {
    fontFamily: FONT_DISPLAY,
    fontSize,
    lineHeight: 1.02,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: COLORS.white,
    ...outlineStyle(stroke),
  };

  // window of words centered on the active one
  const windowSize = caption.style === 'bold_pop' ? 3 : 5;
  const start = Math.max(0, Math.min(activeIdx - Math.floor(windowSize / 2), caption.words.length - windowSize));
  const from = Math.max(0, start);
  const win = caption.words.slice(from, from + windowSize);

  const pop = spring({
    frame: Math.max(0, frame - Math.round((caption.words[activeIdx].start - caption.start) * fps)),
    fps,
    config: { damping: 12, mass: 0.5, stiffness: 180 },
  });

  return (
    <AbsoluteFill style={wrapStyle(placement)}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: `${fontSize * 0.12}px ${fontSize * 0.3}px`, maxWidth: '90%' }}>
        {win.map((w, i) => {
          const idx = from + i;
          const isActive = idx === activeIdx;
          const spoken = w.end <= tAbs;
          let color = COLORS.white;
          if (caption.style === 'karaoke') color = spoken || isActive ? COLORS.accent : COLORS.white;
          else if (isActive) color = COLORS.accent;

          if (caption.style === 'bold_pop' && isActive) {
            return (
              <span
                key={idx}
                style={{
                  ...base,
                  color: COLORS.ink,
                  WebkitTextStroke: '0px transparent',
                  background: COLORS.accent,
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
            <span
              key={idx}
              style={{
                ...base,
                color,
                transform: isActive ? `scale(${1 + 0.12 * pop})` : 'scale(1)',
                display: 'inline-block',
              }}
            >
              {clean(w.word)}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const Typewriter: React.FC<{
  caption: CaptionOverlay;
  tAbs: number;
  activeIdx: number;
  width: number;
  placement: CaptionPlacement;
}> = ({ caption, tAbs, activeIdx, width, placement }) => {
  const active = caption.words[activeIdx];
  const dur = Math.max(0.12, active.end - active.start);
  const prog = Math.min(1, Math.max(0, (tAbs - active.start) / dur));
  const activeText = clean(active.word);
  const typed = activeText.slice(0, Math.ceil(activeText.length * prog));
  const done = caption.words.slice(0, activeIdx).map((w) => clean(w.word)).join(' ');
  const cursorOn = Math.floor(tAbs * 2) % 2 === 0;
  const fontSize = Math.round(width * 0.05);
  const stroke = Math.max(4, Math.round(fontSize * 0.08));

  return (
    <AbsoluteFill style={wrapStyle(placement)}>
      <div
        style={{
          maxWidth: '88%',
          textAlign: 'center',
          fontFamily: FONT_DISPLAY,
          fontSize,
          lineHeight: 1.12,
          textTransform: 'uppercase',
          color: COLORS.white,
          ...outlineStyle(stroke),
        }}
      >
        {done ? done + ' ' : ''}
        <span style={{ color: COLORS.accent }}>{typed}</span>
        <span style={{ opacity: cursorOn ? 1 : 0 }}>▌</span>
      </div>
    </AbsoluteFill>
  );
};

function findActiveWord(words: CaptionOverlay['words'], t: number): number {
  for (let i = 0; i < words.length; i++) if (t >= words[i].start && t <= words[i].end) return i;
  let last = -1;
  for (let i = 0; i < words.length; i++) if (words[i].start <= t) last = i;
  return last;
}

function clean(w: string): string {
  return w.replace(/^\s+|\s+$/g, '');
}
