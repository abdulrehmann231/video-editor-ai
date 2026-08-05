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

    expect(framesPerLambda(900)).toBe(250);
  });

  it('derives a shard size from the max Lambda function cap', () => {
    delete process.env.REMOTION_FRAMES_PER_LAMBDA;
    process.env.REMOTION_MAX_LAMBDA_FUNCTIONS = '6';

    expect(framesPerLambda(900)).toBe(180);
  });
});