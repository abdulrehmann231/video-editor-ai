import type { AnnotationKind, Camera, MotionLayer, Vec2, Vec3 } from '../ir/types';
import { DEFAULT_BRAND } from '../brand';
import { annotationLayer, BuildCtx, constant, fadeIn, meterLayer, punchScale, reveal, scalePop, shapeLayer, textLayer } from './helpers';

/**
 * Effect template registry — the reusable, parameterized effects the AI/adapter
 * select instead of hand-building layers. Mirrors the threeRegistry/lottieRegistry
 * pattern (interface + array + ids + getter, whenToUse prose for the model).
 *
 * `build` is a DETERMINISTIC pure function (never model-generated code) that turns
 * clamped params into IR layers (+ an optional composition camera). The AI only
 * ever emits { templateId, params }.
 */

export type ParamType = 'number' | 'string' | 'color' | 'enum' | 'boolean' | 'list';

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

/** Coerce a loose param into an array of {text, mark} rows (checklist/list). */
interface ListRow { text: string; mark: 'check' | 'cross' | 'dot' }
function asRows(v: unknown, defaultMark: ListRow['mark'] = 'dot'): ListRow[] {
  if (!Array.isArray(v)) return [];
  const marks = new Set(['check', 'cross', 'dot']);
  return v
    .map((it): ListRow | null => {
      if (typeof it === 'string') return { text: it, mark: defaultMark };
      if (it && typeof it === 'object') {
        const t = asStr((it as Record<string, unknown>).text);
        if (!t) return null;
        const m = asStr((it as Record<string, unknown>).mark, defaultMark);
        return { text: t, mark: (marks.has(m) ? m : defaultMark) as ListRow['mark'] };
      }
      return null;
    })
    .filter((r): r is ListRow => r !== null)
    .slice(0, 6);
}

export const TEMPLATES: EffectTemplate[] = [
  {
    id: 'kinetic_text',
    version: '1.0',
    name: 'Kinetic caption',
    whenToUse: 'Bold word captions over a spoken passage (hook, key point). Phase 4 upgrades this to true word-by-word.',
    renderer: 'remotion',
    parameters: [
      { name: 'text', type: 'string', default: '', description: 'Whole-phrase fallback text (used when no per-word timing is supplied).' },
      { name: 'style', type: 'enum', default: 'word_highlight', options: ['word_highlight', 'bold_pop', 'karaoke', 'typewriter', 'youtube', 'single_word', 'underline', 'bounce', 'char_reveal', 'scramble', 'mask_reveal', 'tracking_in'], semanticRole: 'style' },
      { name: 'size', type: 'number', default: 0.05, min: 0.02, max: 0.15, description: 'Font size as a fraction of frame width (single-word styles go large).', semanticRole: 'emphasis' },
      { name: 'weight', type: 'number', default: 800, min: 100, max: 900, semanticRole: 'emphasis' },
      { name: 'tracking', type: 'number', default: 0, min: -5, max: 40, description: 'Letter-spacing in px.', semanticRole: 'style' },
      { name: 'placement', type: 'enum', default: 'lower', options: ['lower', 'middle', 'upper'], semanticRole: 'composition' },
      { name: 'fill', type: 'color', default: undefined, description: 'Text color (defaults to brand text).', semanticRole: 'brand' },
      { name: 'highlight', type: 'color', default: undefined, description: 'Active-word color (defaults to brand accent).', semanticRole: 'brand' },
      { name: 'fontFamily', type: 'string', default: undefined, description: 'Font family (defaults to brand heading).', semanticRole: 'brand' },
      { name: 'box', type: 'boolean', default: false, description: 'Draw a background box behind the caption.', semanticRole: 'style' },
      { name: 'boxColor', type: 'string', default: undefined, description: 'Box fill color (any CSS color incl. rgba()).', semanticRole: 'brand' },
      { name: 'boxBlur', type: 'number', default: undefined, min: 0, max: 40, description: 'Backdrop blur behind the box (px).', semanticRole: 'style' },
      { name: 'maxWidth', type: 'number', default: undefined, min: 0.3, max: 1, description: 'Caption block max width (fraction of frame).', semanticRole: 'layout' },
      { name: 'outlineColor', type: 'string', default: undefined, description: 'Text outline/stroke color (any CSS color).', semanticRole: 'brand' },
      { name: 'outlineWidth', type: 'number', default: undefined, min: 0, max: 0.3, description: 'Outline width (fraction of font size).', semanticRole: 'style' },
    ],
    build: (p, ctx) => {
      const b = ctx.brand ?? DEFAULT_BRAND;
      const placement = asStr(p.placement, 'lower') as 'lower' | 'middle' | 'upper';
      const sizeFrac = asNum(p.size, 0.042);
      const words = ctx.input?.words;

      // Word-by-word kinetic caption when transcript timing is injected.
      if (words && words.length > 0) {
        return {
          layers: [
            {
              id: `${ctx.idPrefix}_cap`,
              type: 'caption',
              start: 0,
              duration: ctx.dur,
              words,
              style: asStr(p.style, 'word_highlight') as 'word_highlight' | 'bold_pop' | 'karaoke' | 'typewriter',
              placement,
              size: sizeFrac,
              fill: asStr(p.fill, b.colors.text),
              highlight: asStr(p.highlight, b.colors.accent),
              family: asStr(p.fontFamily, b.fonts.heading),
              weight: asNum(p.weight, 800),
              tracking: asNum(p.tracking, 0),
              emphasis: ctx.input?.emphasis && ctx.input.emphasis.length > 0 ? ctx.input.emphasis : undefined,
              box: p.box === true ? true : undefined,
              boxColor: asStr(p.boxColor) || undefined,
              boxBlur: typeof p.boxBlur === 'number' ? p.boxBlur : undefined,
              maxWidth: typeof p.maxWidth === 'number' ? p.maxWidth : undefined,
              outlineColor: asStr(p.outlineColor) || undefined,
              outlineWidth: typeof p.outlineWidth === 'number' ? p.outlineWidth : undefined,
            },
          ],
        };
      }

      // Fallback: static whole-phrase text (direct template use / no transcript).
      const y = placement === 'upper' ? 0.15 : placement === 'middle' ? 0.5 : 0.82;
      return {
        layers: [
          textLayer(`${ctx.idPrefix}_cap`, asStr(p.text), [0.5, y], Math.round(ctx.canvas.width * sizeFrac), ctx.dur, {
            fill: asStr(p.fill, b.colors.text),
            family: asStr(p.fontFamily, b.fonts.heading),
            weight: asNum(p.weight, 800),
            tracking: asNum(p.tracking, 0),
          }),
        ],
      };
    },
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
      { name: 'accent', type: 'color', default: undefined, description: 'Subtitle color (defaults to brand accent).', semanticRole: 'brand' },
      { name: 'textColor', type: 'color', default: undefined, description: 'Title color (defaults to brand text).', semanticRole: 'brand' },
      { name: 'boxColor', type: 'color', default: undefined, description: 'Box color (defaults to brand background).', semanticRole: 'brand' },
      { name: 'boxOpacity', type: 'number', default: 0.72, min: 0, max: 1, semanticRole: 'style' },
      { name: 'fontFamily', type: 'string', default: undefined, semanticRole: 'brand' },
      { name: 'scale', type: 'number', default: 1, min: 0.5, max: 2, description: 'Text size multiplier.', semanticRole: 'emphasis' },
      { name: 'align', type: 'enum', default: 'left', options: ['left', 'center', 'right'], semanticRole: 'layout' },
    ],
    build: (p, ctx) => {
      const W = ctx.canvas.width;
      const b = ctx.brand ?? DEFAULT_BRAND;
      const sub = asStr(p.subtitle);
      const accent = asStr(p.accent, b.colors.accent);
      const textColor = asStr(p.textColor, b.colors.text);
      const family = asStr(p.fontFamily, b.fonts.heading);
      const scale = asNum(p.scale, 1);
      const cx = asStr(p.align, 'left') === 'center' ? 0.5 : asStr(p.align, 'left') === 'right' ? 0.72 : 0.28;
      return {
        layers: [
          {
            id: `${ctx.idPrefix}_lt`,
            type: 'group',
            start: 0,
            duration: ctx.dur,
            children: [
              // Gradient bar + drop shadow (fill overrides the gradient if the
              // user set an explicit boxColor).
              shapeLayer(
                `${ctx.idPrefix}_bg`,
                {
                  shape: 'rounded_rectangle',
                  size: [0.44, 0.14],
                  radius: 0.018,
                  ...(p.boxColor ? { fill: asStr(p.boxColor) } : { gradient: ['#1b2130', '#0b0d12'] as [string, string], gradientAngle: 150 }),
                  shadow: Math.round(W * 0.02),
                  opacity: constant(asNum(p.boxOpacity, 0.94)),
                  transform: { position: constant<Vec3>([cx, 0.83, 0]) },
                },
                ctx.dur,
              ),
              // Left accent stripe.
              shapeLayer(
                `${ctx.idPrefix}_stripe`,
                { shape: 'rounded_rectangle', size: [0.008, 0.1], radius: 0.004, fill: accent, transform: { position: constant<Vec3>([cx - 0.2, 0.83, 0]) } },
                ctx.dur,
              ),
              textLayer(`${ctx.idPrefix}_title`, asStr(p.title), [cx + 0.01, 0.81], Math.round(W * 0.03 * scale), ctx.dur, { fill: textColor, family }),
              ...(sub ? [textLayer(`${ctx.idPrefix}_sub`, sub, [cx + 0.01, 0.865], Math.round(W * 0.019 * scale), ctx.dur, { fill: accent, family })] : []),
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
      { name: 'accent', type: 'color', default: undefined, description: 'Badge color (defaults to brand accent).', semanticRole: 'brand' },
      { name: 'textColor', type: 'color', default: undefined, description: 'Value/label color (defaults to brand text).', semanticRole: 'brand' },
      { name: 'fontFamily', type: 'string', default: undefined, semanticRole: 'brand' },
      { name: 'scale', type: 'number', default: 1, min: 0.5, max: 2, description: 'Size multiplier.', semanticRole: 'emphasis' },
    ],
    build: (p, ctx) => {
      const W = ctx.canvas.width;
      const b = ctx.brand ?? DEFAULT_BRAND;
      const corner = asStr(p.position, 'center') === 'corner';
      const [cx, cy] = corner ? [0.8, 0.22] : [0.5, 0.45];
      const label = asStr(p.label);
      const accent = asStr(p.accent, b.colors.accent);
      const textColor = asStr(p.textColor, b.colors.text);
      const family = asStr(p.fontFamily, b.fonts.heading);
      const scale = asNum(p.scale, 1) * (corner ? 0.8 : 1);
      const cardW = 0.3 * scale;
      const cardH = 0.24 * scale;
      const pop = () => scalePop(1);
      return {
        layers: [
          {
            id: `${ctx.idPrefix}_stat`,
            type: 'group',
            start: 0,
            duration: ctx.dur,
            children: [
              // Premium dark card with a subtle gradient + drop shadow.
              shapeLayer(
                `${ctx.idPrefix}_card`,
                { shape: 'rounded_rectangle', size: [cardW, cardH], radius: 0.03, gradient: ['#1b2130', '#0b0d12'], gradientAngle: 150, shadow: Math.round(W * 0.03), opacity: constant(0.95), transform: { position: constant<Vec3>([cx, cy, 0]), scale: pop() } },
                ctx.dur,
              ),
              // Big number.
              {
                ...textLayer(`${ctx.idPrefix}_val`, asStr(p.value), [cx, cy - 0.025 * scale], Math.round(W * 0.082 * scale), ctx.dur, { fill: textColor, family }),
                transform: { position: constant<Vec3>([cx, cy - 0.025 * scale, 0]), scale: pop() },
              },
              // Accent underline bar.
              shapeLayer(
                `${ctx.idPrefix}_bar`,
                { shape: 'rounded_rectangle', size: [cardW * 0.42, 0.012 * scale], radius: 0.006, fill: accent, transform: { position: constant<Vec3>([cx, cy + 0.03 * scale, 0]), scale: pop() } },
                ctx.dur,
              ),
              // Label.
              ...(label ? [textLayer(`${ctx.idPrefix}_lbl`, label, [cx, cy + 0.08 * scale], Math.round(W * 0.024 * scale), ctx.dur, { fill: accent, family })] : []),
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
      { name: 'accent', type: 'color', default: undefined, description: 'Subtitle color (defaults to brand accent).', semanticRole: 'brand' },
      { name: 'dim', type: 'number', default: 0.55, min: 0, max: 1, description: 'Background dim opacity.', semanticRole: 'style' },
      { name: 'textColor', type: 'color', default: undefined, description: 'Heading color (defaults to brand text).', semanticRole: 'brand' },
      { name: 'fontFamily', type: 'string', default: undefined, semanticRole: 'brand' },
      { name: 'scale', type: 'number', default: 1, min: 0.5, max: 2, description: 'Text size multiplier.', semanticRole: 'emphasis' },
    ],
    build: (p, ctx) => {
      const W = ctx.canvas.width;
      const b = ctx.brand ?? DEFAULT_BRAND;
      const sub = asStr(p.sub);
      const accent = asStr(p.accent, b.colors.accent);
      const textColor = asStr(p.textColor, b.colors.text);
      const family = asStr(p.fontFamily, b.fonts.heading);
      const scale = asNum(p.scale, 1);
      return {
        layers: [
          {
            id: `${ctx.idPrefix}_card`,
            type: 'group',
            start: 0,
            duration: ctx.dur,
            children: [
              shapeLayer(`${ctx.idPrefix}_cbg`, { shape: 'rectangle', size: [1, 1], fill: b.colors.background, opacity: constant(asNum(p.dim, 0.55)), transform: { position: constant<Vec3>([0.5, 0.5, 0]) } }, ctx.dur),
              textLayer(`${ctx.idPrefix}_head`, asStr(p.heading), [0.5, 0.44], Math.round(W * 0.08 * scale), ctx.dur, { fill: textColor, family }),
              ...(sub ? [textLayer(`${ctx.idPrefix}_csub`, sub, [0.5, 0.56], Math.round(W * 0.035 * scale), ctx.dur, { fill: accent, family })] : []),
            ],
          },
        ],
      };
    },
  },
  {
    id: 'transition',
    version: '1.0',
    name: 'Scene transition',
    whenToUse: 'A brief transition at a strong topic boundary — flash, glitch (RGB split), or zoom-blur. Keep rare and short.',
    renderer: 'remotion',
    parameters: [{ name: 'variant', type: 'enum', default: 'flash', options: ['glitch', 'flash', 'zoom_blur'], semanticRole: 'style' }],
    build: (p, ctx) => ({
      layers: [
        {
          id: `${ctx.idPrefix}_transition`,
          type: 'transition',
          start: 0,
          duration: ctx.dur,
          variant: asStr(p.variant, 'flash') as 'glitch' | 'flash' | 'zoom_blur',
        },
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
    id: 'lottie',
    version: '1.0',
    name: 'Lottie overlay',
    whenToUse: 'A polished animated graphic (confetti, checkmark, underline, wipe) on a beat.',
    renderer: 'remotion',
    parameters: [
      { name: 'template', type: 'string', default: '' },
      { name: 'position', type: 'enum', default: 'center', options: ['full', 'center', 'corner'], semanticRole: 'layout' },
    ],
    build: (p, ctx) => ({
      layers: [{ id: `${ctx.idPrefix}_lottie`, type: 'lottie', start: 0, duration: ctx.dur, template: asStr(p.template), position: asStr(p.position, 'center') as 'full' | 'center' | 'corner' }],
    }),
  },
  {
    id: 'three',
    version: '1.0',
    name: 'Real 3D effect',
    whenToUse: 'A premium 3D moment (stat orb / flip card) for a standout number or headline.',
    renderer: 'remotion',
    parameters: [
      { name: 'template', type: 'string', default: '' },
      { name: 'value', type: 'string', default: '' },
      { name: 'label', type: 'string', default: '' },
    ],
    build: (p, ctx) => ({
      layers: [{ id: `${ctx.idPrefix}_three`, type: 'three', start: 0, duration: ctx.dur, template: asStr(p.template), value: asStr(p.value) || undefined, label: asStr(p.label) || undefined }],
    }),
  },
  {
    id: 'annotate',
    version: '1.0',
    name: 'Hand-drawn annotation',
    whenToUse:
      'Draw a marker annotation directly on the frame like a human editor — a curved ARROW pointing at the speaker/object, a rough CIRCLE around a face/thing, an UNDERLINE/BOX/STRIKE on a spot, a CHECKMARK or CROSS, or a highlighter SCRIBBLE. The single most common vault move. Point at what the speaker references.',
    renderer: 'remotion',
    parameters: [
      { name: 'annotation', type: 'enum', default: 'arrow', options: ['arrow', 'circle', 'underline', 'box', 'strike', 'scribble', 'checkmark', 'cross'], semanticRole: 'style' },
      { name: 'x', type: 'number', default: 0.35, min: 0, max: 1, description: 'Target region left (normalized).', semanticRole: 'layout' },
      { name: 'y', type: 'number', default: 0.35, min: 0, max: 1, description: 'Target region top (normalized).', semanticRole: 'layout' },
      { name: 'w', type: 'number', default: 0.3, min: 0.02, max: 1, description: 'Target region width.', semanticRole: 'layout' },
      { name: 'h', type: 'number', default: 0.3, min: 0.02, max: 1, description: 'Target region height.', semanticRole: 'layout' },
      { name: 'fromX', type: 'number', default: 0.12, min: 0, max: 1, description: 'Arrow tail X (arrow only).', semanticRole: 'layout' },
      { name: 'fromY', type: 'number', default: 0.18, min: 0, max: 1, description: 'Arrow tail Y (arrow only).', semanticRole: 'layout' },
      { name: 'color', type: 'color', default: undefined, description: 'Marker color (defaults to brand accent).', semanticRole: 'brand' },
      { name: 'strokeWidth', type: 'number', default: 0.006, min: 0.002, max: 0.02, semanticRole: 'emphasis' },
      { name: 'roughness', type: 'number', default: 0.5, min: 0, max: 1, semanticRole: 'style' },
    ],
    build: (p, ctx) => {
      const b = ctx.brand ?? DEFAULT_BRAND;
      const kind = asStr(p.annotation, 'arrow') as AnnotationKind;
      const x = asNum(p.x, 0.35), y = asNum(p.y, 0.35), w = asNum(p.w, 0.3), h = asNum(p.h, 0.3);
      const color = asStr(p.color, b.colors.accent);
      const rect = { x, y, width: w, height: h };
      const from: Vec2 = [asNum(p.fromX, 0.12), asNum(p.fromY, 0.18)];
      const to: Vec2 = [x + w / 2, y + h / 2];
      return {
        layers: [
          annotationLayer(
            `${ctx.idPrefix}_anno`,
            { annotation: kind, rect, from, to, color, strokeWidth: asNum(p.strokeWidth, 0.006), roughness: asNum(p.roughness, 0.5), drawIn: 0.55 },
            ctx.dur,
          ),
        ],
      };
    },
  },
  {
    id: 'name_tag',
    version: '1.0',
    name: 'Name-tag callout',
    whenToUse: 'Label a person/object on screen: a bright pill tag (e.g. "YOUNG MARK") with a hand-drawn arrow pointing at them. Great for naming a subject or highlighting a detail.',
    renderer: 'remotion',
    parameters: [
      { name: 'text', type: 'string', default: '' },
      { name: 'targetX', type: 'number', default: 0.5, min: 0, max: 1, description: 'What the arrow points at (X).', semanticRole: 'layout' },
      { name: 'targetY', type: 'number', default: 0.35, min: 0, max: 1, description: 'What the arrow points at (Y).', semanticRole: 'layout' },
      { name: 'side', type: 'enum', default: 'below', options: ['below', 'left', 'right'], semanticRole: 'layout' },
      { name: 'accent', type: 'color', default: undefined, description: 'Pill color (defaults to brand accent).', semanticRole: 'brand' },
      { name: 'textColor', type: 'color', default: '#0b0d12', description: 'Pill text color.', semanticRole: 'brand' },
    ],
    build: (p, ctx) => {
      const W = ctx.canvas.width;
      const b = ctx.brand ?? DEFAULT_BRAND;
      const text = asStr(p.text) || 'LABEL';
      const accent = asStr(p.accent, b.colors.accent);
      const textColor = asStr(p.textColor, '#0b0d12');
      const tx = asNum(p.targetX, 0.5), ty = asNum(p.targetY, 0.35);
      const side = asStr(p.side, 'below');
      // Pill position offset from the target.
      const [px, py] = side === 'left' ? [Math.max(0.18, tx - 0.26), ty] : side === 'right' ? [Math.min(0.82, tx + 0.26), ty] : [tx, Math.min(0.9, ty + 0.28)];
      const fontPx = Math.round(W * 0.032);
      const pillW = Math.min(0.6, 0.05 + text.length * 0.026);
      return {
        layers: [
          {
            id: `${ctx.idPrefix}_tag`,
            type: 'group',
            start: 0,
            duration: ctx.dur,
            children: [
              shapeLayer(`${ctx.idPrefix}_pill`, { shape: 'rounded_rectangle', size: [pillW, 0.095], radius: 0.02, fill: accent, shadow: Math.round(W * 0.016), transform: { position: constant<Vec3>([px, py, 0]), scale: scalePop(1) } }, ctx.dur),
              { ...textLayer(`${ctx.idPrefix}_txt`, text, [px, py - 0.004], fontPx, ctx.dur, { fill: textColor, family: b.fonts.heading }), stroke: { color: textColor, width: 0 }, transform: { position: constant<Vec3>([px, py - 0.004, 0]), scale: scalePop(1) } },
            ],
          },
          // Arrow draws on after the pill pops.
          annotationLayer(`${ctx.idPrefix}_arrow`, { annotation: 'arrow', from: [px, side === 'below' ? py - 0.05 : py], to: [tx, ty], color: accent, strokeWidth: 0.006, drawIn: 0.45 }, ctx.dur, 0.25),
        ],
      };
    },
  },
  {
    id: 'checklist',
    version: '1.0',
    name: 'Checklist / do-and-dont',
    whenToUse: 'A punchy list that reveals row-by-row, each with a green CHECK, red CROSS, or bullet DOT — e.g. "EXPERTISE ✓ / LABOUR ✗", steps, or a set of points. High-retention vault staple.',
    renderer: 'remotion',
    parameters: [
      { name: 'title', type: 'string', default: '' },
      { name: 'items', type: 'list', default: [], description: 'Array of {text, mark} where mark is check|cross|dot.' },
      { name: 'position', type: 'enum', default: 'center', options: ['center', 'left'], semanticRole: 'layout' },
      { name: 'accent', type: 'color', default: undefined, description: 'Title color (defaults to brand accent).', semanticRole: 'brand' },
    ],
    build: (p, ctx) => {
      const W = ctx.canvas.width;
      const b = ctx.brand ?? DEFAULT_BRAND;
      const rows = asRows(p.items);
      if (rows.length === 0) return { layers: [{ id: `${ctx.idPrefix}_empty`, type: 'group', start: 0, duration: ctx.dur, children: [] }] };
      const accent = asStr(p.accent, b.colors.accent);
      const title = asStr(p.title);
      const left = asStr(p.position, 'center') === 'left';
      // Clean bold-italic overlay (the vault's "✓ EXPERTISE / ✗ LABOUR" look):
      // big slanted white text, huge bright green check / red cross marks, NO card.
      const rowH = 0.145;
      const nRows = rows.length + (title ? 1 : 0);
      const blockH = nRows * rowH;
      const top = 0.5 - blockH / 2 + rowH / 2;
      // Left margin for the mark; text sits to its right, left-anchored.
      const markX = left ? 0.14 : 0.24;
      const textX = markX + 0.085;
      const rowFont = Math.round(W * 0.062);
      // Soft left-side scrim so the marks/text read on any footage.
      const children: MotionLayer[] = [
        shapeLayer(
          `${ctx.idPrefix}_scrim`,
          { shape: 'rectangle', size: [1.25, 1.3], gradient: ['#000000b0', '#00000000'], gradientAngle: 90, opacity: fadeIn(ctx.dur), transform: { position: constant<Vec3>([0.22, 0.5, 0]) } },
          ctx.dur,
        ),
      ];
      let y = top;
      if (title) {
        children.push({ ...textLayer(`${ctx.idPrefix}_title`, title, [markX, y], Math.round(W * 0.04), ctx.dur, { fill: accent, family: b.fonts.heading, align: 'left', italic: true, stroke: { color: '#0b0d12', width: Math.round(W * 0.003) } }) });
        y += rowH;
      }
      rows.forEach((row, i) => {
        const ry = y + i * rowH;
        const st = 0.12 + i * 0.16; // staggered reveal
        const markColor = row.mark === 'check' ? '#28d17c' : row.mark === 'cross' ? '#ff3b30' : accent;
        if (row.mark === 'dot') {
          children.push(reveal(shapeLayer(`${ctx.idPrefix}_dot${i}`, { shape: 'circle', radius: 0.016, fill: accent, shadow: Math.round(W * 0.01), transform: { position: constant<Vec3>([markX, ry, 0]), scale: scalePop(1) } }, ctx.dur), st) as MotionLayer);
        } else {
          const annoKind: AnnotationKind = row.mark === 'cross' ? 'cross' : 'checkmark';
          children.push(annotationLayer(`${ctx.idPrefix}_mk${i}`, { annotation: annoKind, rect: { x: markX - 0.045, y: ry - 0.052, width: 0.09, height: 0.1 }, color: markColor, strokeWidth: 0.009, roughness: 0.25, drawIn: 0.22 }, ctx.dur, st));
        }
        children.push(reveal(textLayer(`${ctx.idPrefix}_row${i}`, row.text, [textX, ry], rowFont, ctx.dur, { fill: b.colors.text, family: b.fonts.heading, align: 'left', italic: true, stroke: { color: '#0b0d12', width: Math.round(W * 0.0035) } }), st));
      });
      return { layers: [{ id: `${ctx.idPrefix}_check`, type: 'group', start: 0, duration: ctx.dur, children }] };
    },
  },
  {
    id: 'comparison',
    version: '1.0',
    name: 'Two-column comparison',
    whenToUse: 'Contrast two things side by side with directional arrows — e.g. "You lose $$$" (red down) vs "They make $$$" (green up), or old vs new. Reveals both panels; the losing side gets a down arrow, the winning side an up arrow.',
    renderer: 'remotion',
    parameters: [
      { name: 'leftTitle', type: 'string', default: '' },
      { name: 'rightTitle', type: 'string', default: '' },
      { name: 'leftItems', type: 'list', default: [], description: 'Array of strings.' },
      { name: 'rightItems', type: 'list', default: [], description: 'Array of strings.' },
      { name: 'leftTone', type: 'enum', default: 'bad', options: ['bad', 'good', 'neutral'], semanticRole: 'style' },
      { name: 'rightTone', type: 'enum', default: 'good', options: ['bad', 'good', 'neutral'], semanticRole: 'style' },
    ],
    build: (p, ctx) => {
      const W = ctx.canvas.width;
      const b = ctx.brand ?? DEFAULT_BRAND;
      const toneColor = (t: string) => (t === 'bad' ? '#ff375f' : t === 'good' ? '#34d399' : b.colors.accent);
      const col = (idp: string, cx: number, title: string, items: string[], tone: string, dir: 'up' | 'down' | 'none') => {
        const color = toneColor(tone);
        const kids: MotionLayer[] = [
          shapeLayer(`${idp}_bg`, { shape: 'rounded_rectangle', size: [0.4, 0.5], radius: 0.02, gradient: ['#14171d', '#0a0b0e'], gradientAngle: 150, stroke: { color, width: 3 }, shadow: Math.round(W * 0.025), opacity: fadeIn(ctx.dur), transform: { position: constant<Vec3>([cx, 0.5, 0]), scale: scalePop(1) } }, ctx.dur),
        ];
        if (title) kids.push({ ...textLayer(`${idp}_t`, title, [cx, 0.31], Math.round(W * 0.036), ctx.dur, { fill: color, family: b.fonts.heading }) });
        items.slice(0, 4).forEach((it, i) => {
          kids.push(reveal(textLayer(`${idp}_i${i}`, it, [cx, 0.42 + i * 0.075], Math.round(W * 0.026), ctx.dur, { fill: b.colors.text, family: b.fonts.body, weight: 600 }), 0.2 + i * 0.12));
        });
        if (dir !== 'none') {
          const y0 = dir === 'down' ? 0.66 : 0.74;
          const y1 = dir === 'down' ? 0.74 : 0.66;
          kids.push(annotationLayer(`${idp}_arr`, { annotation: 'arrow', from: [cx, y0], to: [cx, y1], color, strokeWidth: 0.009, drawIn: 0.4 }, ctx.dur, 0.5));
        }
        return kids;
      };
      const children = [
        ...col(`${ctx.idPrefix}_L`, 0.27, asStr(p.leftTitle), Array.isArray(p.leftItems) ? p.leftItems.map((x) => asStr(x)).filter(Boolean) : [], asStr(p.leftTone, 'bad'), asStr(p.leftTone, 'bad') === 'good' ? 'up' : 'down'),
        ...col(`${ctx.idPrefix}_R`, 0.73, asStr(p.rightTitle), Array.isArray(p.rightItems) ? p.rightItems.map((x) => asStr(x)).filter(Boolean) : [], asStr(p.rightTone, 'good'), asStr(p.rightTone, 'good') === 'good' ? 'up' : 'down'),
      ];
      return { layers: [{ id: `${ctx.idPrefix}_cmp`, type: 'group', start: 0, duration: ctx.dur, children }] };
    },
  },
  {
    id: 'stack_list',
    version: '1.0',
    name: 'Stacking list',
    whenToUse:
      'A vertical list that stacks in row-by-row — outlined pills (e.g. "OLD B2B SERVICES / BUILDING SOFTWARE / LOGISTICS"), a NUMBERED steps list, or a top-left to-do checklist. Bright, thin-bordered, reveals one item at a time. Use for enumerations, steps, agendas, or option lists.',
    renderer: 'remotion',
    parameters: [
      { name: 'items', type: 'list', default: [], description: 'Array of strings (each becomes a row).' },
      { name: 'variant', type: 'enum', default: 'outline', options: ['outline', 'number', 'bullet'], semanticRole: 'style' },
      { name: 'position', type: 'enum', default: 'center', options: ['center', 'left', 'topleft'], semanticRole: 'layout' },
      { name: 'accent', type: 'color', default: undefined, description: 'Pill/number color (defaults to brand accent).', semanticRole: 'brand' },
      { name: 'textColor', type: 'color', default: undefined, description: 'Row text color (defaults to white).', semanticRole: 'brand' },
    ],
    build: (p, ctx) => {
      const W = ctx.canvas.width;
      const b = ctx.brand ?? DEFAULT_BRAND;
      const items = Array.isArray(p.items) ? p.items.map((x) => asStr(x)).filter(Boolean).slice(0, 6) : [];
      if (items.length === 0) return { layers: [{ id: `${ctx.idPrefix}_empty`, type: 'group', start: 0, duration: ctx.dur, children: [] }] };
      const variant = asStr(p.variant, 'outline') as 'outline' | 'number' | 'bullet';
      const pos = asStr(p.position, 'center') as 'center' | 'left' | 'topleft';
      const accent = asStr(p.accent, b.colors.accent);
      const textColor = asStr(p.textColor, '#ffffff');
      const rowFont = Math.round(W * (pos === 'topleft' ? 0.026 : 0.034));
      const rowH = pos === 'topleft' ? 0.085 : 0.115;
      const maxLen = Math.max(...items.map((s) => s.length));
      const badgeW = variant === 'number' ? 0.055 : 0;
      const padL = 0.03;
      const pillW = Math.min(0.82, badgeW + padL * 2 + maxLen * rowFont * 0.63 / W + 0.02);
      // Anchor: topleft stacks from the corner; left/center center vertically.
      const blockH = items.length * rowH;
      const leftX = pos === 'topleft' ? 0.045 : pos === 'left' ? 0.08 : 0.5 - pillW / 2;
      const top = pos === 'topleft' ? 0.12 : 0.5 - blockH / 2 + rowH / 2;
      // Filled pill (dark text) for bullet + todo-style top-left; outlined pill
      // (light text) for 'outline'; bare number badge + light text for 'number'.
      const filled = variant === 'bullet' || pos === 'topleft';
      const children: MotionLayer[] = [];
      items.forEach((text, i) => {
        const ry = top + i * rowH;
        const st = 0.1 + i * 0.16;
        const cx = leftX + pillW / 2;
        if (variant !== 'number') {
          const pill = filled
            ? shapeLayer(`${ctx.idPrefix}_bg${i}`, { shape: 'rounded_rectangle', size: [pillW, rowH * 0.82], radius: 0.014, fill: accent, opacity: constant(0.94), shadow: Math.round(W * 0.014), transform: { position: constant<Vec3>([cx, ry, 0]), scale: scalePop(1) } }, ctx.dur)
            : shapeLayer(`${ctx.idPrefix}_pill${i}`, { shape: 'rounded_rectangle', size: [pillW, rowH * 0.82], radius: 0.012, fill: '#0b0d12', opacity: constant(0.5), stroke: { color: accent, width: 3 }, shadow: Math.round(W * 0.012), transform: { position: constant<Vec3>([cx, ry, 0]), scale: scalePop(1) } }, ctx.dur);
          children.push(reveal(pill, st) as MotionLayer);
        }
        let tx = leftX + padL;
        if (variant === 'number') {
          const bx = leftX + badgeW / 2 + 0.008;
          children.push(reveal(shapeLayer(`${ctx.idPrefix}_num${i}`, { shape: 'rounded_rectangle', size: [badgeW * 0.78, rowH * 0.6], radius: 0.008, fill: accent, shadow: Math.round(W * 0.01), transform: { position: constant<Vec3>([bx, ry, 0]), scale: scalePop(1) } }, ctx.dur), st) as MotionLayer);
          children.push(reveal(textLayer(`${ctx.idPrefix}_ni${i}`, String(i + 1), [bx, ry], Math.round(rowFont * 1.05), ctx.dur, { fill: '#0b0d12', family: b.fonts.heading, stroke: { color: '#0b0d12', width: 0 } }), st));
          tx = leftX + badgeW + 0.02;
        }
        const rowTextColor = filled ? '#0b0d12' : textColor;
        children.push(reveal(textLayer(`${ctx.idPrefix}_t${i}`, text, [tx, ry], rowFont, ctx.dur, { fill: rowTextColor, family: b.fonts.heading, align: 'left', textCase: pos === 'topleft' ? 'none' : 'upper', stroke: { color: '#0b0d12', width: variant === 'number' ? Math.round(W * 0.002) : 0 } }), st));
      });
      return { layers: [{ id: `${ctx.idPrefix}_stack`, type: 'group', start: 0, duration: ctx.dur, children }] };
    },
  },
  {
    id: 'progress',
    version: '1.0',
    name: 'Progress bar / meter / counter',
    whenToUse:
      'Animate a data widget: a labeled horizontal PROGRESS BAR (e.g. "70% happy customers", "4. BECOME SKILLED"), a vertical red→green GAUGE meter (e.g. "CONFIDENCE" filling up), or a big COUNTER that counts up/down (countdown timers, growing numbers). Great for stats, momentum, and tension.',
    renderer: 'remotion',
    parameters: [
      { name: 'variant', type: 'enum', default: 'bar', options: ['bar', 'gauge', 'counter'], semanticRole: 'style' },
      { name: 'value', type: 'number', default: 70, min: 0, max: 100000, description: 'Fill % (0-100) for bar/gauge; the end number for counter.', semanticRole: 'data' },
      { name: 'from', type: 'number', default: 0, min: 0, max: 100000, description: 'Counter start value.', semanticRole: 'data' },
      { name: 'label', type: 'string', default: '' },
      { name: 'suffix', type: 'string', default: undefined, description: 'Counter suffix, e.g. "%", "x", "s".' },
      { name: 'position', type: 'enum', default: 'lower', options: ['lower', 'center', 'corner', 'left', 'right'], semanticRole: 'layout' },
      { name: 'color', type: 'color', default: undefined, description: 'Fill/accent color (defaults to brand accent).', semanticRole: 'brand' },
    ],
    build: (p, ctx) => {
      const b = ctx.brand ?? DEFAULT_BRAND;
      const variant = asStr(p.variant, 'bar') as 'bar' | 'gauge' | 'counter';
      const color = asStr(p.color, b.colors.accent);
      const label = asStr(p.label) || undefined;
      const suffix = asStr(p.suffix) || undefined;
      const posName = asStr(p.position, 'lower');
      const rawVal = asNum(p.value, 70);
      let pos: Vec3;
      if (variant === 'gauge') pos = posName === 'right' ? [0.9, 0.5, 0] : [0.12, 0.5, 0];
      else if (variant === 'counter') pos = posName === 'corner' ? [0.8, 0.24, 0] : [0.5, 0.42, 0];
      else pos = posName === 'center' ? [0.5, 0.8, 0] : [0.3, 0.86, 0];
      // bar/gauge take a 0..1 fill; counter takes the number verbatim.
      const value = variant === 'counter' ? rawVal : Math.max(0, Math.min(1, rawVal > 1 ? rawVal / 100 : rawVal));
      return {
        layers: [
          {
            ...meterLayer(
              `${ctx.idPrefix}_meter`,
              { variant, value, from: variant === 'counter' ? asNum(p.from, 0) : undefined, label, color, suffix, fillIn: 0.95 },
              ctx.dur,
            ),
            transform: { position: constant<Vec3>(pos) },
          },
        ],
      };
    },
  },
  {
    id: 'placeholder',
    version: '1.0',
    name: 'Placeholder',
    whenToUse: 'Reserved slot for effects not yet mapped to an executable template.',
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
