import React from 'react';
import { AbsoluteFill, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Camera } from '../../lib/motion/ir/types';
import type { MotionRenderProps } from '../../lib/motion/render/props';
import { ProgressBar } from '../components/ProgressBar';
import { LayerRenderer } from './LayerRenderer';
import { resolveSrc } from './src';
import { sampleVec3 } from './anim/resolveAnimated';

/**
 * The generic Motion composition: the cut video base (with any active
 * composition camera applied), then each Motion IR composition placed on the cut
 * timeline as a Sequence, its layers rendered by the single generic
 * LayerRenderer. Parallel render path to `Edit` (flag-gated).
 */

const ORIGIN: Record<NonNullable<Camera['focus']>, string> = {
  center: '50% 50%',
  face: '50% 38%',
  left: '30% 50%',
  right: '70% 50%',
  top: '50% 25%',
};

interface CameraWindow {
  start: number;
  end: number;
  camera: Camera;
}

/** Base footage with composition-level camera (e.g. punch-in zoom) applied. */
const CameraVideo: React.FC<{ src: string; cameras: CameraWindow[] }> = ({ src, cameras }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const active = cameras.find((c) => t >= c.start && t <= c.end);

  let scale = 1;
  let origin = '50% 50%';
  if (active?.camera.scale) {
    const local = Math.max(0, Math.round((t - active.start) * fps));
    scale = sampleVec3(active.camera.scale, local, fps, [1, 1, 1])[0];
    origin = ORIGIN[active.camera.focus ?? 'center'] ?? '50% 50%';
  }

  if (!src) {
    return (
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', color: '#4b5568', fontSize: 24 }}>
        (no video source)
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <AbsoluteFill style={{ transform: `scale(${scale})`, transformOrigin: origin }}>
        <OffthreadVideo src={resolveSrc(src)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const MotionComp: React.FC<Record<string, unknown>> = (props) => {
  const p = props as unknown as MotionRenderProps;

  const cameras: CameraWindow[] = p.compositions
    .filter((c) => c.camera?.scale)
    .map((c) => ({ start: c.start, end: c.end, camera: c.camera! }));

  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      <CameraVideo src={p.videoSrc} cameras={cameras} />

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
