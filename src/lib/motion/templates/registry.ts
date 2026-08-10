import type { Camera, MotionLayer, Vec3 } from '../ir/types';
import { BuildCtx, PALETTE, constant, punchScale, scalePop, shapeLayer, textLayer } from './helpers';

/**
 * Effect template registry — the reusable, parameterized effects the AI/adapter
 * select instead of hand-building layers. Mirrors the threeRegistry/lottieRegistry
 * pattern (interface + array + ids + getter, whenToUse prose for the model).
 *
 * `build` is a DETERMINISTIC pure function (never model-generated code) that turns
 * clamped params into IR layers (+ an optional composition camera). The AI only
 * ever emits { templateId, params }.
 */

export type ParamType = 'number' | 'string' | 'color' | 'enum' | 'boolean';

export interface EffectParameter {
  name: string;
  type: ParamType;
  default: unknown;
  min?: number;
  max?: number;
  /** Allowed values for `enum` params. */
  options?: string[];
  description?: string;
  /** What the param controls semantically (energy, brand, timing, …). */
  semanticRole?: string;
}

export interface TemplateResult {
  layers: MotionLayer[];
  /** Composition-level camera (e.g. camera_punch moves the base footage). */
  camera?: Camera;
}

export interface EffectTemplate {
  id: string;
  version: string;
  name: string;
  /** Guidance for the model on when to choose this template. */
  whenToUse: string;
  renderer: 'remotion' | 'webgl' | 'webgpu' | 'blender' | 'rive';
  parameters: EffectParameter[];
  build: (params: Record<string, unknown>, ctx: BuildCtx) => TemplateResult;
}

const asStr = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const asNum = (v: unknown, fallback = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

export const TEMPLATES: EffectTemplate[] = [
  {
    id: 'kinetic_text',
    version: '1.0',
    name: 'Kinetic caption',
    whenToUse: 'Bold word captions over a spoken passage (hook, key point). Phase 4 upgrades this to true word-by-word.',
    renderer: 'remotion',
    parameters: [
      { name: 'text', type: 'string', default: '', description: 'The caption text.' },
      { name: 'style', type: 'enum', default: 'word_highlight', options: ['word_highlight', 'bold_pop', 'karaoke', 'typewriter'], semanticRole: 'style' },
    ],
    build: (p, ctx) => ({
      layers: [textLayer(`${ctx.idPrefix}_cap`, asStr(p.text), [0.5, 0.82], Math.round(ctx.canvas.width * 0.05), ctx.dur)],
    }),
  },
  {
    id: 'camera_punch',
    version: '1.0',
    name: 'Punch-in zoom',
    whenToUse: 'Snap a quick zoom on the base footage for emphasis or a hook. Moves the video, not an overlay.',
    renderer: 'remotion',
    parameters: [
      { name: 'scale', type: 'number', default: 1.15, min: 1.02, max: 1.6, semanticRole: 'energy' },
      { name: 'focus', type: 'enum', default: 'center', options: ['center', 'face', 'left', 'right', 'top'], semanticRole: 'composition' },
    ],
    build: (p, ctx) => ({
      layers: [],
      camera: { scale: punchScale(asNum(p.scale, 1.15), ctx.dur), focus: asStr(p.focus, 'center') as Camera['focus'] },
    }),
  },
  {
    id: 'lower_third',
    version: '1.0',
    name: 'Lower third',
    whenToUse: 'Introduce a speaker (name + role) or label a section. Clean, brief.',
    renderer: 'remotion',
    parameters: [
      { name: 'title', type: 'string', default: '' },
      { name: 'subtitle', type: 'string', default: '' },
    ],
    build: (p, ctx) => {
      const W = ctx.canvas.width;
      const sub = asStr(p.subtitle);
      return {
        layers: [
          {
            id: `${ctx.idPrefix}_lt`,
            type: 'group',
            start: 0,
            duration: ctx.dur,
            children: [
              shapeLayer(
                `${ctx.idPrefix}_bg`,
                { shape: 'rounded_rectangle', size: [0.42, 0.14], radius: 0.02, fill: PALETTE.ink, opacity: constant(0.72), transform: { position: constant<Vec3>([0.28, 0.82, 0]) } },
                ctx.dur,
              ),
              textLayer(`${ctx.idPrefix}_title`, asStr(p.title), [0.28, 0.8], Math.round(W * 0.03), ctx.dur),
              ...(sub ? [textLayer(`${ctx.idPrefix}_sub`, sub, [0.28, 0.86], Math.round(W * 0.02), ctx.dur, PALETTE.accent)] : []),
            ],
          },
        ],
      };
    },
  },
  {
    id: 'metric_pop',
    version: '1.0',
    name: 'Animated stat / metric',
    whenToUse: 'Pop a number/metric/percentage with a spring scale + accent. Great for finance/growth points.',
    renderer: 'remotion',
    parameters: [
      { name: 'value', type: 'string', default: '' },
      { name: 'label', type: 'string', default: '' },
      { name: 'position', type: 'enum', default: 'center', options: ['center', 'corner'], semanticRole: 'composition' },
    ],
    build: (p, ctx) => {
      const W = ctx.canvas.width;
      const [cx, cy] = asStr(p.position, 'center') === 'corner' ? [0.8, 0.2] : [0.5, 0.45];
      const label = asStr(p.label);
      return {
        layers: [
          {
            id: `${ctx.idPrefix}_stat`,
            type: 'group',
            start: 0,
            duration: ctx.dur,
            children: [
              shapeLayer(
                `${ctx.idPrefix}_accent`,
                { shape: 'circle', radius: 0.12, fill: PALETTE.accent, opacity: constant(0.18), transform: { position: constant<Vec3>([cx, cy, 0]), scale: scalePop(1) } },
                ctx.dur,
              ),
              {
                ...textLayer(`${ctx.idPrefix}_val`, asStr(p.value), [cx, cy], Math.round(W * 0.09), ctx.dur),
                transform: { position: constant<Vec3>([cx, cy, 0]), scale: scalePop(1) },
              },
              ...(label ? [textLayer(`${ctx.idPrefix}_lbl`, label, [cx, cy + 0.09], Math.round(W * 0.03), ctx.dur)] : []),
            ],
          },
        ],
      };
    },
  },
  {
    id: 'title_card',
    version: '1.0',
    name: 'Intro / CTA title card',
    whenToUse: 'Full-screen intro (topic) or CTA (subscribe) card overlaid on the footage; adds no time.',
    renderer: 'remotion',
    parameters: [
      { name: 'heading', type: 'string', default: '' },
      { name: 'sub', type: 'string', default: '' },
      { name: 'variant', type: 'enum', default: 'intro', options: ['intro', 'cta'], semanticRole: 'role' },
    ],
    build: (p, ctx) => {
      const W = ctx.canvas.width;
      const sub = asStr(p.sub);
      return {
        layers: [
          {
            id: `${ctx.idPrefix}_card`,
            type: 'group',
            start: 0,
            duration: ctx.dur,
            children: [
              shapeLayer(`${ctx.idPrefix}_cbg`, { shape: 'rectangle', size: [1, 1], fill: PALETTE.ink, opacity: constant(0.55), transform: { position: constant<Vec3>([0.5, 0.5, 0]) } }, ctx.dur),
              textLayer(`${ctx.idPrefix}_head`, asStr(p.heading), [0.5, 0.44], Math.round(W * 0.08), ctx.dur),
              ...(sub ? [textLayer(`${ctx.idPrefix}_csub`, sub, [0.5, 0.56], Math.round(W * 0.035), ctx.dur, PALETTE.accent)] : []),
            ],
          },
        ],
      };
    },
  },
  {
    id: 'transition_flash',
    version: '1.0',
    name: 'Scene transition',
    whenToUse: 'A brief flash/wipe at a strong topic boundary. Keep rare and short.',
    renderer: 'remotion',
    parameters: [{ name: 'variant', type: 'enum', default: 'flash', options: ['glitch', 'flash', 'zoom_blur'], semanticRole: 'style' }],
    build: (_p, ctx) => ({
      layers: [
        shapeLayer(
          `${ctx.idPrefix}_flash`,
          {
            shape: 'rectangle',
            size: [1, 1],
            fill: PALETTE.white,
            transform: { position: constant<Vec3>([0.5, 0.5, 0]) },
            opacity: { kind: 'keyframes', keyframes: [{ time: 0, value: 0 }, { time: ctx.dur / 2, value: 0.9 }, { time: ctx.dur, value: 0 }] },
          },
          ctx.dur,
        ),
      ],
    }),
  },
  {
    id: 'broll',
    version: '1.0',
    name: 'Stock b-roll',
    whenToUse: 'Overlay stock footage illustrating a concrete thing being said. Full frame or picture-in-picture.',
    renderer: 'remotion',
    parameters: [{ name: 'layout', type: 'enum', default: 'full', options: ['full', 'pip'], semanticRole: 'composition' }],
    build: (p, ctx) => {
      const full = asStr(p.layout, 'full') === 'full';
      return {
        layers: [
          {
            id: `${ctx.idPrefix}_broll`,
            type: 'video',
            start: 0,
            duration: ctx.dur,
            fit: full ? 'cover' : 'contain',
            opacity: constant(1),
            transform: {
              position: constant<Vec3>(full ? [0.5, 0.5, 0] : [0.72, 0.28, 0]),
              scale: constant<Vec3>(full ? [1, 1, 1] : [0.36, 0.36, 1]),
            },
            ...(full ? {} : { mask: { shape: 'rounded_rectangle', rect: { x: 0.54, y: 0.1, width: 0.36, height: 0.36 }, radius: 0.02 } as const }),
          },
        ],
      };
    },
  },
  {
    id: 'placeholder',
    version: '1.0',
    name: 'Placeholder',
    whenToUse: 'Reserved slot for effects not yet mapped to an executable template (e.g. lottie/three until Phase 5).',
    renderer: 'remotion',
    parameters: [],
    build: (_p, ctx) => ({
      layers: [{ id: `${ctx.idPrefix}_placeholder`, type: 'group', start: 0, duration: ctx.dur, children: [], opacity: constant(1) }],
    }),
  },
];

export const TEMPLATE_IDS: string[] = TEMPLATES.map((t) => t.id);

const BY_ID = new Map(TEMPLATES.map((t) => [t.id, t] as const));

export function getTemplate(id: string): EffectTemplate | undefined {
  return BY_ID.get(id);
}
