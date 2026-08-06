/**
 * One-time (and after any composition change) Remotion Lambda setup.
 *
 *   npm run lambda:deploy
 *
 * Deploys the Lambda render function + the composition "site" (bundle) to your
 * AWS account, then prints the env values to paste into .env.local. Re-run
 * `deploySite` (this script) whenever you change src/remotion/*.
 *
 * Requires AWS creds in env (REMOTION_AWS_ACCESS_KEY_ID / _SECRET_ACCESS_KEY or
 * AWS_ACCESS_KEY_ID / _SECRET_ACCESS_KEY) and a region. See DEPLOY-LAMBDA.md.
 */
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { getOrCreateBucket, deployFunction, deploySite, type AwsRegion } from '@remotion/lambda';

function loadEnvFile(path: string) {
  try {
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (!m) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (process.env[m[1]] === undefined) process.env[m[1]] = v;
    }
  } catch {
    /* absent — fine */
  }
}
loadEnvFile('.env.local');
loadEnvFile('.env');

async function main() {
  const region = (process.env.REMOTION_AWS_REGION || process.env.AWS_REGION || 'us-east-1') as AwsRegion;
  const SITE = 'edit-ai';
  const timeoutInSeconds = Number(process.env.REMOTION_LAMBDA_TIMEOUT_SECONDS) || 900;

  console.log(`Deploying Remotion Lambda in region ${region} …`);
  const memorySizeInMb = Number(process.env.REMOTION_LAMBDA_MEMORY_MB) || 4096;
  const { functionName } = await deployFunction({
    region,
    createCloudWatchLogGroup: true,
    // On Lambda, CPU scales with memory, so more memory = faster per-frame
    // rendering (crucial when a low account concurrency quota forces big
    // chunks). 4096 MB ≈ 2.5 vCPUs vs ~1.2 at 2048; cost stays ~flat because
    // you pay memory × time and time drops. Override with REMOTION_LAMBDA_MEMORY_MB.
    memorySizeInMb,
    diskSizeInMb: 4096,
    timeoutInSeconds,
  });
  console.log(`  memory: ${memorySizeInMb} MB, timeout: ${timeoutInSeconds}s`);
  console.log('  function:', functionName);

  const { bucketName } = await getOrCreateBucket({ region });
  console.log('  bucket:', bucketName);

  const { serveUrl } = await deploySite({
    region,
    bucketName,
    entryPoint: join(process.cwd(), 'src/remotion/index.ts'),
    siteName: SITE,
  });
  console.log('  serveUrl:', serveUrl);

  console.log('\n=== Add these to .env.local ===');
  console.log('RENDER_BACKEND=lambda');
  console.log(`REMOTION_AWS_REGION=${region}`);
  console.log(`REMOTION_LAMBDA_FUNCTION_NAME=${functionName}`);
  console.log(`REMOTION_SERVE_URL=${serveUrl}`);
  console.log('# plus REMOTION_AWS_ACCESS_KEY_ID / REMOTION_AWS_SECRET_ACCESS_KEY');
}

main().catch((e) => {
  console.error('Lambda deploy failed:', e?.message || e);
  process.exit(1);
});
