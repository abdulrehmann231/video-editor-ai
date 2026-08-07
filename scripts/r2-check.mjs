/**
 * R2 access diagnostic. Runs against your local .env.local and tells you exactly
 * why the app gets `AccessDenied` on getObject — without printing any secrets.
 *
 *   node scripts/r2-check.mjs [projectId]
 *
 * Default projectId is the one from your error log (p_049f61e3d022).
 */
import { readFileSync } from 'node:fs';
import {
  S3Client,
  ListObjectsV2Command,
  HeadBucketCommand,
  GetObjectCommand,
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

const endpoint = process.env.R2_ENDPOINT;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucket = process.env.R2_BUCKET || 'edit-ai'; // schema default
const projectId = process.argv[2] || 'p_049f61e3d022';
const key = `projects/${projectId}.json`;

function mask(s) {
  if (!s) return '(MISSING)';
  if (s.length <= 8) return `${s[0]}***(len ${s.length})`;
  return `${s.slice(0, 4)}…${s.slice(-2)} (len ${s.length})`;
}

console.log('--- Resolved R2 config (sanitized) ---');
console.log('R2_ENDPOINT        :', endpoint || '(MISSING)');
console.log('R2_BUCKET          :', bucket, process.env.R2_BUCKET ? '' : '(defaulted — R2_BUCKET not set!)');
console.log('R2_ACCESS_KEY_ID   :', mask(accessKeyId));
console.log('R2_SECRET_ACCESS_KEY:', mask(secretAccessKey));
console.log('Object key         :', key);
console.log();

if (!endpoint || !accessKeyId || !secretAccessKey) {
  console.error('❌ Missing one of R2_ENDPOINT / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY in .env.local');
  process.exit(1);
}
if (/\/[^/]+\/?$/.test(new URL(endpoint).pathname)) {
  console.warn('⚠️  R2_ENDPOINT has a path — it must be https://<accountid>.r2.cloudflarestorage.com with NO bucket.\n');
}

const s3 = new S3Client({ region: 'auto', endpoint, credentials: { accessKeyId, secretAccessKey } });

function describe(err) {
  const name = err?.name || err?.Code || 'Unknown';
  const status = err?.$metadata?.httpStatusCode;
  return `${name}${status ? ` (HTTP ${status})` : ''}`;
}

async function step(label, fn) {
  try {
    const out = await fn();
    console.log(`✅ ${label}`);
    return out;
  } catch (err) {
    console.log(`❌ ${label} → ${describe(err)}`);
    return { __err: err };
  }
}

console.log('--- Running checks ---');
const head = await step(`HeadBucket "${bucket}" (are creds valid for this bucket?)`, () =>
  s3.send(new HeadBucketCommand({ Bucket: bucket })),
);
const list = await step(`ListObjects "${bucket}" (does the token grant read?)`, () =>
  s3.send(new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 5 })),
);
const get = await step(`GetObject "${key}" (the exact call the app makes)`, () =>
  s3.send(new GetObjectCommand({ Bucket: bucket, Key: key })),
);

console.log('\n--- Verdict ---');
const anyErr = (r) => r && r.__err;
if (!anyErr(head) && !anyErr(list) && !anyErr(get)) {
  console.log('🎉 All good — the app should be able to read this project. If the app still fails, it is reading a different R2_BUCKET/endpoint than this script (restart `npm run dev`).');
} else if (anyErr(head) || anyErr(list)) {
  console.log('🔑 Credentials or token PERMISSIONS problem (not a missing file):');
  console.log('   • Verify R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY are the CURRENT token (not rotated).');
  console.log('   • In Cloudflare → R2 → Manage API Tokens: the token needs Object Read on this bucket.');
  console.log('   • If the token is scoped to "Specific buckets", it must include:', bucket);
  console.log('   • Confirm R2_ENDPOINT is the right account id.');
} else if (anyErr(get)) {
  const e = get.__err;
  if (e?.name === 'NoSuchKey' || e?.$metadata?.httpStatusCode === 404) {
    console.log(`📄 Creds & bucket are fine, but the object "${key}" does not exist. Wrong project id, or it was never written.`);
  } else {
    console.log(`🔒 Bucket access works but GetObject was denied (${describe(e)}). The token likely lacks object-read on this prefix.`);
  }
}
