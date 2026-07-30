import {
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { r2, bucket } from '../r2';

/** S3/R2 multipart upload helpers for large (>5 GB) resumable uploads. */

export interface CompletedPart {
  PartNumber: number;
  ETag: string;
}

export async function createMultipart(key: string, contentType: string): Promise<string> {
  const res = await r2().send(
    new CreateMultipartUploadCommand({ Bucket: bucket(), Key: key, ContentType: contentType }),
  );
  if (!res.UploadId) throw new Error('R2 did not return an UploadId');
  return res.UploadId;
}

/** Presigned URL the browser PUTs one part to (returns an ETag header). */
export function signPart(
  key: string,
  uploadId: string,
  partNumber: number,
  expiresIn = 3600,
): Promise<string> {
  const cmd = new UploadPartCommand({
    Bucket: bucket(),
    Key: key,
    UploadId: uploadId,
    PartNumber: partNumber,
  });
  return getSignedUrl(r2(), cmd, { expiresIn });
}

export async function completeMultipart(
  key: string,
  uploadId: string,
  parts: CompletedPart[],
): Promise<void> {
  const sorted = [...parts].sort((a, b) => a.PartNumber - b.PartNumber);
  await r2().send(
    new CompleteMultipartUploadCommand({
      Bucket: bucket(),
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: sorted },
    }),
  );
}

export async function abortMultipart(key: string, uploadId: string): Promise<void> {
  try {
    await r2().send(
      new AbortMultipartUploadCommand({ Bucket: bucket(), Key: key, UploadId: uploadId }),
    );
  } catch {
    /* best-effort */
  }
}
