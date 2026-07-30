import { describe, it, expect } from 'vitest';
import { planParts, partRange, MIN_PART, MAX_PARTS, DEFAULT_PART } from '../uploads/partPlan';

const GiB = 1024 * 1024 * 1024;
const MiB = 1024 * 1024;

describe('planParts', () => {
  it('uses one part for a small file', () => {
    expect(planParts(2 * MiB)).toEqual({ partSize: DEFAULT_PART, partCount: 1 });
  });

  it('chunks a mid-size file at the default part size', () => {
    // 200 MiB / 64 MiB = 4 parts
    expect(planParts(200 * MiB)).toEqual({ partSize: DEFAULT_PART, partCount: 4 });
  });

  it('handles a 12 GB file within the part ceiling', () => {
    const plan = planParts(12 * GiB);
    expect(plan.partSize).toBe(DEFAULT_PART); // 12GB/64MB = 192 parts
    expect(plan.partCount).toBe(Math.ceil((12 * GiB) / DEFAULT_PART));
    expect(plan.partCount).toBeLessThanOrEqual(MAX_PARTS);
  });

  it('grows part size so a huge file stays under 10k parts', () => {
    const huge = 5 * 1024 * GiB; // 5 TB
    const plan = planParts(huge);
    expect(plan.partCount).toBeLessThanOrEqual(MAX_PARTS);
    expect(plan.partSize).toBeGreaterThan(DEFAULT_PART);
    expect(plan.partSize % MiB).toBe(0); // rounded to whole MiB
  });

  it('never goes below the 5 MiB minimum part', () => {
    expect(planParts(1 * MiB).partSize).toBeGreaterThanOrEqual(MIN_PART);
  });
});

describe('partRange', () => {
  it('computes byte ranges and clamps the final part', () => {
    expect(partRange(250, 100, 1)).toEqual([0, 100]);
    expect(partRange(250, 100, 3)).toEqual([200, 250]);
  });
});
