import React, { useEffect, useState } from 'react';
import { AbsoluteFill, Sequence, staticFile, continueRender, delayRender } from 'remotion';
import { Lottie, type LottieAnimationData } from '@remotion/lottie';
import type { LottieOverlay } from '../types';
import { getLottieTemplate, type LottiePosition } from '../../lib/render/lottieRegistry';

/**
 * Pro animated overlays via Lottie (After-Effects-quality 2D, rendered in the
 * cloud — no AE). Each overlay loads a bundled JSON from public/lottie and is
 * positioned full-frame, centered, or in a corner.
 */
export const LottieLayer: React.FC<{ lotties: LottieOverlay[]; fps: number }> = ({ lotties, fps }) => (
  <>
    {lotties.map((l) => {
      const tpl = getLottieTemplate(l.template);
      if (!tpl) return null;
      const from = Math.round(l.start * fps);
      const durationInFrames = Math.max(1, Math.round((l.end - l.start) * fps));
      const position = l.position ?? tpl.position;
      return (
        <Sequence key={l.id} from={from} durationInFrames={durationInFrames}>
          <OneLottie file={tpl.file} position={position} scale={tpl.scale} loop={tpl.loop} />
        </Sequence>
      );
    })}
  </>
);

const OneLottie: React.FC<{ file: string; position: LottiePosition; scale: number; loop: boolean }> = ({
  file,
  position,
  scale,
  loop,
}) => {
  const [data, setData] = useState<LottieAnimationData | null>(null);
  const [handle] = useState(() => delayRender(`lottie:${file}`));

  useEffect(() => {
    let alive = true;
    fetch(staticFile(`lottie/${file}`))
      .then((r) => r.json())
      .then((json) => {
        if (alive) {
          setData(json as LottieAnimationData);
          continueRender(handle);
        }
      })
      .catch(() => continueRender(handle));
    return () => {
      alive = false;
    };
  }, [file, handle]);

  if (!data) return null;

  if (position === 'full') {
    return (
      <AbsoluteFill>
        <Lottie animationData={data} loop={loop} style={{ width: '100%', height: '100%' }} />
      </AbsoluteFill>
    );
  }

  const wrap: React.CSSProperties =
    position === 'corner'
      ? { justifyContent: 'flex-start', alignItems: 'flex-end', padding: '6% 5%' }
      : { justifyContent: 'center', alignItems: 'center' };

  return (
    <AbsoluteFill style={wrap}>
      <div style={{ width: `${scale * 100}%`, aspectRatio: '1 / 1' }}>
        <Lottie animationData={data} loop={loop} style={{ width: '100%', height: '100%' }} />
      </div>
    </AbsoluteFill>
  );
};
