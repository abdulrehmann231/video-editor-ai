import { describe, it, expect } from 'vitest';
import { stepState, PIPELINE_STEPS } from '../pipeline/view';

describe('pipeline stepState', () => {
  it('marks all steps done when the pipeline is done', () => {
    for (const s of PIPELINE_STEPS) {
      expect(stepState('done', 'done', s.key)).toBe('done');
    }
  });

  it('shows the active step and completed prior steps while running', () => {
    expect(stepState('running', 'render', 'analyze')).toBe('done');
    expect(stepState('running', 'render', 'render')).toBe('active');
    expect(stepState('running', 'render', 'done')).toBe('pending');
  });

  it('does not mark the failing step active on error', () => {
    expect(stepState('error', 'render', 'analyze')).toBe('done');
    expect(stepState('error', 'render', 'render')).toBe('pending');
  });

  it('starts with analyze active', () => {
    expect(stepState('running', 'analyze', 'analyze')).toBe('active');
    expect(stepState('running', 'analyze', 'render')).toBe('pending');
  });
});
