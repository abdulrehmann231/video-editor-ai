/**
 * Motion Graphics IR — canonical, renderer-independent representation of a
 * visual composition (the "AI After Effects" program the AI emits and the
 * deterministic renderers execute).
 *
 * IMPORTANT: this module has ZERO imports on purpose. Like `src/remotion/types.ts`,
 * it must stay importable from the Remotion webpack bundle without dragging any
 * Node-only dependency (zod/ffmpeg/aws-sdk) into the browser. `schema.ts` (zod)
 * lives on the Node side and mirrors these shapes.
 *
 * Phase-1 supported subset only: layer types text|shape|video|image|group,
 * animation kinds constant|keyframes|spring. Advanced layer/animation kinds are
 * introduced in later phases and rejected by the validator until then.
 */

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];
/** #rgb / #rrggbb / #rrggbbaa hex color. */
export type Color = string;

export type IrVersion = '1.0';

// ── Animation ───────────────────────────────────────────────────────────────

export type EasingType =
  | 'linear'
  | 'easeIn'
  | 'easeOut'
  | 'easeInOut'
  | 'bezier'
  | 'back'
  | 'elastic';

export type Easing =
  | { type: 'linear' }
  | { type: 'easeIn' }
  | { type: 'easeOut' }
  | { type: 'easeInOut' }
  | { type: 'bezier'; x1: number; y1: number; x2: number; y2: number }
  | { type: 'back'; amount: number }
  | { type: 'elastic'; amplitude: number; period: number };

export interface SpringConfig {
  mass: number;
  stiffness: number;
  damping: number;
  initialVelocity?: number;
}

export interface Keyframe<T> {
  /** Seconds, relative to the layer start. */
  time: number;
  value: T;
  easing?: Easing;
}

export type AnimatedKind = 'constant' | 'keyframes' | 'spring';

/** A value that is either constant or varies over time. */
export interface Animated<T> {
  kind: AnimatedKind;
  /** Constant value, and the target value for a spring. */
  value?: T;
  /** Optional start value for a spring. */
  from?: T;
  keyframes?: Keyframe<T>[];
  spring?: SpringConfig;
}

// ── Transform ─────────────────────────────────────────────────────────────---

export interface Transform {
  position?: Animated<Vec3>;
  scale?: Animated<Vec3>;
  /** Rotation in DEGREES; 2D uses z. */
  rotation?: Animated<Vec3>;
  anchor?: Animated<Vec3>;
  skew?: Animated<Vec2>;
}

export type BlendMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'soft_light'
  | 'add'
  | 'darken'
  | 'lighten';

/**
 * Basic clip/mask (Phase 2). A layer is clipped to the mask region; content
 * outside it is hidden. `rect` is normalized (0..1) over the frame; defaults to
 * the full frame. Advanced alpha/luma/track mattes come in a later phase.
 */
export interface Mask {
  shape: 'rectangle' | 'rounded_rectangle' | 'circle';
  /** Normalized region kept, over the frame. Defaults to the whole frame. */
  rect?: { x: number; y: number; width: number; height: number };
  /** Corner radius (rounded_rectangle) / circle radius, fraction of frame width. */
  radius?: number;
}

// ── Layers ──────────────────────────────────────────────────────────────────

export type LayerType = 'text' | 'shape' | 'video' | 'image' | 'group' | 'transition' | 'caption';

/** A transcript word with times RELATIVE to the caption layer's start (seconds). */
export interface CaptionWord {
  word: string;
  start: number;
  end: number;
}

export type CaptionStyle =
  | 'word_highlight'
  | 'bold_pop'
  | 'karaoke'
  | 'typewriter'
  | 'youtube'
  | 'single_word'
  | 'underline'
  | 'bounce';
export type CaptionPlacement = 'lower' | 'middle' | 'upper';

export interface BaseLayer {
  id: string;
  type: LayerType;
  /** Seconds, relative to the composition start. */
  start: number;
  duration: number;
  visible?: boolean;
  transform?: Transform;
  opacity?: Animated<number>;
  blendMode?: BlendMode;
  mask?: Mask;
  zIndex?: number;
  parentId?: string;
}

export interface TextFont {
  family?: string;
  weight?: number;
  size?: number;
  tracking?: number;
  leading?: number;
}

export interface Stroke {
  color: Color;
  width: number;
}

/** Whole-layer text in Phase 1; per-word/char kinetic targeting lands in Phase 4. */
export interface Kinetic {
  target: 'word' | 'char' | 'line' | 'layer';
  enter?: string;
  emphasis?: string[];
  stagger?: number;
}

export interface TextLayer extends BaseLayer {
  type: 'text';
  content: string;
  font?: TextFont;
  align?: 'left' | 'center' | 'right';
  fill?: Color;
  stroke?: Stroke;
  kinetic?: Kinetic;
}

export type ShapeKind = 'rectangle' | 'rounded_rectangle' | 'circle' | 'ellipse' | 'line';

export interface ShapeLayer extends BaseLayer {
  type: 'shape';
  shape: ShapeKind;
  size?: Vec2;
  radius?: number;
  fill?: Color;
  stroke?: Stroke;
}

export interface VideoLayer extends BaseLayer {
  type: 'video';
  /** Reference into composition.assets, resolved at compile time. */
  assetId?: string;
  /** Direct URL (e.g. resolved Pexels clip); may be filled in later. */
  src?: string;
  fit?: 'cover' | 'contain';
}

export interface ImageLayer extends BaseLayer {
  type: 'image';
  assetId?: string;
  src?: string;
  fit?: 'cover' | 'contain';
}

export interface GroupLayer extends BaseLayer {
  type: 'group';
  children: MotionLayer[];
}

/** Full-frame scene transition (flash / glitch / zoom-blur). A self-contained
 * composite effect rather than a primitive; rendered deterministically. */
export interface TransitionLayer extends BaseLayer {
  type: 'transition';
  variant: 'glitch' | 'flash' | 'zoom_blur';
}

/** Word-by-word kinetic captions (the professional caption engine). Carries its
 * own word timing so the renderer can animate per word/character. */
export interface CaptionLayer extends BaseLayer {
  type: 'caption';
  words: CaptionWord[];
  style: CaptionStyle;
  placement?: CaptionPlacement;
  /** Font size as a fraction of frame width. */
  size?: number;
  /** Base (inactive) word color. */
  fill?: Color;
  /** Active/emphasis word color. */
  highlight?: Color;
  family?: string;
  weight?: number;
  /** Letter-spacing in px. */
  tracking?: number;
  /** Words to always accent (lower-cased match). */
  emphasis?: string[];
  /** Draw a background box behind the caption (implied for the 'youtube' style). */
  box?: boolean;
  /** Box fill color (hex, incl. 8-digit alpha, e.g. #000000a8). */
  boxColor?: Color;
  /** Backdrop blur behind the box, in px. */
  boxBlur?: number;
  /** Max caption block width as a fraction of frame width (0..1). */
  maxWidth?: number;
  /** Text outline (stroke) color for the sticker look. */
  outlineColor?: Color;
  /** Outline width as a fraction of font size. */
  outlineWidth?: number;
}

export type MotionLayer =
  | TextLayer
  | ShapeLayer
  | VideoLayer
  | ImageLayer
  | GroupLayer
  | TransitionLayer
  | CaptionLayer;

// ── Assets & composition ─────────────────────────────────────────────────────

export type AssetType = 'video' | 'image' | 'audio' | 'font' | 'lottie';

export interface MotionAsset {
  id: string;
  type: AssetType;
  uri: string;
  metadata?: Record<string, unknown>;
}

/** Whether the composition's start/end are in source, cut, or relative time. */
export type TimeBasis = 'source' | 'cut' | 'relative';

/**
 * Composition-level camera applied to the base footage (e.g. a punch-in zoom).
 * Kept separate from layer transforms because it moves the underlying video, not
 * an overlay. `scale` is layer-relative time (0 = composition start). This is the
 * seed of the 2.5D camera system (later phases add position/rotation/dolly).
 */
export interface Camera {
  scale?: Animated<Vec3>;
  focus?: 'center' | 'face' | 'left' | 'right' | 'top';
}

export interface MotionMetadata {
  purpose?: string;
  style?: string[];
  references?: string[];
  confidence?: number;
  generatedBy?: string;
  // Provenance carried from the EDL so the decision log stays populated.
  sourceOpId?: string;
  sourceOpType?: string;
  reason?: string;
  // Placeholders carried forward for later-phase mapping.
  variant?: string;
  query?: string;
  template?: string;
}

export interface MotionComposition {
  schemaVersion: IrVersion;
  id: string;
  /** Composition window in `timeBasis` seconds. */
  start: number;
  end: number;
  timeBasis: TimeBasis;
  coordinateSpace: 'normalized' | 'pixels';
  canvas: { width: number; height: number; fps: number };
  background?: Color;
  camera?: Camera;
  layers: MotionLayer[];
  assets?: MotionAsset[];
  metadata?: MotionMetadata;
}
