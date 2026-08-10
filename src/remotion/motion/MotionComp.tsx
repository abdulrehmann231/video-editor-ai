import React from 'react';
import { AbsoluteFill, OffthreadVideo, Sequence } from 'remotion';
import type { MotionRenderProps } from '../../lib/motion/render/props';
import { ProgressBar } from '../components/ProgressBar';
import { LayerRenderer } from './LayerRenderer';

/**
 * The generic Motion composition: the cut video base, then each Motion IR
 * composition placed on the cut timeline as a Sequence, its layers rendered by
 * the single generic LayerRenderer. This is the parallel render path to `Edit`
 * (gated behind a flag); `Edit` stays the default until parity.
 *
 * Known Phase-1.5 gaps (handled in later phases): zoom_punch groups are empty
 * placeholders (base-video camera punch not yet applied); b-roll video layers
 * have no resolved `src` yet, so they render nothing.
 */
export const MotionComp: React.FC<Record<string, unknown>> = (props) => {
  const p = props as unknown as MotionRenderProps;
  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      {p.videoSrc ? (
        <OffthreadVideo src={p.videoSrc} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', color: '#4b5568', fontSize: 24 }}>
          (no video source)
        </AbsoluteFill>
      )}

      {p.compositions.map((comp) => {
        const from = Math.max(0, Math.round(comp.start * p.fps));
        const durationInFrames = Math.max(1, Math.round((comp.end - comp.start) * p.fps));
        return (
          <Sequence key={comp.id} from={from} durationInFrames={durationInFrames} layout="none">
            <AbsoluteFill>
              {comp.layers.map((layer) => (
                <LayerRenderer key={layer.id} layer={layer} />
              ))}
            </AbsoluteFill>
          </Sequence>
        );
      })}

      {p.progressBar && <ProgressBar />}
    </AbsoluteFill>
  );
};
