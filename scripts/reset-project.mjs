/**
 * Reset a project's stuck job status after you kill the dev server mid-run.
 *
 *   node scripts/reset-project.mjs <projectId>
 *
 * Jobs run in-process (see src/lib/pipeline/pipeline.ts). Killing the server
 * stops the work but leaves the persisted status on 'analyzing' / 'running' /
 * 'rendering' / 'deriving', which makes the API reject new runs with HTTP 409.
 * This flips any in-flight status back to 'idle' so you can start again.
 * No secrets are printed.
 */
import { readFileSync } from 'node:fs';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

function loadEnv(path) {
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
loadEnv('.env.local');
loadEnv('.env');

const id = process.argv[2];
if (!id) {
  console.error('Usage: node scripts/reset-project.mjs <projectId>');
  process.exit(1);
}

const endpoint = process.env.R2_ENDPOINT;
const bucket = process.env.R2_BUCKET || 'edit-ai';
const s3 = new S3Client({
  region: 'auto',
  endpoint,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const key = `projects/${id}.json`;

// status field -> the "busy" value that blocks re-runs
const BUSY = {
  deriveStatus: 'deriving',
  analysisStatus: 'analyzing',
  renderStatus: 'rendering',
  finalStatus: 'rendering',
  shortsStatus: 'rendering',
  pipelineStatus: 'running',
};

async function main() {
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const project = JSON.parse(await res.Body.transformToString());

  const changed = [];
  for (const [field, busy] of Object.entries(BUSY)) {
    if (project[field] === busy) {
      project[field] = 'idle';
      changed.push(field);
    }
  }
  if (project.pipelineStep && project.pipelineStep !== 'done') {
    project.pipelineStep = undefined;
    changed.push('pipelineStep');
  }
  if (!changed.length) {
    console.log(`Project ${id} has no in-flight status — nothing to reset.`);
    return;
  }
  project.pipelineError = 'Reset manually after stopping the server.';
  project.updatedAt = new Date().toISOString();

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: JSON.stringify(project),
      ContentType: 'application/json',
    }),
  );
  console.log(`Reset ${id}: ${changed.join(', ')} → idle. You can start a new run now.`);
}

main().catch((e) => {
  console.error('Reset failed:', e?.name || e?.message || e);
  process.exit(1);
});
