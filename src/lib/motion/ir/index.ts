/**
 * Motion Graphics IR — public entry point (Phase 1).
 *
 * The IR is the canonical, renderer-independent representation of a visual
 * composition. Phase 1 introduces the types, a zod schema + self-healing parser,
 * a semantic validator, and an EDL -> IR adapter. Nothing is wired into the
 * render path yet (no visual change).
 */

export * from './types';
export { IR_VERSION, BOUNDS, type IrVersion } from './version';
export { parseMotionComposition, layerZ } from './schema';
export { motionFromEdl, type CanvasSpec, type MotionFromEdlResult } from './fromEdl';
export { validateComposition, type ValidationResult } from '../validators/validate';
export {
  TEMPLATES,
  TEMPLATE_IDS,
  getTemplate,
  type EffectTemplate,
  type EffectParameter,
  type TemplateResult,
} from '../templates/registry';
export { resolveTemplate, clampParams, type ResolveResult } from '../compiler/resolveTemplates';
export { DEFAULT_BRAND, type BrandProfile, type BrandColors, type BrandFonts } from '../brand';
export { CAPTION_PRESETS, CAPTION_PRESET_IDS, resolveCaptionConfig, type CaptionConfig } from '../captions';
export { type EffectStyle, type LowerThirdStyle, type StatStyle, type TitleCardStyle } from '../effects';
export {
  enrichedVault,
  executableReferences,
  referenceToInstance,
  retrieveExecutableReferences,
  vaultStats,
  refExecLine,
  type MotionReference,
  type ReferenceMapping,
  type EffectFamily,
} from '../vault';
export { classifyReference } from '../vault/mappings';
