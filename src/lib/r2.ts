import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getEnv, publicBaseUrl } from './env';

let client: S3Client | null = null;

/** Lazily-constructed S3 client pointed at the Cloudflare R2 endpoint. */
export function r2(): S3Client {
  if (client) return client;
  const env = getEnv();
  client = new S3Client({
    region: 'auto', // R2 ignores region but the SDK requires one
    endpoint: env.R2_ENDPOINT,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });
  return client;
}

export function bucket(): string {
  return getEnv().R2_BUCKET;
}

/** Public URL for an object served via the R2 custom domain. */
export function publicUrl(key: string): string {
  const env = getEnv();
  return `${publicBaseUrl(env.R2_PUBLIC_HOST)}/${key.replace(/^\/+/, '')}`;
}

/** Presigned URL a browser can PUT directly to (bypasses our server for big files). */
export function presignPut(
  key: string,
  contentType: string,
  expiresIn = 3600,
): Promise<string> {
  const cmd = new PutObjectCommand({
    Bucket: bucket(),
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(r2(), cmd, { expiresIn });
}

/** Presigned GET (for feeding private objects to Gemini / the worker). */
export function presignGet(key: string, expiresIn = 3600): Promise<string> {
  const cmd = new GetObjectCommand({ Bucket: bucket(), Key: key });
  return getSignedUrl(r2(), cmd, { expiresIn });
}

export async function putObject(
  key: string,
  body: Uint8Array | Buffer | string,
  contentType?: string,
): Promise<void> {
  await r2().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

/**
 * Stream a local file to R2 without buffering it in memory (safe for large
 * derived files like the 1080p mezzanine). Uses a single PUT (up to 5 GB).
 */
export async function putFile(key: string, filePath: string, contentType?: string): Promise<void> {
  const { createReadStream, statSync } = await import('node:fs');
  const size = statSync(filePath).size;
  await r2().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: createReadStream(filePath),
      ContentLength: size,
      ContentType: contentType,
    }),
  );
}

/** Read a whole object into a Buffer. Returns null if it does not exist. */
export async function getObject(key: string): Promise<Buffer | null> {
  try {
    const res = await r2().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
    if (!res.Body) return null;
    const bytes = await res.Body.transformToByteArray();
    return Buffer.from(bytes);
  } catch (err: unknown) {
    if (isNotFound(err)) return null;
    throw err;
  }
}

export async function objectExists(key: string): Promise<boolean> {
  try {
    await r2().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
    return true;
  } catch (err: unknown) {
    if (isNotFound(err)) return false;
    throw err;
  }
}

export async function deleteObject(key: string): Promise<void> {
  await r2().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}

function isNotFound(err: unknown): boolean {
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
  return (
    e?.name === 'NotFound' ||
    e?.name === 'NoSuchKey' ||
    e?.$metadata?.httpStatusCode === 404
  );
}
