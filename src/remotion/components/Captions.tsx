import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, spring } from 'remotion';
import type { CaptionOverlay } from '../types';

/**
 * Bold word-by-word captions (B2B/YouTube style). For each caption window we
 * render a short rolling group of words with the currently-spoken word
 * highlighted and popped.
 */
export const Captions: React.FC<{ captions: CaptionOverlay[]; fps: number }> = ({ captions, fps }) => (
  <>
    {captions.map((c) => {
      const from = Math.round(c.start * fps);
      const durationInFrames = Math.max(1, Math.round((c.end - c.start) * fps));
      return (
        <Sequence key={c.id} from={from} durationInFrames={durationInFrames}>
          <CaptionBlock caption={c} />
        </Sequence>
      );
    })}
  </>
);

const CaptionBlock: React.FC<{ caption: CaptionOverlay }> = ({ caption }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const tAbs = caption.start + frame / fps;

  const activeIdx = findActiveWord(caption.words, tAbs);
  if (activeIdx < 0) return null;

  // rolling window of up to 3 words centered on the active one
  const start = Math.max(0, activeIdx - 1);
  const windowWords = caption.words.slice(start, start + 3);

  const pop = spring({ frame: Math.max(0, frame - Math.round((caption.words[activeIdx].start - caption.start) * fps)), fps, config: { damping: 200, mass: 0.5 } });
  const fontSize = Math.round(width * 0.055);

  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: '10%' }}>
      <div
        style={{
          display: 'flex',
          gap: fontSize * 0.35,
          maxWidth: '84%',
          flexWrap: 'wrap',
          justifyContent: 'center',
          fontFamily: 'Inter, Arial, sans-serif',
          fontWeight: 800,
          fontSize,
          lineHeight: 1.1,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        {windowWords.map((w, i) => {
          const isActive = start + i === activeIdx;
          return (
            <span
              key={i}
              style={{
                color: isActive ? '#ffe14d' : '#ffffff',
                transform: isActive ? `scale(${1 + 0.12 * pop})` : 'scale(1)',
                textShadow: '0 4px 18px rgba(0,0,0,0.85), 0 2px 3px rgba(0,0,0,0.9)',
                padding: '0 2px',
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

function findActiveWord(words: CaptionOverlay['words'], t: number): number {
  for (let i = 0; i < words.length; i++) {
    if (t >= words[i].start && t <= words[i].end) return i;
  }
  // between words: highlight the most recent one that has started
  let last = -1;
  for (let i = 0; i < words.length; i++) if (words[i].start <= t) last = i;
  return last;
}

function clean(w: string): string {
  return w.replace(/^\s+|\s+$/g, '');
}
