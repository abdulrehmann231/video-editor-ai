/**
 * Registry of 3D effect templates (rendered with Three.js / react-three-fiber via
 * @remotion/three, in headless Chrome with software WebGL — no GPU, no After
 * Effects). Pure data; imported by both the Node pipeline and the Remotion bundle.
 */
export interface ThreeTemplate {
  id: string;
  label: string;
  whenToUse: string;
}

export const THREE_TEMPLATES: ThreeTemplate[] = [
  {
    id: 'stat_orb',
    label: '3D glass stat orb',
    whenToUse:
      'a premium 3D reveal of a key number/metric (revenue, %, multiple) — the glossy orb with the value floating in it',
  },
  {
    id: 'card_3d',
    label: '3D flip card',
    whenToUse: 'a 3D card that flips in to introduce a term, name, or short headline',
  },
];

export const THREE_IDS = THREE_TEMPLATES.map((t) => t.id);

export function getThreeTemplate(id: string): ThreeTemplate | undefined {
  return THREE_TEMPLATES.find((t) => t.id === id);
}
