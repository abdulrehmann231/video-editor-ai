import { describe, it, expect } from 'vitest';
import {
  enrichedVault,
  executableReferences,
  referenceToInstance,
  retrieveExecutableReferences,
  vaultStats,
  resolveTemplate,
  validateComposition,
  type MotionComposition,
} from '../motion/ir';
import { VAULT } from '../vault';

/**
 * Phase 5 — the executable Inspiration Vault. Every reference is classified; a
 * large fraction map to real templates and the rest are flagged "requires
 * advanced backend". Every executable reference must actually build valid layers.
 */

const CTX = { idPrefix: 'r', dur: 2, canvas: { width: 1280, height: 720, fps: 30 } };

describe('vault classification coverage', () => {
  it('classifies all 451 references', () => {
    const v = enrichedVault();
    expect(v).toHaveLength(VAULT.length);
    expect(v.every((r) => r.mapping && r.mapping.family)).toBe(true);
  });

  it('has well over 50 executable references (acceptance)', () => {
    const s = vaultStats();
    expect(s.total).toBe(451);
    expect(s.executable).toBeGreaterThanOrEqual(50);
    // Advanced/other are explicitly flagged, not silently broken.
    expect(s.executable + s.requiresAdvanced).toBe(451);
  });
});

describe('every executable reference builds valid IR', () => {
  it('resolves each mapping to layers (or a camera) that validate', () => {
    const refs = executableReferences();
    expect(refs.length).toBeGreaterThan(50);
    for (const ref of refs) {
      const inst = referenceToInstance(ref)!;
      const res = resolveTemplate(inst.templateId, inst.params, CTX);
      expect(res.warnings, `ref #${ref.i} ${ref.name} -> ${inst.templateId}`).toHaveLength(0);
      // A template yields overlay layers and/or a composition camera (camera_punch).
      expect(res.layers.length > 0 || Boolean(res.camera), `ref #${ref.i} produced nothing`).toBe(true);

      const comp: MotionComposition = {
        schemaVersion: '1.0',
        id: `c_${ref.i}`,
        start: 0,
        end: CTX.dur,
        timeBasis: 'cut',
        coordinateSpace: 'normalized',
        canvas: CTX.canvas,
        ...(res.camera ? { camera: res.camera } : {}),
        layers: res.layers,
      };
      expect(validateComposition(comp).ok, `ref #${ref.i} invalid comp`).toBe(true);
    }
  });
});

describe('reference mappings are sensible for anchors', () => {
  it('maps a 3D money orb to three:stat_orb', () => {
    const orb = enrichedVault().find((r) => r.i === 1)!;
    expect(orb.mapping.templateId).toBe('three');
    expect(orb.mapping.params?.template).toBe('stat_orb');
  });

  it('retrieveExecutableReferences(executableOnly) returns only renderable refs', () => {
    const refs = retrieveExecutableReferences('stat metric revenue growth', { limit: 10, executableOnly: true });
    expect(refs.length).toBeGreaterThan(0);
    expect(refs.every((r) => r.mapping.templateId && !r.mapping.requiresAdvanced)).toBe(true);
  });
});
