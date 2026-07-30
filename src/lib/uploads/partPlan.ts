/**
 * Pure part-planning for S3/R2 multipart uploads.
 *
 * S3 rules: minimum part size 5 MiB (except the final part), maximum 10,000
 * parts. We pick a comfortable part size (default 64 MiB) and only grow it if a
 * file is so large it would exceed 10,000 parts.
 */

const MiB = 1024 * 1024;
export const MIN_PART = 5 * MiB;
export const MAX_PARTS = 10_000;
export const DEFAULT_PART = 64 * MiB;

export interface PartPlan {
  partSize: number;
  partCount: number;
}

export function planParts(fileSize: number, preferred = DEFAULT_PART): PartPlan {
  if (fileSize <= 0) return { partSize: MIN_PART, partCount: 1 };

  let partSize = Math.max(MIN_PART, preferred);
  if (Math.ceil(fileSize / partSize) > MAX_PARTS) {
    // Grow part size so we stay within the 10k-part ceiling, rounded up to MiB.
    partSize = Math.ceil(fileSize / MAX_PARTS / MiB) * MiB;
    partSize = Math.max(partSize, MIN_PART);
  }
  const partCount = Math.max(1, Math.ceil(fileSize / partSize));
  return { partSize, partCount };
}

/** Byte range [start, end) for a given 1-indexed part number. */
export function partRange(fileSize: number, partSize: number, partNumber: number): [number, number] {
  const start = (partNumber - 1) * partSize;
  const end = Math.min(fileSize, start + partSize);
  return [start, end];
}
