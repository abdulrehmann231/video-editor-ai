/**
 * Registry of bundled Lottie animations (public/lottie/*.json). Pure data — safe
 * to import in both the Node pipeline (schema/catalog/timeline) and the Remotion
 * browser bundle (LottieLayer).
 *
 * To add a pro animation: download a free/CC0 Lottie JSON (e.g. LottieFiles) into
 * public/lottie/, add an entry here, and Gemini can start using it by `template` id.
 */
export type LottiePosition = 'full' | 'center' | 'corner';

export interface LottieTemplate {
  id: string;
  file: string;
  label: string;
  whenToUse: string;
  position: LottiePosition;
  /** Size of the animation relative to the frame width (for center/corner). */
  scale: number;
  loop: boolean;
}

export const LOTTIE_TEMPLATES: LottieTemplate[] = [
  {
    id: 'confetti',
    file: 'confetti.json',
    label: 'Confetti burst',
    whenToUse: 'a celebration / win / positive result / big reveal moment',
    position: 'full',
    scale: 1,
    loop: false,
  },
  {
    id: 'checkmark',
    file: 'checkmark.json',
    label: 'Green checkmark pop',
    whenToUse: 'confirm a point, mark a step done, or a "yes / correct / it works"',
    position: 'center',
    scale: 0.35,
    loop: false,
  },
];

export const LOTTIE_IDS = LOTTIE_TEMPLATES.map((t) => t.id);

export function getLottieTemplate(id: string): LottieTemplate | undefined {
  return LOTTIE_TEMPLATES.find((t) => t.id === id);
}
