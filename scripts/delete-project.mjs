/**
 * Permanently delete a project and ALL its R2 objects (record, uploaded source,
 * proxy, mezzanine, renders) and remove it from the project index.
 *
 *   node scripts/delete-project.mjs <projectId>
 *   node scripts/delete-project.mjs <projectId> --dry-run   # list only, delete nothing
 *
 * Leaves the shared broll-cache/ alone. Irreversible — use --dry-run first.
 */
import { readFileSync } from 'node:fs';
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';

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
const dryRun = process.argv.includes('--dry-run');
if (!id || id.startsWith('--')) {
  console.error('Usage: node scripts/delete-project.mjs <projectId> [--dry-run]');
  process.exit(1);
}

const bucket = process.env.R2_BUCKET || 'edit-ai';
const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const recordKey = `projects/${id}.json`;
const INDEX_KEY = 'projects/_index.json';
const prefixes = [`uploads/${id}/`, `renders/${id}/`];

async function getJson(key) {
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    return JSON.parse(await res.Body.transformToString());
  } catch {
    return null;
  }
}

async function listPrefix(prefix) {
  const keys = [];
  let token;
  do {
    const res = await s3.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }),
    );
    for (const o of res.Contents ?? []) keys.push(o.Key);
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

async function main() {
  const project = await getJson(recordKey);
  if (!project) console.warn(`(no record at ${recordKey} — will still sweep prefixes)`);

  // Collect every key: prefix sweeps + explicit derived keys + the record.
  const set = new Set();
  for (const p of prefixes) for (const k of await listPrefix(p)) set.add(k);
  for (const f of ['proxyKey', 'mezzanineKey', 'renderKey', 'finalKey', 'shortsKey']) {
    if (project?.[f]) set.add(project[f]);
  }
  set.add(recordKey);
  const keys = [...set].filter((k) => k && !k.startsWith('broll-cache/'));

  console.log(`Project ${id}: ${keys.length} object(s) to delete:`);
  for (const k of keys) console.log('  -', k);

  if (dryRun) {
    console.log('\n--dry-run: nothing deleted.');
    return;
  }

  // Delete in batches of 1000 (S3 limit).
  for (let i = 0; i < keys.length; i += 1000) {
    const batch = keys.slice(i, i + 1000).map((Key) => ({ Key }));
    await s3.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: batch, Quiet: true } }));
  }

  // Remove from the project index.
  const ids = (await getJson(INDEX_KEY)) ?? [];
  const next = Array.isArray(ids) ? ids.filter((x) => x !== id) : ids;
  if (Array.isArray(ids) && next.length !== ids.length) {
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: INDEX_KEY,
        Body: JSON.stringify(next, null, 2),
        ContentType: 'application/json',
      }),
    );
    console.log('Removed from project index.');
  }

  console.log(`\n✅ Deleted ${keys.length} object(s) for project ${id}.`);
}

main().catch((e) => {
  console.error('Delete failed:', e?.name || e?.message || e);
  process.exit(1);
});
