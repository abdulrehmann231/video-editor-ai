# MOTION_GRAPHICS_ENGINE_PLAN.md

> **Status:** Implementation specification\
> **Audience:** Coding agent + human engineer\
> **Goal:** Evolve the existing AI-assisted, non-generative talking-head
> editor into a deterministic AI motion-graphics editor capable of
> producing the kinds of layered 2D, 2.5D, typography, compositing,
> particle, UI, camera, and selected 3D effects found in professional
> After Effects-style editing references.
>
> **Core principle:** The AI does not generate final video pixels. The
> AI generates a structured, validated **motion-graphics program**.
> Trusted renderers execute that program deterministically.

------------------------------------------------------------------------

# 0. Executive Summary

The existing architecture is:

``` text
Upload
  -> Ingest
  -> Gemini video analysis
  -> EDL
  -> FFmpeg cut
  -> Remotion effects
  -> MP4
```

The target architecture is:

``` text
                           RAW VIDEO
                               |
                    +----------+----------+
                    |                     |
                 Analysis              Transcript
                    |                     |
                    +----------+----------+
                               |
                       CREATIVE DIRECTOR
                               |
                 +-------------+-------------+
                 |                           |
          Existing EDL                 Motion plan
                 |                           |
                 +-------------+-------------+
                               |
                    MOTION GRAPHICS IR
                    / COMPOSITION GRAPH
                               |
             +-----------------+------------------+
             |                 |                  |
          Remotion          WebGL/WebGPU       3D backend
             |                 |               (later)
        2D graphics        shaders/particles    Blender
        typography         distortion           / Three.js
        shapes             compositing          as justified
        cards              2.5D
             |                 |                  |
             +-----------------+------------------+
                               |
                         Compositor/output
                               |
                         Preview frames
                               |
                         VISUAL QA MODEL
                               |
                   +-----------+-----------+
                   |                       |
                 ACCEPT                  REPAIR
                                           |
                                     patch Motion IR
                                           |
                                        rerender
```

The most important architectural change is the addition of a **Motion
Graphics IR** between Gemini and the renderers.

The AI must not directly write arbitrary Remotion/React/Blender code.
Instead:

``` text
Gemini
  -> strict JSON
  -> Zod validation
  -> semantic validation
  -> deterministic compiler
  -> renderer
```

This gives the system:

-   predictable rendering
-   reusable effects
-   parameterized effects
-   composable effects
-   renderer independence
-   versioning
-   debugging
-   safe execution
-   caching
-   visual QA
-   future support for WebGL/WebGPU and true 3D
-   the ability to turn the existing Inspiration Vault into an
    executable motion-design library

Adobe's After Effects expression model is based around properties,
layers, footage, cameras, and programmatic relationships between
properties. This plan intentionally mirrors that abstraction rather than
copying the After Effects UI. [Adobe After Effects
expressions](https://helpx.adobe.com/in/after-effects/using/expression-language.html)

Adobe Research's LogoMotion is especially relevant: it uses visually
grounded analysis, program synthesis, visual checking, and program
repair to create content-aware animation. That research supports the
central "reference -\> program -\> render -\> inspect -\> repair" loop
proposed here.
[LogoMotion](https://research.adobe.com/publication/logomotion-visually-grounded-code-synthesis-for-creating-and-editing-animation/)
/ [paper](https://arxiv.org/abs/2405.07065)

------------------------------------------------------------------------

# 1. Existing System: DO NOT THROW THIS AWAY

The current implementation already contains valuable infrastructure.

## Existing components

-   Next.js App Router
-   Cloudflare R2
-   multipart/resumable browser uploads
-   ffprobe ingest
-   480p analysis proxy
-   1080p mezzanine
-   Gemini File API
-   Gemini key rotation/failover
-   structured EDL + Zod validation
-   one repair pass
-   ffmpeg silencedetect
-   local Whisper word timing
-   deterministic FFmpeg cutting
-   Remotion rendering
-   OffthreadVideo
-   Pexels B-roll
-   automatic pipeline
-   R2 output storage
-   9:16 rendering
-   decision logs
-   Inspiration Vault retrieval
-   existing effect catalog

## Existing effects

Keep these working:

``` text
silence_cut
caption
zoom_punch
lower_third
broll
title_card
stat_callout
transition
progress_bar
background_music
music_ducking
```

The new engine is an **incremental extension**, not a rewrite.

------------------------------------------------------------------------

# 2. Product Goal

The target experience is:

> Upload a talking-head video and let the system edit it like a skilled
> motion designer/editor.

The AI should be able to recognize moments such as:

-   a hook
-   a key statement
-   a statistic
-   a product mention
-   a quote
-   a question
-   a transition between topics
-   an important name
-   an emotional beat
-   a CTA
-   a visual opportunity

Then choose or construct an appropriate visual treatment.

Example:

``` text
Speaker:
"Our revenue grew 43% this year."

AI:
- identify "43%" as a high-value semantic entity
- retrieve metric-animation references
- choose a metric composition
- adapt colors to brand
- place it away from face
- animate number with overshoot
- add supporting text
- add accent shape
- add subtle particles
- time entrance to speech
- time exit before next phrase
- render
- inspect result
- repair if overlap/readability/style problems exist
```

------------------------------------------------------------------------

# 3. Non-Goals

Do NOT attempt these in the first implementation:

-   full After Effects compatibility
-   arbitrary JavaScript generated by the model
-   arbitrary Blender Python generated by the model
-   AI-generated photorealistic video for normal editing
-   physics-perfect simulation of every effect
-   full professional NLE timeline replacement
-   recreating every AE plugin
-   unrestricted shader generation
-   replacing Remotion immediately
-   replacing FFmpeg immediately
-   building a general-purpose 3D editor

The objective is to build a **high-quality constrained motion system**
that can grow.

------------------------------------------------------------------------

# 4. Core Architecture

## 4.1 New layers

Introduce:

``` text
src/lib/motion/
  ir/
  primitives/
  templates/
  compiler/
  renderers/
  validators/
  timing/
  assets/
  shaders/
  tracking/
  qa/
```

Conceptually:

``` text
AI Creative Plan
       |
       v
Motion Graphics IR
       |
       +--> semantic validation
       |
       +--> layout validation
       |
       +--> timing validation
       |
       +--> renderer capability validation
       |
       v
Motion Compiler
       |
       +--------+---------+----------+
       |        |         |          |
   Remotion  WebGL     WebGPU    Blender
       |        |         |          |
       +--------+---------+----------+
                |
                v
             Composite
                |
                v
             MP4
```

------------------------------------------------------------------------

# 5. Motion Graphics IR

## 5.1 Purpose

The IR is the canonical representation of a visual composition.

It should describe:

-   layers
-   assets
-   transforms
-   timing
-   keyframes
-   easing
-   text
-   shapes
-   masks
-   effects
-   materials
-   cameras
-   2.5D depth
-   particles
-   renderer requirements
-   references
-   semantic intent

The IR must be renderer-independent.

------------------------------------------------------------------------

# 6. TypeScript IR Design

Create:

``` text
src/lib/motion/ir/types.ts
src/lib/motion/ir/schema.ts
src/lib/motion/ir/version.ts
```

## 6.1 Top-level composition

``` ts
export interface MotionComposition {
  schemaVersion: string;
  id: string;

  start: number;
  end: number;

  coordinateSpace: "normalized" | "pixels";

  canvas: {
    width: number;
    height: number;
    fps: number;
  };

  background?: Color;

  layers: MotionLayer[];

  assets?: MotionAsset[];

  metadata?: {
    purpose?: string;
    style?: string[];
    references?: string[];
    confidence?: number;
    generatedBy?: string;
  };

  rendererHints?: RendererHint[];
}
```

------------------------------------------------------------------------

# 7. Layer Model

Every visual object is a layer.

``` ts
type MotionLayer =
  | VideoLayer
  | ImageLayer
  | TextLayer
  | ShapeLayer
  | GroupLayer
  | ParticleLayer
  | ShaderLayer
  | ThreeLayer
  | RiveLayer;
```

## 7.1 Common layer properties

``` ts
interface BaseLayer {
  id: string;
  type: string;

  start: number;
  duration: number;

  visible?: boolean;

  transform?: Transform;
  opacity?: Animated<number>;

  blendMode?: BlendMode;

  effects?: EffectInstance[];

  mask?: Mask;
  matte?: Matte;

  zIndex?: number;

  parentId?: string;
}
```

This is the foundation for AE-like layering.

------------------------------------------------------------------------

# 8. Transform System

Create a canonical transform representation:

``` ts
interface Transform {
  position: Animated<Vec3>;
  scale: Animated<Vec3>;
  rotation: Animated<Vec3>;
  anchor: Animated<Vec3>;

  skew?: Animated<Vec2>;

  perspective?: {
    x: Animated<number>;
    y: Animated<number>;
  };
}
```

2D uses:

``` text
x
y
rotationZ
```

2.5D uses:

``` text
x
y
z
rotationX
rotationY
rotationZ
camera
```

------------------------------------------------------------------------

# 9. Animation System

Do NOT hard-code animation names such as:

``` text
zoom_punch
scale_pop
slide_left
```

as the fundamental abstraction.

Those should be templates built from the primitive animation system.

## 9.1 Animated value

``` ts
interface Animated<T> {
  type: "constant" | "keyframes" | "spring" | "expression";
  value?: T;

  keyframes?: Keyframe<T>[];

  spring?: SpringConfig;

  expression?: ExpressionRef;
}
```

For the first implementation, only allow:

``` text
constant
keyframes
spring
```

Do not implement arbitrary expressions initially.

------------------------------------------------------------------------

# 10. Keyframes

``` ts
interface Keyframe<T> {
  time: number;
  value: T;

  easing?: Easing;
}
```

Supported easing:

``` ts
type Easing =
  | { type: "linear" }
  | { type: "bezier"; x1: number; y1: number; x2: number; y2: number }
  | { type: "easeIn" }
  | { type: "easeOut" }
  | { type: "easeInOut" }
  | { type: "back"; amount: number }
  | { type: "elastic"; amplitude: number; period: number };
```

Add spring animation:

``` ts
interface SpringConfig {
  mass: number;
  stiffness: number;
  damping: number;
  initialVelocity?: number;
}
```

Use sensible bounded ranges.

Do not let the model generate absurd values.

------------------------------------------------------------------------

# 11. Animation Primitives

Implement these first.

## Transform

``` text
move
scale
rotate
skew
perspective
```

## Opacity

``` text
fade
```

## Reveal

``` text
wipe
clip
mask reveal
trim path
```

## Motion behaviors

``` text
slide
pop
bounce
spring
overshoot
settle
shake
wiggle
orbit
follow
```

## Temporal behaviors

``` text
stagger
delay
sequence
parallel
reverse
```

------------------------------------------------------------------------

# 12. Shape System

Create deterministic vector shapes:

``` text
rectangle
rounded_rectangle
circle
ellipse
line
polygon
star
path
arrow
bracket
blob
```

Each supports:

``` text
fill
stroke
strokeWidth
gradient
opacity
transform
trimPath
```

These primitives should be rendered using SVG/Canvas/Remotion initially.

------------------------------------------------------------------------

# 13. Text System

This is one of the highest-priority systems.

Implement:

``` text
text
character ranges
words
lines
paragraphs
```

Allow animation at:

``` text
character
word
line
whole layer
```

Example:

``` json
{
  "type": "text",
  "content": "43% growth",
  "animation": {
    "target": "word",
    "enter": "spring_pop",
    "stagger": 0.04
  }
}
```

Implement:

-   font family
-   font weight
-   font size
-   tracking
-   leading
-   alignment
-   fill
-   stroke
-   shadow
-   gradient
-   background box
-   per-word color
-   per-word animation
-   per-character animation
-   text clipping
-   text reveal
-   typewriter
-   kinetic typography

------------------------------------------------------------------------

# 14. Kinetic Typography

Build a reusable engine instead of individual caption effects.

The engine should support:

``` text
word highlight
word pop
word slide
word bounce
word rotate
word scale
character reveal
character scramble
line reveal
mask reveal
tracking expansion
tracking contraction
```

Composition:

``` text
Transcript
  |
  +--> words
        |
        +--> word timing
        +--> semantic importance
        +--> emphasis
        +--> style
        |
        v
Kinetic Text Program
```

The AI should specify intent:

``` json
{
  "text": "This changes everything",
  "target": "word",
  "emphasis": ["changes", "everything"],
  "style": "high_energy"
}
```

The compiler decides the exact animation.

------------------------------------------------------------------------

# 15. Masks and Mattes

This is required to reproduce many AE-like compositions.

Implement:

``` text
alpha mask
luma mask
shape mask
inverted mask
track matte
clipping group
```

Example:

``` text
Video
  |
Mask: RoundedRectangle
  |
Shadow
  |
Glow
```

and:

``` text
Text
  |
Track Matte
  |
Gradient
```

Do not implement arbitrary mask path animation in phase 1. Support basic
rectangle/circle/path masks first.

------------------------------------------------------------------------

# 16. Compositing

Implement a normalized blend-mode abstraction.

Start with:

``` text
normal
multiply
screen
overlay
soft_light
add
darken
lighten
```

The renderer backend maps these to its native implementation.

------------------------------------------------------------------------

# 17. Effect System

An effect is NOT a primitive.

An effect is:

``` text
template
+
parameters
+
composition
+
timing
```

Example:

``` text
MetricPop
  |
  +-- Text
  +-- Background Shape
  +-- Accent Line
  +-- Glow
  +-- Spring animation
  +-- Overshoot
  +-- Fade
```

------------------------------------------------------------------------

# 18. Effect Template Schema

Create:

``` ts
interface EffectTemplate {
  id: string;
  version: string;

  name: string;

  description: string;

  tags: string[];

  useCases: string[];

  styleTags: string[];

  motionTags: string[];

  renderer: "remotion" | "webgl" | "webgpu" | "blender" | "rive";

  parameters: EffectParameter[];

  build: MotionProgram;

  preview?: AssetRef;

  references?: VaultReference[];

  constraints?: EffectConstraint[];
}
```

The `build` field is a deterministic program/template, not arbitrary
model-generated code.

------------------------------------------------------------------------

# 19. Parameter System

Every reusable effect should expose parameters.

Example:

``` json
{
  "effect": "metric_pop",
  "parameters": {
    "scale": 1.18,
    "overshoot": 0.12,
    "duration": 0.38,
    "stagger": 0.03,
    "glow": 0.15,
    "accent": "#6D5DFB"
  }
}
```

Parameters must have:

``` text
name
type
default
min
max
description
semantic role
```

Example:

``` ts
{
  name: "overshoot",
  type: "number",
  default: 0.1,
  min: 0,
  max: 0.35,
  description: "Amount of scale overshoot",
  semanticRole: "energy"
}
```

------------------------------------------------------------------------

# 20. Primitive Composition

The model should be able to compose templates.

Example:

``` text
MetricPop
+
ParticleBurst
+
Glow
+
CameraPunch
```

Result:

``` text
43%
  -> scale pop
  -> glow
  -> particles
  -> subtle camera punch
```

This is the major step beyond a fixed effect catalog.

------------------------------------------------------------------------

# 21. 2D Rendering Backend

Use Remotion as the first renderer.

Remotion is explicitly designed for programmatic video generation with
React and supports building reusable motion design systems and
video-editor applications. [Remotion](https://www.remotion.dev/)

Create:

``` text
src/lib/motion/renderers/remotion/
  renderComposition.ts
  LayerRenderer.tsx
  TextRenderer.tsx
  ShapeRenderer.tsx
  MaskRenderer.tsx
  EffectRenderer.tsx
  TransformRenderer.tsx
```

The renderer receives IR only.

It must never contain AI logic.

------------------------------------------------------------------------

# 22. Renderer Contract

``` ts
interface MotionRenderer {
  id: string;

  supports(node: MotionNode): boolean;

  compile(
    composition: MotionComposition
  ): CompiledComposition;

  render(
    compiled: CompiledComposition,
    options: RenderOptions
  ): Promise<RenderResult>;
}
```

The compiler selects the renderer.

------------------------------------------------------------------------

# 23. WebGL Backend

Add WebGL after the 2D IR is stable.

Use WebGL for:

``` text
glow
blur
distortion
chromatic aberration
noise
film grain
liquid distortion
heat distortion
RGB split
displacement
procedural backgrounds
particles
advanced transitions
```

WebGL shaders are well-established and can run vertex/fragment programs;
this makes them appropriate for deterministic GPU visual effects. [MDN
WebGLShader](https://developer.mozilla.org/en-US/docs/Web/API/WebGLShader)

Create:

``` text
src/lib/motion/renderers/webgl/
  WebGLRenderer.ts
  ShaderRegistry.ts
  TextureManager.ts
  passes/
    blur.ts
    glow.ts
    chromatic.ts
    displacement.ts
    noise.ts
    distortion.ts
```

------------------------------------------------------------------------

# 24. WebGPU Backend

Do not make WebGPU a hard dependency initially.

Use it later for:

``` text
heavy particles
compute-driven effects
advanced GPU processing
large texture workloads
future GPU composition
```

WebGPU provides GPU rendering and compute capabilities, but browser
support is still less universal than WebGL. Therefore WebGPU should
initially be an optional backend with WebGL fallback. [MDN
WebGPU](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)

Architecture:

``` text
GPUEffect
   |
   +--> WebGPU if supported
   |
   +--> WebGL fallback
   |
   +--> CPU fallback where practical
```

------------------------------------------------------------------------

# 25. Shader Registry

Never let the model directly execute arbitrary shader code.

Create a controlled registry:

``` ts
type ShaderEffect =
  | "glow"
  | "blur"
  | "chromatic_aberration"
  | "displacement"
  | "noise"
  | "film_grain"
  | "scanlines"
  | "liquid"
  | "heat"
  | "rgb_split"
  | "pixelate";
```

Each shader has:

``` text
shader ID
version
parameters
safe ranges
GPU requirements
fallback
```

Example:

``` json
{
  "shader": "chromatic_aberration",
  "parameters": {
    "amount": 0.08,
    "angle": 0.0
  }
}
```

------------------------------------------------------------------------

# 26. Particles

Build a deterministic particle system.

Minimum:

``` text
emitter
count
lifetime
velocity
direction
spread
gravity
drag
size
sizeOverLife
opacityOverLife
colorOverLife
rotation
randomSeed
```

Important:

**Always use a deterministic seed.**

``` text
seed = hash(projectId + compositionId + layerId)
```

The same IR must produce the same particles.

This is required for reproducibility and caching.

------------------------------------------------------------------------

# 27. 2.5D Engine

Many "3D-looking" social-video effects do not require true 3D.

Implement:

``` text
z-depth
perspective camera
parallax
layer rotation X/Y
camera dolly
camera orbit
depth-based scale
depth blur
```

Example:

``` text
Background z=100
Speaker z=50
Text z=20
Particles z=10
Camera z=0
```

This can reproduce:

-   floating UI
-   depth cards
-   cinematic parallax
-   layered product scenes
-   fake 3D transitions
-   perspective text
-   camera pushes

------------------------------------------------------------------------

# 28. Camera System

Create:

``` ts
interface Camera {
  position: Animated<Vec3>;
  rotation: Animated<Vec3>;

  focalLength?: number;
  fieldOfView?: number;

  target?: Animated<Vec3>;
}
```

Templates:

``` text
camera_punch
camera_push
camera_pull
camera_pan
camera_tilt
camera_orbit
camera_shake
camera_follow
```

------------------------------------------------------------------------

# 29. Face/Speaker Anchoring

The engine must eventually allow graphics to follow the speaker.

Create:

``` text
AnchorTarget
```

Types:

``` text
screen
face
head
torso
hand
object
tracked_point
```

Example:

``` json
{
  "position": {
    "anchor": "speaker.face",
    "offset": {
      "x": 0.1,
      "y": -0.15
    }
  }
}
```

Initially use sampled face detection/tracking data.

Do not require frame-by-frame AI inference for every render.

------------------------------------------------------------------------

# 30. Tracking Data

Create an analysis artifact:

``` text
tracking.json
```

Example:

``` json
{
  "subject": "speaker",
  "frames": [
    {
      "time": 0,
      "face": {
        "x": 0.51,
        "y": 0.42,
        "width": 0.18,
        "height": 0.25
      }
    }
  ]
}
```

Interpolate between sampled points during rendering.

This reduces inference cost.

------------------------------------------------------------------------

# 31. Asset System

Effects should be able to use:

``` text
SVG
PNG
WebP
video
audio
3D model
Rive asset
font
shader
```

Create:

``` ts
interface MotionAsset {
  id: string;
  type: AssetType;
  uri: string;
  metadata?: Record<string, unknown>;
}
```

Use content-addressed storage where possible.

------------------------------------------------------------------------

# 32. Rive Integration

Rive is useful for reusable vector/interactive animations and
state-machine-driven graphics. Rive state machines combine animations,
transitions, inputs, and layers and advance over time at runtime. [Rive
state machines](https://rive.app/docs/runtimes/web/state-machines)

Do NOT make Rive the core engine.

Use it for:

``` text
logos
illustrations
UI animations
branded components
characters
complex vector assets
```

Treat Rive files as assets referenced by the IR.

------------------------------------------------------------------------

# 33. True 3D Backend

Only introduce true 3D after the 2D/2.5D system is strong.

Possible backends:

``` text
Three.js
Blender
```

Three.js provides animation mixers/clips for time-based animation of 3D
objects. [Three.js
AnimationMixer](https://threejs.org/docs/pages/AnimationMixer.html)

Blender provides programmatic keyframes and animation data, and can be
driven through Python. [Blender Python
API](https://docs.blender.org/api/dev/info_quickstart.html)

------------------------------------------------------------------------

# 34. When to Use Blender

Use Blender for effects requiring:

``` text
real geometry
lights
materials
reflections
depth
3D text
volumetric effects
complex 3D particles
real shadows
camera perspective
procedural geometry
```

Do NOT spawn Blender for:

``` text
caption
lower third
metric badge
simple card
simple transition
basic zoom
```

The overhead is not worth it.

------------------------------------------------------------------------

# 35. 3D IR

Create a backend-neutral subset:

``` ts
interface ThreeScene {
  camera: Camera3D;

  objects: ThreeObject[];

  lights: Light[];

  environment?: Environment;

  materials?: Material[];
}
```

Supported first:

``` text
box
sphere
plane
text
image plane
extruded text
camera
area light
point light
directional light
```

Later:

``` text
particles
geometry nodes
volumetrics
physics
procedural geometry
```

------------------------------------------------------------------------

# 36. 3D Determinism

All 3D scenes must specify:

``` text
seed
camera
lighting
material
object transforms
animation curves
```

Never rely on uncontrolled randomness.

------------------------------------------------------------------------

# 37. Inspiration Vault Migration

The existing 451-item Inspiration Vault is a major asset.

Do not discard it.

Currently it acts mostly as:

``` text
reference -> retrieved description -> catalog operation
```

Evolve it toward:

``` text
reference
  |
  +-- semantic metadata
  +-- visual embedding
  +-- motion metadata
  +-- renderer requirements
  +-- executable template
  +-- parameters
  +-- preview
```

------------------------------------------------------------------------

# 38. Vault Schema

Create:

``` ts
interface MotionReference {
  id: string;

  name: string;

  description: string;

  tags: string[];

  useCases: string[];

  visualFeatures: string[];

  motionFeatures: string[];

  layers?: string[];

  rendererRequirements?: RendererRequirement[];

  executableTemplateId?: string;

  previewAsset?: string;

  referenceImage?: string;

  referenceVideo?: string;
}
```

------------------------------------------------------------------------

# 39. Vault Classification

Each reference should be classified into:

``` text
2D
2.5D
3D
typography
UI
data visualization
camera
transition
particle
lighting
compositing
character
product visualization
diagram
photo manipulation
```

And:

``` text
low complexity
medium complexity
high complexity
```

And:

``` text
deterministic procedural
template-based
asset-based
true 3D
requires tracking
requires shader
requires external renderer
```

------------------------------------------------------------------------

# 40. Reference-to-Program Mapping

For each vault reference, add:

``` text
reference
    ->
effect family
    ->
primitive graph
    ->
parameter defaults
    ->
renderer
```

Example:

``` text
"Kinetic Word-by-Word Hook Caption"
    ->
kinetic typography
    ->
Text
 + WordTiming
 + Scale
 + Color
 + Spring
 + Blur
    ->
Remotion
```

Another:

``` text
"Floating 3D Metric"
    ->
2.5D metric
    ->
Text
 + Card
 + Perspective
 + Camera
 + Glow
 + Particles
    ->
WebGL/Remotion
```

Another:

``` text
"3D Chrome Product Reveal"
    ->
true 3D
    ->
Mesh
 + Material
 + Camera
 + Lighting
 + Animation
    ->
Blender/Three.js
```

------------------------------------------------------------------------

# 41. AI Retrieval Pipeline

Change:

``` text
Transcript
  -> retrieve references
```

to:

``` text
Transcript
+
user prompt
+
brand profile
+
video analysis
+
existing edit style
+
scene context
       |
       v
semantic retrieval
       |
       v
motion retrieval
       |
       v
diversification
       |
       v
candidate references
```

Retrieve by:

``` text
semantic intent
visual style
motion type
energy
content type
B2B use case
speaker position
available screen space
duration
renderer capability
```

------------------------------------------------------------------------

# 42. AI Creative Planning

Introduce a distinct stage:

``` text
analysis
   ->
creative_plan
   ->
motion_program
```

Do not combine everything into one giant Gemini response.

## Analysis

Answers:

``` text
What is being said?
Who is speaking?
What matters?
Where are the visual opportunities?
```

## Creative plan

Answers:

``` text
Where should visuals appear?
What should they communicate?
What style should they use?
What references are appropriate?
```

## Motion program

Answers:

``` text
Exactly which primitives/templates and parameters should be executed.
```

------------------------------------------------------------------------

# 43. Creative Plan Schema

``` ts
interface CreativePlan {
  version: string;

  moments: CreativeMoment[];

  globalStyle: {
    energy: "low" | "medium" | "high";
    density: "minimal" | "balanced" | "dense";
    typography: string;
    colorStrategy: string;
  };
}
```

Moment:

``` ts
interface CreativeMoment {
  start: number;
  end: number;

  intent:
    | "emphasis"
    | "explanation"
    | "transition"
    | "hook"
    | "stat"
    | "quote"
    | "cta"
    | "context";

  content: string;

  importance: number;

  suggestedReferences: string[];

  suggestedTemplateFamilies: string[];
}
```

------------------------------------------------------------------------

# 44. Motion Program Schema

Example:

``` json
{
  "schemaVersion": "1.0",
  "id": "moment-43-percent",
  "start": 12.4,
  "end": 15.1,
  "layers": [
    {
      "id": "metric",
      "type": "text",
      "content": "43%",
      "transform": {
        "position": {
          "type": "constant",
          "value": [0.72, 0.42, 0]
        },
        "scale": {
          "type": "spring",
          "spring": {
            "mass": 1,
            "stiffness": 180,
            "damping": 16
          }
        }
      }
    }
  ]
}
```

The exact IR can evolve, but the concept must remain:

``` text
semantic
+
timing
+
layers
+
primitives
+
parameters
```

------------------------------------------------------------------------

# 45. AI Output Rules

The model may only output:

``` text
known layer types
known primitives
known templates
known parameters
known renderer IDs
known asset IDs
known vault references
```

The model may NOT output:

``` text
arbitrary JS
arbitrary TS
arbitrary JSX
arbitrary Python
arbitrary shell commands
arbitrary shader source
```

This is both a reliability and security requirement.

------------------------------------------------------------------------

# 46. Validation

Validation occurs at four levels.

## Level 1: Schema

Zod validates JSON shape.

## Level 2: Semantic

Examples:

``` text
duration > 0
start < end
scale within safe range
opacity 0..1
color valid
font exists
asset exists
template exists
shader exists
```

## Level 3: Composition

Detect:

``` text
invalid parent
cycles
unknown layer
missing asset
overlapping exclusive regions
unsupported blend mode
renderer mismatch
```

## Level 4: Visual

Vision model checks rendered output.

------------------------------------------------------------------------

# 47. Compiler

Create:

``` text
src/lib/motion/compiler/
  normalize.ts
  resolveTemplates.ts
  resolveAssets.ts
  resolveTiming.ts
  validateCapabilities.ts
  buildRenderGraph.ts
  optimizeGraph.ts
```

Pipeline:

``` text
Motion IR
   |
normalize
   |
resolve templates
   |
resolve assets
   |
resolve timing
   |
validate
   |
build render graph
   |
optimize
   |
backend compilation
```

------------------------------------------------------------------------

# 48. Render Graph

Do not immediately render each layer independently.

Build a graph:

``` text
Video
 |
Transform
 |
Color
 |
Mask
 |
Composite
 |
Text
 |
Glow
 |
Composite
 |
Output
```

This allows future optimization.

For example:

``` text
Text
 -> Glow
 -> Blur
 -> Composite
```

can eventually be grouped into one GPU pass.

------------------------------------------------------------------------

# 49. Render Graph Optimization

Implement simple optimization first:

``` text
remove invisible layers
remove zero-opacity layers
remove empty groups
merge static transforms
reuse identical assets
cache static graphics
avoid rendering unused regions
```

Later:

``` text
pass fusion
texture reuse
GPU batching
tile rendering
partial rendering
```

------------------------------------------------------------------------

# 50. Existing EDL Compatibility

Do NOT delete the current EDL.

Create:

``` text
Legacy EDL
    |
    v
EDL -> Motion IR adapter
```

Examples:

``` text
caption
 -> KineticText template

zoom_punch
 -> CameraPunch template

lower_third
 -> LowerThird template

stat_callout
 -> MetricPop template

transition
 -> Transition template
```

This allows the current product to keep working while the new system
grows.

------------------------------------------------------------------------

# 51. Timeline Model

Maintain one canonical timeline.

Important rule:

``` text
source time
    ->
keep segments
    ->
cut time
    ->
motion time
```

All motion compositions must be able to declare whether their timestamps
are:

``` text
source
cut
relative
```

Use the existing timeline remapping implementation as the foundation.

------------------------------------------------------------------------

# 52. Effect Lifecycle

Every effect follows:

``` text
discover
  ->
retrieve
  ->
instantiate
  ->
parameterize
  ->
validate
  ->
compile
  ->
render
  ->
inspect
```

------------------------------------------------------------------------

# 53. Visual QA

This is mandatory for advanced effects.

After rendering:

``` text
render preview
   |
extract frames
   |
vision model
   |
evaluate
```

The evaluator should check:

``` text
composition
readability
overlap
timing
style consistency
brand consistency
face obstruction
safe margins
visual hierarchy
effect intensity
reference similarity
```

------------------------------------------------------------------------

# 54. QA Output

``` ts
interface VisualQAResult {
  score: number;

  issues: VisualIssue[];

  passed: boolean;

  suggestedPatch?: MotionPatch[];
}
```

Issue:

``` ts
interface VisualIssue {
  type:
    | "overlap"
    | "out_of_frame"
    | "too_small"
    | "poor_contrast"
    | "face_obstruction"
    | "style_mismatch"
    | "timing"
    | "excessive_effect"
    | "missing_effect";

  severity: "low" | "medium" | "high";

  layerIds: string[];

  description: string;
}
```

------------------------------------------------------------------------

# 55. Repair Loop

The model should NOT regenerate the whole composition when one issue
exists.

Use patches:

``` json
{
  "patches": [
    {
      "operation": "set",
      "target": "layer.metric.transform.position",
      "value": [0.72, 0.55, 0]
    }
  ]
}
```

Allowed operations:

``` text
set
replace
add
remove
shift
resize
changeParameter
```

Then:

``` text
patch
 -> validate
 -> rerender
 -> inspect
```

Limit retries:

``` text
max 2-3
```

------------------------------------------------------------------------

# 56. Visual QA Sampling

Do not render the entire video for every QA iteration.

For each composition:

``` text
first frame
middle frame
peak animation frame
last frame
```

For transitions:

``` text
before
mid-transition
after
```

For kinetic text:

``` text
entry
peak
exit
```

Only perform full final render after QA passes.

------------------------------------------------------------------------

# 57. Reference Similarity

For vault-driven effects, the QA model should answer:

``` text
Does this composition preserve the important visual characteristics of the reference?
```

Compare:

``` text
layout
motion direction
layer count
color strategy
typography hierarchy
depth
energy
timing
```

Do not require pixel-level similarity.

------------------------------------------------------------------------

# 58. Performance Architecture

The current pipeline should evolve from:

``` text
derive
 -> analyze
 -> cut
 -> final render
```

toward:

``` text
derive
 |
 +--> analysis
 |     +--> transcript
 |     +--> visual analysis
 |     +--> tracking
 |     +--> semantic moments
 |
 +--> mezzanine
 |
 creative planning
 |
 motion compilation
 |
 preview
 |
 QA
 |
 final render
```

Parallelize independent work.

------------------------------------------------------------------------

# 59. Cache Everything

Cache:

``` text
proxy
mezzanine
ffprobe
silence detection
transcript
word timings
visual analysis
face tracking
reference retrieval
creative plan
motion IR
compiled render graph
effect assets
shader pipelines
preview frames
final render
```

Cache keys should include:

``` text
content hash
model/version
prompt hash
analysis version
IR version
template version
renderer version
output format
```

------------------------------------------------------------------------

# 60. Content-Addressed Artifacts

Prefer:

``` text
sha256(source)
```

as the root identity.

Example:

``` text
artifacts/
  source/<sha>
  proxy/<sha>
  transcript/<sha>
  analysis/<sha-model-version>
  motion/<sha-plan-version>
  render/<sha-render-version>
```

This makes reruns cheap.

------------------------------------------------------------------------

# 61. Incremental Rendering

If only a stat callout changes:

Do NOT rerender:

``` text
entire 10-minute video
```

Instead:

``` text
render changed composition
+
reuse unchanged layers
```

Initially implement composition-level caching.

Later implement frame-range caching.

------------------------------------------------------------------------

# 62. Static Layer Caching

If a layer doesn't change over time:

``` text
render once
reuse texture
```

Examples:

``` text
logo
background
static card
static chart
static title
```

------------------------------------------------------------------------

# 63. Renderer Selection

Create:

``` ts
function selectRenderer(node: MotionNode): RendererId
```

Rules:

``` text
simple text -> remotion
simple shapes -> remotion
2D transition -> remotion
shader effect -> webgl
heavy particles -> webgl/webgpu
Rive asset -> rive
true 3D -> blender/three
```

Do not use the most powerful renderer by default.

------------------------------------------------------------------------

# 64. Model Strategy

Use different model jobs.

## Primary planner

Gemini:

``` text
video understanding
semantic editing
creative planning
reference selection
motion program generation
```

## Repair/QA

Use a vision-capable model.

It should receive:

``` text
reference
preview frames
motion program summary
```

## Local processing

Continue using local Whisper for word timings.

------------------------------------------------------------------------

# 65. Prompt Architecture

Do not use one giant prompt.

Create:

``` text
analysis prompt
creative director prompt
motion compiler prompt
visual QA prompt
repair prompt
```

Each has one job.

This improves:

``` text
reliability
token usage
debugging
evaluation
```

------------------------------------------------------------------------

# 66. Model Context

The motion compiler should receive only:

``` text
relevant moment
relevant transcript
relevant analysis
relevant vault references
available templates
brand config
renderer capabilities
```

Do not send all 451 vault entries.

------------------------------------------------------------------------

# 67. Template Retrieval

Retrieve approximately:

``` text
8-20 candidates
```

Then ask the model to select/combine.

Diversity should be enforced across:

``` text
motion family
visual style
renderer
energy
composition
```

------------------------------------------------------------------------

# 68. Brand System

Create:

``` ts
interface BrandProfile {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
  };

  typography: {
    headingFont: string;
    bodyFont: string;
  };

  logo?: AssetRef;

  motionStyle: {
    energy: number;
    roundness: number;
    exaggeration: number;
    density: number;
  };
}
```

The AI should adapt templates instead of inventing brand styles every
time.

------------------------------------------------------------------------

# 69. Style System

Create high-level style presets:

``` text
minimal_b2b
modern_saas
high_energy
cinematic
editorial
technical
playful
luxury
```

These modify effect parameters.

Example:

``` text
high_energy
 -> larger scale overshoot
 -> shorter durations
 -> more particles
 -> stronger transitions

minimal_b2b
 -> smaller movement
 -> softer easing
 -> fewer layers
 -> restrained color
```

------------------------------------------------------------------------

# 70. Effect Density

Add a global control:

``` text
effectDensity: 0..1
```

Interpretation:

``` text
0.0 = almost no graphics
0.5 = balanced
1.0 = dense motion design
```

The creative director uses this.

This prevents the AI from adding effects to every sentence.

------------------------------------------------------------------------

# 71. Semantic Importance

Every potential edit moment gets:

``` text
importance: 0..1
```

Only high-value moments should receive expensive effects.

Example:

``` text
ordinary sentence -> caption only

important claim -> kinetic text

stat -> metric composition

hook -> high-energy composition

CTA -> title/CTA composition
```

------------------------------------------------------------------------

# 72. Avoiding Visual Clutter

Implement a layout budget.

For each time range:

``` text
max text layers
max decorative layers
max particles
max screen occupation
```

Example:

``` ts
interface VisualBudget {
  maxTextArea: number;
  maxDecorativeLayers: number;
  maxParticleCount: number;
  maxConcurrentEffects: number;
}
```

The validator rejects over-dense compositions.

------------------------------------------------------------------------

# 73. Safe Areas

All compositions should understand:

``` text
topSafe
bottomSafe
leftSafe
rightSafe
faceSafeZone
subtitleSafeZone
```

This is particularly important for:

``` text
9:16
1:1
16:9
```

------------------------------------------------------------------------

# 74. Responsive Composition

Do not create separate hand-coded effects for every aspect ratio.

Use normalized coordinates:

``` text
x = 0..1
y = 0..1
```

Then adapt through:

``` text
anchor
safe zone
layout rules
```

------------------------------------------------------------------------

# 75. 9:16

Keep current Shorts support.

Upgrade it so Motion IR understands:

``` text
aspectRatio
safeZones
speakerRegion
captionRegion
```

Then the same effect can adapt.

------------------------------------------------------------------------

# 76. Testing Strategy

Create three test categories.

## Unit tests

Test:

``` text
IR validation
timing
keyframes
easing
template expansion
parameter ranges
timeline remapping
renderer selection
layout
```

## Snapshot tests

Render small compositions and compare:

``` text
expected frame
actual frame
```

Use tolerances rather than exact pixel equality when GPU output can
vary.

## Golden video tests

Maintain:

``` text
10-30 representative clips
```

Cover:

``` text
talking head
fast speaker
slow speaker
multiple cuts
different aspect ratios
different lighting
different resolutions
```

------------------------------------------------------------------------

# 77. Golden Effect Library

Create:

``` text
tests/golden-effects/
```

Each effect has:

``` text
input.json
expected/
  frame-000.png
  frame-015.png
  frame-030.png
metadata.json
```

Every renderer change must run this suite.

------------------------------------------------------------------------

# 78. Effect Acceptance Criteria

An effect is production-ready only when:

-   deterministic
-   schema-valid
-   parameter-bounded
-   renders successfully
-   handles 16:9 and 9:16
-   handles missing optional assets
-   has preview fixture
-   has unit tests
-   has golden frame tests
-   has documented parameters
-   has fallback behavior
-   has renderer capability declaration

------------------------------------------------------------------------

# 79. Performance Benchmarks

Track:

``` text
analysis seconds
transcription seconds
compile seconds
preview render seconds
final render seconds
CPU seconds
GPU seconds
memory
R2 bytes read
R2 bytes written
model tokens
model cost
```

Store per project.

------------------------------------------------------------------------

# 80. Target Performance

Initial targets:

``` text
analysis:
< 1x video duration where practical

preview:
< 10 seconds for a short composition

simple final render:
< 0.5x realtime on provisioned worker

complex GPU composition:
benchmark independently
```

Do not optimize prematurely. Measure first.

------------------------------------------------------------------------

# 81. Cost Controls

Use:

``` text
proxy analysis
cached transcripts
cached tracking
reference retrieval instead of huge prompts
small preview renders
vision QA only on changed compositions
model routing
batching where possible
```

Avoid:

``` text
full-resolution AI analysis
full-video vision QA
full-video rerender for every edit
```

------------------------------------------------------------------------

# 82. Render Workers

Current in-process orchestration is acceptable for development.

Production architecture should move toward:

``` text
API
 |
Queue
 |
+-------------------+
|                   |
Analysis workers   Render workers
|                   |
Gemini             FFmpeg
Whisper            Remotion
Tracking           WebGL/WebGPU
                    Blender
```

Use Redis/BullMQ or equivalent.

------------------------------------------------------------------------

# 83. Render Job Model

``` ts
interface RenderJob {
  id: string;

  projectId: string;

  type:
    | "preview"
    | "composition"
    | "final"
    | "qa";

  inputArtifact: string;

  motionVersion: string;

  renderer: RendererId;

  priority: number;

  status: JobStatus;

  attempts: number;
}
```

------------------------------------------------------------------------

# 84. Failure Handling

Every renderer must return structured errors:

``` ts
interface RenderError {
  code: string;
  message: string;
  layerId?: string;
  renderer?: string;
  recoverable: boolean;
}
```

Examples:

``` text
MISSING_ASSET
UNSUPPORTED_EFFECT
INVALID_SHADER
BLENDER_TIMEOUT
GPU_UNAVAILABLE
INVALID_FONT
OUT_OF_MEMORY
```

------------------------------------------------------------------------

# 85. Decision Logs

Extend the existing decision log.

Each AI decision should record:

``` text
what
why
source moment
reference
template
parameters
renderer
confidence
```

Example:

``` text
12.40s
Metric "43%"
Reason:
"Speaker introduces a concrete growth statistic."

Reference:
"Metric Impact"

Template:
"metric_pop"

Renderer:
"remotion"

Confidence:
0.91
```

------------------------------------------------------------------------

# 86. Motion Program Versioning

Every template and IR must be versioned.

Example:

``` text
motion-ir@1.0
metric-pop@2.1
shader-glitch@1.3
```

A project stores the exact versions used.

This ensures old projects remain renderable.

------------------------------------------------------------------------

# 87. Determinism Requirement

Given:

``` text
same source
same IR
same assets
same renderer version
same seed
```

the output must be visually equivalent.

Randomness must always use explicit seeds.

------------------------------------------------------------------------

# 88. Security

The AI must never execute arbitrary:

``` text
JavaScript
Python
shell
shader
HTML
```

unless that capability is explicitly sandboxed and reviewed.

For phase 1:

``` text
AI -> JSON only
```

Shader programs live in a trusted registry.

Blender programs live in trusted application code/templates.

------------------------------------------------------------------------

# 89. Effect Creation Workflow

Human engineers/designers should be able to add an effect without
changing the AI.

Workflow:

``` text
create template
  ->
define parameters
  ->
compose primitives
  ->
preview
  ->
golden test
  ->
register
  ->
tag
  ->
add to retrieval index
```

The AI automatically becomes capable of using the new effect.

------------------------------------------------------------------------

# 90. Future: AI-Assisted Effect Authoring

Later, build a developer tool:

``` text
Reference image/video
       |
       v
Vision analysis
       |
       v
Effect decomposition
       |
       v
Motion IR proposal
       |
       v
Human approval
       |
       v
Template
```

This is where the vault can become a continuously expanding motion
library.

------------------------------------------------------------------------

# 91. Future: Reference-to-Program

For a reference effect:

``` text
reference video
     |
sample frames
     |
detect layers
     |
detect motion
     |
estimate timing
     |
classify effects
     |
generate Motion IR
     |
human review
     |
save as template
```

Do not expect perfect automatic reconstruction initially.

Use human-in-the-loop.

------------------------------------------------------------------------

# 92. Future: AI Effect Synthesis

Only after the primitive system is mature:

``` text
User:
"Make this metric animation more cinematic."

AI:
retrieve similar effects
+
modify parameters
+
compose additional primitives
+
render
+
visual QA
```

This is safer and more controllable than asking the model to invent
arbitrary code.

------------------------------------------------------------------------

# 93. Future: Program Synthesis

Eventually the AI may be allowed to generate a restricted DSL.

Example:

``` text
GROUP metric {
  TEXT "43%"
    ENTER spring(scale=1.2)
    EXIT fade()

  SHAPE circle
    ENTER scalePop()

  EFFECT glow(amount=0.2)
}
```

Compile this DSL into Motion IR.

Never execute it directly.

------------------------------------------------------------------------

# 94. Effect DSL

Possible later grammar:

``` text
scene
layer
group
text
shape
image
video
particle
camera
effect
animate
keyframe
spring
mask
blend
```

The DSL should compile into the same canonical IR.

------------------------------------------------------------------------

# 95. Research-Based Architecture Principle

The system should follow the pattern demonstrated by visually grounded
animation research:

``` text
understand visual content
       ->
construct semantic concept
       ->
generate executable animation representation
       ->
render
       ->
visually inspect
       ->
repair
```

LogoMotion specifically reports a visually grounded code-synthesis and
visual-debugging approach for content-aware animation. This strongly
supports making the **program representation** the center of the system
rather than directly generating pixels. [Adobe Research
LogoMotion](https://research.adobe.com/publication/logomotion-visually-grounded-code-synthesis-for-creating-and-editing-animation/)

------------------------------------------------------------------------

# 96. Phase Plan

## Phase 1 --- Motion IR foundation

### Goal

Introduce the IR without changing rendering behavior.

### Tasks

-   [ ] create `src/lib/motion/ir`
-   [ ] define schemas
-   [ ] define versioning
-   [ ] implement layer model
-   [ ] implement transforms
-   [ ] implement animated values
-   [ ] implement keyframes
-   [ ] implement easing
-   [ ] implement validation
-   [ ] write unit tests
-   [ ] create IR fixtures

### Acceptance

Existing EDL output can be converted into valid Motion IR.

No visual regression.

------------------------------------------------------------------------

# 97. Phase 2 --- Primitive renderer

### Goal

Build a reusable 2D primitive engine.

### Implement

-   [ ] text
-   [ ] rectangle
-   [ ] circle
-   [ ] line
-   [ ] image
-   [ ] video
-   [ ] transform
-   [ ] opacity
-   [ ] clipping
-   [ ] basic masks
-   [ ] basic blend modes
-   [ ] keyframes
-   [ ] easing
-   [ ] spring

### Acceptance

At least 20 compositions can be built without creating a new renderer
component for each composition.

------------------------------------------------------------------------

# 98. Phase 3 --- Template system

### Goal

Convert fixed effects into reusable templates.

### Migrate

``` text
zoom_punch
caption
lower_third
stat_callout
title_card
transition
```

into:

``` text
templates/
```

### Acceptance

AI can select a template and customize parameters without needing
renderer-specific knowledge.

------------------------------------------------------------------------

# 99. Phase 4 --- Kinetic typography

### Implement

-   [ ] word segmentation
-   [ ] character segmentation
-   [ ] word timing
-   [ ] emphasis
-   [ ] per-word animation
-   [ ] per-character animation
-   [ ] typewriter
-   [ ] spring pop
-   [ ] highlight
-   [ ] mask reveal
-   [ ] tracking animation

### Acceptance

Reproduce at least 10 distinct kinetic typography references from the
vault.

------------------------------------------------------------------------

# 100. Phase 5 --- Vault executable migration

### Tasks

-   [ ] enrich vault schema
-   [ ] classify 451 references
-   [ ] map references to effect families
-   [ ] map existing references to templates
-   [ ] add executable template IDs
-   [ ] add renderer requirements
-   [ ] add parameter defaults
-   [ ] add previews
-   [ ] build retrieval index
-   [ ] add reference-to-template evaluation

### Acceptance

At least 50 high-value vault references are executable or mapped to an
explicit "requires advanced backend" status.

------------------------------------------------------------------------

# 101. Phase 6 --- Creative Director

### Add

``` text
analysis
 ->
creative plan
 ->
motion program
```

### Tasks

-   [ ] separate analysis prompt
-   [ ] creative plan schema
-   [ ] motion generation schema
-   [ ] reference retrieval
-   [ ] template selection
-   [ ] parameter generation
-   [ ] visual density
-   [ ] brand style
-   [ ] semantic importance

### Acceptance

A talking-head video produces varied but relevant compositions without
manually specifying effects.

------------------------------------------------------------------------

# 102. Phase 7 --- Layout and tracking

### Implement

-   [ ] normalized coordinates
-   [ ] safe areas
-   [ ] face safe zones
-   [ ] face anchoring
-   [ ] tracked positions
-   [ ] speaker-aware placement
-   [ ] automatic collision detection
-   [ ] responsive 9:16 layout

### Acceptance

Graphics do not cover the speaker or leave safe regions in normal
talking-head footage.

------------------------------------------------------------------------

# 103. Phase 8 --- WebGL

### Implement

-   [ ] WebGL renderer
-   [ ] texture system
-   [ ] shader registry
-   [ ] blur
-   [ ] glow
-   [ ] chromatic aberration
-   [ ] displacement
-   [ ] noise
-   [ ] RGB split
-   [ ] film grain
-   [ ] procedural backgrounds

### Acceptance

At least 10 vault effects requiring shader-like visuals render
deterministically.

------------------------------------------------------------------------

# 104. Phase 9 --- Particles

### Implement

-   [ ] deterministic seed
-   [ ] emitter
-   [ ] velocity
-   [ ] gravity
-   [ ] drag
-   [ ] lifetime
-   [ ] size
-   [ ] opacity
-   [ ] color
-   [ ] turbulence

### Acceptance

Particle effects remain identical across repeated renders.

------------------------------------------------------------------------

# 105. Phase 10 --- Visual QA

### Implement

-   [ ] preview frame extraction
-   [ ] vision QA
-   [ ] issue schema
-   [ ] patch schema
-   [ ] repair loop
-   [ ] retry limit
-   [ ] QA decision logs

### Acceptance

At least three intentionally broken compositions are automatically
corrected.

------------------------------------------------------------------------

# 106. Phase 11 --- 2.5D

### Implement

-   [ ] Z-depth
-   [ ] perspective
-   [ ] camera
-   [ ] parallax
-   [ ] camera punch
-   [ ] depth blur
-   [ ] 3D transforms

### Acceptance

Reproduce at least 10 2.5D vault references.

------------------------------------------------------------------------

# 107. Phase 12 --- Rive

Optional.

### Implement

-   [ ] Rive asset registry
-   [ ] state machine selection
-   [ ] parameter binding
-   [ ] timeline synchronization

### Acceptance

A Rive asset can be inserted as a deterministic layer.

------------------------------------------------------------------------

# 108. Phase 13 --- True 3D

Only start when 2D/2.5D meets product quality requirements.

### Tasks

-   [ ] 3D IR
-   [ ] camera
-   [ ] mesh
-   [ ] material
-   [ ] lighting
-   [ ] 3D text
-   [ ] animation
-   [ ] renderer worker
-   [ ] output compositing

### Acceptance

At least 5 true-3D vault references render at production quality.

------------------------------------------------------------------------

# 109. Phase 14 --- Render Graph Optimization

### Implement

-   [ ] static caching
-   [ ] layer pruning
-   [ ] texture reuse
-   [ ] composition caching
-   [ ] partial rendering
-   [ ] GPU batching
-   [ ] pass fusion where justified

------------------------------------------------------------------------

# 110. Phase 15 --- Production Worker Architecture

Move:

``` text
in-process pipeline
```

toward:

``` text
queue
 |
analysis worker
 |
render worker
 |
GPU worker
 |
3D worker
```

Add:

-   [ ] retries
-   [ ] job priorities
-   [ ] concurrency limits
-   [ ] resource limits
-   [ ] cancellation
-   [ ] progress
-   [ ] observability

------------------------------------------------------------------------

# 111. Suggested Folder Structure

``` text
src/lib/
  motion/
    ir/
      types.ts
      schema.ts
      version.ts
      normalize.ts

    primitives/
      transform.ts
      opacity.ts
      text.ts
      shape.ts
      mask.ts
      blend.ts
      particles.ts
      camera.ts

    animation/
      keyframes.ts
      easing.ts
      spring.ts
      stagger.ts

    templates/
      registry.ts
      metric-pop.ts
      lower-third.ts
      kinetic-text.ts
      title-card.ts
      camera-punch.ts
      transitions/
      captions/

    compiler/
      compile.ts
      resolveTemplates.ts
      resolveAssets.ts
      validateCapabilities.ts
      buildRenderGraph.ts
      optimizeGraph.ts

    renderers/
      remotion/
      webgl/
      webgpu/
      rive/
      blender/

    shaders/
      registry.ts
      glow.ts
      blur.ts
      chromatic.ts
      displacement.ts

    tracking/
      types.ts
      face.ts
      interpolation.ts

    vault/
      schema.ts
      retrieval.ts
      mappings.ts
      templates.ts

    qa/
      extractFrames.ts
      evaluate.ts
      repair.ts
      patches.ts

    assets/
      registry.ts
      resolver.ts

    testing/
      fixtures/
      golden/
```

------------------------------------------------------------------------

# 112. Existing Pipeline After Migration

The final pipeline should become:

``` text
UPLOAD
  |
  v
INGEST
  |
  +--> proxy
  +--> mezzanine
  +--> metadata
  |
  v
ANALYSIS
  |
  +--> transcript
  +--> word timings
  +--> silence
  +--> visual moments
  +--> face/tracking data
  |
  v
CREATIVE DIRECTOR
  |
  +--> semantic moments
  +--> references
  +--> style
  |
  v
MOTION PROGRAM
  |
  v
VALIDATE
  |
  v
COMPILE
  |
  +--> render graph
  |
  +--> Remotion
  +--> WebGL/WebGPU
  +--> Rive
  +--> 3D backend
  |
  v
PREVIEW
  |
  v
VISUAL QA
  |
  +------> REPAIR
  |           |
  |           +----> validate
  |                 render
  |
  v
FINAL RENDER
  |
  v
FFmpeg / COMPOSITE
  |
  v
MP4
```

------------------------------------------------------------------------

# 113. Implementation Rules for the Coding Agent

The coding agent MUST:

1.  Read the existing architecture before modifying it.
2.  Preserve all currently working pipeline steps.
3.  Implement one phase at a time.
4.  Add tests with every new primitive.
5.  Never bypass the Motion IR.
6.  Never let Gemini directly execute code.
7.  Never make arbitrary shader execution part of the initial AI
    contract.
8.  Preserve source-time/cut-time timeline semantics.
9.  Keep all renderer-specific logic behind renderer interfaces.
10. Version the IR.
11. Version effect templates.
12. Log every AI decision.
13. Add golden fixtures for visual changes.
14. Avoid introducing Blender until true 3D requirements justify it.
15. Prefer Remotion for ordinary 2D graphics.
16. Prefer WebGL/WebGPU only for effects that benefit from GPU
    processing.
17. Cache expensive analysis and rendering artifacts.
18. Keep all randomness deterministic.
19. Do not rewrite working infrastructure without evidence that it is
    necessary.
20. Do not implement future phases prematurely.

------------------------------------------------------------------------

# 114. Definition of Done for the Motion Engine MVP

The MVP is complete when:

-   [ ] Motion IR exists and is versioned.
-   [ ] Existing EDL converts into Motion IR.
-   [ ] Remotion renders Motion IR.
-   [ ] Transform/keyframe/easing/spring systems work.
-   [ ] Text and shapes are first-class layers.
-   [ ] Masks and compositing work.
-   [ ] Effects are reusable parameterized templates.
-   [ ] Existing effects have been migrated.
-   [ ] At least 50 vault references are mapped to executable templates.
-   [ ] Gemini can select references and templates.
-   [ ] Gemini can parameterize templates.
-   [ ] AI cannot execute arbitrary code.
-   [ ] 16:9 and 9:16 work.
-   [ ] Face-safe layout works.
-   [ ] Golden effect tests exist.
-   [ ] Decision logs explain references/template/parameters.
-   [ ] Existing end-to-end pipeline remains functional.

------------------------------------------------------------------------

# 115. Definition of Done for Advanced Motion Engine

The advanced engine is complete when:

-   [ ] WebGL effects work.
-   [ ] deterministic particles work.
-   [ ] 2.5D camera/depth works.
-   [ ] tracking-aware graphics work.
-   [ ] visual QA works.
-   [ ] automatic repair works.
-   [ ] composition-level caching works.
-   [ ] renderer selection is automatic.
-   [ ] Rive assets can be integrated.
-   [ ] true 3D backend exists for selected references.
-   [ ] 100+ vault references are executable or have documented renderer
    requirements.
-   [ ] render workers scale independently.
-   [ ] GPU workloads are isolated.
-   [ ] per-project cost metrics exist.
-   [ ] golden video regression suite exists.

------------------------------------------------------------------------

# 116. Feasibility Matrix

The goal is not to promise that every After Effects effect can be
recreated with one engine.

  -----------------------------------------------------------------------
  Effect family           Target backend          Feasibility
  ----------------------- ----------------------- -----------------------
  Captions                Remotion                Excellent

  Kinetic typography      Remotion                Excellent

  Lower thirds            Remotion                Excellent

  Stat cards              Remotion                Excellent

  Shape animation         Remotion                Excellent

  Masks                   Remotion/WebGL          Excellent

  Glows                   WebGL                   Excellent

  Blur                    WebGL                   Excellent

  RGB split               WebGL                   Excellent

  Distortion              WebGL                   Excellent

  Particles               WebGL/WebGPU            Very good

  2.5D cards              WebGL                   Very good

  Camera parallax         WebGL                   Very good

  UI/product mockups      Remotion/WebGL          Very good

  Complex vector          Rive/Remotion           Very good
  animation                                       

  Real 3D text            Three.js/Blender        Good

  Real 3D product scenes  Blender/Three.js        Good

  Volumetrics             Blender                 Good

  Complex physics         Blender                 Possible but expensive

  Arbitrary AE plugins    N/A                     Not a goal

  Pixel-perfect           N/A                     Not realistic
  reconstruction of every                         
  reference                                       
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 117. What "AI After Effects" Actually Means

The system does NOT need to recreate the entire After Effects
application.

It needs to recreate the **creative capabilities editors use most
often**.

That means:

``` text
layers
+
timing
+
keyframes
+
easing
+
text
+
shapes
+
masks
+
compositing
+
camera
+
2.5D
+
particles
+
shaders
+
assets
+
templates
+
3D where needed
```

This is enough to reproduce a surprisingly large fraction of modern
social/B2B motion graphics.

------------------------------------------------------------------------

# 118. Final Architectural Principle

The product should evolve from:

``` text
AI chooses effects
```

to:

``` text
AI designs compositions
```

and eventually:

``` text
AI programs a constrained motion-design language.
```

The renderers remain deterministic.

The vault provides references and reusable programs.

The AI provides semantic understanding and creative decisions.

The compiler provides safety and renderer independence.

The renderer provides pixels.

The visual QA loop provides iterative quality control.

That separation is the core of the system.

------------------------------------------------------------------------

# 119. Research References

Primary/reference sources used for this architecture:

-   Adobe After Effects expression model:
    https://helpx.adobe.com/in/after-effects/using/expression-language.html

-   Adobe Research --- LogoMotion:
    https://research.adobe.com/publication/logomotion-visually-grounded-code-synthesis-for-creating-and-editing-animation/

-   LogoMotion paper: https://arxiv.org/abs/2405.07065

-   Adobe Research --- Narrative Motion Blocks / AniMate:
    https://research.adobe.com/publication/logomotion-visually-grounded-code-generation-for-content-aware-animation/

-   Remotion: https://www.remotion.dev/

-   MDN WebGLShader:
    https://developer.mozilla.org/en-US/docs/Web/API/WebGLShader

-   MDN WebGPU:
    https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API

-   Rive state machines:
    https://rive.app/docs/runtimes/web/state-machines

-   Three.js AnimationMixer:
    https://threejs.org/docs/pages/AnimationMixer.html

-   Blender Python API animation:
    https://docs.blender.org/api/dev/info_quickstart.html

------------------------------------------------------------------------

# 120. First Task for the Coding Agent

Before implementing anything:

``` text
1. Inspect the current repository.
2. Identify the existing EDL schema.
3. Identify all existing effect implementations.
4. Identify timeline remapping code.
5. Identify Remotion composition entrypoints.
6. Identify vault schema/retrieval code.
7. Identify pipeline step boundaries.
8. Identify current tests.
9. Produce a short migration map from:
      current EDL/effect catalog
      ->
      Motion IR/templates/renderers
10. Do NOT modify production code yet.
```

Then implement **Phase 1 only**.

After Phase 1 passes all tests, proceed to Phase 2.

Do not skip phases.

------------------------------------------------------------------------

# 121. Most Important Constraint

**Do not build an "AI that generates After Effects code."**

Build:

``` text
AI
 |
 v
Motion Design IR
 |
 v
Deterministic Motion Compiler
 |
 +---- Remotion
 +---- WebGL/WebGPU
 +---- Rive
 +---- Blender/Three.js
 |
 v
Video
```

That is the architecture that gives this project the best combination
of:

``` text
AI creativity
+
professional-looking motion graphics
+
determinism
+
safety
+
reusability
+
speed
+
cost control
+
renderer independence
```

And it lets the existing Inspiration Vault become one of the most
valuable components of the system: not merely a gallery of effects, but
the foundation of an executable motion-design library.
