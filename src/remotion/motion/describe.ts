import type { MotionComposition, MotionLayer } from '../../lib/motion/ir/types';
import { sampleNumber, sampleVec3 } from './anim/resolveAnimated';
import { cssBlendMode, clipPathFromMask } from './decorations';

/**
 * Pure, deterministic description of what a composition renders at given frames —
 * the resolved geometry + decorations each layer receives. This is the same math
 * the React renderers apply (transform sampling, blend, mask), extracted so it
 * can be snapshot-tested in node WITHOUT a headless browser. It's the CI-safe
 * "golden render-graph" guard; the optional pixel golden (RUN_VISUAL) verifies
 * the actual DOM/CSS output on top of this.
 */

export interface LayerRender {
  id: string;
  type: MotionLayer['type'];
  active: boolean;
  opacity: number;
  position: [number, number];
  scale: [number, number];
  rotationZ: number;
  blendMode: string;
  clipPath?: string;
  // type-specific
  content?: string;
  shape?: string;
  fit?: string;
  hasSrc?: boolean;
  children?: LayerRender[];
}

const r3 = (n: number): number => Math.round(n * 1000) / 1000;

/** Describe a single layer at a composition-relative time (seconds). */
export function describeLayer(layer: MotionLayer, compTimeSec: number, fps: number): LayerRender {
  const active = compTimeSec >= layer.start - 1e-6 && compTimeSec <= layer.start + layer.duration + 1e-6;
  const localFrame = Math.max(0, Math.round((compTimeSec - layer.start) * fps));

  const [px, py] = sampleVec3(layer.transform?.position, localFrame, fps, [0.5, 0.5, 0]);
  const [sx, sy] = sampleVec3(layer.transform?.scale, localFrame, fps, [1, 1, 1]);
  const [, , rz] = sampleVec3(layer.transform?.rotation, localFrame, fps, [0, 0, 0]);
  const opacity = sampleNumber(layer.opacity, localFrame, fps, 1);

  const out: LayerRender = {
    id: layer.id,
    type: layer.type,
    active,
    opacity: r3(opacity),
    position: [r3(px), r3(py)],
    scale: [r3(sx), r3(sy)],
    rotationZ: r3(rz),
    blendMode: cssBlendMode(layer.blendMode) ?? 'normal',
    clipPath: clipPathFromMask(layer.mask),
  };

  if (layer.type === 'text') out.content = layer.content;
  if (layer.type === 'shape') out.shape = layer.shape;
  if (layer.type === 'video' || layer.type === 'image') {
    out.fit = layer.fit ?? 'cover';
    out.hasSrc = Boolean(layer.src);
  }
  if (layer.type === 'group') {
    out.children = layer.children.map((c) => describeLayer(c, compTimeSec - layer.start, fps));
  }
  return out;
}

export interface CompositionRender {
  id: string;
  start: number;
  end: number;
  atFrames: { frame: number; cameraScale?: number; layers: LayerRender[] }[];
}

/** Describe a composition at the given (composition-relative) frame numbers. */
export function describeComposition(comp: MotionComposition, frames: number[], fps: number): CompositionRender {
  return {
    id: comp.id,
    start: r3(comp.start),
    end: r3(comp.end),
    atFrames: frames.map((frame) => ({
      frame,
      cameraScale: comp.camera?.scale ? r3(sampleVec3(comp.camera.scale, frame, fps, [1, 1, 1])[0]) : undefined,
      layers: comp.layers.map((l) => describeLayer(l, frame / fps, fps)),
    })),
  };
}
