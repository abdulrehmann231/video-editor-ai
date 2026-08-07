import { afterEach, describe, expect, it } from 'vitest';
import { framesPerLambda } from '../render/lambda';

const originalFramesPerLambda = process.env.REMOTION_FRAMES_PER_LAMBDA;
const originalMaxLambdaFunctions = process.env.REMOTION_MAX_LAMBDA_FUNCTIONS;

afterEach(() => {
  if (originalFramesPerLambda === undefined) delete process.env.REMOTION_FRAMES_PER_LAMBDA;
  else process.env.REMOTION_FRAMES_PER_LAMBDA = originalFramesPerLambda;

  if (originalMaxLambdaFunctions === undefined) delete process.env.REMOTION_MAX_LAMBDA_FUNCTIONS;
  else process.env.REMOTION_MAX_LAMBDA_FUNCTIONS = originalMaxLambdaFunctions;
});

describe('framesPerLambda', () => {
  it('defaults to a shard size that stays within a low concurrency cap', () => {
    delete process.env.REMOTION_FRAMES_PER_LAMBDA;
    delete process.env.REMOTION_MAX_LAMBDA_FUNCTIONS;

    expect(framesPerLambda(900)).toBe(100);
  });

  it('respects an explicit shard size override', () => {
    process.env.REMOTION_FRAMES_PER_LAMBDA = '250';
    delete process.env.REMOTION_MAX_LAMBDA_FUNCTIONS; // default cap (10) → floor 100 < 250

    expect(framesPerLambda(900)).toBe(250);
  });

  it('derives a shard size from the max Lambda function cap', () => {
    delete process.env.REMOTION_FRAMES_PER_LAMBDA;
    process.env.REMOTION_MAX_LAMBDA_FUNCTIONS = '6';

    expect(framesPerLambda(900)).toBe(180);
  });

  it('clamps a too-small explicit shard up to keep concurrency under the cap', () => {
    // 15044 frames with a small shard would spawn ~150 concurrent Lambdas and
    // trip AWS "Rate Exceeded". With the cap at 8 functions (7 renderers), the
    // shard must be at least ceil(15044 / 7) = 2150 so only 7 Lambdas run.
    process.env.REMOTION_FRAMES_PER_LAMBDA = '100';
    process.env.REMOTION_MAX_LAMBDA_FUNCTIONS = '8';

    expect(framesPerLambda(15044)).toBe(2150);
  });

  it('still honors an explicit shard larger than the concurrency floor', () => {
    process.env.REMOTION_FRAMES_PER_LAMBDA = '3000';
    process.env.REMOTION_MAX_LAMBDA_FUNCTIONS = '8';

    expect(framesPerLambda(15044)).toBe(3000);
  });
});