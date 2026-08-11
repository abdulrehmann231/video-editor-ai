import { join } from 'node:path';
import { bundle } from '@remotion/bundler';

/**
 * Bundle the Remotion entry once per process and share the serve URL across all
 * render paths (Edit + Motion), so we don't pay webpack twice.
 */
let bundlePromise: Promise<string> | null = null;

export function getRemotionBundle(): Promise<string> {
  if (!bundlePromise) {
    bundlePromise = bundle({ entryPoint: join(process.cwd(), 'src/remotion/index.ts') });
  }
  return bundlePromise;
}
