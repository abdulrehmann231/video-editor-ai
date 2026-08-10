import { z } from 'zod';
import { IR_VERSION } from './version';
import type { MotionComposition, MotionLayer } from './types';

/**
 * Zod mirror of the Motion IR (Node-only — never imported into the Remotion
 * bundle). Follows `parseEdl`'s self-healing philosophy: the top-level shape must
 * be valid (throws otherwise), but individually-invalid layers are dropped with a
 * warning rather than failing the whole composition. Deep numeric bounds are the
 * validator's job (see validators/validate.ts); the schema enforces structure.
 */

const easingZ = z.discriminatedUnion('type', [
  z.object({ type: z.literal('linear') }),
  z.object({ type: z.literal('easeIn') }),
  z.object({ type: z.literal('easeOut') }),
  z.object({ type: z.literal('easeInOut') }),
  z.object({ type: z.literal('bezier'), x1: z.number(), y1: z.number(), x2: z.number(), y2: z.number() }),
  z.object({ type: z.literal('back'), amount: z.number() }),
  z.object({ type: z.literal('elastic'), amplitude: z.number(), period: z.number() }),
]);

const springZ = z.object({
  mass: z.number(),
  stiffness: z.number(),
  damping: z.number(),
  initialVelocity: z.number().optional(),
});

function animatedZ<T extends z.ZodTypeAny>(v: T) {
  return z.object({
    kind: z.enum(['constant', 'keyframes', 'spring']),
    value: v.optional(),
    from: v.optional(),
    keyframes: z.array(z.object({ time: z.number(), value: v, easing: easingZ.optional() })).optional(),
    spring: springZ.optional(),
  });
}

const vec2Z = z.tuple([z.number(), z.number()]);
const vec3Z = z.tuple([z.number(), z.number(), z.number()]);

const transformZ = z.object({
  position: animatedZ(vec3Z).optional(),
  scale: animatedZ(vec3Z).optional(),
  rotation: animatedZ(vec3Z).optional(),
  anchor: animatedZ(vec3Z).optional(),
  skew: animatedZ(vec2Z).optional(),
});

const blendZ = z.enum(['normal', 'multiply', 'screen', 'overlay', 'soft_light', 'add', 'darken', 'lighten']);
const strokeZ = z.object({ color: z.string(), width: z.number() });
const maskZ = z.object({
  shape: z.enum(['rectangle', 'rounded_rectangle', 'circle']),
  rect: z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() }).optional(),
  radius: z.number().optional(),
});

const baseFields = {
  id: z.string().min(1),
  start: z.number(),
  duration: z.number(),
  visible: z.boolean().optional(),
  transform: transformZ.optional(),
  opacity: animatedZ(z.number()).optional(),
  blendMode: blendZ.optional(),
  mask: maskZ.optional(),
  zIndex: z.number().optional(),
  parentId: z.string().optional(),
};
const base = z.object(baseFields);

const textZ = base.extend({
  type: z.literal('text'),
  content: z.string(),
  font: z
    .object({
      family: z.string().optional(),
      weight: z.number().optional(),
      size: z.number().optional(),
      tracking: z.number().optional(),
      leading: z.number().optional(),
    })
    .optional(),
  align: z.enum(['left', 'center', 'right']).optional(),
  fill: z.string().optional(),
  stroke: strokeZ.optional(),
  kinetic: z
    .object({
      target: z.enum(['word', 'char', 'line', 'layer']),
      enter: z.string().optional(),
      emphasis: z.array(z.string()).optional(),
      stagger: z.number().optional(),
    })
    .optional(),
});

const shapeZ = base.extend({
  type: z.literal('shape'),
  shape: z.enum(['rectangle', 'rounded_rectangle', 'circle', 'ellipse', 'line']),
  size: vec2Z.optional(),
  radius: z.number().optional(),
  fill: z.string().optional(),
  stroke: strokeZ.optional(),
});

const videoZ = base.extend({
  type: z.literal('video'),
  assetId: z.string().optional(),
  src: z.string().optional(),
  fit: z.enum(['cover', 'contain']).optional(),
});

const imageZ = base.extend({
  type: z.literal('image'),
  assetId: z.string().optional(),
  src: z.string().optional(),
  fit: z.enum(['cover', 'contain']).optional(),
});

const transitionZ = base.extend({
  type: z.literal('transition'),
  variant: z.enum(['glitch', 'flash', 'zoom_blur']),
});

const CAPTION_STYLES = ['word_highlight', 'bold_pop', 'karaoke', 'typewriter', 'youtube', 'single_word', 'underline', 'bounce'] as const;

const captionZ = base.extend({
  type: z.literal('caption'),
  words: z.array(z.object({ word: z.string(), start: z.number(), end: z.number() })),
  style: z.enum(CAPTION_STYLES),
  placement: z.enum(['lower', 'middle', 'upper']).optional(),
  size: z.number().optional(),
  fill: z.string().optional(),
  highlight: z.string().optional(),
  family: z.string().optional(),
  weight: z.number().optional(),
  tracking: z.number().optional(),
  emphasis: z.array(z.string()).optional(),
  box: z.boolean().optional(),
  boxColor: z.string().optional(),
  boxBlur: z.number().optional(),
  maxWidth: z.number().optional(),
  outlineColor: z.string().optional(),
  outlineWidth: z.number().optional(),
});

// Recursive: a group holds child layers of any supported type.
const layerZ: z.ZodType<MotionLayer> = z.lazy(() =>
  z.discriminatedUnion('type', [textZ, shapeZ, videoZ, imageZ, groupZ, transitionZ, captionZ]),
);

const groupZ = base.extend({
  type: z.literal('group'),
  children: z.array(layerZ),
});

const assetZ = z.object({
  id: z.string(),
  type: z.enum(['video', 'image', 'audio', 'font', 'lottie']),
  uri: z.string(),
  metadata: z.record(z.unknown()).optional(),
});

const metadataZ = z.object({
  purpose: z.string().optional(),
  style: z.array(z.string()).optional(),
  references: z.array(z.string()).optional(),
  confidence: z.number().optional(),
  generatedBy: z.string().optional(),
  sourceOpId: z.string().optional(),
  sourceOpType: z.string().optional(),
  reason: z.string().optional(),
  variant: z.string().optional(),
  query: z.string().optional(),
  template: z.string().optional(),
});

const cameraZ = z.object({
  scale: animatedZ(vec3Z).optional(),
  focus: z.enum(['center', 'face', 'left', 'right', 'top']).optional(),
});

/** Top-level composition WITHOUT layers (layers are validated individually). */
const compositionShellZ = z.object({
  schemaVersion: z.literal(IR_VERSION),
  id: z.string().min(1),
  start: z.number(),
  end: z.number(),
  timeBasis: z.enum(['source', 'cut', 'relative']).default('cut'),
  coordinateSpace: z.enum(['normalized', 'pixels']).default('normalized'),
  canvas: z.object({ width: z.number(), height: z.number(), fps: z.number() }),
  background: z.string().optional(),
  camera: cameraZ.optional(),
  assets: z.array(assetZ).optional(),
  metadata: metadataZ.optional(),
});

export { layerZ };

/**
 * Strip null / undefined / empty-string values so optional fields the flat model
 * output emits don't choke the discriminated-union parse (mirrors edl/schema.ts).
 */
function stripEmpty(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripEmpty);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === null || v === undefined || v === '') continue;
      out[k] = stripEmpty(v);
    }
    return out;
  }
  return value;
}

/**
 * Validate + normalize raw JSON into a MotionComposition. Throws if the top-level
 * shape is invalid; drops individually-invalid layers with a warning.
 */
export function parseMotionComposition(raw: unknown): { comp: MotionComposition; warnings: string[] } {
  const cleaned = stripEmpty(raw) as { layers?: unknown };
  const shell = compositionShellZ.parse(cleaned);
  const warnings: string[] = [];

  const rawLayers = Array.isArray(cleaned?.layers) ? cleaned.layers : [];
  const layers: MotionLayer[] = [];
  for (const l of rawLayers) {
    const res = layerZ.safeParse(l);
    if (!res.success) {
      const t = (l as { type?: string })?.type ?? 'unknown';
      warnings.push(`Dropped invalid ${t} layer: ${res.error.issues[0]?.message ?? 'schema error'}`);
      continue;
    }
    layers.push(res.data);
  }

  const comp: MotionComposition = { ...shell, layers } as MotionComposition;
  return { comp, warnings };
}
