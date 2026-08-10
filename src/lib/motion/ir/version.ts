/**
 * Motion Graphics IR version + bounded-range constants.
 *
 * BOUNDS is the single source of truth for both the zod schema and the semantic
 * validator, so the model can never produce absurd values (per the engine plan
 * §10 "Use sensible bounded ranges. Do not let the model generate absurd values").
 */

export const IR_VERSION = '1.0' as const;
export type IrVersion = typeof IR_VERSION;

export const BOUNDS = {
  scale: { min: 0, max: 10 },
  opacity: { min: 0, max: 1 },
  rotationDeg: { min: -3600, max: 3600 },
  duration: { min: 0.001, max: 3600 },
  fontSize: { min: 4, max: 4000 },
  spring: {
    mass: { min: 0.1, max: 20 },
    stiffness: { min: 1, max: 1000 },
    damping: { min: 0, max: 200 },
  },
} as const;
